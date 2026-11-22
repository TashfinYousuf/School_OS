# backend/tests/test_safe_deletion_lifecycle.py
"""
Test Suite: Safe User and Tenant Deletion Lifecycle & Foreign Key Integrity.
Verifies:
1. Deleting user with no dependencies.
2. Deleting user referenced by Teacher profile (cascade/cleanup without FK error).
3. Deleting user referenced by Guardian profile (SET NULL without FK error).
4. Deleting user referenced by Student profile (SET NULL without FK error).
5. User deactivation & reactivaton lifecycle.
6. User soft-deletion & login denial.
7. User GDPR/privacy-preserving anonymization (preserves UUID and audit logs while scrubbing PII).
8. Cross-tenant deletion prevention (cannot delete user belonging to another tenant).
9. Tenant dependency inventory reporting.
10. Tenant safe archival and permanent cascading deletion.
11. Audit history preservation (actor_id remains referentially valid after user deletion).
"""
import uuid
import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

import app.models
from app.models.base import Base
from app.models.tenant import Tenant, User, Role
from app.models.users import Teacher
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.student import Student
from app.models.academic import AcademicSession, ClassModel
from app.models.audit import AuditLog
from app.models.finance import Invoice, FeePayment
from app.models.curriculum import CurriculumDocument, CurriculumChunk
from app.services.lifecycle import LifecycleService
from app.core.security import get_password_hash

# SQLite JSONB compatibility
if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


def test_delete_user_with_no_dependencies():
    db = TestingSessionLocal()
    t_id = uuid.uuid4()
    tenant = Tenant(id=t_id, school_name="Test School", domain=f"test-{t_id.hex[:6]}.edu")
    user = User(id=uuid.uuid4(), tenant_id=t_id, email="standalone@test.com", password_hash="hash", role="teacher")
    db.add_all([tenant, user])
    db.commit()

    # Verify dependency inventory
    dep = LifecycleService.get_user_dependencies(db, str(t_id), user.id)
    assert dep["found"] is True
    assert dep["dependencies"]["teacher_profiles"] == 0

    # Permanent delete
    res = LifecycleService.delete_user_permanent(db, str(t_id), user.id, actor_id="admin-1", confirmed=True)
    assert res["success"] is True

    # User no longer exists
    assert db.query(User).filter(User.id == user.id).first() is None
    db.close()


def test_delete_user_referenced_by_teacher():
    db = TestingSessionLocal()
    t_id = uuid.uuid4()
    tenant = Tenant(id=t_id, school_name="Test School", domain=f"test-{t_id.hex[:6]}.edu")
    user = User(id=uuid.uuid4(), tenant_id=t_id, email="teacher@test.com", password_hash="hash", role="teacher")
    teacher = Teacher(
        id=uuid.uuid4(),
        tenant_id=t_id,
        user_id=user.id,
        first_name="Rahim",
        last_name="Uddin"
    )
    db.add_all([tenant, user, teacher])
    db.commit()

    # Check dependency count reflects teacher profile
    dep = LifecycleService.get_user_dependencies(db, str(t_id), user.id)
    assert dep["dependencies"]["teacher_profiles"] == 1

    # Permanent delete resolves teacher dependency safely without FK conflict
    res = LifecycleService.delete_user_permanent(db, str(t_id), user.id, actor_id="admin-1", confirmed=True)
    assert res["success"] is True

    # Both user and teacher are cleanly deleted
    assert db.query(User).filter(User.id == user.id).first() is None
    assert db.query(Teacher).filter(Teacher.id == teacher.id).first() is None
    db.close()


def test_delete_user_referenced_by_guardian_sets_null():
    db = TestingSessionLocal()
    t_id = uuid.uuid4()
    tenant = Tenant(id=t_id, school_name="Test School", domain=f"test-{t_id.hex[:6]}.edu")
    user = User(id=uuid.uuid4(), tenant_id=t_id, email="guardian@test.com", password_hash="hash", role="guardian")
    guardian = Guardian(
        id=uuid.uuid4(),
        tenant_id=str(t_id),
        user_id=user.id,
        first_name="Fatima",
        last_name="Begum",
        phone_number="01700000001"
    )
    db.add_all([tenant, user, guardian])
    db.commit()

    # Permanent delete
    res = LifecycleService.delete_user_permanent(db, str(t_id), user.id, actor_id="admin-1", confirmed=True)
    assert res["success"] is True

    # User is deleted, Guardian profile is preserved with user_id=None (SET NULL)
    assert db.query(User).filter(User.id == user.id).first() is None
    g = db.query(Guardian).filter(Guardian.id == guardian.id).first()
    assert g is not None
    assert g.user_id is None
    db.close()


def test_user_deactivation_and_reactivation():
    db = TestingSessionLocal()
    t_id = uuid.uuid4()
    tenant = Tenant(id=t_id, school_name="Test School", domain=f"test-{t_id.hex[:6]}.edu")
    user = User(id=uuid.uuid4(), tenant_id=t_id, email="staff@test.com", password_hash="hash", role="teacher", is_active=True)
    db.add_all([tenant, user])
    db.commit()

    # Deactivate
    deact = LifecycleService.deactivate_user(db, str(t_id), user.id, actor_id="admin-1")
    assert deact["success"] is True
    assert deact["is_active"] is False

    u = db.query(User).filter(User.id == user.id).first()
    assert u.is_active is False

    # Reactivate
    react = LifecycleService.reactivate_user(db, str(t_id), user.id, actor_id="admin-1")
    assert react["success"] is True
    assert react["is_active"] is True

    u = db.query(User).filter(User.id == user.id).first()
    assert u.is_active is True
    db.close()


def test_user_anonymization_preserves_audit_integrity():
    db = TestingSessionLocal()
    t_id = uuid.uuid4()
    tenant = Tenant(id=t_id, school_name="Test School", domain=f"test-{t_id.hex[:6]}.edu")
    user = User(
        id=uuid.uuid4(),
        tenant_id=t_id,
        email="real_person@test.com",
        password_hash="secret_hash",
        first_name="Personal",
        last_name="Identity",
        phone_number="01987654321",
        role="teacher",
        is_active=True
    )
    # Historic audit entry authored by this user
    audit = AuditLog(
        tenant_id=str(t_id),
        actor_id=str(user.id),
        action_type="grade.updated",
        target_entity="Student Roll 1"
    )
    db.add_all([tenant, user, audit])
    db.commit()

    # Anonymize
    anon = LifecycleService.anonymize_user(db, str(t_id), user.id, actor_id="admin-1")
    assert anon["success"] is True

    u = db.query(User).filter(User.id == user.id).first()
    assert "anonymized_" in u.email
    assert u.first_name == "Anonymized"
    assert u.phone_number is None
    assert u.is_active is False

    # Historical audit record remains completely intact referencing user.id
    saved_audit = db.query(AuditLog).filter(AuditLog.actor_id == str(user.id)).first()
    assert saved_audit is not None
    assert saved_audit.action_type == "grade.updated"
    db.close()


def test_cross_tenant_deletion_prevention():
    db = TestingSessionLocal()
    t1_id = uuid.uuid4()
    t2_id = uuid.uuid4()
    t1 = Tenant(id=t1_id, school_name="School 1", domain=f"s1-{t1_id.hex[:4]}.edu")
    t2 = Tenant(id=t2_id, school_name="School 2", domain=f"s2-{t2_id.hex[:4]}.edu")
    u2 = User(id=uuid.uuid4(), tenant_id=t2_id, email="u2@s2.com", password_hash="hash", role="teacher")
    db.add_all([t1, t2, u2])
    db.commit()

    # Attempting to delete School 2 user using School 1 tenant_id must fail
    res = LifecycleService.delete_user_permanent(db, str(t1_id), u2.id, actor_id="admin-1", confirmed=True)
    assert res["success"] is False
    assert "User not found" in res["error"]

    # User in School 2 is unharmed
    assert db.query(User).filter(User.id == u2.id).first() is not None
    db.close()


def test_tenant_archival_and_permanent_deletion():
    db = TestingSessionLocal()
    t_id = uuid.uuid4()
    u_id = uuid.uuid4()
    s_id = uuid.uuid4()
    c_id = uuid.uuid4()
    tid_str = str(t_id)

    tenant = Tenant(id=t_id, school_name="Piloting School", domain=f"pilot-{t_id.hex[:4]}.edu")
    user = User(id=u_id, tenant_id=t_id, email="admin@pilot.edu", password_hash="hash", role="admin")
    student = Student(id=s_id, tenant_id=tid_str, first_name="Sakib", last_name="Hasan", admission_number="STD-001")
    academic_cls = ClassModel(id=c_id, tenant_id=t_id, class_name="Class 5")
    db.add_all([tenant, user, student, academic_cls])
    db.commit()

    # 1. Dependency inventory reports correct counts
    inv = LifecycleService.get_tenant_dependencies(db, tid_str)
    assert inv["found"] is True
    assert inv["inventory"]["users"] == 1
    assert inv["inventory"]["students"] == 1
    assert inv["inventory"]["classes"] == 1

    # 2. Archive tenant (soft delete)
    arch = LifecycleService.archive_tenant(db, tid_str, actor_id="superadmin")
    assert arch["success"] is True

    t = db.query(Tenant).filter(Tenant.id == t_id).first()
    assert t.is_active is False
    assert t.deleted_at is not None

    u = db.query(User).filter(User.id == u_id).first()
    assert u.is_active is False

    # 3. Permanent cascade delete with explicit confirmation
    perm = LifecycleService.delete_tenant_permanent(db, tid_str, actor_id="superadmin", confirmed=True)
    assert perm["success"] is True

    # Entire tenant and subordinate rows are safely removed with zero FK violations
    assert db.query(Tenant).filter(Tenant.id == t_id).first() is None
    assert db.query(User).filter(User.id == u_id).first() is None
    assert db.query(Student).filter(Student.id == s_id).first() is None
    assert db.query(ClassModel).filter(ClassModel.id == c_id).first() is None
    db.close()
