# backend/app/services/lifecycle.py
"""
Central Enterprise Lifecycle Management Service for EducationOS.
Manages:
1. User Deactivation, Soft-Deletion, Anonymization (GDPR/privacy-preserving), and Permanent Deletion.
2. Tenant Deactivation, Archival, and Permanent Cascading Deletion.
3. Dependency Mapping & Resolution (Zero foreign-key constraint violations).
4. Immutable Financial and Audit Trail Preservation.
"""
import uuid
import datetime
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.tenant import User, Tenant, Role
from app.models.users import Teacher
from app.models.guardian import Guardian, GuardianStudentLink
from app.models.student import Student
from app.models.audit import AuditLog
from app.models.finance import Invoice, FeePayment
from app.models.academic import AcademicSession, ClassModel
from app.models.curriculum import CurriculumDocument, CurriculumChunk
from app.models.admission import AdmissionApplication
from app.models.subscription import InstitutionSubscription
from app.models.workspace import WorkspaceMembership

logger = logging.getLogger("educationos.lifecycle")


def _ensure_uuid(val: Any) -> Any:
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError):
        return val


class LifecycleService:
    @staticmethod
    def get_user_dependencies(db: Session, tenant_id: str, user_id: uuid.UUID) -> Dict[str, Any]:
        """
        Inspects all records that reference this user across the database.
        Returns a structured dependency inventory.
        """
        uid = _ensure_uuid(user_id)
        t_uuid = _ensure_uuid(tenant_id)
        tid_str = str(tenant_id)

        user = db.query(User).filter(User.id == uid, User.tenant_id == t_uuid).first()
        if not user:
            return {"error": "User not found", "found": False}

        teacher_count = db.query(func.count(Teacher.id)).filter(Teacher.user_id == uid).scalar() or 0
        guardian_count = db.query(func.count(Guardian.id)).filter(Guardian.user_id == uid).scalar() or 0
        student_count = db.query(func.count(Student.id)).filter(Student.user_id == uid).scalar() or 0
        audit_count = db.query(func.count(AuditLog.id)).filter(AuditLog.actor_id == str(uid)).scalar() or 0
        workspace_count = db.query(func.count(WorkspaceMembership.id)).filter(
            WorkspaceMembership.user_id == str(uid)
        ).scalar() or 0

        return {
            "found": True,
            "user_id": str(user.id),
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "deleted_at": user.deleted_at.isoformat() if getattr(user, "deleted_at", None) else None,
            "dependencies": {
                "teacher_profiles": teacher_count,
                "guardian_profiles": guardian_count,
                "student_profiles": student_count,
                "audit_logs_authored": audit_count,
                "workspace_memberships": workspace_count,
            },
            "can_safely_soft_delete": True,
            "has_blocking_foreign_keys": teacher_count > 0,
            "recommended_action": "deactivate_or_soft_delete",
        }

    @staticmethod
    def deactivate_user(db: Session, tenant_id: str, user_id: uuid.UUID, actor_id: str) -> Dict[str, Any]:
        """
        Safely deactivates user account (prevents login, keeps all data intact).
        """
        uid = _ensure_uuid(user_id)
        t_uuid = _ensure_uuid(tenant_id)
        tid_str = str(tenant_id)

        user = db.query(User).filter(User.id == uid, User.tenant_id == t_uuid).first()
        if not user:
            return {"success": False, "error": "User not found"}

        user.is_active = False
        db.add(AuditLog(
            tenant_id=tid_str,
            actor_id=str(actor_id),
            action_type="user.deactivated",
            target_entity=f"User {user.email} ({user.id})",
            event_payload={"user_id": str(user.id), "previous_state": "active", "new_state": "deactivated"},
            risk_level="Medium"
        ))
        db.commit()
        return {"success": True, "user_id": str(user.id), "status": "deactivated", "is_active": False}

    @staticmethod
    def reactivate_user(db: Session, tenant_id: str, user_id: uuid.UUID, actor_id: str) -> Dict[str, Any]:
        """
        Reactivates a deactivated user account.
        """
        uid = _ensure_uuid(user_id)
        t_uuid = _ensure_uuid(tenant_id)
        tid_str = str(tenant_id)

        user = db.query(User).filter(User.id == uid, User.tenant_id == t_uuid).first()
        if not user:
            return {"success": False, "error": "User not found"}

        user.is_active = True
        user.deleted_at = None
        db.add(AuditLog(
            tenant_id=tid_str,
            actor_id=str(actor_id),
            action_type="user.reactivated",
            target_entity=f"User {user.email} ({user.id})",
            event_payload={"user_id": str(user.id), "status": "active"},
            risk_level="Medium"
        ))
        db.commit()
        return {"success": True, "user_id": str(user.id), "status": "active", "is_active": True}

    @staticmethod
    def soft_delete_user(db: Session, tenant_id: str, user_id: uuid.UUID, actor_id: str) -> Dict[str, Any]:
        """
        Performs soft deletion:
        Sets is_active=False and sets deleted_at timestamp.
        Cascades soft deletion to subordinate profiles while keeping audit trail intact.
        """
        uid = _ensure_uuid(user_id)
        t_uuid = _ensure_uuid(tenant_id)
        tid_str = str(tenant_id)

        user = db.query(User).filter(User.id == uid, User.tenant_id == t_uuid).first()
        if not user:
            return {"success": False, "error": "User not found"}

        now = datetime.datetime.now(datetime.timezone.utc)
        user.is_active = False
        user.deleted_at = now

        # Soft delete linked Teacher profile
        teacher = db.query(Teacher).filter(Teacher.user_id == uid).first()
        if teacher:
            teacher.deleted_at = now

        # Soft delete linked Guardian profile
        guardian = db.query(Guardian).filter(Guardian.user_id == uid).first()
        if guardian:
            guardian.deleted_at = now

        db.add(AuditLog(
            tenant_id=tid_str,
            actor_id=str(actor_id),
            action_type="user.soft_deleted",
            target_entity=f"User {user.email} ({user.id})",
            event_payload={"user_id": str(user.id), "deleted_at": now.isoformat()},
            risk_level="High"
        ))
        db.commit()
        return {"success": True, "user_id": str(user.id), "status": "soft_deleted", "deleted_at": now.isoformat()}

    @staticmethod
    def anonymize_user(db: Session, tenant_id: str, user_id: uuid.UUID, actor_id: str) -> Dict[str, Any]:
        """
        GDPR/Privacy-compliant User Anonymization:
        Irreversibly scrubs PII (name, email, phone) while preserving the UUID primary key
        so historical audit logs, fee ledgers, and academic grades maintain referential integrity.
        """
        uid = _ensure_uuid(user_id)
        t_uuid = _ensure_uuid(tenant_id)
        tid_str = str(tenant_id)

        user = db.query(User).filter(User.id == uid, User.tenant_id == t_uuid).first()
        if not user:
            return {"success": False, "error": "User not found"}

        hex_suffix = user.id.hex[:8]
        now = datetime.datetime.now(datetime.timezone.utc)
        user.email = f"anonymized_{hex_suffix}@educationos.internal"
        user.username = f"anon_{hex_suffix}"
        user.first_name = "Anonymized"
        user.last_name = "User"
        user.phone_number = None
        user.password_hash = "ANONYMIZED_REVOKED_ACCOUNT"
        user.is_active = False
        user.deleted_at = now

        # Also anonymize Teacher profile if present
        teacher = db.query(Teacher).filter(Teacher.user_id == uid).first()
        if teacher:
            teacher.first_name = "Anonymized"
            teacher.last_name = "Teacher"
            teacher.name_bn = None
            teacher.phone_number = None
            teacher.address = None
            teacher.emergency_contact = None
            teacher.deleted_at = now

        db.add(AuditLog(
            tenant_id=tid_str,
            actor_id=str(actor_id),
            action_type="user.anonymized",
            target_entity=f"User anonymized_{hex_suffix} ({user.id})",
            event_payload={"user_id": str(user.id), "anonymized_at": now.isoformat()},
            risk_level="High"
        ))
        db.commit()
        return {
            "success": True,
            "user_id": str(user.id),
            "status": "anonymized",
            "anonymized_email": user.email,
        }

    @staticmethod
    def delete_user_permanent(
        db: Session, tenant_id: str, user_id: uuid.UUID, actor_id: str, confirmed: bool = False
    ) -> Dict[str, Any]:
        """
        Permanently deletes a user from the database.
        Resolves all foreign-key dependencies explicitly:
        - Deletes or disassociates Teacher profile first.
        - Sets Guardian.user_id = None (SET NULL).
        - Sets Student.user_id = None (SET NULL).
        - Removes Workspace memberships.
        - Preserves AuditLogs (actor_id remains as historical string).
        """
        if not confirmed:
            return {
                "success": False,
                "error": "Permanent deletion requires explicit confirmation parameter 'confirmed=true'.",
            }

        uid = _ensure_uuid(user_id)
        t_uuid = _ensure_uuid(tenant_id)
        tid_str = str(tenant_id)

        user = db.query(User).filter(User.id == uid, User.tenant_id == t_uuid).first()
        if not user:
            return {"success": False, "error": "User not found"}

        user_email = user.email

        # 1. Handle Teacher dependency (Delete teacher first to avoid FK constraint on users.id)
        teacher = db.query(Teacher).filter(Teacher.user_id == uid).first()
        if teacher:
            db.delete(teacher)
            db.flush()

        # 2. Handle Guardian dependency (SET NULL)
        guardians = db.query(Guardian).filter(Guardian.user_id == uid).all()
        for g in guardians:
            g.user_id = None

        # 3. Handle Student dependency (SET NULL)
        students = db.query(Student).filter(Student.user_id == uid).all()
        for s in students:
            s.user_id = None

        # 4. Remove workspace memberships
        db.query(WorkspaceMembership).filter(WorkspaceMembership.user_id == str(uid)).delete(synchronize_session=False)

        # 5. Delete User record
        db.delete(user)

        # 6. Record in immutable audit log
        db.add(AuditLog(
            tenant_id=tid_str,
            actor_id=str(actor_id),
            action_type="user.permanently_deleted",
            target_entity=f"User {user_email} ({user_id})",
            event_payload={"deleted_user_id": str(user_id), "user_email": user_email},
            risk_level="Critical"
        ))
        db.commit()
        return {"success": True, "user_id": str(user_id), "status": "permanently_deleted"}

    @staticmethod
    def get_tenant_dependencies(db: Session, tenant_id: str) -> Dict[str, Any]:
        """
        Comprehensive inventory of all records belonging to a tenant.
        """
        t_uuid = _ensure_uuid(tenant_id)
        tid_str = str(tenant_id)

        tenant = db.query(Tenant).filter(Tenant.id == t_uuid).first()
        if not tenant:
            return {"error": "Tenant not found", "found": False}

        users_count = db.query(func.count(User.id)).filter(User.tenant_id == t_uuid).scalar() or 0
        students_count = db.query(func.count(Student.id)).filter(
            (Student.tenant_id == tid_str) | (Student.tenant_id == t_uuid)
        ).scalar() or 0
        teachers_count = db.query(func.count(Teacher.id)).filter(Teacher.tenant_id == t_uuid).scalar() or 0
        guardians_count = db.query(func.count(Guardian.id)).filter(
            (Guardian.tenant_id == tid_str) | (Guardian.tenant_id == t_uuid)
        ).scalar() or 0
        invoices_count = db.query(func.count(Invoice.id)).filter(Invoice.tenant_id == tid_str).scalar() or 0
        payments_count = db.query(func.count(FeePayment.id)).filter(FeePayment.tenant_id == tid_str).scalar() or 0
        sessions_count = db.query(func.count(AcademicSession.id)).filter(AcademicSession.tenant_id == t_uuid).scalar() or 0
        classes_count = db.query(func.count(ClassModel.id)).filter(ClassModel.tenant_id == t_uuid).scalar() or 0
        docs_count = db.query(func.count(CurriculumDocument.id)).filter(CurriculumDocument.tenant_id == tid_str).scalar() or 0
        audit_count = db.query(func.count(AuditLog.id)).filter(AuditLog.tenant_id == tid_str).scalar() or 0

        return {
            "found": True,
            "tenant_id": str(tenant.id),
            "school_name": tenant.school_name,
            "domain": tenant.domain,
            "is_active": getattr(tenant, "is_active", True),
            "deleted_at": tenant.deleted_at.isoformat() if getattr(tenant, "deleted_at", None) else None,
            "inventory": {
                "users": users_count,
                "students": students_count,
                "teachers": teachers_count,
                "guardians": guardians_count,
                "invoices": invoices_count,
                "fee_payments": payments_count,
                "academic_sessions": sessions_count,
                "classes": classes_count,
                "curriculum_documents": docs_count,
                "audit_logs": audit_count,
            },
            "retention_policy_note": "Financial invoices and audit logs are archived by default to preserve regulatory records.",
        }

    @staticmethod
    def archive_tenant(db: Session, tenant_id: str, actor_id: str) -> Dict[str, Any]:
        """
        Safely archives a school/tenant:
        - Sets is_active=False on Tenant and records deleted_at.
        - Deactivates all users under this tenant to block any further logins.
        - Suspends active subscription.
        - Preserves all records for historical audit and regulatory compliance.
        """
        t_uuid = _ensure_uuid(tenant_id)
        tid_str = str(tenant_id)

        tenant = db.query(Tenant).filter(Tenant.id == t_uuid).first()
        if not tenant:
            return {"success": False, "error": "Tenant not found"}

        now = datetime.datetime.now(datetime.timezone.utc)
        tenant.is_active = False
        tenant.deleted_at = now

        # Deactivate all users for this tenant
        db.query(User).filter(User.tenant_id == t_uuid).update({"is_active": False, "deleted_at": now})

        # Suspend subscription
        sub = db.query(InstitutionSubscription).filter(InstitutionSubscription.tenant_id == tid_str).first()
        if sub:
            sub.subscription_status = "ARCHIVED"

        db.add(AuditLog(
            tenant_id=tid_str,
            actor_id=str(actor_id),
            action_type="tenant.archived",
            target_entity=f"Tenant {tenant.school_name} ({tenant.id})",
            event_payload={"tenant_id": tid_str, "archived_at": now.isoformat()},
            risk_level="Critical"
        ))
        db.commit()
        return {"success": True, "tenant_id": tid_str, "status": "archived", "archived_at": now.isoformat()}

    @staticmethod
    def delete_tenant_permanent(
        db: Session, tenant_id: str, actor_id: str, confirmed: bool = False
    ) -> Dict[str, Any]:
        """
        Permanently cascades and deletes a tenant and its subordinate rows.
        Order of deletion respects foreign-key constraints:
        1. Curriculum chunks & documents
        2. Fee payments & Invoices
        3. Student-Guardian links, Guardians, Students
        4. Teachers
        5. Classes & Academic sessions
        6. Users & Roles
        7. Subscriptions
        8. Tenant
        """
        if not confirmed:
            return {
                "success": False,
                "error": "Permanent tenant deletion requires explicit confirmation parameter 'confirmed=true'.",
            }

        t_uuid = _ensure_uuid(tenant_id)
        tid_str = str(tenant_id)

        tenant = db.query(Tenant).filter(Tenant.id == t_uuid).first()
        if not tenant:
            return {"success": False, "error": "Tenant not found"}

        school_name = tenant.school_name

        try:
            # 1. Curriculum
            doc_ids = [d.id for d in db.query(CurriculumDocument.id).filter(CurriculumDocument.tenant_id == tid_str).all()]
            if doc_ids:
                db.query(CurriculumChunk).filter(CurriculumChunk.document_id.in_(doc_ids)).delete(synchronize_session=False)
            db.query(CurriculumDocument).filter(CurriculumDocument.tenant_id == tid_str).delete(synchronize_session=False)

            # 2. Finance
            db.query(FeePayment).filter(FeePayment.tenant_id == tid_str).delete(synchronize_session=False)
            db.query(Invoice).filter(Invoice.tenant_id == tid_str).delete(synchronize_session=False)

            # 3. Admissions
            db.query(AdmissionApplication).filter(AdmissionApplication.tenant_id == tid_str).delete(synchronize_session=False)

            # 4. Teachers, Guardians, Students
            db.query(Teacher).filter(Teacher.tenant_id == t_uuid).delete(synchronize_session=False)
            db.query(GuardianStudentLink).filter(GuardianStudentLink.tenant_id == tid_str).delete(synchronize_session=False)
            db.query(Guardian).filter((Guardian.tenant_id == tid_str) | (Guardian.tenant_id == t_uuid)).delete(synchronize_session=False)
            db.query(Student).filter((Student.tenant_id == tid_str) | (Student.tenant_id == t_uuid)).delete(synchronize_session=False)

            # 5. Academic structure
            db.query(ClassModel).filter(ClassModel.tenant_id == t_uuid).delete(synchronize_session=False)
            db.query(AcademicSession).filter(AcademicSession.tenant_id == t_uuid).delete(synchronize_session=False)

            # 6. Users & Roles
            db.query(User).filter(User.tenant_id == t_uuid).delete(synchronize_session=False)
            db.query(Role).filter(Role.tenant_id == t_uuid).delete(synchronize_session=False)

            # 7. Subscriptions
            db.query(InstitutionSubscription).filter(InstitutionSubscription.tenant_id == tid_str).delete(synchronize_session=False)

            # 8. Tenant entity
            db.delete(tenant)

            # 9. Record in root control plane audit
            db.add(AuditLog(
                tenant_id="c0000000-0000-0000-0000-000000000001",
                actor_id=str(actor_id),
                action_type="tenant.permanently_deleted",
                target_entity=f"Tenant {school_name} ({tid_str})",
                event_payload={"tenant_id": tid_str, "school_name": school_name},
                risk_level="Critical"
            ))
            db.commit()
            return {"success": True, "tenant_id": tid_str, "status": "permanently_deleted"}

        except Exception as err:
            db.rollback()
            logger.error(f"Failed to permanently delete tenant {tid_str}: {err}", exc_info=True)
            return {"success": False, "error": str(err)}
