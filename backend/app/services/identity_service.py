# backend/app/services/identity_service.py
import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.security import get_password_hash
from app.models.auth import AccountInvitation, RefreshTokenSession
from app.models.tenant import User
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink
from app.models.users import Teacher
from app.models.audit import AuditLog


class IdentityService:
    """
    Centralized Identity and Access Management (IAM) Service for EducationOS.
    Manages account provisioning, single-use activation invitations, and verified relationship lifecycles.
    """

    @staticmethod
    def _hash_token(raw_token: str) -> str:
        """Computes SHA-256 hash of activation token for zero-knowledge storage."""
        return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()

    @classmethod
    def generate_activation_invitation(
        cls,
        db: Session,
        tenant_id: str,
        target_role: str,
        identifier: str,
        user_id: Optional[uuid.UUID] = None,
        student_id: Optional[uuid.UUID] = None,
        guardian_id: Optional[uuid.UUID] = None,
        created_by_user_id: Optional[str] = None,
        validity_hours: int = 72,
    ) -> Tuple[str, AccountInvitation]:
        """
        Generates a 256-bit cryptographically secure activation token.
        Invalidates any prior unconsumed invitations for this student/guardian.
        """
        tid = str(tenant_id)
        raw_token = secrets.token_urlsafe(32)
        token_hash = cls._hash_token(raw_token)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=validity_hours)

        # 1. Supersede previous unconsumed invitations
        if student_id:
            db.query(AccountInvitation).filter(
                AccountInvitation.tenant_id == tid,
                AccountInvitation.student_id == student_id,
                AccountInvitation.is_consumed == False,
            ).update({"is_consumed": True, "consumed_at": now}, synchronize_session=False)

        if guardian_id:
            db.query(AccountInvitation).filter(
                AccountInvitation.tenant_id == tid,
                AccountInvitation.guardian_id == guardian_id,
                AccountInvitation.is_consumed == False,
            ).update({"is_consumed": True, "consumed_at": now}, synchronize_session=False)

        # 2. Record new invitation hash
        invitation = AccountInvitation(
            tenant_id=tid,
            user_id=user_id,
            student_id=student_id,
            guardian_id=guardian_id,
            target_role=target_role,
            identifier=identifier,
            token_hash=token_hash,
            is_consumed=False,
            expires_at=expires_at,
            created_by_user_id=created_by_user_id,
            created_at=now,
        )
        db.add(invitation)
        db.flush()
        return raw_token, invitation

    @classmethod
    def activate_account(cls, db: Session, token: str, new_password: str) -> dict:
        """
        Consumes an activation token, verifies constraints, and establishes permanent password.
        """
        if not token or len(token.strip()) < 16:
            raise HTTPException(status_code=400, detail="Invalid or malformed activation token.")

        # Password complexity validation
        if len(new_password) < 8 or not re.search(r"[A-Za-z]", new_password) or not re.search(r"\d", new_password):
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 8 characters long and contain both letters and numbers."
            )

        token_hash = cls._hash_token(token)
        now = datetime.now(timezone.utc)

        invitation = db.query(AccountInvitation).filter(
            AccountInvitation.token_hash == token_hash,
        ).first()

        if not invitation:
            raise HTTPException(status_code=400, detail="Invalid or expired activation invitation.")

        if invitation.is_consumed:
            raise HTTPException(
                status_code=400,
                detail="This activation invitation has already been consumed. Please request a new invitation."
            )

        exp_at = invitation.expires_at
        if exp_at.tzinfo is None:
            exp_at = exp_at.replace(tzinfo=timezone.utc)
        if exp_at < now:
            raise HTTPException(
                status_code=400,
                detail="This activation invitation has expired. Please contact school administration for a new invitation."
            )

        # Resolve associated User record strictly inside invitation tenant
        user = None
        try:
            tenant_uuid = uuid.UUID(str(invitation.tenant_id)) if invitation.tenant_id else None
        except (ValueError, TypeError):
            tenant_uuid = invitation.tenant_id

        if invitation.user_id:
            user = db.query(User).filter(User.id == invitation.user_id, User.tenant_id == tenant_uuid).first()
        elif invitation.student_id:
            student = db.query(Student).filter(Student.id == invitation.student_id, Student.tenant_id == str(invitation.tenant_id)).first()
            if student and student.user_id:
                user = db.query(User).filter(User.id == student.user_id, User.tenant_id == tenant_uuid).first()
        elif invitation.guardian_id:
            guardian = db.query(Guardian).filter(Guardian.id == invitation.guardian_id, Guardian.tenant_id == str(invitation.tenant_id)).first()
            if guardian and guardian.user_id:
                user = db.query(User).filter(User.id == guardian.user_id, User.tenant_id == tenant_uuid).first()

        if not user:
            raise HTTPException(status_code=404, detail="User account associated with this invitation was not found.")

        # Establish permanent password, activate user, and revoke prior sessions
        user.password_hash = get_password_hash(new_password)
        user.is_active = True
        user.must_change_password = False
        cls.revoke_user_sessions(db=db, tenant_id=str(invitation.tenant_id), user_id=str(user.id))

        # Mark invitation consumed
        invitation.is_consumed = True
        invitation.consumed_at = now

        # Write audit log
        audit = AuditLog(
            tenant_id=invitation.tenant_id,
            actor_id=str(user.id),
            action_type="account.activated",
            target_entity=f"User {user.id}",
            event_payload={
                "target_role": invitation.target_role,
                "identifier": invitation.identifier,
                "activated_at": now.isoformat(),
            },
            risk_level="Low"
        )
        db.add(audit)
        db.commit()

        return {
            "status": "success",
            "message": "Account activated successfully. You can now sign in with your permanent password.",
            "role": invitation.target_role,
            "username": getattr(user, "username", None) or user.email,
        }

    @classmethod
    def provision_student_account(
        cls,
        db: Session,
        tenant_id: str,
        student_id: uuid.UUID,
        created_by_user_id: Optional[str] = None
    ) -> Tuple[User, str]:
        """
        Idempotently provisions a User account for an academic Student record
        and generates an activation invitation token.
        """
        tid = str(tenant_id)
        student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == tid).first()
        if not student:
            raise HTTPException(status_code=404, detail="Student record not found.")

        user = None
        if student.user_id:
            user = db.query(User).filter(User.id == student.user_id, User.tenant_id == tid).first()

        # Format canonical student username: STD-<admission_number>
        clean_adm = re.sub(r"[^A-Za-z0-9_-]+", "", student.admission_number).upper()
        username = clean_adm
        email = f"{clean_adm.lower()}-{tid[:8]}@students.internal"

        if not user:
            # Check if an existing *student* user matches username/email (never collide/hijack staff role)
            existing = db.query(User).filter(
                User.tenant_id == tid,
                func.lower(User.role) == "student",
                (User.email == email) | (User.username == username)
            ).first()

            if existing:
                user = existing
                student.user_id = user.id
            else:
                user = User(
                    tenant_id=tid,
                    email=email,
                    username=username,
                    password_hash=get_password_hash(secrets.token_urlsafe(32)),
                    first_name=student.first_name,
                    last_name=student.last_name,
                    role="student",
                    is_active=False,
                    must_change_password=True,
                )
                db.add(user)
                db.flush()
                student.user_id = user.id
        else:
            if not user.username:
                user.username = username

        raw_token, inv = cls.generate_activation_invitation(
            db=db,
            tenant_id=tid,
            target_role="student",
            identifier=username,
            user_id=user.id,
            student_id=student.id,
            created_by_user_id=created_by_user_id,
        )
        db.commit()
        return user, raw_token

    @classmethod
    def provision_guardian_account(
        cls,
        db: Session,
        tenant_id: str,
        guardian_id: uuid.UUID,
        created_by_user_id: Optional[str] = None
    ) -> Tuple[User, str]:
        """
        Idempotently provisions an independent User account for a Guardian profile
        and generates an activation invitation token.
        """
        tid = str(tenant_id)
        guardian = db.query(Guardian).filter(Guardian.id == guardian_id, Guardian.tenant_id == tid).first()
        if not guardian:
            raise HTTPException(status_code=404, detail="Guardian record not found.")

        user = None
        if guardian.user_id:
            user = db.query(User).filter(User.id == guardian.user_id, User.tenant_id == tid).first()

        clean_phone = re.sub(r"\D+", "", guardian.phone_number or "")[-11:]
        email = guardian.email or f"guardian-{clean_phone}-{tid[:8]}@guardians.internal"

        if not user:
            # Check existing *guardian* user by phone or email (never collide/hijack staff role)
            existing = db.query(User).filter(
                User.tenant_id == tid,
                func.lower(User.role) == "guardian",
                (User.email == email) | (User.phone_number == clean_phone)
            ).first()

            if existing:
                user = existing
                guardian.user_id = user.id
            else:
                user = User(
                    tenant_id=tid,
                    email=email,
                    phone_number=clean_phone if len(clean_phone) >= 10 else None,
                    username=clean_phone if len(clean_phone) >= 10 else f"G-{uuid.uuid4().hex[:6]}",
                    password_hash=get_password_hash(secrets.token_urlsafe(32)),
                    first_name=guardian.first_name,
                    last_name=guardian.last_name or "",
                    role="guardian",
                    is_active=False,
                    must_change_password=True,
                )
                db.add(user)
                db.flush()
                guardian.user_id = user.id
        else:
            if not user.phone_number and len(clean_phone) >= 10:
                user.phone_number = clean_phone

        raw_token, inv = cls.generate_activation_invitation(
            db=db,
            tenant_id=tid,
            target_role="guardian",
            identifier=clean_phone or email,
            user_id=user.id,
            guardian_id=guardian.id,
            created_by_user_id=created_by_user_id,
        )
        db.commit()
        return user, raw_token

    @classmethod
    def provision_teacher_account(
        cls,
        db: Session,
        tenant_id: str,
        teacher_id: uuid.UUID,
        created_by_user_id: Optional[str] = None
    ) -> Tuple[User, str]:
        """
        Idempotently provisions an independent User account for a Teacher profile
        and generates a single-use activation invitation token.
        """
        tid = str(tenant_id)
        try:
            t_uuid = uuid.UUID(tid)
        except Exception:
            t_uuid = tid

        teacher = db.query(Teacher).filter(Teacher.id == teacher_id, Teacher.tenant_id == t_uuid).first()
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher record not found.")

        user = None
        if teacher.user_id:
            user = db.query(User).filter(User.id == teacher.user_id, User.tenant_id == t_uuid).first()

        clean_phone = re.sub(r"\D+", "", teacher.phone_number or "")[-11:]
        email = teacher.email or f"teacher-{clean_phone or teacher_id.hex[:6]}-{tid[:8]}@staff.internal"

        if not user:
            existing = db.query(User).filter(
                User.tenant_id == t_uuid,
                func.lower(User.role) == "teacher",
                (User.email == email) | (User.phone_number == clean_phone)
            ).first()

            if existing:
                user = existing
                teacher.user_id = user.id
            else:
                user = User(
                    tenant_id=t_uuid,
                    email=email,
                    phone_number=clean_phone if len(clean_phone) >= 10 else None,
                    username=f"T-{clean_phone or teacher.employee_id or teacher_id.hex[:6]}",
                    password_hash=get_password_hash(secrets.token_urlsafe(32)),
                    first_name=teacher.first_name,
                    last_name=teacher.last_name or "",
                    role="teacher",
                    is_active=False,
                    must_change_password=True,
                )
                db.add(user)
                db.flush()
                teacher.user_id = user.id
        else:
            if not user.phone_number and len(clean_phone) >= 10:
                user.phone_number = clean_phone

        raw_token, inv = cls.generate_activation_invitation(
            db=db,
            tenant_id=tid,
            target_role="teacher",
            identifier=clean_phone or email,
            user_id=user.id,
            created_by_user_id=created_by_user_id,
        )
        db.commit()
        return user, raw_token

    @classmethod
    def revoke_user_sessions(cls, db: Session, tenant_id: str, user_id: str) -> int:
        """Revokes all active refresh token sessions for a user in the tenant."""
        now = datetime.now(timezone.utc)
        return (
            db.query(RefreshTokenSession)
            .filter(
                RefreshTokenSession.tenant_id == str(tenant_id),
                RefreshTokenSession.user_id == str(user_id),
                RefreshTokenSession.revoked == False,
            )
            .update({"revoked": True, "revoked_at": now}, synchronize_session=False)
        )

    @classmethod
    def get_invitation_status(cls, db: Session, raw_token: str) -> dict:
        """Inspects an activation token without consuming it."""
        if not raw_token or len(raw_token.strip()) < 16:
            return {"valid": False, "status": "INVALID", "detail": "Invalid token format."}

        inv = db.query(AccountInvitation).filter(
            AccountInvitation.token_hash == cls._hash_token(raw_token)
        ).first()
        if not inv:
            return {"valid": False, "status": "NOT_FOUND", "detail": "Invitation not found."}

        now = datetime.now(timezone.utc)
        exp_at = inv.expires_at
        if exp_at.tzinfo is None:
            exp_at = exp_at.replace(tzinfo=timezone.utc)

        if inv.is_consumed:
            return {"valid": False, "status": "CONSUMED_OR_REVOKED", "detail": "Invitation already used or revoked."}
        if exp_at < now:
            return {"valid": False, "status": "EXPIRED", "detail": "Invitation has expired."}

        return {
            "valid": True,
            "status": "PENDING",
            "target_role": inv.target_role,
            "identifier": inv.identifier,
            "expires_at": exp_at.isoformat(),
        }

