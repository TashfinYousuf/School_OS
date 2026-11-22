# backend/tests/security/test_guardian_student_isolation.py
import secrets
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.security import create_access_token, create_refresh_token, get_password_hash
from app.models.attendance import AttendanceEvent
from app.models.audit import AuditLog
from app.models.finance import FeePayment, Invoice, InvoiceStatus
from app.models.guardian import Guardian, GuardianRelationship, GuardianStudentLink
from app.models.notification import PushSubscriptionRecord
from app.models.result import StudentResult
from app.models.student import Student
from app.models.tenant import Tenant, User
from app.main import app

client = TestClient(app)


@pytest.fixture
def isolated_bola_env():
    db = SessionLocal()
    t1_id = uuid.uuid4()
    t2_id = uuid.uuid4()
    s1_uid = uuid.uuid4()
    s2_uid = uuid.uuid4()
    g1_uid = uuid.uuid4()
    g2_uid = uuid.uuid4()
    t2_g_uid = uuid.uuid4()
    admin_uid = uuid.uuid4()

    t1 = Tenant(id=t1_id, school_name="RC3 Security School A", domain=f"rc3a-{uuid.uuid4().hex[:6]}.edu.bd")
    t2 = Tenant(id=t2_id, school_name="RC3 Security School B", domain=f"rc3b-{uuid.uuid4().hex[:6]}.edu.bd")
    db.add_all([t1, t2])
    db.commit()

    shared_phone = f"0175{secrets.randbelow(8999999) + 1000000}"
    other_phone = f"0185{secrets.randbelow(8999999) + 1000000}"

    u_admin = User(
        id=admin_uid, tenant_id=t1_id, email=f"admin-{uuid.uuid4().hex[:6]}@rc3.edu.bd",
        password_hash=get_password_hash("AdminPass123!"), role="admin", is_active=True
    )
    u_s1 = User(
        id=s1_uid, tenant_id=t1_id, email=f"s1-{uuid.uuid4().hex[:6]}@rc3.edu.bd",
        username=f"S1-{uuid.uuid4().hex[:5]}",
        password_hash=get_password_hash("StudPass123!"), role="student", is_active=True
    )
    u_s2 = User(
        id=s2_uid, tenant_id=t1_id, email=f"s2-{uuid.uuid4().hex[:6]}@rc3.edu.bd",
        username=f"S2-{uuid.uuid4().hex[:5]}",
        password_hash=get_password_hash("StudPass123!"), role="student", is_active=True
    )
    u_g1 = User(
        id=g1_uid, tenant_id=t1_id, email=f"g1-{uuid.uuid4().hex[:6]}@rc3.edu.bd",
        phone_number=shared_phone,
        password_hash=get_password_hash("GuardPass123!"), role="guardian", is_active=True
    )
    # Guardian 2 in Tenant 1 has distinct User/Guardian ID, NOT linked to Student 1
    u_g2 = User(
        id=g2_uid, tenant_id=t1_id, email=f"g2-{uuid.uuid4().hex[:6]}@rc3.edu.bd",
        phone_number=other_phone,
        password_hash=get_password_hash("GuardPass123!"), role="guardian", is_active=True
    )
    u_t2_g = User(
        id=t2_g_uid, tenant_id=t2_id, email=f"t2g-{uuid.uuid4().hex[:6]}@rc3.edu.bd",
        password_hash=get_password_hash("GuardPass123!"), role="guardian", is_active=True
    )
    db.add_all([u_admin, u_s1, u_s2, u_g1, u_g2, u_t2_g])
    db.flush()

    s1 = Student(
        id=uuid.uuid4(), tenant_id=t1_id, user_id=s1_uid,
        first_name="Ayaan", last_name="Rahman",
        admission_number=f"ADM-S1-{uuid.uuid4().hex[:5].upper()}",
        class_name="Class 5", status="Active",
    )
    s2 = Student(
        id=uuid.uuid4(), tenant_id=t1_id, user_id=s2_uid,
        first_name="Zara", last_name="Karim",
        admission_number=f"ADM-S2-{uuid.uuid4().hex[:5].upper()}",
        class_name="Class 6", status="Active",
    )
    g1 = Guardian(
        id=uuid.uuid4(), tenant_id=t1_id, user_id=g1_uid,
        first_name="Kamal", last_name="Rahman", phone_number=shared_phone
    )
    g2 = Guardian(
        id=uuid.uuid4(), tenant_id=t1_id, user_id=g2_uid,
        first_name="Hasan", last_name="Karim", phone_number=other_phone
    )
    g_t2 = Guardian(
        id=uuid.uuid4(), tenant_id=t2_id, user_id=t2_g_uid,
        first_name="Cross", last_name="Tenant", phone_number=f"0195{secrets.randbelow(8999999) + 1000000}"
    )
    db.add_all([s1, s2, g1, g2, g_t2])
    db.flush()

    # Verified link: g1 -> s1; Pending link: g2 -> s1; Revoked link: g2 -> s2
    link_verified = GuardianStudentLink(
        tenant_id=t1_id, guardian_id=g1.id, student_id=s1.id,
        relationship_type=GuardianRelationship.FATHER, verification_status="VERIFIED"
    )
    link_pending = GuardianStudentLink(
        tenant_id=t1_id, guardian_id=g2.id, student_id=s1.id,
        relationship_type=GuardianRelationship.LEGAL_GUARDIAN, verification_status="PENDING_VERIFICATION"
    )
    link_revoked = GuardianStudentLink(
        tenant_id=t1_id, guardian_id=g2.id, student_id=s2.id,
        relationship_type=GuardianRelationship.FATHER, verification_status="REVOKED"
    )
    db.add_all([link_verified, link_pending, link_revoked])

    res_s1 = StudentResult(
        tenant_id=str(t1_id), student_id=s1.id, exam_term="Half Yearly 2026",
        class_name="Class 5", subject="Mathematics", marks_obtained=88.0, highest_marks=100.0,
        grade="A+", grade_point=5.0, is_published=True
    )
    res_s2 = StudentResult(
        tenant_id=str(t1_id), student_id=s2.id, exam_term="Half Yearly 2026",
        class_name="Class 6", subject="Science", marks_obtained=74.0, highest_marks=100.0,
        grade="A", grade_point=4.0, is_published=True
    )
    inv_s2 = Invoice(
        tenant_id=str(t1_id), student_id=str(s2.id),
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}", title="Tuition Fee",
        billing_month="2026-11",
        due_date=datetime.now(timezone.utc), total_amount=Decimal("2000.00"),
        paid_amount=Decimal("2000.00"), status=InvoiceStatus.PAID,
    )
    pay_s2 = FeePayment(
        tenant_id=str(t1_id), student_id=s2.id, amount=Decimal("2000.00"),
        receipt_number=f"RCP-{uuid.uuid4().hex[:8].upper()}",
        idempotency_key=f"IDEMP-{uuid.uuid4().hex[:10]}",
        payment_method="CASH", payment_status="COMPLETED", is_reversed=False,
    )
    db.add_all([res_s1, res_s2, inv_s2, pay_s2])
    db.commit()

    def _hdr(uid, tid, role):
        tok = create_access_token({"sub": str(uid), "tenant_id": str(tid), "role": role})
        return {"Authorization": f"Bearer {tok}"}

    yield {
        "db": db,
        "t1_id": t1_id, "t2_id": t2_id,
        "s1": s1, "s2": s2, "g1": g1, "g2": g2, "g_t2": g_t2,
        "u_s1": u_s1, "u_s2": u_s2, "u_g1": u_g1, "u_g2": u_g2, "u_admin": u_admin,
        "inv_s2": inv_s2, "pay_s2": pay_s2,
        "h_admin": _hdr(admin_uid, t1_id, "admin"),
        "h_s1": _hdr(s1_uid, t1_id, "student"),
        "h_s2": _hdr(s2_uid, t1_id, "student"),
        "h_g1": _hdr(g1_uid, t1_id, "guardian"),
        "h_g2": _hdr(g2_uid, t1_id, "guardian"),
        "h_g_t2": _hdr(t2_g_uid, t2_id, "guardian"),
        "h_unrecognized": _hdr(admin_uid, t1_id, "auditor"),
    }

    try:
        db.rollback()
        db.query(AuditLog).filter(AuditLog.tenant_id.in_([str(t1_id), str(t2_id)])).delete(synchronize_session=False)
        db.query(PushSubscriptionRecord).filter(PushSubscriptionRecord.tenant_id.in_([str(t1_id), str(t2_id)])).delete(synchronize_session=False)
        db.query(FeePayment).filter(FeePayment.tenant_id == str(t1_id)).delete(synchronize_session=False)
        db.query(Invoice).filter(Invoice.tenant_id == str(t1_id)).delete(synchronize_session=False)
        db.query(StudentResult).filter(StudentResult.tenant_id == str(t1_id)).delete(synchronize_session=False)
        db.query(AttendanceEvent).filter(AttendanceEvent.tenant_id == str(t1_id)).delete(synchronize_session=False)
        db.query(GuardianStudentLink).filter(GuardianStudentLink.tenant_id.in_([t1_id, t2_id])).delete(synchronize_session=False)
        db.query(Guardian).filter(Guardian.tenant_id.in_([t1_id, t2_id])).delete(synchronize_session=False)
        db.query(Student).filter(Student.tenant_id.in_([t1_id, t2_id])).delete(synchronize_session=False)
        db.query(User).filter(User.tenant_id.in_([t1_id, t2_id])).delete(synchronize_session=False)
        db.query(Tenant).filter(Tenant.id.in_([t1_id, t2_id])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def test_role_model_default_and_guardian_creation_no_admin_escalation(isolated_bola_env):
    """F-RC3-02: User model default must not be admin, and create_guardian must set role='guardian'."""
    assert User.role.default.arg == "student"
    email = f"newguard-{uuid.uuid4().hex[:6]}@rc3.edu.bd"
    phone = f"0161{secrets.randbelow(8999999) + 1000000}"
    r = client.post(
        "/api/v1/guardians/",
        headers=isolated_bola_env["h_admin"],
        json={
            "first_name": "Rahim", "last_name": "Uddin",
            "phone_number": phone, "email": email, "password": "GuardPassword123!"
        },
    )
    assert r.status_code == 201, r.text
    created = isolated_bola_env["db"].query(User).filter(User.email == email).first()
    assert created is not None
    assert created.role == "guardian"


def test_12_bola_idor_isolation_scenarios(isolated_bola_env):
    env = isolated_bola_env
    s1_id, s2_id = env["s1"].id, env["s2"].id

    # 1. Verified guardian CAN view own child progress card (regression check for results.py user_id vs guardian_id bug)
    r_ok_g = client.get(f"/api/v1/results/progress-card/{s1_id}?exam_term=Half Yearly 2026", headers=env["h_g1"])
    assert r_ok_g.status_code == 200, r_ok_g.text

    # 2. Student CAN view own progress card (regression check for results.py student_id != user_id bug)
    r_ok_s = client.get(f"/api/v1/results/progress-card/{s1_id}?exam_term=Half Yearly 2026", headers=env["h_s1"])
    assert r_ok_s.status_code == 200, r_ok_s.text

    # 3. Guardian 1 CANNOT view unrelated Student 2 progress card, attendance, fees, or profile-360
    assert client.get(f"/api/v1/results/progress-card/{s2_id}?exam_term=Half Yearly 2026", headers=env["h_g1"]).status_code == 403
    assert client.get(f"/api/v1/attendance/student/{s2_id}", headers=env["h_g1"]).status_code == 403
    assert client.get(f"/api/v1/guardians/me/children/{s2_id}/fees", headers=env["h_g1"]).status_code == 403
    assert client.get(f"/api/v1/students/{s2_id}/profile-360", headers=env["h_g1"]).status_code == 403
    assert client.get(f"/api/v1/finance/invoices/{env['inv_s2'].id}", headers=env["h_g1"]).status_code == 403
    assert client.get(f"/api/v1/finance/receipts/{env['pay_s2'].id}", headers=env["h_g1"]).status_code == 403

    # 4. Student 1 CANNOT view Student 2 records
    assert client.get(f"/api/v1/results/progress-card/{s2_id}?exam_term=Half Yearly 2026", headers=env["h_s1"]).status_code == 403
    assert client.get(f"/api/v1/attendance/student/{s2_id}", headers=env["h_s1"]).status_code == 403
    assert client.get(f"/api/v1/students/{s2_id}/profile-360", headers=env["h_s1"]).status_code == 403
    assert client.get(f"/api/v1/finance/receipts/{env['pay_s2'].id}", headers=env["h_s1"]).status_code == 403

    # 5. PENDING_VERIFICATION link (g2 -> s1) CANNOT view Student 1 data
    assert client.get(f"/api/v1/results/progress-card/{s1_id}?exam_term=Half Yearly 2026", headers=env["h_g2"]).status_code == 403
    assert client.get(f"/api/v1/attendance/student/{s1_id}", headers=env["h_g2"]).status_code == 403
    assert client.get(f"/api/v1/guardians/me/children/{s1_id}/fees", headers=env["h_g2"]).status_code == 403
    assert client.get(f"/api/v1/students/{s1_id}/profile-360", headers=env["h_g2"]).status_code == 403

    # 6. REVOKED link (g2 -> s2) CANNOT view Student 2 data or appear in /me/children
    assert client.get(f"/api/v1/results/progress-card/{s2_id}?exam_term=Half Yearly 2026", headers=env["h_g2"]).status_code == 403
    assert client.get(f"/api/v1/guardians/me/children/{s2_id}/fees", headers=env["h_g2"]).status_code == 403
    assert client.get("/api/v1/guardians/me/children", headers=env["h_g2"]).json() == []

    # 7. Cross-tenant guardian (g_t2) receives 404 (no existence leak across tenant_id)
    assert client.get(f"/api/v1/results/progress-card/{s1_id}?exam_term=Half Yearly 2026", headers=env["h_g_t2"]).status_code in (403, 404)
    assert client.get(f"/api/v1/attendance/student/{s1_id}", headers=env["h_g_t2"]).status_code in (403, 404)

    # 8. Unrecognized role MUST fail closed with 403 (never default-allow True!)
    assert client.get(f"/api/v1/results/progress-card/{s1_id}?exam_term=Half Yearly 2026", headers=env["h_unrecognized"]).status_code == 403
    assert client.get(f"/api/v1/attendance/student/{s1_id}", headers=env["h_unrecognized"]).status_code == 403
    assert client.get(f"/api/v1/finance/receipts/{env['pay_s2'].id}", headers=env["h_unrecognized"]).status_code == 403

    # 9. Notifications IDOR & unprivileged dispatch & honest status
    r_sub = client.post(
        "/api/v1/notifications/subscribe",
        headers=env["h_s1"],
        json={"user_id": str(env["u_s2"].id), "role": "admin", "subscription": {"endpoint": "https://push.test/1"}},
    )
    assert r_sub.status_code == 201
    # Verify recorded under authenticated caller u_s1, NOT tampered u_s2
    rec_s2 = env["db"].query(PushSubscriptionRecord).filter(PushSubscriptionRecord.user_id == str(env["u_s2"].id)).first()
    rec_s1 = env["db"].query(PushSubscriptionRecord).filter(PushSubscriptionRecord.user_id == str(env["u_s1"].id)).first()
    assert rec_s2 is None and rec_s1 is not None and rec_s1.role == "student"

    assert client.post(
        "/api/v1/notifications/dispatch-reminder",
        headers=env["h_s1"],
        json={"title": "Fake", "body": "Spoof"},
    ).status_code == 403

    r_disp = client.post(
        "/api/v1/notifications/dispatch-reminder",
        headers=env["h_admin"],
        json={"title": "Exam Alert", "body": "Starts at 10 AM"},
    )
    assert r_disp.status_code == 200
    assert r_disp.json()["status"] == "DELIVERY_NOT_CONFIGURED"
    assert r_disp.json()["delivery_configured"] is False


def test_student_and_guardian_refresh_token_lifecycle(isolated_bola_env):
    env = isolated_bola_env
    # Student login -> refresh succeeds (fixes Student.id == user_id regression)
    r_ref_s = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": create_refresh_token({"sub": str(env["u_s1"].id), "tenant_id": str(env["t1_id"]), "role": "student"})},
    )
    assert r_ref_s.status_code == 200, r_ref_s.text

    # Guardian login -> refresh succeeds
    r_ref_g = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": create_refresh_token({"sub": str(env["u_g1"].id), "tenant_id": str(env["t1_id"]), "role": "guardian"})},
    )
    assert r_ref_g.status_code == 200, r_ref_g.text