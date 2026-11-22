# backend/tests/test_student_guardian_reconstruction.py
import secrets
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
from app.models.attendance import AttendanceEvent
from app.models.result import StudentResult
from app.services.identity_service import IdentityService

client = TestClient(app)


@pytest.fixture
def tenant_fixture():
    db = SessionLocal()
    tenant_id = uuid.uuid4()
    tenant = Tenant(
        id=tenant_id,
        school_name="Reconstruction Test Academy",
        domain=f"recon-{uuid.uuid4().hex[:6]}.edu.bd",
        address="Dhaka, Bangladesh"
    )
    db.add(tenant)
    db.commit()

    # Admin user
    admin_id = uuid.uuid4()
    admin = User(
        id=admin_id,
        tenant_id=tenant_id,
        email=f"admin-{uuid.uuid4().hex[:6]}@recon.edu.bd",
        password_hash=get_password_hash("AdminPass123!"),
        role="admin",
        is_active=True,
        first_name="Admin",
        last_name="User"
    )
    db.add(admin)

    # Student 1
    student1_id = uuid.uuid4()
    student1 = Student(
        id=student1_id,
        tenant_id=tenant_id,
        first_name="Rafiq",
        last_name="Ahmed",
        admission_number=f"ADM-RECON-{uuid.uuid4().hex[:4].upper()}",
        class_name="Class 5",
        section="A",
        roll_number="01",
        status="Active"
    )
    db.add(student1)

    # Student 2 (Unrelated student in same tenant)
    student2_id = uuid.uuid4()
    student2 = Student(
        id=student2_id,
        tenant_id=tenant_id,
        first_name="Nusrat",
        last_name="Jahan",
        admission_number=f"ADM-RECON-{uuid.uuid4().hex[:4].upper()}",
        class_name="Class 7",
        section="B",
        roll_number="05",
        status="Active"
    )
    db.add(student2)

    # Guardian 1
    guardian1_id = uuid.uuid4()
    clean_phone = f"0171{secrets.randbelow(9000000) + 1000000}"
    guardian1 = Guardian(
        id=guardian1_id,
        tenant_id=tenant_id,
        first_name="Farid",
        last_name="Ahmed",
        phone_number=clean_phone,
        email=f"guardian-{clean_phone}@recon.edu.bd"
    )
    db.add(guardian1)

    # Guardian-Student Link (Verified for Student 1 only)
    link1 = GuardianStudentLink(
        tenant_id=tenant_id,
        guardian_id=guardian1_id,
        student_id=student1_id,
        relationship_type=GuardianRelationship.FATHER,
        verification_status="VERIFIED",
        is_primary=True,
        is_primary_contact=True
    )
    db.add(link1)

    db.commit()

    admin_token = create_access_token(data={"sub": str(admin_id), "tenant_id": str(tenant_id), "role": "admin"})

    yield {
        "tenant_id": str(tenant_id),
        "admin_token": admin_token,
        "admin_id": str(admin_id),
        "student1_id": str(student1_id),
        "student1_adm": student1.admission_number,
        "student2_id": str(student2_id),
        "guardian1_id": str(guardian1_id),
        "guardian1_phone": clean_phone,
        "link1_id": str(link1.id)
    }

    # Teardown
    try:
        db.query(GuardianStudentLink).filter(GuardianStudentLink.tenant_id == tenant_id).delete()
        db.query(Guardian).filter(Guardian.tenant_id == tenant_id).delete()
        db.query(Student).filter(Student.tenant_id == tenant_id).delete()
        db.query(User).filter(User.tenant_id == tenant_id).delete()
        db.query(Tenant).filter(Tenant.id == tenant_id).delete()
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def test_guardian_login_requires_password_rejects_phone_only(tenant_fixture):
    """
    VULN-SG-01 Security Regression Test:
    Verifies that calling guardian login with admission number + phone number alone
    is strictly REJECTED with HTTP 401 Unauthorized.
    """
    res = client.post("/api/v1/auth/guardian", json={
        "admission_number": tenant_fixture["student1_adm"],
        "phone_number": tenant_fixture["guardian1_phone"],
        "tenant_id": tenant_fixture["tenant_id"]
    })
    assert res.status_code == 401
    assert "Invalid admission number, credentials, or unauthorized access." in res.json()["detail"]


def test_student_account_provisioning_and_activation(tenant_fixture):
    """
    Verifies that an admin can provision a student account,
    issue a high-entropy activation token, and the student can establish a permanent password.
    """
    db = SessionLocal()
    # 1. Admin generates activation invitation
    user, raw_token = IdentityService.provision_student_account(
        db=db,
        tenant_id=tenant_fixture["tenant_id"],
        student_id=uuid.UUID(tenant_fixture["student1_id"]),
        created_by_user_id=tenant_fixture["admin_id"]
    )
    assert raw_token is not None
    assert len(raw_token) >= 32
    assert user.is_active is False

    # 2. Student activates account with valid password
    res = client.post("/api/v1/auth/activate", json={
        "token": raw_token,
        "password": "PermanentStudentPass123"
    })
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    # 3. Student can now log in
    login_res = client.post("/api/v1/auth/student", json={
        "admission_number": tenant_fixture["student1_adm"],
        "password": "PermanentStudentPass123",
        "tenant_id": tenant_fixture["tenant_id"]
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert "access_token" in data
    assert data["role"] == "student"

    # 4. Replay attack: consuming same token again is rejected
    replay_res = client.post("/api/v1/auth/activate", json={
        "token": raw_token,
        "password": "AnotherPassword456"
    })
    assert replay_res.status_code == 400
    assert "already been consumed" in replay_res.json()["detail"]
    db.close()


def test_guardian_provisioning_and_secure_login(tenant_fixture):
    """
    Verifies guardian account provisioning, token activation, and password-authenticated login.
    """
    db = SessionLocal()
    user, raw_token = IdentityService.provision_guardian_account(
        db=db,
        tenant_id=tenant_fixture["tenant_id"],
        guardian_id=uuid.UUID(tenant_fixture["guardian1_id"]),
        created_by_user_id=tenant_fixture["admin_id"]
    )
    assert raw_token is not None

    # Activate
    act_res = client.post("/api/v1/auth/activate", json={
        "token": raw_token,
        "password": "GuardianSecretPass123!"
    })
    assert act_res.status_code == 200

    # Login with phone + password
    login_res = client.post("/api/v1/auth/guardian/login", json={
        "identifier": tenant_fixture["guardian1_phone"],
        "password": "GuardianSecretPass123!",
        "tenant_id": tenant_fixture["tenant_id"]
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert data["role"] == "guardian"
    assert "access_token" in data
    db.close()


def test_guardian_student_relationship_authorization_blocks_unlinked_student(tenant_fixture):
    """
    VULN-SG-02 / BOLA Test:
    Verifies that Guardian 1 CANNOT access records of Student 2 (unlinked).
    """
    db = SessionLocal()
    user, raw_token = IdentityService.provision_guardian_account(
        db=db,
        tenant_id=tenant_fixture["tenant_id"],
        guardian_id=uuid.UUID(tenant_fixture["guardian1_id"]),
        created_by_user_id=tenant_fixture["admin_id"]
    )
    IdentityService.activate_account(db, raw_token, "SecurePass1234!")

    # Login to obtain guardian token
    login_res = client.post("/api/v1/auth/guardian", json={
        "identifier": tenant_fixture["guardian1_phone"],
        "password": "SecurePass1234!",
        "tenant_id": tenant_fixture["tenant_id"]
    })
    guardian_token = login_res.json()["access_token"]

    # 1. Accessing unlinked Student 2 progress card returns 403 Forbidden
    res_card = client.get(
        f"/api/v1/guardians/me/children/{tenant_fixture['student2_id']}/progress-card",
        headers={"Authorization": f"Bearer {guardian_token}"}
    )
    assert res_card.status_code == 403
    assert "not authorized" in res_card.json()["detail"].lower()

    # 2. Accessing unlinked Student 2 attendance returns 403 Forbidden
    res_att = client.get(
        f"/api/v1/guardians/me/children/{tenant_fixture['student2_id']}/attendance",
        headers={"Authorization": f"Bearer {guardian_token}"}
    )
    assert res_att.status_code == 403

    # 3. Accessing verified Student 1 progress card succeeds (200 OK)
    res_card1 = client.get(
        f"/api/v1/guardians/me/children/{tenant_fixture['student1_id']}/progress-card",
        headers={"Authorization": f"Bearer {guardian_token}"}
    )
    assert res_card1.status_code == 200
    assert res_card1.json()["student_id"] == tenant_fixture["student1_id"]
    db.close()


def test_learning_studio_socratic_tutor_and_study_room(tenant_fixture):
    """
    Verifies student Learning Studio features: Socratic tutor guidance and study room tracking.
    """
    db = SessionLocal()
    user, raw_token = IdentityService.provision_student_account(
        db=db,
        tenant_id=tenant_fixture["tenant_id"],
        student_id=uuid.UUID(tenant_fixture["student1_id"]),
        created_by_user_id=tenant_fixture["admin_id"]
    )
    IdentityService.activate_account(db, raw_token, "StudentSecret999!")

    login_res = client.post("/api/v1/auth/student", json={
        "admission_number": tenant_fixture["student1_adm"],
        "password": "StudentSecret999!",
        "tenant_id": tenant_fixture["tenant_id"]
    })
    student_token = login_res.json()["access_token"]

    # 1. AI Socratic Tutor Chat
    tutor_res = client.post(
        "/api/v1/learning-os/tutor/chat",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "subject": "Mathematics",
            "topic": "Algebraic Expressions",
            "message": "How do I solve 3x + 6 = 15?"
        }
    )
    assert tutor_res.status_code == 200
    assert "reply" in tutor_res.json()
    assert tutor_res.json()["mode"] == "Socratic Guided Discovery"

    # 2. Record Study Room Focus Session
    session_res = client.post(
        "/api/v1/learning-os/study-room/session",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "subject": "General Science",
            "topic": "Photosynthesis",
            "mode": "study_room",
            "duration_seconds": 1500,
            "goals": "Understand light and dark reactions",
            "notes": "Chlorophyll absorbs red and blue light."
        }
    )
    assert session_res.status_code == 201
    assert session_res.json()["status"] == "success"

    # 3. Retrieve Learning Analytics
    analytics_res = client.get(
        "/api/v1/learning-os/analytics",
        headers={"Authorization": f"Bearer {student_token}"}
    )
    assert analytics_res.status_code == 200
    data = analytics_res.json()["analytics"]
    assert data["completed_sessions_count"] >= 1
    db.close()


def test_revoked_guardian_link_immediately_blocks_access(tenant_fixture):
    """
    Verifies that revoking a relationship immediately terminates access without delay.
    """
    db = SessionLocal()
    user, raw_token = IdentityService.provision_guardian_account(
        db=db,
        tenant_id=tenant_fixture["tenant_id"],
        guardian_id=uuid.UUID(tenant_fixture["guardian1_id"]),
        created_by_user_id=tenant_fixture["admin_id"]
    )
    IdentityService.activate_account(db, raw_token, "RevokeTestPass123!")

    login_res = client.post("/api/v1/auth/guardian", json={
        "identifier": tenant_fixture["guardian1_phone"],
        "password": "RevokeTestPass123!",
        "tenant_id": tenant_fixture["tenant_id"]
    })
    guardian_token = login_res.json()["access_token"]

    # Pre-condition: Has access
    pre_res = client.get(
        f"/api/v1/guardians/me/children/{tenant_fixture['student1_id']}/progress-card",
        headers={"Authorization": f"Bearer {guardian_token}"}
    )
    assert pre_res.status_code == 200

    # Admin revokes link
    revoke_res = client.post(
        f"/api/v1/guardians/admin/links/{tenant_fixture['link1_id']}/revoke",
        headers={"Authorization": f"Bearer {tenant_fixture['admin_token']}"}
    )
    assert revoke_res.status_code == 200

    # Post-condition: Access blocked immediately (403)
    post_res = client.get(
        f"/api/v1/guardians/me/children/{tenant_fixture['student1_id']}/progress-card",
        headers={"Authorization": f"Bearer {guardian_token}"}
    )
    assert post_res.status_code == 403
    db.close()

