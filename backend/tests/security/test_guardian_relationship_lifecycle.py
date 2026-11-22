# backend/tests/security/test_guardian_relationship_lifecycle.py
import secrets
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.security import create_access_token, create_refresh_token, get_password_hash
from app.models.audit import AuditLog
from app.models.auth import AccountInvitation, RefreshTokenSession
from app.models.guardian import Guardian, GuardianStudentLink
from app.models.student import Student
from app.models.tenant import Tenant, User
from app.main import app

client = TestClient(app)


@pytest.fixture
def iam_lifecycle_env():
    db = SessionLocal()
    tid = uuid.uuid4()
    admin_uid = uuid.uuid4()
    adm_no = f"ADM-IAM-{uuid.uuid4().hex[:5].upper()}"
    g_phone = f"0179{secrets.randbelow(8999999) + 1000000}"

    tenant = Tenant(id=tid, school_name="RC3 Lifecycle Academy", domain=f"rc3iam-{uuid.uuid4().hex[:6]}.edu.bd")
    db.add(tenant)
    db.commit()
    admin = User(
        id=admin_uid, tenant_id=tid, email=f"admin-{uuid.uuid4().hex[:6]}@iam.test",
        password_hash=get_password_hash("AdminPass123!"), role="admin", is_active=True
    )
    student = Student(
        id=uuid.uuid4(), tenant_id=tid, first_name="Nabil", last_name="Hasan",
        admission_number=adm_no, class_name="Class 8", status="Active"
    )
    guardian = Guardian(
        id=uuid.uuid4(), tenant_id=tid, first_name="Selim", last_name="Hasan",
        phone_number=g_phone, email=f"selim-{uuid.uuid4().hex[:6]}@iam.test"
    )
    db.add_all([admin, student, guardian])
    db.commit()

    admin_tok = create_access_token({"sub": str(admin_uid), "tenant_id": str(tid), "role": "admin"})
    yield {
        "db": db,
        "tid": tid,
        "admin_uid": admin_uid,
        "student": student,
        "guardian": guardian,
        "adm_no": adm_no,
        "h_admin": {"Authorization": f"Bearer {admin_tok}"},
    }

    try:
        db.rollback()
        db.query(AuditLog).filter(AuditLog.tenant_id == str(tid)).delete(synchronize_session=False)
        db.query(RefreshTokenSession).filter(RefreshTokenSession.tenant_id == str(tid)).delete(synchronize_session=False)
        db.query(AccountInvitation).filter(AccountInvitation.tenant_id == str(tid)).delete(synchronize_session=False)
        db.query(GuardianStudentLink).filter(GuardianStudentLink.tenant_id == tid).delete(synchronize_session=False)
        db.query(Guardian).filter(Guardian.tenant_id == tid).delete(synchronize_session=False)
        db.query(Student).filter(Student.tenant_id == tid).delete(synchronize_session=False)
        db.query(User).filter(User.tenant_id == tid).delete(synchronize_session=False)
        db.query(Tenant).filter(Tenant.id == tid).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def test_invitation_activation_revoke_suspend_and_recovery_lifecycle(iam_lifecycle_env):
    env = iam_lifecycle_env
    # 1. Admin issues guardian activation invite
    r_inv = client.post(f"/api/v1/auth/guardian/{env['guardian'].id}/invite", headers=env["h_admin"])
    assert r_inv.status_code == 200, r_inv.text
    g_token = r_inv.json()["activation_token"]
    g_user_id = r_inv.json()["user_id"]

    # 2. Pre-check status is PENDING
    r_stat = client.get(f"/api/v1/auth/activate/status?token={g_token}")
    assert r_stat.status_code == 200 and r_stat.json()["valid"] is True and r_stat.json()["status"] == "PENDING"

    # 3. Admin revokes the invitation before consumption -> activation fails
    inv_list = client.get("/api/v1/auth/invitations/status?target_role=guardian", headers=env["h_admin"]).json()["invitations"]
    inv_id = inv_list[0]["id"]
    assert client.post(f"/api/v1/auth/invitations/{inv_id}/revoke", headers=env["h_admin"]).status_code == 200
    assert client.get(f"/api/v1/auth/activate/status?token={g_token}").json()["valid"] is False
    assert client.post("/api/v1/auth/activate", json={"token": g_token, "password": "GuardianPassword123!"}).status_code == 400

    # 4. Re-issue & activate cleanly -> single-use replay blocked
    r_inv2 = client.post(f"/api/v1/auth/guardian/{env['guardian'].id}/invite", headers=env["h_admin"])
    g_token2 = r_inv2.json()["activation_token"]
    assert client.post("/api/v1/auth/activate", json={"token": g_token2, "password": "GuardianPassword123!"}).status_code == 200
    assert client.post("/api/v1/auth/activate", json={"token": g_token2, "password": "GuardianPassword123!"}).status_code == 400

    # 5. Guardian submits self-service link request -> starts PENDING_VERIFICATION
    g_tok = create_access_token({"sub": str(g_user_id), "tenant_id": str(env["tid"]), "role": "guardian"})
    h_guard = {"Authorization": f"Bearer {g_tok}"}
    r_req = client.post(
        "/api/v1/guardians/link-request",
        headers=h_guard,
        json={"admission_number": env["adm_no"], "relationship_type": "Father"},
    )
    assert r_req.status_code == 201, r_req.text

    # Before admin verification -> child list empty
    assert client.get("/api/v1/guardians/me/children", headers=h_guard).json() == []

    # 6. Admin views pending links & verifies -> child immediately accessible
    links = client.get("/api/v1/guardians/admin/links?status_filter=PENDING_VERIFICATION", headers=env["h_admin"]).json()["links"]
    assert len(links) == 1
    link_id = links[0]["id"]
    assert client.post(f"/api/v1/guardians/admin/links/{link_id}/verify", headers=env["h_admin"]).status_code == 200
    assert len(client.get("/api/v1/guardians/me/children", headers=h_guard).json()) == 1

    # 7. Admin revokes link -> child immediately hidden, and guardian self-service cannot resubmit REVOKED link
    assert client.post(f"/api/v1/guardians/admin/links/{link_id}/revoke", headers=env["h_admin"]).status_code == 200
    assert client.get("/api/v1/guardians/me/children", headers=h_guard).json() == []
    assert client.post(
        "/api/v1/guardians/link-request",
        headers=h_guard,
        json={"admission_number": env["adm_no"], "relationship_type": "Father"},
    ).status_code == 403

    # 8. Suspend user -> refresh denied (401); reactivate -> password recovery invite works
    ref_tok = create_refresh_token({"sub": str(g_user_id), "tenant_id": str(env["tid"]), "role": "guardian"})
    assert client.post(f"/api/v1/auth/accounts/{g_user_id}/suspend", headers=env["h_admin"]).status_code == 200
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": ref_tok}).status_code == 401
    assert client.post(f"/api/v1/auth/accounts/{g_user_id}/reactivate", headers=env["h_admin"]).status_code == 200

    r_rec = client.post(
        "/api/v1/auth/password-reset/initiate",
        headers=env["h_admin"],
        json={"user_id": g_user_id, "reason": "Parent requested reset"},
    )
    assert r_rec.status_code == 200, r_rec.text
    rec_token = r_rec.json()["activation_token"]
    assert client.post("/api/v1/auth/activate", json={"token": rec_token, "password": "NewGuardPass456!"}).status_code == 200
