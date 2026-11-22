# backend/tests/security/test_five_role_lifecycle_and_rbac.py
"""
Five-Role QA Lifecycle, Identity Governance & RBAC Security Test Suite.
Validates end-to-end security invariants across all 5 EducationOS personas:
1. SuperAdmin Platform Console exclusivity & non-superadmin denial (403).
2. Tenant lifecycle suspension & activation operations.
3. Dual-custody payment verification and mandatory rejection reason.
4. User account suspension & immediate session revocation.
5. Single-use invitation activation token lifecycle & replay attack prevention.
6. Guardian linked-child access vs foreign student IDOR protection.
7. Student self-scoping vs cross-student IDOR protection.
"""
import uuid
import datetime
import hashlib
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

import app.models
from app.main import app
from app.models.base import Base
from app.models.tenant import User, Tenant, SchoolProfile
from app.models.users import Teacher
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.auth import AccountInvitation, RevokedTokenRecord
from app.models.subscription_payment import SubscriptionPayment
from app.models.subscription import InstitutionSubscription
from app.models.audit import AuditLog
from app.api.deps import (
    get_db as deps_get_db,
    get_current_tenant_id,
    get_current_user_claims,
    get_current_user,
)
from app.core.database import get_db as core_get_db
from app.core.security import get_password_hash

if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def get_test_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def clean_database_and_overrides():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[deps_get_db] = get_test_db
    app.dependency_overrides[core_get_db] = get_test_db
    yield
    app.dependency_overrides.clear()


def make_claims(role="admin", tenant_id="tenant-sec-1", user_id=None, email=None):
    uid = user_id or str(uuid.uuid4())
    return {
        "sub": uid,
        "user_id": uid,
        "tenant_id": str(tenant_id),
        "role": role,
        "email": email or f"{role}@sec.test",
        "jti": uuid.uuid4().hex,
        "exp": datetime.datetime.now(datetime.timezone.utc).timestamp() + 3600,
    }


# ========================================================================================
# 1. Superadmin Platform Exclusivity
# ========================================================================================

def test_superadmin_platform_endpoints_access_and_rbac():
    """Superadmin must be able to view platform overview, directory, and billing review queue.
    Non-superadmin roles (admin, teacher, student, guardian) must be strictly forbidden (403)."""
    client = TestClient(app)
    db = TestingSessionLocal()
    tid = str(uuid.uuid4())

    # Seed tenant and subscription
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    t = Tenant(id=uuid.UUID(tid), school_name="Pilot School", domain="pilot.edu.bd")
    db.add(t)
    sub = InstitutionSubscription(
        tenant_id=tid,
        subscription_status="ACTIVE",
        plan_tier="growth",
        valid_until=now_utc + datetime.timedelta(days=30)
    )
    db.add(sub)
    db.commit()
    db.close()

    # 1. Non-superadmin (School Admin) denial
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(role="admin", tenant_id=tid)

    res_stats = client.get("/api/v1/tenants/overview/stats")
    assert res_stats.status_code == 403, f"Admin must be rejected from platform stats: {res_stats.text}"

    res_dir = client.get("/api/v1/tenants/directory")
    assert res_dir.status_code == 403, f"Admin must be rejected from platform directory: {res_dir.text}"

    res_pmts = client.get("/api/v1/billing/admin/payments")
    assert res_pmts.status_code == 403, f"Admin must be rejected from cross-tenant payments: {res_pmts.text}"

    # 2. Superadmin access
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(role="superadmin", tenant_id=tid)

    res_stats_ok = client.get("/api/v1/tenants/overview/stats")
    assert res_stats_ok.status_code == 200
    stats_data = res_stats_ok.json()
    assert stats_data["total_tenants"] >= 1
    assert stats_data["active_subscriptions"] >= 1

    res_dir_ok = client.get("/api/v1/tenants/directory")
    assert res_dir_ok.status_code == 200
    dir_data = res_dir_ok.json()
    assert len(dir_data) >= 1
    assert dir_data[0]["school_name"] == "Pilot School"

    res_pmts_ok = client.get("/api/v1/billing/admin/payments")
    assert res_pmts_ok.status_code == 200
    assert "payments" in res_pmts_ok.json()


# ========================================================================================
# 2. Tenant Lifecycle Suspension & Activation
# ========================================================================================

def test_tenant_suspension_and_reactivation():
    """Superadmin suspends and reactivates a tenant; state transitions and audit logging verified."""
    client = TestClient(app)
    db = TestingSessionLocal()
    tid = str(uuid.uuid4())

    now_utc = datetime.datetime.now(datetime.timezone.utc)
    t = Tenant(id=uuid.UUID(tid), school_name="Action Academy", domain="action.edu.bd")
    db.add(t)
    sub = InstitutionSubscription(
        tenant_id=tid,
        subscription_status="ACTIVE",
        plan_tier="growth",
        valid_until=now_utc + datetime.timedelta(days=30)
    )
    db.add(sub)
    db.commit()
    db.close()

    # Admin trying to suspend -> 403
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(role="admin", tenant_id=tid)
    res_deny = client.post(f"/api/v1/tenants/{tid}/suspend")
    assert res_deny.status_code == 403

    # Superadmin suspends
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(role="superadmin", tenant_id=tid)
    res_suspend = client.post(f"/api/v1/tenants/{tid}/suspend")
    assert res_suspend.status_code == 200
    assert res_suspend.json()["status"] == "suspended"

    # Verify DB
    db = TestingSessionLocal()
    updated_sub = db.query(InstitutionSubscription).filter_by(tenant_id=tid).first()
    assert updated_sub.subscription_status == "SUSPENDED"

    # Verify audit log
    audit = db.query(AuditLog).filter_by(tenant_id=tid, action_type="tenant.suspended").first()
    assert audit is not None
    assert audit.risk_level == "High"
    db.close()

    # Superadmin reactivates
    res_act = client.post(f"/api/v1/tenants/{tid}/activate")
    assert res_act.status_code == 200
    assert res_act.json()["status"] == "active"

    db = TestingSessionLocal()
    reactivated_sub = db.query(InstitutionSubscription).filter_by(tenant_id=tid).first()
    assert reactivated_sub.subscription_status == "ACTIVE"
    db.close()


# ========================================================================================
# 3. Dual-Custody Payment Verification & Rejection
# ========================================================================================

def test_manual_payment_reconciliation_dual_custody_and_rejection():
    """Manual payment claim approval requires dual custody; submitter cannot approve their own claim.
    Rejection must require mandatory reason."""
    client = TestClient(app)
    db = TestingSessionLocal()
    tid = str(uuid.uuid4())
    operator_uid = str(uuid.uuid4())

    pmt = SubscriptionPayment(
        tenant_id=tid,
        payment_reference="SUB-2026-TEST-99",
        plan_key="school_growth",
        billing_cycle="monthly",
        gateway="BKASH",
        amount=Decimal("2490.00"),
        status="SUBMITTED",
        transaction_id="TRX-DUAL-001",
        submitted_by=operator_uid,
        submitted_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(pmt)
    sub = InstitutionSubscription(
        tenant_id=tid,
        subscription_status="TRIALING",
        plan_tier="growth",
        valid_until=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=14)
    )
    db.add(sub)
    db.commit()
    db.close()

    # Superadmin who was the submitter tries to approve -> Dual custody violation
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(
        role="superadmin", tenant_id=tid, user_id=operator_uid
    )

    reconcile_payload = {
        "payment_reference": "SUB-2026-TEST-99",
        "statement_reference": "BANK-REC-999",
        "verified_amount": 2490.0
    }
    res_dual_fail = client.post("/api/v1/billing/admin/reconcile-payment", json=reconcile_payload)
    assert res_dual_fail.status_code == 403
    assert "Dual-custody violation" in res_dual_fail.json()["detail"]

    # Different superadmin rejects with mandatory reason
    diff_operator_uid = str(uuid.uuid4())
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(
        role="superadmin", tenant_id=tid, user_id=diff_operator_uid
    )

    # Empty rejection reason -> 422
    res_empty_reject = client.post("/api/v1/billing/admin/reject-payment", json={
        "payment_reference": "SUB-2026-TEST-99",
        "reason": ""
    })
    assert res_empty_reject.status_code == 422

    # Valid rejection
    res_valid_reject = client.post("/api/v1/billing/admin/reject-payment", json={
        "payment_reference": "SUB-2026-TEST-99",
        "reason": "Bank statement does not show deposit TRX-DUAL-001"
    })
    assert res_valid_reject.status_code == 200
    assert res_valid_reject.json()["status"] == "PAYMENT_REJECTED"


# ========================================================================================
# 4. User Account Suspension Lifecycle
# ========================================================================================

def test_user_account_suspension_enforcement():
    """Tenant Admin suspends a user; subsequent authenticated operations fail with 403."""
    client = TestClient(app)
    db = TestingSessionLocal()
    tid = str(uuid.uuid4())
    admin_uid = str(uuid.uuid4())
    target_uid = str(uuid.uuid4())

    t = Tenant(id=uuid.UUID(tid), school_name="Suspension Test Academy", domain="suspend.edu.bd")
    db.add(t)

    admin_user = User(
        id=uuid.UUID(admin_uid),
        tenant_id=uuid.UUID(tid),
        email="admin@suspend.edu.bd",
        role="admin",
        password_hash=get_password_hash("Secret123!"),
        is_active=True
    )
    target_user = User(
        id=uuid.UUID(target_uid),
        tenant_id=uuid.UUID(tid),
        email="teacher@suspend.edu.bd",
        role="teacher",
        password_hash=get_password_hash("Secret123!"),
        is_active=True
    )
    db.add_all([admin_user, target_user])
    db.commit()
    db.close()

    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(
        role="admin", tenant_id=tid, user_id=admin_uid
    )

    # Admin self-suspension prevented
    res_self = client.post(f"/api/v1/auth/accounts/{admin_uid}/suspend")
    assert res_self.status_code == 400
    assert "cannot suspend their own account" in res_self.json()["detail"].lower()

    # Suspend target user
    res_suspend = client.post(f"/api/v1/auth/accounts/{target_uid}/suspend")
    assert res_suspend.status_code == 200
    assert res_suspend.json()["status"] == "suspended"

    # Verify target user in DB is inactive
    db = TestingSessionLocal()
    u = db.query(User).filter_by(id=uuid.UUID(target_uid)).first()
    assert u.is_active is False
    db.close()

    # Authenticate as suspended user -> get_current_user raises 403
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(
        role="teacher", tenant_id=tid, user_id=target_uid
    )
    # Clear get_current_user override to let real dependency check run
    if get_current_user in app.dependency_overrides:
        del app.dependency_overrides[get_current_user]

    res_call = client.get("/api/v1/users/me")
    assert res_call.status_code in (401, 403)
    assert "suspended" in res_call.json()["detail"].lower() or "deactivated" in res_call.json()["detail"].lower()


# ========================================================================================
# 5. Single-Use Invitation Token Lifecycle & Replay Prevention
# ========================================================================================

def test_single_use_invitation_activation_and_replay_prevention():
    """Activation token is single-use; subsequent attempt with identical token must return 400."""
    client = TestClient(app)
    db = TestingSessionLocal()
    tid = str(uuid.uuid4())
    user_uid = str(uuid.uuid4())
    token_str = "ACT-" + uuid.uuid4().hex + uuid.uuid4().hex
    token_hash = hashlib.sha256(token_str.strip().encode("utf-8")).hexdigest()

    t = Tenant(id=uuid.UUID(tid), school_name="Activation Academy", domain="act.edu.bd")
    db.add(t)

    user = User(
        id=uuid.UUID(user_uid),
        tenant_id=uuid.UUID(tid),
        email="newteacher@act.edu.bd",
        role="teacher",
        password_hash=get_password_hash("Temporary123!"),
        is_active=False,
        must_change_password=True
    )
    db.add(user)

    invitation = AccountInvitation(
        tenant_id=tid,
        identifier="newteacher@act.edu.bd",
        target_role="teacher",
        token_hash=token_hash,
        user_id=uuid.UUID(user_uid),
        is_consumed=False,
        expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7),
    )
    db.add(invitation)
    db.commit()
    db.close()

    # Step 1: Initial activation succeeds
    activation_payload = {
        "token": token_str,
        "password": "NewStrongPassword2026!"
    }
    res_act = client.post("/api/v1/auth/activate", json=activation_payload)
    assert res_act.status_code == 200
    assert res_act.json().get("status") in ("success", "activated")

    # Verify user is active and must_change_password is False
    db = TestingSessionLocal()
    activated_user = db.query(User).filter_by(id=uuid.UUID(user_uid)).first()
    assert activated_user.is_active is True
    assert activated_user.must_change_password is False

    # Verify invitation is consumed
    inv = db.query(AccountInvitation).filter_by(token_hash=token_hash).first()
    assert inv.is_consumed is True
    assert inv.consumed_at is not None
    db.close()

    # Step 2: Replay attack fails with 400
    res_replay = client.post("/api/v1/auth/activate", json=activation_payload)
    assert res_replay.status_code == 400
    assert "already been consumed" in res_replay.json()["detail"].lower()


# ========================================================================================
# 6. Guardian Relational Isolation & Anti-IDOR Protection
# ========================================================================================

def test_guardian_linked_child_access_and_idor_denial():
    """Guardian can access their verified linked child; foreign unlinked student access is forbidden (403)."""
    client = TestClient(app)
    db = TestingSessionLocal()
    tid = str(uuid.uuid4())
    guardian_user_id = str(uuid.uuid4())
    guardian_id = uuid.uuid4()
    child_id = uuid.uuid4()
    foreign_student_id = uuid.uuid4()

    t = Tenant(id=uuid.UUID(tid), school_name="Guardian Academy", domain="guardian.edu.bd")
    db.add(t)

    g_user = User(
        id=uuid.UUID(guardian_user_id),
        tenant_id=uuid.UUID(tid),
        email="parent@guardian.edu.bd",
        phone_number="01799998888",
        role="guardian",
        password_hash=get_password_hash("ParentPass123!"),
        is_active=True
    )
    db.add(g_user)

    guardian = Guardian(
        id=guardian_id,
        tenant_id=tid,
        user_id=uuid.UUID(guardian_user_id),
        first_name="Rafiq",
        last_name="Chowdhury",
        phone_number="01799998888",
        email="parent@guardian.edu.bd"
    )
    db.add(guardian)

    child = Student(
        id=child_id,
        tenant_id=tid,
        first_name="Anis",
        last_name="Chowdhury",
        admission_number="STU-LINKED-01",
        class_name="Class 5",
        status="Active"
    )
    foreign_stu = Student(
        id=foreign_student_id,
        tenant_id=tid,
        first_name="Tanvir",
        last_name="Hasan",
        admission_number="STU-FOREIGN-02",
        class_name="Class 5",
        status="Active"
    )
    db.add_all([child, foreign_stu])

    link = GuardianStudentLink(
        tenant_id=tid,
        guardian_id=guardian_id,
        student_id=child_id,
        relationship_type=GuardianRelationship.FATHER,
        verification_status="VERIFIED",
        is_primary=True
    )
    db.add(link)
    db.commit()
    db.close()

    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(
        role="guardian", tenant_id=tid, user_id=guardian_user_id, email="parent@guardian.edu.bd"
    )

    # 1. Accessing linked child's progress card succeeds
    res_child = client.get(f"/api/v1/guardians/me/children/{child_id}/progress-card")
    assert res_child.status_code == 200

    # 2. Accessing foreign student's progress card raises 403 Forbidden
    res_foreign = client.get(f"/api/v1/guardians/me/children/{foreign_student_id}/progress-card")
    assert res_foreign.status_code == 403
    assert "not authorized" in res_foreign.json()["detail"].lower()
