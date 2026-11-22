"""
Stage 05 Verification Test Suite: Role-Based Access Control (RBAC) & Authorization Hardening
Validates:
1. Canonical RBAC matrix integrity, role hierarchy, and permission resolution.
2. require_permissions and require_roles dependency enforcement.
3. Privilege escalation prevention in user management and role assignment.
4. Cross-tenant role assignment denial and boundary containment.
5. Resource-level IDOR/BOLA protection on student profiles (guardians/students).
6. Negative authorization checks across operational endpoints.
"""

import uuid
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, or_
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from app.core.rbac import (
    Permission,
    RoleEnum,
    ROLE_PERMISSIONS,
    has_permission,
    has_all_permissions,
    has_any_permission,
    normalize_role,
    validate_role_assignment,
    get_role_permissions,
)
from app.api.deps import (
    require_permissions,
    require_roles,
    get_db as deps_get_db,
    get_current_tenant_id,
    get_current_user,
    get_current_user_claims,
)
from app.core.security import create_access_token, clear_revocation_store
from app.models.base import Base
from app.models.tenant import User, Tenant
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.finance import FeePayment
from app.models.attendance import AttendanceEvent
from app.models.result import StudentResult
from app.models.academic import StudentEnrollmentHistory
from app.main import app

# Teach SQLite compiler to render PostgreSQL JSONB as JSON during in-memory tests
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"


# ----------------------------------------------------------------------------------------
# In-Memory SQLite Fixtures for Stage 05 Testing
# ----------------------------------------------------------------------------------------
@pytest.fixture
def sqlite_session():
    """Provides a thread-safe, isolated in-memory SQLite session for testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Register only the specific tables needed for Stage 05 RBAC tests
    target_tables = [
        User.__table__,
        Student.__table__,
        Guardian.__table__,
        GuardianStudentLink.__table__,
        FeePayment.__table__,
        AttendanceEvent.__table__,
        StudentResult.__table__,
        StudentEnrollmentHistory.__table__,
    ]
    Base.metadata.create_all(bind=engine, tables=target_tables)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine, tables=target_tables)


@pytest.fixture(autouse=True)
def clean_overrides():
    clear_revocation_store()
    app.dependency_overrides.clear()
    yield
    clear_revocation_store()
    app.dependency_overrides.clear()


# ----------------------------------------------------------------------------------------
# 1. RBAC Matrix & Permission Resolution Tests
# ----------------------------------------------------------------------------------------
def test_rbac_matrix_completeness():
    """Validates that all roles exist and have expected core permission assignments."""
    assert RoleEnum.SUPERADMIN.value in ROLE_PERMISSIONS
    assert RoleEnum.ADMIN.value in ROLE_PERMISSIONS
    assert RoleEnum.FINANCE_OFFICER.value in ROLE_PERMISSIONS
    assert RoleEnum.TEACHER.value in ROLE_PERMISSIONS
    assert RoleEnum.GUARDIAN.value in ROLE_PERMISSIONS
    assert RoleEnum.STUDENT.value in ROLE_PERMISSIONS

    # Superadmin has platform management
    assert has_permission("superadmin", Permission.PLATFORM_MANAGE)
    assert has_permission("superadmin", Permission.AUDIT_READ)

    # Admin has operational authorities but NOT platform management
    assert has_permission("admin", Permission.STUDENTS_CREATE)
    assert has_permission("admin", Permission.FINANCE_INVOICES_CREATE)
    assert not has_permission("admin", Permission.PLATFORM_MANAGE)

    # Teacher has classroom authorities but CANNOT create invoices or delete students
    assert has_permission("teacher", Permission.ATTENDANCE_MARK)
    assert has_permission("teacher", Permission.EXAMS_MANAGE)
    assert not has_permission("teacher", Permission.FINANCE_INVOICES_CREATE)
    assert not has_permission("teacher", Permission.STUDENTS_DELETE)

    # Finance officer has financial ledger permissions but CANNOT manage academic courses
    assert has_permission("finance_officer", Permission.FINANCE_PAYMENTS_RECORD)
    assert has_permission("accountant", Permission.FINANCE_PAYMENTS_RECORD)
    assert not has_permission("finance_officer", Permission.ACADEMIC_MANAGE)
    # Separation of duties: finance officer can initiate refund, but admin approves
    assert has_permission("finance_officer", Permission.FINANCE_REFUNDS_INITIATE)
    assert not has_permission("finance_officer", Permission.FINANCE_REFUNDS_APPROVE)


def test_permission_checker_helpers():
    """Tests normalization, has_all_permissions, and custom permission extension."""
    assert normalize_role("  ADMIN  ") == "admin"
    assert normalize_role("Accountant") == "finance_officer"
    assert normalize_role("SuperAdmin") == "superadmin"

    # All permissions check
    assert has_all_permissions("admin", [Permission.STUDENTS_READ, Permission.STUDENTS_CREATE])
    assert not has_all_permissions("teacher", [Permission.STUDENTS_READ, Permission.STUDENTS_DELETE])

    # Custom permission override
    assert not has_permission("teacher", Permission.FINANCE_INVOICES_READ)
    assert has_permission("teacher", Permission.FINANCE_INVOICES_READ, custom_permissions=[Permission.FINANCE_INVOICES_READ])


def test_require_permissions_dependency():
    """Tests the require_permissions dependency guard."""
    checker = require_permissions([Permission.STUDENTS_READ, Permission.STUDENTS_CREATE])
    
    # Valid claims
    admin_claims = {"role": "admin", "sub": str(uuid.uuid4()), "tenant_id": "test_t1"}
    assert checker(claims=admin_claims) == admin_claims

    # Invalid claims (insufficient permissions)
    teacher_claims = {"role": "teacher", "sub": str(uuid.uuid4()), "tenant_id": "test_t1"}
    with pytest.raises(HTTPException) as exc_info:
        checker(claims=teacher_claims)
    assert exc_info.value.status_code == 403
    assert "Security Policy Violation" in exc_info.value.detail


# ----------------------------------------------------------------------------------------
# 2. Privilege Escalation Prevention in Role Assignment
# ----------------------------------------------------------------------------------------
def test_validate_role_assignment_rules():
    actor_admin = str(uuid.uuid4())
    other_user = str(uuid.uuid4())
    superadmin = str(uuid.uuid4())

    # Rule 1: Self-modification is forbidden
    with pytest.raises(HTTPException) as exc_info:
        validate_role_assignment("admin", "admin", actor_admin, actor_admin)
    assert exc_info.value.status_code == 403
    assert "Self-modification" in exc_info.value.detail

    # Rule 2: Non-managers cannot assign roles
    with pytest.raises(HTTPException) as exc_info:
        validate_role_assignment("teacher", "teacher", actor_admin, other_user)
    assert exc_info.value.status_code == 403
    assert "Insufficient permissions" in exc_info.value.detail

    # Rule 3: Tenant admin CANNOT grant superadmin
    with pytest.raises(HTTPException) as exc_info:
        validate_role_assignment("admin", "superadmin", actor_admin, other_user)
    assert exc_info.value.status_code == 403
    assert "cannot assign platform superadmin" in exc_info.value.detail

    # Rule 4: Superadmin CAN grant superadmin
    validate_role_assignment("superadmin", "superadmin", superadmin, other_user)

    # Rule 5: Admin CAN grant tenant-level roles
    validate_role_assignment("admin", "teacher", actor_admin, other_user)
    validate_role_assignment("admin", "finance_officer", actor_admin, other_user)

    # Rule 6: Invalid role rejected with 400
    with pytest.raises(HTTPException) as exc_info:
        validate_role_assignment("admin", "god_mode_hacker", actor_admin, other_user)
    assert exc_info.value.status_code == 400


# ----------------------------------------------------------------------------------------
# 3. User Management Endpoint Authorization & Escalation Protection
# ----------------------------------------------------------------------------------------
def test_user_role_assignment_endpoint(sqlite_session):
    client = TestClient(app)
    tenant_uuid = uuid.uuid4()
    tenant_id = str(tenant_uuid)

    actor_admin_id = uuid.uuid4()
    target_user_id = uuid.uuid4()

    admin_user = User(
        id=actor_admin_id,
        tenant_id=tenant_uuid,
        email="admin@test.org",
        password_hash="test_hash",
        role="admin",
        is_active=True,
    )
    target_user = User(
        id=target_user_id,
        tenant_id=tenant_uuid,
        email="target@test.org",
        password_hash="test_hash",
        role="teacher",
        is_active=True,
    )
    sqlite_session.add(admin_user)
    sqlite_session.add(target_user)
    sqlite_session.commit()

    # Override dependencies
    app.dependency_overrides[deps_get_db] = lambda: sqlite_session
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_id

    admin_token = create_access_token(data={"sub": str(actor_admin_id), "tenant_id": tenant_id, "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Attempt self-role modification -> 403 Forbidden
    res_self = client.put(
        f"/api/v1/users/{actor_admin_id}/role",
        json={"role": "admin"},
        headers=headers
    )
    assert res_self.status_code == 403
    assert "Self-modification" in res_self.json()["detail"]

    # 2. Attempt privilege escalation to superadmin -> 403 Forbidden
    res_escalate = client.put(
        f"/api/v1/users/{target_user_id}/role",
        json={"role": "superadmin"},
        headers=headers
    )
    assert res_escalate.status_code == 403
    assert "cannot assign platform superadmin" in res_escalate.json()["detail"]

    # 3. Legitimate role update to finance_officer -> 200 OK
    res_valid = client.put(
        f"/api/v1/users/{target_user_id}/role",
        json={"role": "finance_officer"},
        headers=headers
    )
    assert res_valid.status_code == 200
    assert res_valid.json()["role"] == "finance_officer"
    
    # Verify in DB
    sqlite_session.refresh(target_user)
    assert target_user.role == "finance_officer"


def test_user_role_assignment_cross_tenant_isolation(sqlite_session):
    client = TestClient(app)
    tenant_a_uuid = uuid.uuid4()
    tenant_b_uuid = uuid.uuid4()
    tenant_a = str(tenant_a_uuid)
    tenant_b = str(tenant_b_uuid)

    admin_a_id = uuid.uuid4()
    user_b_id = uuid.uuid4()

    admin_a = User(
        id=admin_a_id,
        tenant_id=tenant_a_uuid,
        email="admin@tenant-a.com",
        password_hash="test_hash",
        role="admin",
        is_active=True,
    )
    user_b = User(
        id=user_b_id,
        tenant_id=tenant_b_uuid,
        email="user@tenant-b.com",
        password_hash="test_hash",
        role="teacher",
        is_active=True,
    )
    sqlite_session.add(admin_a)
    sqlite_session.add(user_b)
    sqlite_session.commit()

    app.dependency_overrides[deps_get_db] = lambda: sqlite_session
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_a

    token_a = create_access_token(data={"sub": str(admin_a_id), "tenant_id": tenant_a, "role": "admin"})
    headers = {"Authorization": f"Bearer {token_a}"}

    # Admin A attempts to modify User B (belonging to Tenant B)
    response = client.put(
        f"/api/v1/users/{user_b_id}/role",
        json={"role": "admin"},
        headers=headers
    )
    # Must fail with 404 (or 403), never modifying the other tenant's user
    assert response.status_code == 404
    
    sqlite_session.refresh(user_b)
    assert user_b.role == "teacher"


# ----------------------------------------------------------------------------------------
# 4. Roles Catalog Endpoint
# ----------------------------------------------------------------------------------------
def test_roles_catalog_endpoint():
    client = TestClient(app)
    tenant_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    token = create_access_token(data={"sub": user_id, "tenant_id": tenant_id, "role": "admin"})
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/users/roles/catalog", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "roles" in data
    assert "admin" in data["roles"]
    assert "teacher" in data["roles"]
    assert "finance_officer" in data["roles"]


# ----------------------------------------------------------------------------------------
# 5. Resource-Level IDOR / BOLA Guard (Students & Guardians)
# ----------------------------------------------------------------------------------------
def test_student_profile_idor_bola_protection(sqlite_session):
    client = TestClient(app)
    tenant_uuid = uuid.uuid4()
    tenant_id = str(tenant_uuid)

    # Create Students
    student_a_id = uuid.uuid4()
    student_b_id = uuid.uuid4()

    student_a = Student(
        id=student_a_id,
        tenant_id=tenant_id,
        first_name="Rahim",
        last_name="Uddin",
        admission_number="ADM-001",
        status="Active",
    )
    student_b = Student(
        id=student_b_id,
        tenant_id=tenant_id,
        first_name="Karim",
        last_name="Chowdhury",
        admission_number="ADM-002",
        status="Active",
    )
    sqlite_session.add(student_a)
    sqlite_session.add(student_b)

    # Create Users
    guardian_user_id = uuid.uuid4()
    guardian_user = User(
        id=guardian_user_id,
        tenant_id=tenant_uuid,
        email="guardian@example.com",
        password_hash="test_hash",
        role="guardian",
        is_active=True,
    )
    sqlite_session.add(guardian_user)

    # Create Guardian and Link ONLY to Student A
    guardian_id = uuid.uuid4()
    guardian_record = Guardian(
        id=guardian_id,
        tenant_id=tenant_id,
        user_id=guardian_user_id,
        first_name="Abdur",
        last_name="Rob",
        phone_number="+8801700000001",
    )
    sqlite_session.add(guardian_record)

    link_a = GuardianStudentLink(
        tenant_id=tenant_id,
        guardian_id=guardian_id,
        student_id=student_a_id,
        relationship_type=GuardianRelationship.FATHER,
        is_primary=True,
    )
    sqlite_session.add(link_a)
    sqlite_session.commit()

    # Wire overrides
    app.dependency_overrides[deps_get_db] = lambda: sqlite_session
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_id
    app.dependency_overrides[get_current_user] = lambda: guardian_user

    guardian_token = create_access_token(
        data={"sub": str(guardian_user_id), "tenant_id": tenant_id, "role": "guardian"}
    )
    headers = {"Authorization": f"Bearer {guardian_token}"}

    # 1. Guardian A accessing their linked student (Student A) -> 200 OK
    res_linked = client.get(f"/api/v1/students/{student_a_id}/profile-360", headers=headers)
    assert res_linked.status_code == 200, res_linked.text
    assert res_linked.json()["student"]["name"] == "Rahim Uddin"

    # 2. Guardian A attempting to access unlinked student (Student B) -> 403 Forbidden (BOLA blocked)
    res_unlinked = client.get(f"/api/v1/students/{student_b_id}/profile-360", headers=headers)
    assert res_unlinked.status_code == 403
    assert "not authorized to view this student" in res_unlinked.json()["detail"].lower()


# ----------------------------------------------------------------------------------------
# 6. Negative Authorization Tests Across Domain Endpoints
# ----------------------------------------------------------------------------------------
def test_teacher_cannot_admit_student():
    """Verify that a teacher role cannot invoke admin-only student admission."""
    client = TestClient(app)
    tenant_id = str(uuid.uuid4())
    teacher_id = str(uuid.uuid4())

    token = create_access_token(data={"sub": teacher_id, "tenant_id": tenant_id, "role": "teacher"})
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/students/admit",
        json={
            "first_name": "Test",
            "last_name": "Student",
            "admission_number": "ADM-999",
            "class_name": "Class 1",
            "guardian": {
                "first_name": "G",
                "last_name": "U",
                "phone_number": "01700000000",
            }
        },
        headers=headers,
    )
    assert response.status_code == 403
    assert "Security Policy Violation" in response.json()["detail"]


def test_student_cannot_list_all_students():
    """Verify that a student role cannot invoke class-wide student listing."""
    client = TestClient(app)
    tenant_id = str(uuid.uuid4())
    student_id = str(uuid.uuid4())

    token = create_access_token(data={"sub": student_id, "tenant_id": tenant_id, "role": "student"})
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/students/", headers=headers)
    assert response.status_code == 403
    assert "Security Policy Violation" in response.json()["detail"]
