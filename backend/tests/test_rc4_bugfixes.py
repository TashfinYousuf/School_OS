# backend/tests/test_rc4_bugfixes.py
"""
Regression test suite for RC4 Bugfixes:
- Bug A: GET /api/v1/users/me handles synthetic student emails (.invalid, .internal) without Pydantic EmailStr 500 error.
- Bug B: GET /api/v1/workspaces/my-workspaces normalizes list/dict enabled_modules without 500 error.
- Bug C: GET /api/v1/finance/portal/fee-summary provides guardian & student fee ledger, multi-child switcher, and prevents BOLA/IDOR.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal
from app.core.security import get_password_hash, create_access_token
from app.models.tenant import Tenant, User
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.finance import FeePayment, Invoice, InvoiceStatus
from app.models.workspace import Workspace, WorkspaceMembership, WorkspaceType

client = TestClient(app)


@pytest.fixture
def test_setup():
    db: Session = SessionLocal()
    tenant_id = uuid.uuid4()
    tid_str = str(tenant_id)

    tenant = Tenant(
        id=tenant_id,
        school_name="Kids Shine International School (KSIS)",
        domain=f"ksis-{uuid.uuid4().hex[:6]}.schoolos.local",
        address="House 42, Road 11, Banani, Dhaka-1213"
    )
    db.add(tenant)
    db.commit()

    # 1. Users
    admin_id = uuid.uuid4()
    admin = User(
        id=admin_id,
        tenant_id=tenant_id,
        email=f"admin-{uuid.uuid4().hex[:6]}@ksis.edu.bd",
        password_hash=get_password_hash("Admin123!"),
        role="admin",
        is_active=True,
        first_name="Admin",
        last_name="KSIS"
    )

    student1_user_id = uuid.uuid4()
    synthetic_email = f"ksis-2027-001-{uuid.uuid4().hex[:8]}@students.invalid"
    student1_user = User(
        id=student1_user_id,
        tenant_id=tenant_id,
        email=synthetic_email,
        password_hash=get_password_hash("StudentPass123!"),
        role="student",
        is_active=True,
        first_name="Ayaan",
        last_name="Rahman",
        username="ayaan.rahman"
    )

    student2_user_id = uuid.uuid4()
    student2_user = User(
        id=student2_user_id,
        tenant_id=tenant_id,
        email=f"ksis-2027-002-{uuid.uuid4().hex[:8]}@students.internal",
        password_hash=get_password_hash("StudentPass123!"),
        role="student",
        is_active=True,
        first_name="Zara",
        last_name="Rahman",
        username="zara.rahman"
    )

    guardian_user_id = uuid.uuid4()
    guardian_phone = f"0171{uuid.uuid4().hex[:7]}"
    guardian_user = User(
        id=guardian_user_id,
        tenant_id=tenant_id,
        email=f"guardian-{uuid.uuid4().hex[:6]}@gmail.com",
        phone_number=guardian_phone,
        password_hash=get_password_hash("Guardian123!"),
        role="guardian",
        is_active=True,
        first_name="Mahmudur",
        last_name="Rahman"
    )
    db.add_all([admin, student1_user, student2_user, guardian_user])
    db.commit()

    # 2. Student Records
    student1_rec_id = uuid.uuid4()
    student1_rec = Student(
        id=student1_rec_id,
        tenant_id=tenant_id,
        user_id=student1_user_id,
        admission_number=f"KSIS-2027-{uuid.uuid4().hex[:4].upper()}",
        first_name="Ayaan",
        last_name="Rahman",
        class_name="Playgroup",
        section="Morning Star",
        roll_number="01",
        status="Active"
    )

    student2_rec_id = uuid.uuid4()
    student2_rec = Student(
        id=student2_rec_id,
        tenant_id=tenant_id,
        user_id=student2_user_id,
        admission_number=f"KSIS-2027-{uuid.uuid4().hex[:4].upper()}",
        first_name="Zara",
        last_name="Rahman",
        class_name="Nursery",
        section="Little Angels",
        roll_number="02",
        status="Active"
    )

    student3_rec_id = uuid.uuid4()
    student3_rec = Student(
        id=student3_rec_id,
        tenant_id=tenant_id,
        admission_number=f"KSIS-2027-{uuid.uuid4().hex[:4].upper()}",
        first_name="Tanvir",
        last_name="Hasan",
        class_name="Class 1",
        section="A",
        roll_number="05",
        status="Active"
    )
    db.add_all([student1_rec, student2_rec, student3_rec])
    db.commit()

    # 3. Guardian Profile & Links
    guardian_rec = Guardian(
        id=guardian_user_id,
        tenant_id=tenant_id,
        user_id=guardian_user_id,
        first_name="Mahmudur",
        last_name="Rahman",
        phone_number=guardian_phone,
        email=guardian_user.email
    )
    db.add(guardian_rec)
    db.commit()

    # Links: Guardian linked to Student 1 and Student 2 (multi-child)
    link1 = GuardianStudentLink(
        tenant_id=tenant_id,
        guardian_id=guardian_user_id,
        student_id=student1_rec_id,
        relationship_type=GuardianRelationship.FATHER,
        verification_status="VERIFIED",
        is_primary=True,
        is_primary_contact=True
    )
    link2 = GuardianStudentLink(
        tenant_id=tenant_id,
        guardian_id=guardian_user_id,
        student_id=student2_rec_id,
        relationship_type=GuardianRelationship.FATHER,
        verification_status="VERIFIED",
        is_primary=False,
        is_primary_contact=True
    )
    db.add_all([link1, link2])

    # 6. Invoices & Payments for Student 1
    invoice1 = Invoice(
        id=uuid.uuid4(),
        tenant_id=tid_str,
        student_id=str(student1_rec_id),
        invoice_number=f"INV-KSIS-{uuid.uuid4().hex[:6].upper()}",
        title="Monthly Tuition Fee - November 2026",
        billing_month="2026-11",
        total_amount=5000.0,
        paid_amount=5000.0,
        status=InvoiceStatus.PAID.value
    )
    invoice2 = Invoice(
        id=uuid.uuid4(),
        tenant_id=tid_str,
        student_id=str(student1_rec_id),
        invoice_number=f"INV-KSIS-{uuid.uuid4().hex[:6].upper()}",
        title="Monthly Tuition Fee - December 2026",
        billing_month="2026-12",
        total_amount=5000.0,
        paid_amount=0.0,
        status=InvoiceStatus.ISSUED.value
    )
    payment1 = FeePayment(
        id=uuid.uuid4(),
        tenant_id=tid_str,
        student_id=student1_rec_id,
        invoice_id=invoice1.id,
        receipt_number=f"REC-KSIS-{uuid.uuid4().hex[:6].upper()}",
        amount=5000.0,
        payment_method="bKash",
        payment_status="COMPLETED",
        provider_transaction_id=f"TRX{uuid.uuid4().hex[:8].upper()}",
        idempotency_key=f"IDEMP-{uuid.uuid4().hex}"
    )
    db.add_all([invoice1, invoice2, payment1])

    # 7. Workspaces: one with list modules, one with dict modules
    ws_list = Workspace(
        id=uuid.uuid4(),
        tenant_id=tid_str,
        name="KSIS Kindergarten & Primary Campus",
        workspace_type=WorkspaceType.SCHOOL,
        code="WS-KSIS-01",
        enabled_modules=["attendance", "students", "finance", "exams", "notices"] # LIST in DB
    )
    ws_dict = Workspace(
        id=uuid.uuid4(),
        tenant_id=tid_str,
        name="KSIS Coaching & Language Wing",
        workspace_type=WorkspaceType.ACADEMY,
        code="WS-KSIS-02",
        enabled_modules={"attendance": True, "ai_tutor": True} # DICT in DB
    )
    db.add_all([ws_list, ws_dict])
    db.commit()

    # Member links for admin and guardian
    db.add(WorkspaceMembership(workspace_id=ws_list.id, user_id=str(guardian_user_id), role="guardian"))
    db.add(WorkspaceMembership(workspace_id=ws_list.id, user_id=str(student1_user_id), role="student"))
    db.commit()

    context = {
        "tenant_id": tid_str,
        "admin_user": admin,
        "student1_user": student1_user,
        "student1_rec": student1_rec,
        "student2_user": student2_user,
        "student2_rec": student2_rec,
        "student3_rec": student3_rec,
        "guardian_user": guardian_user,
        "guardian_rec": guardian_rec,
        "ws_list": ws_list,
        "ws_dict": ws_dict,
        "payment1": payment1,
        "invoice1": invoice1,
        "invoice2": invoice2
    }

    try:
        yield context
    finally:
        # Cleanup
        try:
            db.query(WorkspaceMembership).filter(WorkspaceMembership.user_id.in_([str(guardian_user_id), str(student1_user_id)])).delete(synchronize_session=False)
            db.query(FeePayment).filter(FeePayment.tenant_id == tid_str).delete(synchronize_session=False)
            db.query(Invoice).filter(Invoice.tenant_id == tid_str).delete(synchronize_session=False)
            db.query(Workspace).filter(Workspace.tenant_id == tid_str).delete(synchronize_session=False)
            db.query(GuardianStudentLink).filter(GuardianStudentLink.guardian_id == guardian_user_id).delete(synchronize_session=False)
            db.query(Guardian).filter(Guardian.id == guardian_user_id).delete(synchronize_session=False)
            db.query(Student).filter(Student.id.in_([student1_rec_id, student2_rec_id, student3_rec_id])).delete(synchronize_session=False)
            db.query(User).filter(User.id.in_([admin_id, student1_user_id, student2_user_id, guardian_user_id])).delete(synchronize_session=False)
            db.query(Tenant).filter(Tenant.id == tenant_id).delete(synchronize_session=False)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


def test_bug_a_synthetic_student_email_users_me(test_setup):
    """
    Bug A Regression Test:
    GET /api/v1/users/me must succeed with HTTP 200 for synthetic student accounts
    ending in .invalid or .internal, avoiding Pydantic EmailStr validation errors.
    """
    tid = test_setup["tenant_id"]
    student1 = test_setup["student1_user"]

    token = create_access_token(
        data={"sub": str(student1.id), "tenant_id": tid, "role": "student"}
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": tid
    }

    resp = client.get("/api/v1/users/me", headers=headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert body["id"] == str(student1.id)
    assert body["email"] == student1.email
    assert body["email"].endswith("@students.invalid")
    assert body["role"] == "student"


def test_bug_b_workspaces_my_workspaces_list_and_dict_normalization(test_setup):
    """
    Bug B Regression Test:
    GET /api/v1/workspaces/my-workspaces must succeed with HTTP 200 when workspaces
    have enabled_modules stored as a JSON list or dict in the database.
    """
    tid = test_setup["tenant_id"]
    guardian = test_setup["guardian_user"]

    token = create_access_token(
        data={"sub": str(guardian.id), "tenant_id": tid, "role": "guardian"}
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": tid
    }

    resp = client.get("/api/v1/workspaces/my-workspaces", headers=headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    workspaces = resp.json()
    assert len(workspaces) >= 1
    for ws in workspaces:
        assert isinstance(ws["enabled_modules"], dict), "enabled_modules must be normalized to a dictionary"
        assert "name" in ws
        assert ws["name"] != "Your School"


def test_bug_c_guardian_portal_fee_summary(test_setup):
    """
    Bug C Regression Test:
    GET /api/v1/finance/portal/fee-summary:
    - Verifies Guardian sees payments, invoices, dues, and children switcher.
    - Verifies sibling switching between Student 1 and Student 2.
    - Verifies 403 Forbidden when requesting an unlinked student (BOLA prevention).
    """
    tid = test_setup["tenant_id"]
    guardian = test_setup["guardian_user"]
    s1 = test_setup["student1_rec"]
    s2 = test_setup["student2_rec"]
    s3_unlinked = test_setup["student3_rec"]

    token = create_access_token(
        data={"sub": str(guardian.id), "tenant_id": tid, "role": "guardian"}
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": tid
    }

    # 1. Default fee summary (should pick first verified child)
    resp = client.get("/api/v1/finance/portal/fee-summary", headers=headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()

    assert data["student"] is not None
    assert len(data["children"]) == 2, "Guardian must receive list of all verified children"
    child_ids = [c["id"] for c in data["children"]]
    assert str(s1.id) in child_ids
    assert str(s2.id) in child_ids

    # Check fee aggregates
    assert data["total_paid"] == 5000.0
    assert data["total_due"] == 5000.0
    assert len(data["payments"]) == 1
    assert data["payments"][0]["receipt_no"].startswith("REC-KSIS-")
    assert len(data["invoices"]) == 2

    # 2. Sibling switch: query specifically for Student 2
    resp_s2 = client.get(f"/api/v1/finance/portal/fee-summary?student_id={s2.id}", headers=headers)
    assert resp_s2.status_code == 200
    data_s2 = resp_s2.json()
    assert data_s2["student"]["id"] == str(s2.id)
    assert data_s2["student"]["first_name"] == "Zara"

    # 3. Security Check (BOLA/IDOR): Guardian attempting to view unlinked Student 3
    resp_unlinked = client.get(f"/api/v1/finance/portal/fee-summary?student_id={s3_unlinked.id}", headers=headers)
    assert resp_unlinked.status_code == 403, "Must return 403 Forbidden for unauthorized student access"


def test_bug_c_student_portal_fee_summary(test_setup):
    """
    Bug C Regression Test:
    GET /api/v1/finance/portal/fee-summary:
    - Verifies Student accessing portal sees their own fees and payments.
    """
    tid = test_setup["tenant_id"]
    student1_user = test_setup["student1_user"]
    s1 = test_setup["student1_rec"]

    token = create_access_token(
        data={"sub": str(student1_user.id), "tenant_id": tid, "role": "student"}
    )
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": tid
    }

    resp = client.get("/api/v1/finance/portal/fee-summary", headers=headers)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["student"]["id"] == str(s1.id)
    assert data["student"]["first_name"] == "Ayaan"
    assert data["total_paid"] == 5000.0
    assert len(data["payments"]) == 1
