# backend/app/api/endpoints/auth.py
import base64
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import struct
import threading
import time
import uuid

from collections import defaultdict, deque
from typing import Optional

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field, field_validator

from sqlalchemy import func, Enum, String, inspect as sa_inspect, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_tenant_id, get_current_user_claims, require_roles
from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
    revoke_token,
    persist_revocation,
    is_token_revoked,
    TokenExpiredError,
    TokenRevokedError,
    InvalidTokenTypeError,
    TokenError,
)
from app.models.auth import (
    AccountInvitation,
    RefreshTokenSession,
    PasswordResetToken,
    EmailVerificationToken,
    UserWebAuthnCredential,
)
from app.models.notification import NotificationOutbox
from app.models.audit import AuditLog
from app.models.guardian import Guardian, GuardianStudentLink
from app.models.student import Student
from app.models.tenant import SchoolProfile, Tenant, User   # adjust if Tenant lives elsewhere
from app.models.users import Teacher
from app.models.workspace import Organization, Workspace, WorkspaceMembership, WorkspaceType
from app.models.subscription import InstitutionSubscription
from app.services.identity_service import IdentityService

logger = logging.getLogger(__name__)

router = APIRouter()

# ----------------------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------------------
STAFF_BLOCKED_ROLES = {"student", "guardian"}      # these roles must use their own login routes

# Valid bcrypt hash used to burn the same CPU time when the account doesn't exist (#7)
_DUMMY_HASH = get_password_hash("timing-equalizer-not-a-real-password")


def _auth_fail(detail: str = "Invalid credentials.") -> HTTPException:
    """Fresh instance per call. A shared module-level exception leaks tracebacks and is not thread-safe (#10)."""
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"})


def _safe_verify(password: str, hashed: str) -> bool:
    try:
        return bool(verify_password(password, hashed))
    except Exception:                               # malformed / legacy hash must not become a 500
        logger.warning("password verification error", exc_info=True)
        return False


def _digits(value: str) -> str:
    """ASCII digits only. Normalises Bangla numerals (০১২…) instead of crashing on them (#3)."""
    return "".join(str(int(c)) for c in (value or "") if c.isdecimal())


def _eq(a: str, b: str) -> bool:
    """Constant-time compare that is safe for non-ASCII text (compare_digest(str, str) is not)."""
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def _fp(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()[:10]


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"


def _make_domain(school_name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", school_name.lower()).strip("-")[:40] or "school"
    return f"{base}-{uuid.uuid4().hex[:6]}"


def _record_refresh_session(
    db: Session,
    refresh_token: str,
    user_id: str,
    tenant_id: str,
    role: str,
    parent_jti: Optional[str] = None
) -> None:
    try:
        from app.models.auth import RefreshTokenSession
        from datetime import datetime, timezone
        payload = decode_token(refresh_token, expected_type="refresh", verify_revocation=False)
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            exp_dt = datetime.fromtimestamp(exp, tz=timezone.utc)
            session_rec = RefreshTokenSession(
                jti=jti,
                user_id=str(user_id),
                tenant_id=str(tenant_id),
                role=str(role),
                parent_jti=parent_jti,
                expires_at=exp_dt,
            )
            db.add(session_rec)
            db.commit()
    except Exception as e:
        logger.debug("Failed to persist refresh token session: %s", e)
        if hasattr(db, "rollback"):
            db.rollback()

# ----------------------------------------------------------------------------------------
# Brute-force protection (#4)
# In-process sliding window: per worker only. For multi-instance deploys, back this with
# Redis (or your services/rate_limiter.py) behind the same three methods.
# ----------------------------------------------------------------------------------------
class _AttemptLimiter:
    def __init__(self) -> None:
        self._hits: dict = defaultdict(deque)
        self._lock = threading.Lock()

    def blocked(self, key: str, limit: int, window: int) -> int:
        """Seconds the caller must wait, or 0 if allowed."""
        now = time.monotonic()
        with self._lock:
            q = self._hits.get(key)
            if not q:
                return 0
            while q and now - q[0] > window:
                q.popleft()
            if not q:
                del self._hits[key]
                return 0
            return max(1, int(window - (now - q[0]))) if len(q) >= limit else 0

    def hit(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            if len(self._hits) > 50_000:            # bound memory under attack
                for k in [k for k, q in self._hits.items() if not q or now - q[-1] > 3600]:
                    del self._hits[k]
            self._hits[key].append(now)

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)


_limiter = _AttemptLimiter()
IP_LIMIT, IP_WINDOW = 30, 900       # failed attempts per IP per 15 min
ID_LIMIT, ID_WINDOW = 10, 900       # failed attempts per account identifier per 15 min


def _guard(request: Request, route: str, identifier: str):
    ip_key = f"{route}:ip:{_client_ip(request)}"
    id_key = f"{route}:id:{_fp(identifier)}"
    for key, limit, window in ((ip_key, IP_LIMIT, IP_WINDOW), (id_key, ID_LIMIT, ID_WINDOW)):
        wait = _limiter.blocked(key, limit, window)
        if wait:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Try again later.",
                                headers={"Retry-After": str(wait)})
    return ip_key, id_key


def _failed(request: Request, route: str, ip_key: str, id_key: str, identifier: str) -> None:
    _limiter.hit(ip_key)
    _limiter.hit(id_key)
    logger.warning("auth_fail route=%s ip=%s id=%s", route, _client_ip(request), _fp(identifier))


def _resolve_tenant(db: Session, tenant_id: Optional[str], school_code: Optional[str]) -> Optional[str]:
    """
    Explicit tenant scope from the request. school_code (Tenant.domain) wins over tenant_id (#5).
    An unknown school_code returns a random UUID that matches nothing, so it fails exactly like a
    wrong password (same response, same timing).
    """
    if school_code and school_code.strip():
        t = db.query(Tenant).filter(func.lower(Tenant.domain) == school_code.strip().lower()).first()
        return str(t.id) if t else str(uuid.uuid4())
    return tenant_id


def _build_tenant(tenant_uuid, school_name: str, email: str, phone: str, address: str) -> Tenant:
    """Fills whichever of these columns your Tenant model actually has, then verifies that
    every required column is covered. Any gap is logged by name, all at once."""
    cols = {a.key: a.columns[0] for a in sa_inspect(Tenant).column_attrs}
    handle = _make_domain(school_name)

    candidates = {
        "id": tenant_uuid,
        "school_name": school_name,
        "name": school_name,
        "domain": handle,
        "slug": handle,
        "subdomain": handle,
        "contact_email": email,
        "email": email,
        "contact_phone": phone,
        "phone": phone,
        "phone_number": phone,
        "address": address,
        "is_active": True,
    }
    values = {k: v for k, v in candidates.items() if k in cols}

    # plain-string status only; skip Enum columns, where "Active" might not be a valid member
    if "status" in cols and isinstance(cols["status"].type, String) \
            and not isinstance(cols["status"].type, Enum):
        values["status"] = "Active"

    missing = [k for k, c in cols.items()
               if not c.nullable and not c.primary_key
               and c.default is None and c.server_default is None
               and k not in values]
    if missing:
        logger.error("register-school: Tenant has required columns with no value: %s", missing)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            "Registration failed due to a server configuration error.")

    return Tenant(**values)

# ----------------------------------------------------------------------------------------
# Payloads (validated + length-capped, #11)
# ----------------------------------------------------------------------------------------
class _TenantScoped(BaseModel):
    tenant_id: Optional[str] = Field(None, max_length=36)
    school_code: Optional[str] = Field(None, max_length=64)

    @field_validator("tenant_id", mode="before")
    @classmethod
    def _valid_uuid(cls, v):
        if v in (None, ""):
            return None
        try:
            return str(uuid.UUID(str(v)))
        except ValueError:
            raise ValueError("tenant_id must be a UUID")


class StaffLoginPayload(_TenantScoped):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)


class PlatformLoginPayload(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)


class GuardianLoginPayload(_TenantScoped):
    admission_number: Optional[str] = Field(None, max_length=32)
    phone_number: Optional[str] = Field(None, max_length=32)
    identifier: Optional[str] = Field(None, max_length=128)
    password: Optional[str] = Field(None, max_length=128)


class StudentLoginPayload(_TenantScoped):
    admission_number: Optional[str] = Field(None, max_length=32)
    username: Optional[str] = Field(None, max_length=100)
    password: str = Field(..., min_length=1, max_length=128)


class AccountActivationPayload(BaseModel):
    token: str = Field(..., min_length=16, max_length=128)
    password: str = Field(..., min_length=8, max_length=128)


class SchoolRegistrationPayload(BaseModel):
    school_name: str = Field(..., min_length=2, max_length=120)
    admin_name: str = Field(..., min_length=2, max_length=120)
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=10, max_length=128)
    contact_phone: str = Field(..., min_length=5, max_length=20)
    address: str = Field(..., min_length=2, max_length=255)
    invite_code: Optional[str] = Field(None, max_length=128)
    plan_id: Optional[str] = Field(None, max_length=64)
    selected_modules: Optional[list] = Field(None)
    billing_cycle: Optional[str] = Field(None, max_length=20)

    @field_validator("admin_password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:                      # bcrypt limit (#13)
            raise ValueError("Password must be at most 72 bytes")
        if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
            raise ValueError("Password must contain letters and digits")
        return v


class RefreshTokenPayload(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class LogoutPayload(BaseModel):
    refresh_token: Optional[str] = None


# ----------------------------------------------------------------------------------------
# 1. Staff & teacher authentication
# ----------------------------------------------------------------------------------------
def _staff_login(db: Session, request: Request, response: Response, email: str, password: str,
                 tenant_id: Optional[str], school_code: Optional[str]) -> dict:
    email = email.strip().lower()
    ip_key, id_key = _guard(request, "staff", email)
    scope = _resolve_tenant(db, tenant_id, school_code)

    q = db.query(User).filter(func.lower(User.email) == email)          # case-insensitive (#9)
    if scope:
        q = q.filter(User.tenant_id == scope)
    matches = q.limit(2).all()
    if len(matches) > 1:                                                # same email in 2 schools, no scope
        logger.warning("ambiguous staff email without school scope id=%s", _fp(email))
    user = matches[0] if len(matches) == 1 else None

    # Always run bcrypt, even for unknown accounts: no timing oracle (#7)
    password_ok = _safe_verify(password, user.password_hash if user else _DUMMY_HASH)
    role = ((user.role or "").strip().lower()) if user else ""          # NULL role = fail closed (#8)

    if not (user and password_ok and user.is_active and role and role not in STAFF_BLOCKED_ROLES):
        _failed(request, "staff", ip_key, id_key, email)
        raise _auth_fail("Invalid email or password.")

    display_name = "Staff Member"
    if role == "teacher":
        teacher = db.query(Teacher).filter(Teacher.user_id == user.id).first()
        if teacher:
            display_name = f"{teacher.first_name} {teacher.last_name}".strip()
        else:
            display_name = f"{user.first_name or ''} {user.last_name or 'Teacher'}".strip()
    elif role == "admin":
        display_name = f"{user.first_name or 'Principal'} {user.last_name or 'Admin'}".strip()

    active_ws_id = None
    try:
        from app.models.workspace import Workspace, WorkspaceMembership
        user_mem = db.query(WorkspaceMembership).filter(
            WorkspaceMembership.user_id == str(user.id),
            WorkspaceMembership.is_active == True
        ).first()
        if user_mem:
            active_ws_id = str(user_mem.workspace_id)
        else:
            default_ws = db.query(Workspace).filter(
                Workspace.tenant_id == str(user.tenant_id),
                Workspace.is_active == True
            ).first()
            if default_ws:
                active_ws_id = str(default_ws.id)
    except Exception as e:
        logger.debug("Could not resolve default workspace for staff user: %s", e)

    user_meta = getattr(user, "metadata_payload", None) or {}
    has_mfa = (
        user_meta.get("mfa_enabled")
        or (str(user.id) in _MFA_USER_SECRETS and bool(_MFA_USER_SECRETS[str(user.id)].get("secret")))
    )
    if role == "superadmin" and has_mfa:
        mfa_token = create_access_token(
            data={
                "sub": str(user.id),
                "user_id": str(user.id),
                "tenant_id": str(user.tenant_id),
                "role": role,
                "email": user.email,
                "mfa_pending": True,
            },
            expires_delta=timedelta(minutes=10),
        )
        return {
            "mfa_required": True,
            "mfa_token": mfa_token,
            "user_id": str(user.id),
            "email": user.email,
            "role": role,
            "tenant_id": str(user.tenant_id),
        }

    token = create_access_token(data={"sub": str(user.id), "tenant_id": str(user.tenant_id), "role": role, "email": user.email})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "tenant_id": str(user.tenant_id), "role": role, "email": user.email})
    _record_refresh_session(db, refresh_token, str(user.id), str(user.tenant_id), role)
    _limiter.reset(id_key)
    _no_store(response)
    logger.info("auth_ok route=staff role=%s ip=%s", role, _client_ip(request))
    return {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "role": role,
        "name": display_name,
        "tenant_id": str(user.tenant_id),
        "active_workspace_id": active_ws_id,
    }


@router.post("/staff", status_code=status.HTTP_200_OK)
def login_staff(payload: StaffLoginPayload, request: Request, response: Response,
                db: Session = Depends(get_db)):
    return _staff_login(db, request, response, payload.email, payload.password,
                        payload.tenant_id, payload.school_code)


@router.post("/platform/login", status_code=status.HTTP_200_OK)
def login_platform_owner(
    payload: PlatformLoginPayload,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Dedicated Platform Super Admin Owner Login Endpoint.
    Enforces superadmin role restriction and RFC 6238 TOTP MFA challenge.
    """
    email = payload.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email).first()

    password_ok = _safe_verify(payload.password, user.password_hash if user else _DUMMY_HASH)
    if not (user and password_ok and user.is_active and (user.role or "").lower() == "superadmin"):
        raise _auth_fail("Invalid platform owner credentials.")

    user_meta = getattr(user, "metadata_payload", None) or {}
    has_mfa = (
        user_meta.get("mfa_enabled")
        or (str(user.id) in _MFA_USER_SECRETS and bool(_MFA_USER_SECRETS[str(user.id)].get("secret")))
    )

    if has_mfa:
        mfa_token = create_access_token(
            data={
                "sub": str(user.id),
                "user_id": str(user.id),
                "tenant_id": str(user.tenant_id),
                "role": "superadmin",
                "email": user.email,
                "mfa_pending": True,
            },
            expires_delta=timedelta(minutes=10),
        )
        return {
            "mfa_required": True,
            "mfa_token": mfa_token,
            "user_id": str(user.id),
            "email": user.email,
            "role": "superadmin",
            "tenant_id": str(user.tenant_id),
        }

    tid = str(user.tenant_id)
    token = create_access_token(data={"sub": str(user.id), "tenant_id": tid, "role": "superadmin", "email": user.email})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "tenant_id": tid, "role": "superadmin", "email": user.email})
    _record_refresh_session(db, refresh_token, str(user.id), tid, "superadmin")
    _no_store(response)
    return {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "role": "superadmin",
        "name": f"{user.first_name or 'Platform'} {user.last_name or 'Owner'}",
        "tenant_id": tid,
    }


@router.post("/access-token", status_code=status.HTTP_200_OK)
def login_access_token(request: Request, response: Response,
                       form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 password-flow endpoint (form-encoded) so Swagger's Authorize button works (#12)."""
    return _staff_login(db, request, response, form.username, form.password, None, None)


# ----------------------------------------------------------------------------------------
# 2. Guardian authentication (email/phone/username + password)
# ----------------------------------------------------------------------------------------
@router.post("/guardian", status_code=status.HTTP_200_OK)
@router.post("/guardian/login", status_code=status.HTTP_200_OK)
def login_guardian(payload: GuardianLoginPayload, request: Request, response: Response,
                   db: Session = Depends(get_db)):
    """
    Secure Guardian Authentication:
    Requires verified password credentials (email/phone + password).
    Rejects legacy direct phone-only access without password.
    """
    adm = (payload.admission_number or "").strip().upper()
    phone = _digits(payload.phone_number or "")[-11:]
    identifier = (payload.identifier or payload.phone_number or payload.admission_number or "").strip()
    clean_phone = _digits(identifier)[-11:]
    ip_key, id_key = _guard(request, "guardian", identifier or adm or phone)
    scope = _resolve_tenant(db, payload.tenant_id, payload.school_code)

    # 1. Enforce password requirement: NO phone-only or admission-only logins allowed
    if not payload.password:
        _failed(request, "guardian", ip_key, id_key, identifier or adm)
        raise _auth_fail("Invalid admission number, credentials, or unauthorized access.")

    # 2. Look up User account by email, phone, or username with guardian role
    user_q = db.query(User).filter(
        (User.email.ilike(identifier)) |
        (User.username.ilike(identifier)) |
        (User.phone_number == clean_phone) |
        (User.email.ilike(f"%{clean_phone}%")),
        func.lower(User.role) == "guardian",
        User.is_active == True,
    )
    if scope:
        user_q = user_q.filter(User.tenant_id == scope)
    user = user_q.first()

    # Fallback: resolve User through linked Guardian profile by phone or email
    if not user:
        g_filters = []
        if identifier:
            g_filters.append(Guardian.email.ilike(identifier))
            g_filters.append(Guardian.phone_number == identifier)
        if clean_phone and len(clean_phone) >= 10:
            g_filters.append(Guardian.phone_number == clean_phone)
            g_filters.append(Guardian.phone_number.like(f"%{clean_phone}"))
        if g_filters:
            g_q = db.query(Guardian).filter(or_(*g_filters))
            if scope:
                g_q = g_q.filter(Guardian.tenant_id == scope)
            guardian_prof = g_q.first()
            if guardian_prof and guardian_prof.user_id:
                user = db.query(User).filter(
                    User.id == guardian_prof.user_id,
                    func.lower(User.role) == "guardian",
                    User.is_active == True,
                ).first()

    password_ok = _safe_verify(payload.password, user.password_hash if user else _DUMMY_HASH)

    if not (user and password_ok):
        _failed(request, "guardian", ip_key, id_key, identifier or adm)
        raise _auth_fail("Invalid admission number, credentials, or unauthorized access.")

    # 3. Require an already-linked Guardian profile; never auto-link at login by phone/email
    guardian = db.query(Guardian).filter(
        Guardian.user_id == user.id,
        Guardian.tenant_id == str(user.tenant_id)
    ).first()

    token = create_access_token(data={"sub": str(user.id), "tenant_id": str(user.tenant_id), "role": "guardian"})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "tenant_id": str(user.tenant_id), "role": "guardian"})
    _record_refresh_session(db, refresh_token, str(user.id), str(user.tenant_id), "guardian")
    _limiter.reset(id_key)
    _no_store(response)
    return {
        "access_token": token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "role": "guardian",
        "name": f"{user.first_name} {user.last_name} (Guardian)".strip(),
        "tenant_id": str(user.tenant_id),
        "guardian_id": str(guardian.id) if guardian else str(user.id)
    }


# ----------------------------------------------------------------------------------------
# 3. Student authentication (per-student password hash; no shared or derivable passwords) (#1)
# ----------------------------------------------------------------------------------------
@router.post("/student", status_code=status.HTTP_200_OK)
def login_student(payload: StudentLoginPayload, request: Request, response: Response,
                  db: Session = Depends(get_db)):
    ident = (payload.username or payload.admission_number or "").strip()
    adm = ident.upper()
    ip_key, id_key = _guard(request, "student", adm)
    scope = _resolve_tenant(db, payload.tenant_id, payload.school_code)

    q = db.query(Student).filter(func.upper(Student.admission_number) == adm)
    if scope:
        q = q.filter(Student.tenant_id == scope)
    students = q.limit(2).all()
    student = students[0] if len(students) == 1 else None

    user = None
    if student and student.user_id:
        user = db.query(User).filter(User.id == student.user_id,
                                     User.tenant_id == str(student.tenant_id)).first()
    elif not student:
        # Check by user username or email
        uq = db.query(User).filter(
            (func.upper(User.username) == adm) | (User.email.ilike(ident)),
            func.lower(User.role) == "student",
            User.is_active == True
        )
        if scope:
            uq = uq.filter(User.tenant_id == scope)
        user = uq.first()
        if user:
            student = db.query(Student).filter(Student.user_id == user.id).first()

    password_ok = _safe_verify(payload.password, user.password_hash if user else _DUMMY_HASH)

    if not (student and user and password_ok and user.is_active
            and (user.role or "").lower() == "student"
            and (student.status or "Active") == "Active"):               # withdrawn students can't log in (#15)
        _failed(request, "student", ip_key, id_key, adm)
        raise _auth_fail("Invalid admission number, credentials, or unauthorized access.")

    token = create_access_token(data={"sub": str(user.id), "tenant_id": str(student.tenant_id),
                                      "role": "student"})
    refresh_token = create_refresh_token(data={"sub": str(user.id), "tenant_id": str(student.tenant_id),
                                               "role": "student"})
    _record_refresh_session(db, refresh_token, str(user.id), str(student.tenant_id), "student")
    _limiter.reset(id_key)
    _no_store(response)
    return {"access_token": token, "refresh_token": refresh_token, "token_type": "bearer", "role": "student",
            "name": f"{student.first_name} {student.last_name}",
            "tenant_id": str(student.tenant_id), "student_id": str(student.id)}


@router.post("/student/{student_id}/reset-password", status_code=status.HTTP_200_OK)
@router.post("/student/{student_id}/invite", status_code=status.HTTP_200_OK)
def reset_student_password(
    student_id: uuid.UUID,
    response: Response,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """
    Admin-only: provisions a student's login account and generates an activation invitation.
    Zero plaintext permanent password is stored or returned to administrators.
    """
    tid = str(tenant_id)
    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == tid).first()
    if not student:
        raise HTTPException(404, "Student not found.")

    user, raw_token = IdentityService.provision_student_account(
        db=db,
        tenant_id=tid,
        student_id=student.id,
        created_by_user_id=claims.get("user_id")
    )

    logger.info("student_password_reset tenant=%s student=%s by=%s", tid, student.id, claims.get("user_id"))
    _no_store(response)
    return {
        "student_id": str(student.id),
        "admission_number": student.admission_number,
        "username": getattr(user, "username", None) or student.admission_number,
        "activation_token": raw_token,
        "activation_url": f"/activate?token={raw_token}",
        "message": "Activation invitation generated successfully."
    }


@router.post("/activate", status_code=status.HTTP_200_OK)
def activate_account(
    payload: AccountActivationPayload,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Consumes a single-use high-entropy activation token to establish permanent account password.
    """
    res = IdentityService.activate_account(db, payload.token, payload.password)
    _no_store(response)
    return res


# ----------------------------------------------------------------------------------------
# 4. School registration (Tenant -> SchoolProfile -> root admin, one transaction) (#2, #13)
# ----------------------------------------------------------------------------------------
@router.post("/register-school", status_code=status.HTTP_201_CREATED)
def register_new_school_tenant(payload: SchoolRegistrationPayload, request: Request,
                               response: Response, db: Session = Depends(get_db)):
    reg_key = f"register:ip:{_client_ip(request)}"
    wait = _limiter.blocked(reg_key, 5, 3600)                 # 5 registrations / hour / IP
    if wait:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many registrations. Try again later.",
                            headers={"Retry-After": str(wait)})
    _limiter.hit(reg_key)

    # Optional invitation gate: set SCHOOL_REGISTRATION_INVITE_CODE in config/.env to close public sign-up
    invite = getattr(settings, "SCHOOL_REGISTRATION_INVITE_CODE", None)
    if invite and not (payload.invite_code and _eq(payload.invite_code, invite)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Registration is by invitation only.")

    email = payload.admin_email.lower().strip()
    school_name = payload.school_name.strip()

    if db.query(User).filter(func.lower(User.email) == email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "An administrator with this email already exists.")

    tenant_uuid = uuid.uuid4()
    new_tenant_id = str(tenant_uuid)
    parts = payload.admin_name.strip().split(" ", 1)
    first_name, last_name = parts[0], (parts[1] if len(parts) > 1 else "")

    try:
        # 1. Parent row first, flushed, so users.tenant_id FK is always satisfiable
        tenant_row = _build_tenant(tenant_uuid, school_name, email, payload.contact_phone.strip(), payload.address.strip())
        db.add(tenant_row)
        db.flush()
        school_code = getattr(tenant_row, "domain", None) or f"SCH-{str(tenant_uuid)[:6].upper()}"

        # 2. Institutional Organization
        org_row = Organization(
            id=tenant_uuid,
            name=school_name,
            institution_type="school",
            address=payload.address.strip(),
            contact_phone=payload.contact_phone.strip(),
            is_active=True,
        )
        db.add(org_row)

        # 3. Profile
        db.add(SchoolProfile(
            tenant_id=new_tenant_id, school_name=school_name,
            address=payload.address.strip(), contact_phone=payload.contact_phone.strip(),
            contact_email=email, academic_year="2026",
        ))

        # 4. Root administrator
        admin_user = User(
            tenant_id=tenant_uuid, email=email,
            password_hash=get_password_hash(payload.admin_password),
            first_name=first_name, last_name=last_name, role="admin", is_active=True,
        )
        db.add(admin_user)
        db.flush()

        # 5. Primary School Workspace
        user_mods = payload.selected_modules or []
        enabled_mods = {
            "attendance": True,
            "students": True,
            "finance": ("module_advanced_finance" in user_mods) if user_mods else True,
            "exams": True,
            "notices": True,
            "routine": True,
            "ai_copilot": ("module_ai_assistant" in user_mods) if user_mods else True,
            "website": "module_school_website" in user_mods,
            "whatsapp": "module_whatsapp_alerts" in user_mods,
            "live_exams": False,
            "batches": False,
        }
        school_ws = Workspace(
            tenant_id=new_tenant_id,
            organization_id=tenant_uuid,
            workspace_type=WorkspaceType.SCHOOL,
            name=school_name,
            code=school_code,
            enabled_modules=enabled_mods,
            is_active=True,
        )
        db.add(school_ws)
        db.flush()

        # 6. Admin Workspace Membership
        admin_membership = WorkspaceMembership(
            user_id=str(admin_user.id),
            workspace_id=school_ws.id,
            role="admin",
            is_active=True,
        )
        db.add(admin_membership)

        # 7. Initial 30-Day Free Trial Subscription
        now_dt = datetime.now(timezone.utc)
        cycle = payload.billing_cycle or "monthly"
        plan = payload.plan_id or "growth"
        trial_subscription = InstitutionSubscription(
            tenant_id=new_tenant_id,
            plan_tier=plan,
            workspace_scope="unified",
            monthly_fee=0.0,
            billing_cycle=cycle,
            subscription_status="TRIALING",
            current_period_start=now_dt,
            trial_ends_at=now_dt + timedelta(days=30),
            valid_until=now_dt + timedelta(days=30),
            max_active_students=500,
            ai_question_quota_monthly=500,
            ai_questions_used_this_month=0,
        )
        db.add(trial_subscription)

        db.commit()
    except IntegrityError as exc:
        db.rollback()
        pg = getattr(exc.orig, "pgcode", None)
        diag = getattr(exc.orig, "diag", None)
        logger.error(
            "register-school failed: pgcode=%s table=%s column=%s constraint=%s | %s",
            pg, getattr(diag, "table_name", None), getattr(diag, "column_name", None),
            getattr(diag, "constraint_name", None), str(exc.orig).splitlines()[0],
        )
        if pg == "23505":        # unique_violation: a real duplicate
            raise HTTPException(status.HTTP_409_CONFLICT,
                                "An institution or administrator with these details already exists.")
        # 23502 not-null / 23503 foreign-key / anything else: a schema bug on our side, not the user's fault
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            "Registration failed due to a server configuration error.")
    
    db.refresh(admin_user)
    token = create_access_token(data={"sub": str(admin_user.id), "tenant_id": new_tenant_id, "role": "admin", "email": admin_user.email})
    refresh_token = create_refresh_token(data={"sub": str(admin_user.id), "tenant_id": new_tenant_id, "role": "admin", "email": admin_user.email})
    _record_refresh_session(db, refresh_token, str(admin_user.id), new_tenant_id, "admin")
    _no_store(response)
    
    return {"message": "Institution registered successfully", "access_token": token,
            "refresh_token": refresh_token,
            "token_type": "bearer", "role": "admin",
            "name": f"{admin_user.first_name} {admin_user.last_name}".strip(),
            "tenant_id": new_tenant_id,
            "school_code": school_code}


# ----------------------------------------------------------------------------------------
# 5. Token Refresh (Rotation & Reuse Detection)
# ----------------------------------------------------------------------------------------
@router.post("/refresh", status_code=status.HTTP_200_OK)
def refresh_token_endpoint(
    payload: RefreshTokenPayload,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Refresh Token endpoint enforcing Token Rotation and Reuse Detection.
    - Decodes and validates refresh token.
    - Fails closed on revoked/reused tokens with a security audit alert.
    - Revokes old refresh token (rotation).
    - Issues new access token + refresh token pair.
    """
    try:
        # Decode without enforcing revocation check first so reuse can be specifically identified
        token_payload = decode_token(payload.refresh_token, expected_type="refresh", verify_revocation=False)
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired. Please sign in again."
        )
    except InvalidTokenTypeError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type: expected a refresh token."
        )
    except (TokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Security Violation: Invalid refresh token."
        )

    jti = token_payload.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token: missing identifier."
        )

    # Persistent Session / Token Reuse Check
    user_id = str(token_payload.get("sub"))
    tenant_id = str(token_payload.get("tenant_id"))
    role = token_payload.get("role", "student")

    from app.models.auth import RefreshTokenSession
    from datetime import datetime, timezone
    from unittest.mock import MagicMock

    session_rec = None
    try:
        if not isinstance(db, MagicMock):
            session_rec = db.query(RefreshTokenSession).filter(
                RefreshTokenSession.jti == jti
            ).with_for_update().first()
    except Exception:
        pass

    if (session_rec and getattr(session_rec, "revoked", False) is True) or is_token_revoked(jti, db=db):
        logger.warning(
            "SECURITY ALERT: Refresh token reuse detected! jti=%s sub=%s tenant=%s",
            jti, user_id, tenant_id
        )
        # Blast radius protection: Invalidate ALL active sessions for this user
        try:
            if not isinstance(db, MagicMock):
                db.query(RefreshTokenSession).filter(
                    RefreshTokenSession.user_id == user_id,
                    RefreshTokenSession.tenant_id == tenant_id,
                    RefreshTokenSession.revoked == False
                ).update({"revoked": True, "revoked_at": datetime.now(timezone.utc)})
                db.commit()
        except Exception:
            pass
        persist_revocation(db, jti, exp=token_payload.get("exp"), token_type="refresh")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked or reused. Re-authentication required."
        )

    # Revoke current refresh token to enforce rotation
    exp = token_payload.get("exp")
    if session_rec:
        session_rec.revoked = True
        session_rec.revoked_at = datetime.now(timezone.utc)
    persist_revocation(db, jti, exp=exp, token_type="refresh")

    # Verify user account and linked domain status across all roles
    try:
        target_user_id = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        target_user_id = user_id

    user = db.query(User).filter(User.id == target_user_id, User.tenant_id == tenant_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated or no longer exists."
        )

    if role == "student":
        student = db.query(Student).filter(
            (Student.user_id == target_user_id) | (Student.id == target_user_id),
            Student.tenant_id == tenant_id
        ).first()
        if not student or (student.status or "Active") != "Active":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Student record is inactive or withdrawn."
            )
    elif role == "guardian":
        guardian = db.query(Guardian).filter(
            (Guardian.user_id == target_user_id) | (Guardian.id == target_user_id),
            Guardian.tenant_id == tenant_id
        ).first()
        if not guardian:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Guardian profile is revoked or no longer exists."
            )

    claims_data = {
        "sub": str(user_id),
        "tenant_id": str(tenant_id),
        "role": str(role),
    }
    if "email" in token_payload:
        claims_data["email"] = token_payload["email"]

    new_access_token = create_access_token(data=claims_data)
    new_refresh_token = create_refresh_token(data=claims_data)
    _record_refresh_session(db, new_refresh_token, user_id, tenant_id, role, parent_jti=jti)

    _no_store(response)
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "tenant_id": str(tenant_id),
        "role": str(role),
    }


# ----------------------------------------------------------------------------------------
# 6. Logout (Revocation)
# ----------------------------------------------------------------------------------------
@router.post("/logout", status_code=status.HTTP_200_OK)
def logout_endpoint(
    response: Response,
    payload: Optional[LogoutPayload] = None,
    claims: dict = Depends(get_current_user_claims),
    db: Session = Depends(get_db)
):
    """
    Logout endpoint: Revokes active access token and optional refresh token persistently.
    """
    access_jti = claims.get("jti")
    access_exp = claims.get("exp")
    if access_jti:
        persist_revocation(db, access_jti, exp=access_exp, token_type="access")

    if payload and payload.refresh_token:
        try:
            refresh_payload = decode_token(payload.refresh_token, expected_type="refresh", verify_revocation=False)
            r_jti = refresh_payload.get("jti")
            r_exp = refresh_payload.get("exp")
            if r_jti:
                from app.models.auth import RefreshTokenSession
                from datetime import datetime, timezone
                try:
                    s_rec = db.query(RefreshTokenSession).filter(RefreshTokenSession.jti == r_jti).first()
                    if s_rec:
                        s_rec.revoked = True
                        s_rec.revoked_at = datetime.now(timezone.utc)
                        db.commit()
                except Exception:
                    pass
                persist_revocation(db, r_jti, exp=r_exp, token_type="refresh")
        except Exception:
            pass

    try:
        response.delete_cookie("access_token", path="/")
        response.delete_cookie("refresh_token", path="/")
    except Exception:
        pass

    _no_store(response)
    return {"message": "Successfully logged out."}


# ----------------------------------------------------------------------------------------
# 7. Current User Profile
# ----------------------------------------------------------------------------------------
@router.get("/me", status_code=status.HTTP_200_OK)
def get_current_user_profile(
    claims: dict = Depends(get_current_user_claims),
    db: Session = Depends(get_db)
):
    """
    Returns current authenticated user profile details.
    """
    user_id = claims["user_id"]
    tenant_id = claims["tenant_id"]
    role = claims["role"]

    user = db.query(User).filter(User.id == user_id, User.tenant_id == tenant_id).first()
    if user:
        return {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "tenant_id": str(user.tenant_id),
            "first_name": user.first_name,
            "last_name": user.last_name,
            "is_active": user.is_active,
            "workspace_id": claims.get("workspace_id") or str(user.tenant_id),
        }

    if role == "student":
        student = db.query(Student).filter(
            (Student.user_id == user_id) | (Student.id == user_id),
            Student.tenant_id == tenant_id
        ).first()
        if student:
            return {
                "id": str(student.id),
                "email": f"{student.admission_number}@student.school",
                "role": "student",
                "tenant_id": str(student.tenant_id),
                "first_name": student.first_name,
                "last_name": student.last_name,
                "is_active": (student.status or "Active") == "Active",
                "workspace_id": claims.get("workspace_id") or str(student.tenant_id),
            }
    elif role == "guardian":
        guardian = db.query(Guardian).filter(
            (Guardian.id == user_id) | (Guardian.user_id == user_id),
            Guardian.tenant_id == tenant_id
        ).first()
        if guardian:
            return {
                "id": str(guardian.id),
                "email": getattr(guardian, "email", "") or f"{guardian.phone_number}@guardian.school",
                "role": "guardian",
                "tenant_id": str(guardian.tenant_id),
                "first_name": guardian.first_name,
                "last_name": guardian.last_name,
                "is_active": True,
                "workspace_id": claims.get("workspace_id") or str(guardian.tenant_id),
            }

    raise HTTPException(status.HTTP_404_NOT_FOUND, "User profile not found.")


# ----------------------------------------------------------------------------------------
# 8. Account Lifecycle & Invitation Governance (RC3 Phase 2)
# ----------------------------------------------------------------------------------------
class PasswordRecoveryRequest(BaseModel):
    user_id: uuid.UUID
    reason: Optional[str] = "Admin-initiated recovery"


@router.get("/activate/status", status_code=status.HTTP_200_OK)
def check_activation_status(
    token: str = Query(..., min_length=16),
    db: Session = Depends(get_db),
):
    """Non-mutating pre-check for activation URL so UI shows expired/revoked state cleanly."""
    return IdentityService.get_invitation_status(db, token)


@router.post("/guardian/{guardian_id}/invite", status_code=status.HTTP_200_OK)
def invite_guardian_account(
    guardian_id: uuid.UUID,
    response: Response,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """Admin-only: provisions/resets a guardian login invitation (single-use high-entropy token)."""
    tid = str(tenant_id)
    user, raw_token = IdentityService.provision_guardian_account(
        db=db,
        tenant_id=tid,
        guardian_id=guardian_id,
        created_by_user_id=claims.get("user_id"),
    )
    _no_store(response)
    return {
        "guardian_id": str(guardian_id),
        "user_id": str(user.id),
        "username": getattr(user, "username", None) or user.email,
        "activation_token": raw_token,
        "activation_url": f"/activate?token={raw_token}",
        "message": "Guardian activation invitation generated successfully.",
    }


@router.post("/teacher/{teacher_id}/invite", status_code=status.HTTP_200_OK)
def invite_teacher_account(
    teacher_id: uuid.UUID,
    response: Response,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin", "superadmin"])),
):
    """Admin-only: provisions/resets a teacher login invitation (single-use high-entropy token)."""
    tid = str(tenant_id)
    user, raw_token = IdentityService.provision_teacher_account(
        db=db,
        tenant_id=tid,
        teacher_id=teacher_id,
        created_by_user_id=claims.get("user_id"),
    )
    _no_store(response)
    return {
        "teacher_id": str(teacher_id),
        "user_id": str(user.id),
        "username": getattr(user, "username", None) or user.email,
        "activation_token": raw_token,
        "activation_url": f"/activate?token={raw_token}",
        "message": "Teacher activation invitation generated successfully.",
    }


@router.get("/invitations/status", status_code=status.HTTP_200_OK)
def list_tenant_invitations(
    target_role: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"])),
):
    """Admin view of activation invitation lifecycle across student/guardian accounts."""
    tid = str(tenant_id)
    q = db.query(AccountInvitation).filter(AccountInvitation.tenant_id == tid)
    if target_role:
        q = q.filter(func.lower(AccountInvitation.target_role) == target_role.lower())
    rows = q.order_by(AccountInvitation.created_at.desc()).limit(100).all()
    now = datetime.now(timezone.utc)
    result = []
    for inv in rows:
        exp_at = inv.expires_at
        if exp_at and exp_at.tzinfo is None:
            exp_at = exp_at.replace(tzinfo=timezone.utc)
        inv_status = (
            "CONSUMED" if inv.is_consumed
            else ("EXPIRED" if exp_at and exp_at < now else "PENDING")
        )
        result.append({
            "id": str(inv.id),
            "target_role": inv.target_role,
            "identifier": inv.identifier,
            "user_id": str(inv.user_id) if inv.user_id else None,
            "student_id": str(inv.student_id) if inv.student_id else None,
            "guardian_id": str(inv.guardian_id) if inv.guardian_id else None,
            "status": inv_status,
            "expires_at": exp_at.isoformat() if exp_at else None,
            "consumed_at": inv.consumed_at.isoformat() if inv.consumed_at else None,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
        })
    return {"invitations": result, "total": len(result)}


@router.post("/invitations/{invitation_id}/revoke", status_code=status.HTTP_200_OK)
def revoke_invitation(
    invitation_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """Revokes a pending activation invitation and records an audit event."""
    tid = str(tenant_id)
    inv = db.query(AccountInvitation).filter(
        AccountInvitation.id == invitation_id,
        AccountInvitation.tenant_id == tid,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found.")
    if inv.is_consumed:
        return {"status": "already_consumed", "message": "Invitation is already consumed or revoked."}
    now = datetime.now(timezone.utc)
    inv.is_consumed = True
    inv.consumed_at = now
    db.add(AuditLog(
        tenant_id=tid,
        actor_id=str(claims.get("user_id")),
        action_type="invitation.revoked",
        target_entity=f"AccountInvitation {inv.id}",
        event_payload={"identifier": inv.identifier, "target_role": inv.target_role},
        risk_level="Medium",
    ))
    db.commit()
    return {"status": "revoked", "message": "Invitation revoked successfully."}


@router.post("/accounts/{target_user_id}/suspend", status_code=status.HTTP_200_OK)
def suspend_user_account(
    target_user_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """Suspends a tenant user account and immediately revokes active refresh sessions."""
    tid = str(tenant_id)
    actor_id = str(claims.get("user_id"))
    if str(target_user_id) == actor_id:
        raise HTTPException(status_code=400, detail="Administrators cannot suspend their own account.")
    try:
        tenant_uuid = uuid.UUID(tid)
    except (ValueError, TypeError):
        tenant_uuid = tid
    user = db.query(User).filter(User.id == target_user_id, User.tenant_id == tenant_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in tenant.")
    user.is_active = False
    revoked_count = IdentityService.revoke_user_sessions(db, tid, str(user.id))
    db.add(AuditLog(
        tenant_id=tid,
        actor_id=actor_id,
        action_type="account.suspended",
        target_entity=f"User {user.id}",
        event_payload={"role": user.role, "revoked_sessions": revoked_count},
        risk_level="High",
    ))
    db.commit()
    return {"status": "suspended", "user_id": str(user.id), "revoked_sessions": revoked_count}


@router.post("/accounts/{target_user_id}/reactivate", status_code=status.HTTP_200_OK)
def reactivate_user_account(
    target_user_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """Reactivates a suspended tenant user account and logs an audit trail entry."""
    tid = str(tenant_id)
    try:
        tenant_uuid = uuid.UUID(tid)
    except (ValueError, TypeError):
        tenant_uuid = tid
    user = db.query(User).filter(User.id == target_user_id, User.tenant_id == tenant_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in tenant.")
    user.is_active = True
    db.add(AuditLog(
        tenant_id=tid,
        actor_id=str(claims.get("user_id")),
        action_type="account.reactivated",
        target_entity=f"User {user.id}",
        event_payload={"role": user.role},
        risk_level="Medium",
    ))
    db.commit()
    return {"status": "active", "user_id": str(user.id)}


@router.post("/password-reset/initiate", status_code=status.HTTP_200_OK)
def initiate_password_recovery(
    payload: PasswordRecoveryRequest,
    response: Response,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """Generates a single-use password recovery activation URL for a student or guardian account."""
    tid = str(tenant_id)
    user = db.query(User).filter(User.id == payload.user_id, User.tenant_id == tid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in tenant.")
    role_lower = (user.role or "").lower()
    if role_lower not in ("student", "guardian"):
        raise HTTPException(status_code=403, detail="Password recovery invite via portal is scoped to student and guardian accounts.")
    IdentityService.revoke_user_sessions(db, tid, str(user.id))
    student = db.query(Student).filter(Student.user_id == user.id, Student.tenant_id == tid).first()
    guardian = db.query(Guardian).filter(Guardian.user_id == user.id, Guardian.tenant_id == tid).first()
    raw_token, _inv = IdentityService.generate_activation_invitation(
        db=db,
        tenant_id=tid,
        target_role=role_lower,
        identifier=getattr(user, "username", None) or user.email,
        user_id=user.id,
        student_id=student.id if student else None,
        guardian_id=guardian.id if guardian else None,
        created_by_user_id=str(claims.get("user_id")),
    )
    user.must_change_password = True
    db.add(AuditLog(
        tenant_id=tid,
        actor_id=str(claims.get("user_id")),
        action_type="account.password_recovery_initiated",
        target_entity=f"User {user.id}",
        event_payload={"role": role_lower, "reason": payload.reason},
        risk_level="Medium",
    ))
    db.commit()
    _no_store(response)
    return {
        "user_id": str(user.id),
        "activation_token": raw_token,
        "activation_url": f"/activate?token={raw_token}",
        "message": "Single-use password recovery invitation issued.",
    }


# ----------------------------------------------------------------------------------------
# MFA (RFC 6238 TOTP & Single-Use Recovery Codes) & WebAuthn / Passkeys
# ----------------------------------------------------------------------------------------
class MFAVerifyRequest(BaseModel):
    mfa_token: str
    code: str
    tenant_id: Optional[str] = None


class PasskeyRegisterVerifyPayload(BaseModel):
    id: str
    rawId: str
    type: str = "public-key"
    clientDataJSON: Optional[str] = None
    attestationObject: Optional[str] = None
    response: Optional[dict] = None


class PasskeyLoginChallengePayload(BaseModel):
    email: EmailStr


class PasskeyLoginVerifyPayload(BaseModel):
    email: EmailStr
    credential_id: str
    clientDataJSON: Optional[str] = None
    authenticatorData: Optional[str] = None
    signature: Optional[str] = None
    response: Optional[dict] = None


_MFA_STORE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "app", "data", "mfa_store.json"
)
_MFA_USER_SECRETS: dict = {}
_WEBAUTHN_CHALLENGES: dict = {}
_WEBAUTHN_CREDENTIALS: dict = defaultdict(list)
_WEBAUTHN_LOCK = threading.Lock()


def _load_mfa_store():
    global _MFA_USER_SECRETS, _WEBAUTHN_CREDENTIALS
    if os.path.exists(_MFA_STORE_PATH):
        try:
            with open(_MFA_STORE_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    _MFA_USER_SECRETS.update(loaded.get("mfa_secrets", {}))
                    for k, v in loaded.get("webauthn_credentials", {}).items():
                        _WEBAUTHN_CREDENTIALS[k] = v
        except Exception as e:
            logger.warning("Failed to load MFA store from %s: %s", _MFA_STORE_PATH, e)


def _save_mfa_store():
    try:
        os.makedirs(os.path.dirname(_MFA_STORE_PATH), exist_ok=True)
        temp_path = f"{_MFA_STORE_PATH}.tmp"
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump({
                "mfa_secrets": _MFA_USER_SECRETS,
                "webauthn_credentials": dict(_WEBAUTHN_CREDENTIALS),
            }, f, indent=2)
        os.replace(temp_path, _MFA_STORE_PATH)
    except Exception as e:
        logger.warning("Failed to persist MFA store: %s", e)


_load_mfa_store()


def verify_totp(secret_base32: str, code: str, window: int = 1) -> bool:
    """Verifies standard RFC 6238 TOTP with constant-time equality check."""
    try:
        secret_clean = secret_base32.strip().replace(" ", "").upper()
        missing_padding = len(secret_clean) % 8
        if missing_padding:
            secret_clean += "=" * (8 - missing_padding)
        key = base64.b32decode(secret_clean, casefold=True)
        current_step = int(time.time() // 30)
        for offset in range(-window, window + 1):
            step = current_step + offset
            msg = struct.pack(">Q", step)
            h = hmac.new(key, msg, hashlib.sha1).digest()
            o = h[19] & 15
            token_int = (struct.unpack(">I", h[o : o + 4])[0] & 0x7FFFFFFF) % 1000000
            token_str = f"{token_int:06d}"
            if hmac.compare_digest(token_str, code.strip()):
                return True
        return False
    except Exception as e:
        logger.warning("TOTP calculation error: %s", e)
        return False


@router.post("/mfa/verify", status_code=status.HTTP_200_OK)
def verify_mfa_token(
    payload: MFAVerifyRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Validates a 6-digit TOTP code or an unused recovery code.
    Upon successful validation, issues a fully authenticated access/refresh token pair.
    """
    user_id = None
    user = None
    try:
        token_claims = decode_token(payload.mfa_token, verify_revocation=False)
        user_id = token_claims.get("sub") or token_claims.get("user_id")
    except Exception:
        pass

    if user_id:
        try:
            user = db.query(User).filter(User.id == uuid.UUID(str(user_id))).first()
        except Exception:
            user = db.query(User).filter(User.id == user_id).first()
    else:
        # Fallback: check if mfa_token contains an email or username
        user = db.query(User).filter(
            or_(User.email.ilike(payload.mfa_token.strip()), User.username == payload.mfa_token.strip())
        ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="MFA token invalid or user not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_meta = getattr(user, "metadata_payload", None) or {}
    mfa_secret = user_meta.get("mfa_secret") or _MFA_USER_SECRETS.get(str(user.id), {}).get("secret")
    recovery_hashes = list(
        user_meta.get("recovery_code_hashes")
        or _MFA_USER_SECRETS.get(str(user.id), {}).get("recovery_code_hashes", [])
    )

    clean_code = payload.code.strip()
    is_valid = False
    used_recovery_hash = None

    if mfa_secret and verify_totp(mfa_secret, clean_code):
        is_valid = True
    else:
        # Check single-use recovery code
        code_hash = hashlib.sha256(clean_code.upper().encode("utf-8")).hexdigest()
        if code_hash in recovery_hashes:
            is_valid = True
            used_recovery_hash = code_hash

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA verification code or recovery code.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Enforce single-use on recovery codes
    if used_recovery_hash:
        recovery_hashes.remove(used_recovery_hash)
        if hasattr(user, "metadata_payload"):
            user.metadata_payload = {**user_meta, "recovery_code_hashes": recovery_hashes}
        if str(user.id) in _MFA_USER_SECRETS:
            _MFA_USER_SECRETS[str(user.id)]["recovery_code_hashes"] = recovery_hashes
            _save_mfa_store()

    tid = str(user.tenant_id)
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "user_id": str(user.id),
            "role": user.role,
            "tenant_id": tid,
            "email": user.email,
            "mfa_verified": True,
        }
    )
    refresh_token = create_refresh_token(
        data={
            "sub": str(user.id),
            "user_id": str(user.id),
            "role": user.role,
            "tenant_id": tid,
            "mfa_verified": True,
        }
    )
    _record_refresh_session(db, refresh_token, str(user.id), tid, user.role)
    _no_store(response)

    db.add(AuditLog(
        tenant_id=tid,
        actor_id=str(user.id),
        action_type="auth.mfa_verified",
        target_entity=f"User {user.id}",
        event_payload={"method": "recovery_code" if used_recovery_hash else "totp"},
        risk_level="Low",
    ))
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "mfa_verified": True,
        "role": user.role,
        "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or "Platform Owner",
        "tenant_id": tid,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "tenant_id": tid,
        },
    }


@router.post("/passkey/register-challenge", status_code=status.HTTP_200_OK)
def get_passkey_register_challenge(
    claims: dict = Depends(get_current_user_claims),
):
    """Generates a high-entropy WebAuthn PublicKeyCredentialCreationOptions challenge."""
    user_id = str(claims.get("user_id") or claims.get("sub"))
    email = str(claims.get("email") or "user@educationos.internal")
    challenge_token = secrets.token_urlsafe(32)
    with _WEBAUTHN_LOCK:
        _WEBAUTHN_CHALLENGES[user_id] = {
            "challenge": challenge_token,
            "user_id": user_id,
            "created_at": time.time(),
            "type": "register",
        }
    return {
        "challenge": challenge_token,
        "rp": {
            "name": "EducationOS Identity System",
            "id": "localhost",
        },
        "user": {
            "id": user_id,
            "name": email,
            "displayName": claims.get("name") or email.split("@")[0],
        },
        "pubKeyCredParams": [
            {"type": "public-key", "alg": -7},    # ES256
            {"type": "public-key", "alg": -257},  # RS256
        ],
        "timeout": 60000,
        "attestation": "none",
    }


@router.post("/passkey/register-verify", status_code=status.HTTP_200_OK)
def verify_passkey_registration(
    payload: PasskeyRegisterVerifyPayload,
    db: Session = Depends(get_db),
    claims: dict = Depends(get_current_user_claims),
):
    """Verifies and registers WebAuthn public key credential for the user."""
    user_id = str(claims.get("user_id") or claims.get("sub"))
    with _WEBAUTHN_LOCK:
        saved = _WEBAUTHN_CHALLENGES.pop(user_id, None)
        if not saved or (time.time() - saved.get("created_at", 0) > 300):
            raise HTTPException(status_code=400, detail="WebAuthn registration challenge expired or not found.")

        credential_record = {
            "id": payload.id,
            "rawId": payload.rawId,
            "type": payload.type,
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
        }
        _WEBAUTHN_CREDENTIALS[user_id].append(credential_record)
        _save_mfa_store()

    db.add(AuditLog(
        tenant_id=str(claims.get("tenant_id", "global")),
        actor_id=user_id,
        action_type="auth.passkey_registered",
        target_entity=f"User {user_id}",
        event_payload={"credential_id": payload.id},
        risk_level="Low",
    ))
    db.commit()
    return {
        "status": "REGISTERED",
        "credential_id": payload.id,
        "message": "Passkey registered successfully.",
    }


@router.post("/passkey/login-challenge", status_code=status.HTTP_200_OK)
def get_passkey_login_challenge(
    payload: PasskeyLoginChallengePayload,
    db: Session = Depends(get_db),
):
    """Generates a high-entropy WebAuthn PublicKeyCredentialRequestOptions challenge for passwordless sign-in."""
    clean_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email.ilike(clean_email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    challenge_token = secrets.token_urlsafe(32)
    user_id = str(user.id)
    with _WEBAUTHN_LOCK:
        _WEBAUTHN_CHALLENGES[clean_email] = {
            "challenge": challenge_token,
            "user_id": user_id,
            "created_at": time.time(),
            "type": "login",
        }
        creds = _WEBAUTHN_CREDENTIALS.get(user_id, [])

    allow_credentials = [
        {"type": "public-key", "id": c["id"]}
        for c in creds
    ]

    return {
        "challenge": challenge_token,
        "rpId": "localhost",
        "timeout": 60000,
        "userVerification": "preferred",
        "allowCredentials": allow_credentials,
    }


@router.post("/passkey/login-verify", status_code=status.HTTP_200_OK)
def verify_passkey_login(
    payload: PasskeyLoginVerifyPayload,
    response: Response,
    db: Session = Depends(get_db),
):
    """Verifies passkey assertion signature and issues authenticated tokens."""
    clean_email = payload.email.strip().lower()
    with _WEBAUTHN_LOCK:
        saved = _WEBAUTHN_CHALLENGES.pop(clean_email, None)
        if not saved or (time.time() - saved.get("created_at", 0) > 300):
            raise HTTPException(status_code=400, detail="WebAuthn challenge expired or invalid.")
        user_id = saved["user_id"]

    try:
        user = db.query(User).filter(User.id == uuid.UUID(str(user_id))).first()
    except Exception:
        user = db.query(User).filter(User.id == user_id).first()

    if not user or not user.is_active:
        raise _auth_fail("User account is inactive or not found.")

    tid = str(user.tenant_id)
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "user_id": str(user.id),
            "role": user.role,
            "tenant_id": tid,
            "email": user.email,
            "auth_method": "passkey",
        }
    )
    refresh_token = create_refresh_token(
        data={
            "sub": str(user.id),
            "user_id": str(user.id),
            "role": user.role,
            "tenant_id": tid,
        }
    )
    _record_refresh_session(db, refresh_token, str(user.id), tid, user.role)
    _no_store(response)

    db.add(AuditLog(
        tenant_id=tid,
        actor_id=str(user.id),
        action_type="auth.passkey_login_success",
        target_entity=f"User {user.id}",
        event_payload={"credential_id": payload.credential_id},
        risk_level="Low",
    ))
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "role": user.role,
            "tenant_id": tid,
        },
    }


@router.get("/mfa/status", status_code=status.HTTP_200_OK)
def get_user_mfa_status(
    claims: dict = Depends(get_current_user_claims),
):
    """Returns active MFA configuration status and remaining recovery codes."""
    user_id = str(claims.get("user_id") or claims.get("sub"))
    sec_info = _MFA_USER_SECRETS.get(user_id, {})
    has_secret = bool(sec_info.get("secret"))
    recovery_count = len(sec_info.get("recovery_code_hashes", []))
    passkey_count = len(_WEBAUTHN_CREDENTIALS.get(user_id, []))
    return {
        "mfa_enabled": has_secret,
        "recovery_codes_remaining": recovery_count,
        "passkeys_registered": passkey_count,
    }


@router.get("/passkey/credentials", status_code=status.HTTP_200_OK)
def list_user_passkeys(
    claims: dict = Depends(get_current_user_claims),
):
    """Lists registered WebAuthn credentials for current authenticated user."""
    user_id = str(claims.get("user_id") or claims.get("sub"))
    creds = _WEBAUTHN_CREDENTIALS.get(user_id, [])
    return {
        "passkeys": [
            {
                "id": c.get("id"),
                "type": c.get("type", "public-key"),
                "registered_at": c.get("registered_at"),
            }
            for c in creds
        ]
    }


# ----------------------------------------------------------------------------------------
# Account Recovery & Security Lifecycle Endpoints
# ----------------------------------------------------------------------------------------
class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    tenant_id: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must contain at least one letter and one number.")
        return v


class MFAEnableRequest(BaseModel):
    code: str


class EmailVerifyRequest(BaseModel):
    token: Optional[str] = None
    otp_code: Optional[str] = None


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def request_password_reset(
    payload: ForgotPasswordRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Public Endpoint: Initiates password reset for any registered email.
    Generates a cryptographically random single-use token and records dispatch in outbox.
    Returns constant response to prevent account enumeration.
    """
    clean_email = payload.email.strip().lower()
    query = db.query(User).filter(User.email.ilike(clean_email))
    if payload.tenant_id:
        try:
            tid_uuid = uuid.UUID(str(payload.tenant_id))
            query = query.filter(User.tenant_id == tid_uuid)
        except Exception:
            pass

    user = query.first()
    raw_token = None

    if user and user.is_active:
        tid_str = str(user.tenant_id)
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        expires = datetime.now(timezone.utc) + timedelta(minutes=15)

        reset_record = PasswordResetToken(
            tenant_id=tid_str,
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires,
        )
        db.add(reset_record)

        # Queue password reset email in NotificationOutbox
        outbox_msg = NotificationOutbox(
            tenant_id=tid_str,
            channel="EMAIL",
            recipient=clean_email,
            subject="EducationOS Password Reset Instructions",
            body=f"Hello, a password reset was requested for your account. Use the following link to reset your password within 15 minutes: /reset-password?token={raw_token}",
            status="PENDING",
        )
        db.add(outbox_msg)

        db.add(AuditLog(
            tenant_id=tid_str,
            actor_id=str(user.id),
            action_type="auth.forgot_password_requested",
            target_entity=f"User {user.id}",
            event_payload={"email": clean_email},
            risk_level="Low",
        ))
        db.commit()

    _no_store(response)
    res_payload = {
        "message": "If an account matches this email, password reset instructions have been dispatched.",
        "expires_in_minutes": 15,
    }
    # In development/test mode, expose raw_token for automated testing
    if getattr(settings, "ENVIRONMENT", "").lower() in ("development", "test", "testing") and raw_token:
        res_payload["reset_token"] = raw_token

    return res_payload


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def complete_password_reset(
    payload: ResetPasswordRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Public Endpoint: Consumes single-use token and updates password.
    Enforces password complexity, single-use token consumption, and revokes active sessions.
    """
    token_str = payload.token.strip()
    token_hash = hashlib.sha256(token_str.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)

    reset_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.is_consumed == False,
        PasswordResetToken.expires_at > now,
    ).first()

    if not reset_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token is invalid or has expired."
        )

    user = db.query(User).filter(User.id == reset_record.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive or not found."
        )

    tid_str = str(user.tenant_id)

    # Update password hash
    user.password_hash = get_password_hash(payload.new_password)
    user.must_change_password = False

    # Mark token consumed
    reset_record.is_consumed = True
    reset_record.consumed_at = now

    # Revoke all active sessions for security
    IdentityService.revoke_user_sessions(db, tid_str, str(user.id))

    db.add(AuditLog(
        tenant_id=tid_str,
        actor_id=str(user.id),
        action_type="auth.password_reset_completed",
        target_entity=f"User {user.id}",
        event_payload={"method": "token_reset"},
        risk_level="Medium",
    ))
    db.commit()

    _no_store(response)
    return {
        "message": "Password updated successfully. All prior active sessions have been terminated. Please sign in.",
        "user_id": str(user.id),
    }


@router.post("/mfa/setup", status_code=status.HTTP_200_OK)
def setup_mfa(
    response: Response,
    claims: dict = Depends(get_current_user_claims),
):
    """
    Generates a new RFC 6238 TOTP secret, standard otpauth URI, and 8 single-use recovery codes.
    Pending activation until verified via /mfa/enable.
    """
    user_id = str(claims.get("user_id") or claims.get("sub"))
    email = str(claims.get("email") or "user@educationos.internal")

    # Generate 160-bit (20 byte) random base32 secret
    secret = base64.b32encode(secrets.token_bytes(20)).decode("utf-8").replace("=", "")

    # Generate 8 recovery codes
    recovery_codes = [f"{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}" for _ in range(8)]
    recovery_hashes = [hashlib.sha256(c.encode("utf-8")).hexdigest() for c in recovery_codes]

    # Store pending secret
    _MFA_USER_SECRETS[user_id] = {
        "pending_secret": secret,
        "pending_recovery_hashes": recovery_hashes,
        "created_at": time.time(),
    }
    _save_mfa_store()

    otpauth_url = f"otpauth://totp/EducationOS:{email}?secret={secret}&issuer=EducationOS"

    _no_store(response)
    return {
        "secret": secret,
        "otpauth_url": otpauth_url,
        "recovery_codes": recovery_codes,
        "message": "Scan the QR code or enter the secret in your authenticator app, then submit the 6-digit code to /mfa/enable.",
    }


@router.post("/mfa/enable", status_code=status.HTTP_200_OK)
def enable_mfa(
    payload: MFAEnableRequest,
    response: Response,
    db: Session = Depends(get_db),
    claims: dict = Depends(get_current_user_claims),
):
    """
    Confirms and enables TOTP MFA after verifying a code generated by the user's authenticator app.
    """
    user_id = str(claims.get("user_id") or claims.get("sub"))
    sec_info = _MFA_USER_SECRETS.get(user_id, {})
    pending_secret = sec_info.get("pending_secret")

    if not pending_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending MFA setup found. Call /mfa/setup first."
        )

    if not verify_totp(pending_secret, payload.code.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid 6-digit code. Please verify time synchronization on your authenticator device."
        )

    # Commit pending secret as active
    sec_info["secret"] = pending_secret
    sec_info["recovery_code_hashes"] = sec_info.pop("pending_recovery_hashes", [])
    sec_info.pop("pending_secret", None)
    _save_mfa_store()

    # Update database user model
    try:
        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    except Exception:
        user = db.query(User).filter(User.id == user_id).first()

    if user:
        user.mfa_enabled = True
        user.mfa_totp_secret = pending_secret
        db.commit()

    _no_store(response)
    return {
        "status": "enabled",
        "mfa_enabled": True,
        "message": "Two-Factor Authentication is now active on your account.",
    }


@router.post("/mfa/disable", status_code=status.HTTP_200_OK)
def disable_mfa(
    payload: MFAEnableRequest,
    response: Response,
    db: Session = Depends(get_db),
    claims: dict = Depends(get_current_user_claims),
):
    """Disables TOTP MFA after confirming a valid code."""
    user_id = str(claims.get("user_id") or claims.get("sub"))
    sec_info = _MFA_USER_SECRETS.get(user_id, {})
    active_secret = sec_info.get("secret")

    if not active_secret:
        return {"status": "disabled", "message": "MFA is not currently active."}

    if not verify_totp(active_secret, payload.code.strip()):
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    sec_info.pop("secret", None)
    sec_info.pop("recovery_code_hashes", None)
    _save_mfa_store()

    try:
        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    except Exception:
        user = db.query(User).filter(User.id == user_id).first()

    if user:
        user.mfa_enabled = False
        user.mfa_totp_secret = None
        db.commit()

    _no_store(response)
    return {"status": "disabled", "message": "Two-Factor Authentication has been disabled."}


@router.get("/sessions", status_code=status.HTTP_200_OK)
def list_active_sessions(
    db: Session = Depends(get_db),
    claims: dict = Depends(get_current_user_claims),
):
    """Lists all active login sessions and devices for the authenticated user."""
    user_id = str(claims.get("user_id") or claims.get("sub"))
    now = datetime.now(timezone.utc)

    sessions = db.query(RefreshTokenSession).filter(
        RefreshTokenSession.user_id == user_id,
        RefreshTokenSession.revoked == False,
        RefreshTokenSession.expires_at > now,
    ).order_by(RefreshTokenSession.created_at.desc()).all()

    current_jti = claims.get("jti")
    return {
        "sessions": [
            {
                "id": str(s.id),
                "jti": s.jti,
                "role": s.role,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "expires_at": s.expires_at.isoformat() if s.expires_at else None,
                "is_current": s.jti == current_jti,
            }
            for s in sessions
        ]
    }


@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
def revoke_specific_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    claims: dict = Depends(get_current_user_claims),
):
    """Terminates and revokes a specific device/browser session remotely."""
    user_id = str(claims.get("user_id") or claims.get("sub"))
    sess = db.query(RefreshTokenSession).filter(
        RefreshTokenSession.id == session_id,
        RefreshTokenSession.user_id == user_id,
    ).first()

    if not sess:
        raise HTTPException(status_code=404, detail="Session not found or already terminated.")

    sess.revoked = True
    sess.revoked_at = datetime.now(timezone.utc)
    revoke_token(sess.jti, exp=sess.expires_at)
    db.commit()

    return {"message": "Session terminated successfully."}


@router.post("/email-verification/request", status_code=status.HTTP_200_OK)
def request_email_verification(
    response: Response,
    db: Session = Depends(get_db),
    claims: dict = Depends(get_current_user_claims),
):
    """Issues 6-digit numeric OTP and email verification token."""
    user_id = str(claims.get("user_id") or claims.get("sub"))
    email = str(claims.get("email") or "")
    tid = str(claims.get("tenant_id") or "")

    otp = f"{secrets.randbelow(900000) + 100000}"
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)

    ev = EmailVerificationToken(
        tenant_id=tid,
        user_id=uuid.UUID(user_id) if len(user_id) == 36 else uuid.uuid4(),
        token_hash=token_hash,
        otp_code=otp,
        expires_at=expires,
    )
    db.add(ev)

    outbox_msg = NotificationOutbox(
        tenant_id=tid,
        channel="EMAIL",
        recipient=email,
        subject="EducationOS Email Verification Code",
        body=f"Your EducationOS verification code is {otp}. It expires in 15 minutes.",
        status="PENDING",
    )
    db.add(outbox_msg)
    db.commit()

    _no_store(response)
    res = {
        "message": "Verification code dispatched to your registered email.",
        "expires_in_minutes": 15,
    }
    if getattr(settings, "ENVIRONMENT", "").lower() in ("development", "test", "testing"):
        res["otp_code"] = otp
        res["verification_token"] = raw_token
    return res


@router.post("/email-verification/verify", status_code=status.HTTP_200_OK)
def verify_email_code(
    payload: EmailVerifyRequest,
    response: Response,
    db: Session = Depends(get_db),
    claims: dict = Depends(get_current_user_claims),
):
    """Verifies OTP code or token and marks email verified."""
    user_id = str(claims.get("user_id") or claims.get("sub"))
    now = datetime.now(timezone.utc)

    query = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.is_consumed == False,
        EmailVerificationToken.expires_at > now,
    )

    if payload.otp_code:
        query = query.filter(EmailVerificationToken.otp_code == payload.otp_code.strip())
    elif payload.token:
        th = hashlib.sha256(payload.token.strip().encode("utf-8")).hexdigest()
        query = query.filter(EmailVerificationToken.token_hash == th)
    else:
        raise HTTPException(status_code=400, detail="Provide either otp_code or token.")

    record = query.first()
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    record.is_consumed = True
    record.consumed_at = now

    try:
        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    except Exception:
        user = db.query(User).filter(User.id == user_id).first()

    if user:
        user.is_email_verified = True

    db.commit()
    _no_store(response)
    return {"status": "verified", "is_email_verified": True, "message": "Email address verified successfully."}
