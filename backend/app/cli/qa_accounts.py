"""
EducationOS Five-Role QA Account Provisioning & Verification CLI

Provides idempotent provisioning and rigorous verification for the five core UAT roles:
  1. Super Admin: superadmin@educationos.internal (Platform Operations)
  2. Admin      : admin@recon.edu.bd (School Principal/Admin)
  3. Teacher    : teacher@recon.edu.bd (Class 5 Math/Science)
  4. Student    : STU-2026-0001 (Rafiq Ahmed, Class 5-A, Roll 01)
  5. Guardian   : 01712345678 (Farid Ahmed, verified Father link)

Safety Guards:
  - Strictly refuses execution against production environments or hosts.
  - Generates secure random credentials saved to mode 0600 file (.qa-credentials.local).
  - Never prints passwords or secrets in CLI stdout or audit logs.

Usage:
  PYTHONPATH=backend venv/bin/python -m app.cli.qa_accounts provision
  PYTHONPATH=backend venv/bin/python -m app.cli.qa_accounts verify
"""

import os
import sys
import uuid
import stat
import string
import secrets
import argparse
from typing import Dict, Any, Optional

from sqlalchemy import or_, func, text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models.tenant import Tenant, User, SchoolProfile, Role
from app.models.student import Student
from app.models.users import Teacher
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.workspace import Organization, Workspace, WorkspaceMembership, WorkspaceType
from app.models.subscription import InstitutionSubscription

CREDENTIALS_FILE = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", ".qa-credentials.local")
)

SYNTHETIC_TENANT = {
    "name": "Reconstruction Test Academy",
    "domain": "recon.edu.bd",
    "address": "Dhanmondi, Dhaka-1209, Bangladesh",
    "eiin": "100999"
}

QA_ACCOUNTS = {
    "superadmin": {
        "email": "superadmin@educationos.internal",
        "username": "superadmin_platform",
        "first_name": "Platform",
        "last_name": "SuperAdmin",
        "role": "superadmin",
    },
    "admin": {
        "email": "admin@recon.edu.bd",
        "username": "admin_recon",
        "first_name": "Recon",
        "last_name": "Administrator",
        "role": "admin",
    },
    "teacher": {
        "email": "teacher@recon.edu.bd",
        "username": "teacher_recon",
        "first_name": "Tariqul",
        "last_name": "Islam",
        "role": "teacher",
        "designation": "Senior Science Educator",
        "assigned_class": "Class 5",
        "subjects": "Mathematics, General Science",
        "employee_id": "TCH-2026-001"
    },
    "student": {
        "email": "stu20260001@recon.edu.bd",
        "username": "STU-2026-0001",
        "admission_number": "STU-2026-0001",
        "first_name": "Rafiq",
        "last_name": "Ahmed",
        "role": "student",
        "class_name": "Class 5",
        "section": "A",
        "roll_number": "01",
        "academic_year": "2026"
    },
    "guardian": {
        "email": "guardian01712345678@recon.edu.bd",
        "phone_number": "01712345678",
        "username": "01712345678",
        "first_name": "Farid",
        "last_name": "Ahmed",
        "role": "guardian",
        "profession": "Software Architect",
        "relationship": GuardianRelationship.FATHER
    }
}


def check_environment_safety():
    """Refuses execution if environment appears to be production."""
    env = os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).lower()
    db_url = getattr(settings, "DATABASE_URL", str(engine.url)).lower()

    if env == "production":
        print("[CRITICAL ERROR] Refusing to provision or run QA CLI in production environment (ENV=production)!", file=sys.stderr)
        sys.exit(1)

    # Supabase production hostname guard
    if "supabase.co" in db_url and "prod" in db_url:
        print("[CRITICAL ERROR] Refusing to run QA CLI on production Supabase database!", file=sys.stderr)
        sys.exit(1)


def generate_secure_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def get_or_create_tenant(db: Session) -> Tenant:
    tenant = db.query(Tenant).filter(
        or_(Tenant.domain == SYNTHETIC_TENANT["domain"], Tenant.school_name == SYNTHETIC_TENANT["name"])
    ).first()

    if not tenant:
        tenant = Tenant(
            id=uuid.uuid4(),
            school_name=SYNTHETIC_TENANT["name"],
            domain=SYNTHETIC_TENANT["domain"],
            address=SYNTHETIC_TENANT["address"]
        )
        db.add(tenant)
        db.flush()

    # Ensure SchoolProfile exists
    profile = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == str(tenant.id)).first()
    if not profile:
        profile = SchoolProfile(
            id=uuid.uuid4(),
            tenant_id=str(tenant.id),
            school_name=SYNTHETIC_TENANT["name"],
            address=SYNTHETIC_TENANT["address"],
            eiin_or_code=SYNTHETIC_TENANT["eiin"],
            tagline="Excellence in Technology-Driven Education",
            academic_year="2026"
        )
        db.add(profile)
        db.flush()

    return tenant


def provision_all() -> None:
    check_environment_safety()
    print("=" * 70)
    print("EDUCATIONOS — FIVE-ROLE QA ACCOUNT PROVISIONING")
    print("=" * 70)

    db: Session = SessionLocal()
    passwords: Dict[str, str] = {}

    try:
        tenant = get_or_create_tenant(db)
        tenant_id = tenant.id
        db.info["tenant_id"] = str(tenant_id)
        print(f"[OK] Tenant: {tenant.school_name} (ID: {tenant_id})")

        # 0. SUPERADMIN PROVISIONING (Platform Operations)
        superadmin_meta = QA_ACCOUNTS["superadmin"]
        superadmin_pw = generate_secure_password(16)
        passwords["superadmin"] = superadmin_pw
        superadmin_user = db.query(User).filter(
            User.tenant_id == tenant_id,
            func.lower(User.email) == superadmin_meta["email"].lower()
        ).first()

        if not superadmin_user:
            superadmin_user = User(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                email=superadmin_meta["email"],
                username=superadmin_meta["username"],
                first_name=superadmin_meta["first_name"],
                last_name=superadmin_meta["last_name"],
                role="superadmin",
                is_active=True,
                password_hash=get_password_hash(superadmin_pw)
            )
            db.add(superadmin_user)
        else:
            superadmin_user.password_hash = get_password_hash(superadmin_pw)
            superadmin_user.is_active = True
            superadmin_user.role = "superadmin"
        db.flush()
        print(f"[OK] Superadmin User provisioned: {superadmin_meta['email']}")

        # 1. ADMIN PROVISIONING
        admin_meta = QA_ACCOUNTS["admin"]
        admin_pw = generate_secure_password(16)
        passwords["admin"] = admin_pw
        admin_user = db.query(User).filter(
            User.tenant_id == tenant_id,
            func.lower(User.email) == admin_meta["email"].lower()
        ).first()

        if not admin_user:
            admin_user = User(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                email=admin_meta["email"],
                username=admin_meta["username"],
                first_name=admin_meta["first_name"],
                last_name=admin_meta["last_name"],
                role="admin",
                is_active=True,
                password_hash=get_password_hash(admin_pw)
            )
            db.add(admin_user)
        else:
            admin_user.password_hash = get_password_hash(admin_pw)
            admin_user.is_active = True
            admin_user.role = "admin"
        db.flush()
        print(f"[OK] Admin User provisioned: {admin_meta['email']}")

        # 2. TEACHER PROVISIONING
        teacher_meta = QA_ACCOUNTS["teacher"]
        teacher_pw = generate_secure_password(16)
        passwords["teacher"] = teacher_pw
        teacher_user = db.query(User).filter(
            User.tenant_id == tenant_id,
            func.lower(User.email) == teacher_meta["email"].lower()
        ).first()

        if not teacher_user:
            teacher_user = User(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                email=teacher_meta["email"],
                username=teacher_meta["username"],
                first_name=teacher_meta["first_name"],
                last_name=teacher_meta["last_name"],
                role="teacher",
                is_active=True,
                password_hash=get_password_hash(teacher_pw)
            )
            db.add(teacher_user)
            db.flush()
        else:
            teacher_user.password_hash = get_password_hash(teacher_pw)
            teacher_user.is_active = True
            teacher_user.role = "teacher"
            db.flush()

        teacher_prof = db.query(Teacher).filter(
            Teacher.tenant_id == tenant_id,
            Teacher.user_id == teacher_user.id
        ).first()

        if not teacher_prof:
            teacher_prof = Teacher(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                user_id=teacher_user.id,
                first_name=teacher_meta["first_name"],
                last_name=teacher_meta["last_name"],
                designation=teacher_meta["designation"],
                assigned_class=teacher_meta["assigned_class"],
                subjects_taught=teacher_meta["subjects"],
                employee_id=teacher_meta["employee_id"],
                status="Active"
            )
            db.add(teacher_prof)
        else:
            teacher_prof.assigned_class = teacher_meta["assigned_class"]
            teacher_prof.subjects_taught = teacher_meta["subjects"]
            teacher_prof.status = "Active"
        db.flush()
        print(f"[OK] Teacher User & Profile provisioned: {teacher_meta['email']} (Class 5 Math/Sci)")

        # 3. STUDENT PROVISIONING
        student_meta = QA_ACCOUNTS["student"]
        student_pw = generate_secure_password(16)
        passwords["student"] = student_pw
        student_user = db.query(User).filter(
            User.tenant_id == tenant_id,
            or_(
                func.lower(User.email) == student_meta["email"].lower(),
                func.upper(User.username) == student_meta["admission_number"]
            )
        ).first()

        if not student_user:
            student_user = User(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                email=student_meta["email"],
                username=student_meta["admission_number"],
                first_name=student_meta["first_name"],
                last_name=student_meta["last_name"],
                role="student",
                is_active=True,
                password_hash=get_password_hash(student_pw)
            )
            db.add(student_user)
            db.flush()
        else:
            student_user.password_hash = get_password_hash(student_pw)
            student_user.is_active = True
            student_user.role = "student"
            db.flush()

        student_rec = db.query(Student).filter(
            Student.tenant_id == tenant_id,
            func.upper(Student.admission_number) == student_meta["admission_number"]
        ).first()

        if not student_rec:
            student_rec = Student(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                user_id=student_user.id,
                first_name=student_meta["first_name"],
                last_name=student_meta["last_name"],
                admission_number=student_meta["admission_number"],
                class_name=student_meta["class_name"],
                section=student_meta["section"],
                roll_number=student_meta["roll_number"],
                academic_year=student_meta["academic_year"],
                status="Active"
            )
            db.add(student_rec)
        else:
            student_rec.user_id = student_user.id
            student_rec.class_name = student_meta["class_name"]
            student_rec.section = student_meta["section"]
            student_rec.roll_number = student_meta["roll_number"]
            student_rec.status = "Active"
        db.flush()
        print(f"[OK] Student User & Registry provisioned: {student_meta['admission_number']} (Rafiq Ahmed, Class 5-A, Roll 01)")

        # 4. GUARDIAN PROVISIONING & STUDENT LINK
        guardian_meta = QA_ACCOUNTS["guardian"]
        guardian_pw = generate_secure_password(16)
        passwords["guardian"] = guardian_pw
        clean_phone = guardian_meta["phone_number"]

        guardian_user = db.query(User).filter(
            User.tenant_id == tenant_id,
            or_(
                func.lower(User.email) == guardian_meta["email"].lower(),
                User.phone_number == clean_phone
            )
        ).first()

        if not guardian_user:
            guardian_user = User(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                email=guardian_meta["email"],
                phone_number=clean_phone,
                username=clean_phone,
                first_name=guardian_meta["first_name"],
                last_name=guardian_meta["last_name"],
                role="guardian",
                is_active=True,
                password_hash=get_password_hash(guardian_pw)
            )
            db.add(guardian_user)
            db.flush()
        else:
            guardian_user.password_hash = get_password_hash(guardian_pw)
            guardian_user.phone_number = clean_phone
            guardian_user.is_active = True
            guardian_user.role = "guardian"
            db.flush()

        guardian_prof = db.query(Guardian).filter(
            Guardian.tenant_id == tenant_id,
            or_(
                Guardian.user_id == guardian_user.id,
                Guardian.phone_number == clean_phone
            )
        ).first()

        if not guardian_prof:
            guardian_prof = Guardian(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                user_id=guardian_user.id,
                first_name=guardian_meta["first_name"],
                last_name=guardian_meta["last_name"],
                phone_number=clean_phone,
                email=guardian_meta["email"],
                profession=guardian_meta["profession"]
            )
            db.add(guardian_prof)
            db.flush()
        else:
            guardian_prof.user_id = guardian_user.id
            guardian_prof.phone_number = clean_phone
            db.flush()

        # Link Guardian to Student
        link = db.query(GuardianStudentLink).filter(
            GuardianStudentLink.tenant_id == tenant_id,
            GuardianStudentLink.guardian_id == guardian_prof.id,
            GuardianStudentLink.student_id == student_rec.id
        ).first()

        if not link:
            link = GuardianStudentLink(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                guardian_id=guardian_prof.id,
                student_id=student_rec.id,
                relationship_type=guardian_meta["relationship"],
                is_primary=True,
                is_primary_contact=True,
                verification_status="VERIFIED",
                verification_method="UAT_PROVISIONING"
            )
            db.add(link)
        else:
            link.verification_status = "VERIFIED"
            link.is_primary = True
        db.flush()
        print(f"[OK] Guardian User, Profile & Student Link provisioned: {clean_phone} (Linked to {student_meta['admission_number']})")

        # 5. ORGANIZATION & WORKSPACE PROVISIONING
        org = db.query(Organization).filter(Organization.id == tenant_id).first()
        if not org:
            org = Organization(
                id=tenant_id,
                name=tenant.school_name,
                institution_type="school",
                address=tenant.address,
                is_active=True
            )
            db.add(org)
            db.flush()

        school_ws = db.query(Workspace).filter(
            Workspace.tenant_id == str(tenant_id),
            Workspace.workspace_type == WorkspaceType.SCHOOL
        ).first()

        if not school_ws:
            school_ws = Workspace(
                tenant_id=str(tenant_id),
                organization_id=org.id,
                name=tenant.school_name,
                code="RECON-SCH",
                workspace_type=WorkspaceType.SCHOOL,
                enabled_modules={
                    "attendance": True,
                    "students": True,
                    "finance": True,
                    "exams": True,
                    "notices": True,
                    "routine": True,
                    "ai_copilot": True,
                    "live_exams": True,
                    "batches": True
                },
                is_active=True
            )
            db.add(school_ws)
            db.flush()

        # Memberships
        for u in [superadmin_user, admin_user, teacher_user, student_user]:
            mem = db.query(WorkspaceMembership).filter(
                WorkspaceMembership.user_id == str(u.id),
                WorkspaceMembership.workspace_id == school_ws.id
            ).first()
            if not mem:
                mem = WorkspaceMembership(
                    user_id=str(u.id),
                    workspace_id=school_ws.id,
                    role=u.role,
                    is_active=True
                )
                db.add(mem)
        db.flush()

        # 6. ACTIVE SUBSCRIPTION PROVISIONING
        import datetime
        now_dt = datetime.datetime.now(datetime.timezone.utc)
        sub = db.query(InstitutionSubscription).filter(InstitutionSubscription.tenant_id == str(tenant_id)).first()
        if not sub:
            sub = InstitutionSubscription(
                tenant_id=str(tenant_id),
                plan_tier="growth",
                workspace_scope="unified",
                monthly_fee=2490.0,
                billing_cycle="monthly",
                subscription_status="ACTIVE",
                current_period_start=now_dt,
                valid_until=now_dt + datetime.timedelta(days=90),
                max_active_students=500,
                ai_question_quota_monthly=500,
                ai_questions_used_this_month=0
            )
            db.add(sub)
        else:
            sub.subscription_status = "ACTIVE"
            sub.valid_until = max(sub.valid_until or now_dt, now_dt + datetime.timedelta(days=90))
        db.flush()

        # Commit all entities cleanly
        db.commit()

        # Write credentials securely to .qa-credentials.local with chmod 0600
        cred_content = (
            "# EDUCATIONOS UAT QA CREDENTIALS — LOCAL ONLY\n"
            "# DO NOT COMMIT TO VERSION CONTROL\n\n"
            f"[TENANT]\n"
            f"TENANT_ID = {tenant_id}\n"
            f"SCHOOL_NAME = {tenant.school_name}\n"
            f"DOMAIN = {tenant.domain}\n\n"
            f"[SUPERADMIN]\n"
            f"ROLE = superadmin\n"
            f"EMAIL = {superadmin_meta['email']}\n"
            f"PASSWORD = {passwords['superadmin']}\n\n"
            f"[ADMIN]\n"
            f"ROLE = admin\n"
            f"EMAIL = {admin_meta['email']}\n"
            f"PASSWORD = {passwords['admin']}\n\n"
            f"[TEACHER]\n"
            f"ROLE = teacher\n"
            f"EMAIL = {teacher_meta['email']}\n"
            f"PASSWORD = {passwords['teacher']}\n"
            f"ASSIGNED_CLASS = {teacher_meta['assigned_class']}\n"
            f"SUBJECTS = {teacher_meta['subjects']}\n\n"
            f"[STUDENT]\n"
            f"ROLE = student\n"
            f"ADMISSION_NUMBER = {student_meta['admission_number']}\n"
            f"EMAIL = {student_meta['email']}\n"
            f"PASSWORD = {passwords['student']}\n"
            f"CLASS = {student_meta['class_name']}-{student_meta['section']}\n"
            f"ROLL = {student_meta['roll_number']}\n\n"
            f"[GUARDIAN]\n"
            f"ROLE = guardian\n"
            f"PHONE = {guardian_meta['phone_number']}\n"
            f"EMAIL = {guardian_meta['email']}\n"
            f"PASSWORD = {passwords['guardian']}\n"
            f"LINKED_STUDENT = {student_meta['admission_number']}\n"
        )

        with open(CREDENTIALS_FILE, "w") as f:
            f.write(cred_content)
        os.chmod(CREDENTIALS_FILE, stat.S_IRUSR | stat.S_IWUSR)  # 0600

        print("=" * 70)
        print("[SUCCESS] All 5 QA Accounts provisioned and persisted successfully.")
        print(f"[PROTECTED] Credentials saved to local file: {CREDENTIALS_FILE} (permissions: 0600).")
        print("[AUDIT SAFE] No plaintext passwords have been written to stdout.")
        print("=" * 70)

    except Exception as e:
        db.rollback()
        print(f"[FAILED] QA Provisioning aborted due to error: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


def verify_all() -> None:
    check_environment_safety()
    print("=" * 80)
    print("EDUCATIONOS — FIVE-ROLE QA ACCOUNT INDEPENDENT VERIFICATION")
    print("=" * 80)

    # Read credentials file if available
    local_creds: Dict[str, Dict[str, str]] = {}
    if os.path.exists(CREDENTIALS_FILE):
        current_section = None
        with open(CREDENTIALS_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith("[") and line.endswith("]"):
                    current_section = line[1:-1].lower()
                    local_creds[current_section] = {}
                elif "=" in line and current_section:
                    k, v = line.split("=", 1)
                    local_creds[current_section][k.strip().lower()] = v.strip()

    db: Session = SessionLocal()
    audit_results = []
    overall_pass = True

    try:
        tenant = db.query(Tenant).filter(
            or_(Tenant.domain == SYNTHETIC_TENANT["domain"], Tenant.school_name == SYNTHETIC_TENANT["name"])
        ).first()

        if not tenant:
            print("[FAIL] Synthetic Test Tenant not found in database!", file=sys.stderr)
            sys.exit(1)

        tenant_id = tenant.id
        db.info["tenant_id"] = str(tenant_id)
        print(f"Target Tenant: {tenant.school_name} (Domain: {tenant.domain}, ID: {tenant_id})")
        print("-" * 80)

        # 0. VERIFY SUPERADMIN
        superadmin_meta = QA_ACCOUNTS["superadmin"]
        superadmin_user = db.query(User).filter(
            User.tenant_id == tenant_id,
            func.lower(User.email) == superadmin_meta["email"].lower()
        ).first()

        superadmin_hash_ok = False
        if superadmin_user and "superadmin" in local_creds and "password" in local_creds["superadmin"]:
            superadmin_hash_ok = verify_password(local_creds["superadmin"]["password"], superadmin_user.password_hash)

        superadmin_pass = bool(superadmin_user and superadmin_user.is_active and superadmin_user.role == "superadmin" and superadmin_hash_ok)
        if not superadmin_pass: overall_pass = False
        audit_results.append({
            "role": "SuperAdmin",
            "identifier": superadmin_meta["email"],
            "user_id": str(superadmin_user.id)[:8] + "..." if superadmin_user else "MISSING",
            "active": "YES" if superadmin_user and superadmin_user.is_active else "NO",
            "hash_valid": "PASS" if superadmin_hash_ok else "UNVERIFIED",
            "profile": "Platform Operations",
            "status": "PASS" if superadmin_pass else "FAIL"
        })

        # 1. VERIFY ADMIN
        admin_meta = QA_ACCOUNTS["admin"]
        admin_user = db.query(User).filter(
            User.tenant_id == tenant_id,
            func.lower(User.email) == admin_meta["email"].lower()
        ).first()

        admin_hash_ok = False
        if admin_user and "admin" in local_creds and "password" in local_creds["admin"]:
            admin_hash_ok = verify_password(local_creds["admin"]["password"], admin_user.password_hash)

        admin_pass = bool(admin_user and admin_user.is_active and admin_user.role == "admin" and admin_hash_ok)
        if not admin_pass: overall_pass = False
        audit_results.append({
            "role": "Admin",
            "identifier": admin_meta["email"],
            "user_id": str(admin_user.id)[:8] + "..." if admin_user else "MISSING",
            "active": "YES" if admin_user and admin_user.is_active else "NO",
            "hash_valid": "PASS" if admin_hash_ok else "UNVERIFIED",
            "profile": "System Administrator",
            "status": "PASS" if admin_pass else "FAIL"
        })

        # 2. VERIFY TEACHER
        teacher_meta = QA_ACCOUNTS["teacher"]
        teacher_user = db.query(User).filter(
            User.tenant_id == tenant_id,
            func.lower(User.email) == teacher_meta["email"].lower()
        ).first()

        teacher_hash_ok = False
        if teacher_user and "teacher" in local_creds and "password" in local_creds["teacher"]:
            teacher_hash_ok = verify_password(local_creds["teacher"]["password"], teacher_user.password_hash)

        teacher_prof = db.query(Teacher).filter(
            Teacher.tenant_id == tenant_id,
            Teacher.user_id == (teacher_user.id if teacher_user else None)
        ).first()

        teacher_pass = bool(
            teacher_user and teacher_user.is_active and teacher_user.role == "teacher"
            and teacher_hash_ok and teacher_prof and teacher_prof.assigned_class == "Class 5"
        )
        if not teacher_pass: overall_pass = False
        audit_results.append({
            "role": "Teacher",
            "identifier": teacher_meta["email"],
            "user_id": str(teacher_user.id)[:8] + "..." if teacher_user else "MISSING",
            "active": "YES" if teacher_user and teacher_user.is_active else "NO",
            "hash_valid": "PASS" if teacher_hash_ok else "UNVERIFIED",
            "profile": f"Class 5 ({teacher_prof.subjects_taught})" if teacher_prof else "NO_PROFILE",
            "status": "PASS" if teacher_pass else "FAIL"
        })

        # 3. VERIFY STUDENT
        student_meta = QA_ACCOUNTS["student"]
        student_user = db.query(User).filter(
            User.tenant_id == tenant_id,
            or_(
                func.lower(User.email) == student_meta["email"].lower(),
                func.upper(User.username) == student_meta["admission_number"]
            )
        ).first()

        student_hash_ok = False
        if student_user and "student" in local_creds and "password" in local_creds["student"]:
            student_hash_ok = verify_password(local_creds["student"]["password"], student_user.password_hash)

        student_rec = db.query(Student).filter(
            Student.tenant_id == tenant_id,
            func.upper(Student.admission_number) == student_meta["admission_number"]
        ).first()

        student_pass = bool(
            student_user and student_user.is_active and student_user.role == "student"
            and student_hash_ok and student_rec and student_rec.class_name == "Class 5"
        )
        if not student_pass: overall_pass = False
        audit_results.append({
            "role": "Student",
            "identifier": student_meta["admission_number"],
            "user_id": str(student_user.id)[:8] + "..." if student_user else "MISSING",
            "active": "YES" if student_user and student_user.is_active else "NO",
            "hash_valid": "PASS" if student_hash_ok else "UNVERIFIED",
            "profile": f"{student_rec.first_name} {student_rec.last_name} (Roll {student_rec.roll_number})" if student_rec else "NO_REGISTRY",
            "status": "PASS" if student_pass else "FAIL"
        })

        # 4. VERIFY GUARDIAN & LINK
        guardian_meta = QA_ACCOUNTS["guardian"]
        clean_phone = guardian_meta["phone_number"]

        guardian_user = db.query(User).filter(
            User.tenant_id == tenant_id,
            or_(
                func.lower(User.email) == guardian_meta["email"].lower(),
                User.phone_number == clean_phone
            )
        ).first()

        guardian_hash_ok = False
        if guardian_user and "guardian" in local_creds and "password" in local_creds["guardian"]:
            guardian_hash_ok = verify_password(local_creds["guardian"]["password"], guardian_user.password_hash)

        guardian_prof = db.query(Guardian).filter(
            Guardian.tenant_id == tenant_id,
            Guardian.user_id == (guardian_user.id if guardian_user else None)
        ).first()

        link = None
        if guardian_prof and student_rec:
            link = db.query(GuardianStudentLink).filter(
                GuardianStudentLink.tenant_id == tenant_id,
                GuardianStudentLink.guardian_id == guardian_prof.id,
                GuardianStudentLink.student_id == student_rec.id,
                GuardianStudentLink.verification_status == "VERIFIED"
            ).first()

        guardian_pass = bool(
            guardian_user and guardian_user.is_active and guardian_user.role == "guardian"
            and guardian_hash_ok and guardian_prof and link
        )
        if not guardian_pass: overall_pass = False
        audit_results.append({
            "role": "Guardian",
            "identifier": clean_phone,
            "user_id": str(guardian_user.id)[:8] + "..." if guardian_user else "MISSING",
            "active": "YES" if guardian_user and guardian_user.is_active else "NO",
            "hash_valid": "PASS" if guardian_hash_ok else "UNVERIFIED",
            "profile": f"Linked to {student_meta['admission_number']} ({link.relationship_type.value if link else 'NO_LINK'})",
            "status": "PASS" if guardian_pass else "FAIL"
        })

        # PRINT FORMATTED AUDIT TABLE (NO SECRETS)
        print(f"{'ROLE':<10} | {'IDENTIFIER':<24} | {'ACTIVE':<6} | {'HASH':<6} | {'PROFILE & LINKAGE':<36} | {'RESULT'}")
        print("-" * 105)
        for row in audit_results:
            print(f"{row['role']:<10} | {row['identifier']:<24} | {row['active']:<6} | {row['hash_valid']:<6} | {row['profile']:<36} | {row['status']}")

        print("-" * 105)
        if overall_pass:
            print("\n[VERIFIED] All 5 QA Accounts are present, cryptographically verified, and ready for UAT.")
        else:
            print("\n[FAILED] One or more QA Accounts failed independent verification.", file=sys.stderr)
            sys.exit(1)

    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="EducationOS QA Account Provisioning & Verification CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("provision", help="Idempotently provision all 5 QA accounts and save credentials locally")
    subparsers.add_parser("verify", help="Independently verify all 5 QA accounts in DB without printing secrets")

    args = parser.parse_args()

    if args.command == "provision":
        provision_all()
    elif args.command == "verify":
        verify_all()


if __name__ == "__main__":
    main()
