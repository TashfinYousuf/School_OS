# backend/tests/security/test_mfa_and_passkey_auth.py
"""
MFA (RFC 6238 TOTP & Single-Use Recovery Codes) and WebAuthn / Passkey Authentication Test Suite.
Verifies:
1. TOTP MFA verification with correct 6-digit time-based code and failure with invalid code.
2. Single-use enforcement of emergency recovery codes (first use succeeds, second use fails with 401).
3. WebAuthn Passkey registration challenge & verification flow.
4. Passwordless Passkey login challenge & verification flow issuing valid JWT session.
"""
import base64
import datetime
import hashlib
import hmac
import struct
import time
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

import app.models
from app.main import app as fastapi_app
from app.models.base import Base
from app.api.deps import (
    get_db as deps_get_db,
    get_current_tenant_id,
    get_current_user_claims,
)
from app.core import database as core_database
from app.core.database import get_db as core_get_db
from app.models.tenant import User, Tenant
from app.core.security import create_access_token, get_password_hash
from app.api.endpoints.auth import _MFA_USER_SECRETS, _WEBAUTHN_CHALLENGES, _WEBAUTHN_CREDENTIALS

# Teach SQLite compiler to render PostgreSQL JSONB as JSON during in-memory tests
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
def clean_database_and_overrides(monkeypatch):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    fastapi_app.dependency_overrides[deps_get_db] = get_test_db
    fastapi_app.dependency_overrides[core_get_db] = get_test_db
    monkeypatch.setattr(core_database, "SessionLocal", TestingSessionLocal)
    _MFA_USER_SECRETS.clear()
    _WEBAUTHN_CHALLENGES.clear()
    _WEBAUTHN_CREDENTIALS.clear()
    yield
    fastapi_app.dependency_overrides.clear()


def make_claims(role: str, tenant_id: str, user_id: str, email: str = "test@school.edu") -> dict:
    return {
        "sub": user_id,
        "user_id": user_id,
        "role": role,
        "tenant_id": tenant_id,
        "email": email,
        "permissions": []
    }


def compute_totp(secret_base32: str) -> str:
    secret_clean = secret_base32.strip().replace(" ", "").upper()
    missing_padding = len(secret_clean) % 8
    if missing_padding:
        secret_clean += "=" * (8 - missing_padding)
    key = base64.b32decode(secret_clean, casefold=True)
    step = int(time.time() // 30)
    msg = struct.pack(">Q", step)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    o = h[19] & 15
    token_int = (struct.unpack(">I", h[o : o + 4])[0] & 0x7FFFFFFF) % 1000000
    return f"{token_int:06d}"


def test_totp_mfa_verification_success_and_failure():
    """Verifies that valid TOTP codes succeed and invalid codes return 401."""
    client = TestClient(fastapi_app)
    db = TestingSessionLocal()
    tid = str(uuid.uuid4())
    uid = uuid.uuid4()
    
    tenant = Tenant(id=uuid.UUID(tid), school_name="MFA Test Academy", domain=f"domain-{tid[:8]}")
    db.add(tenant)
    
    user = User(
        id=uid,
        email="owner@educationos.internal",
        password_hash=get_password_hash("StrongSecret123!"),
        role="superadmin",
        tenant_id=uuid.UUID(tid),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.close()

    # Configure TOTP secret
    secret = "JBSWY3DPEHPK3PXP"  # standard Base32 test secret
    _MFA_USER_SECRETS[str(uid)] = {
        "secret": secret,
        "recovery_code_hashes": []
    }

    mfa_temp_token = create_access_token(data={"sub": str(uid), "user_id": str(uid), "tenant_id": tid, "role": "superadmin"})

    # 1. Invalid TOTP code
    bad_res = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": mfa_temp_token, "code": "000000"})
    assert bad_res.status_code == 401
    assert "Invalid MFA verification code" in bad_res.json()["detail"]

    # 2. Valid TOTP code
    valid_code = compute_totp(secret)
    good_res = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": mfa_temp_token, "code": valid_code})
    assert good_res.status_code == 200
    data = good_res.json()
    assert data["mfa_verified"] is True
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "owner@educationos.internal"


def test_recovery_code_single_use_enforcement():
    """Verifies that an emergency recovery code can only be used once."""
    client = TestClient(fastapi_app)
    db = TestingSessionLocal()
    tid = str(uuid.uuid4())
    uid = uuid.uuid4()

    tenant = Tenant(id=uuid.UUID(tid), school_name="Recovery Code Academy", domain=f"domain-{tid[:8]}")
    db.add(tenant)

    user = User(
        id=uid,
        email="recovery@educationos.internal",
        password_hash=get_password_hash("RecoverySecret123!"),
        role="superadmin",
        tenant_id=uuid.UUID(tid),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.close()

    raw_code = "A1B2-C3D4-E5F6"
    code_hash = hashlib.sha256(raw_code.upper().encode("utf-8")).hexdigest()
    _MFA_USER_SECRETS[str(uid)] = {
        "secret": None,
        "recovery_code_hashes": [code_hash]
    }

    mfa_temp_token = create_access_token(data={"sub": str(uid), "user_id": str(uid), "tenant_id": tid, "role": "superadmin"})

    # First attempt: succeeds
    res1 = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": mfa_temp_token, "code": raw_code})
    assert res1.status_code == 200
    assert res1.json()["mfa_verified"] is True

    # Second attempt with same code: fails (single-use enforced!)
    res2 = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": mfa_temp_token, "code": raw_code})
    assert res2.status_code == 401
    assert "Invalid MFA verification code" in res2.json()["detail"]


def test_webauthn_passkey_lifecycle():
    """Verifies WebAuthn Passkey registration and passwordless login flow."""
    client = TestClient(fastapi_app)
    db = TestingSessionLocal()
    tid = str(uuid.uuid4())
    uid = uuid.uuid4()
    email = "passkey.user@school.edu"

    tenant = Tenant(id=uuid.UUID(tid), school_name="Passkey Academy", domain=f"domain-{tid[:8]}")
    db.add(tenant)

    user = User(
        id=uid,
        email=email,
        password_hash=get_password_hash("PasskeySecret123!"),
        role="teacher",
        tenant_id=uuid.UUID(tid),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.close()

    # Authenticate user claims for registration
    fastapi_app.dependency_overrides[get_current_user_claims] = lambda: make_claims("teacher", tid, str(uid), email)

    # 1. Register Challenge
    reg_challenge_res = client.post("/api/v1/auth/passkey/register-challenge")
    assert reg_challenge_res.status_code == 200
    reg_data = reg_challenge_res.json()
    assert "challenge" in reg_data
    assert reg_data["user"]["id"] == str(uid)
    assert reg_data["rp"]["name"] == "EducationOS Identity System"

    # 2. Register Verify
    credential_id = "cred-sample-pubkey-id-12345"
    reg_verify_res = client.post(
        "/api/v1/auth/passkey/register-verify",
        json={
            "id": credential_id,
            "rawId": credential_id,
            "type": "public-key",
            "clientDataJSON": "sample_client_data",
            "attestationObject": "sample_attestation",
        }
    )
    assert reg_verify_res.status_code == 200
    assert reg_verify_res.json()["status"] == "REGISTERED"

    # 3. Login Challenge (Passwordless)
    login_challenge_res = client.post("/api/v1/auth/passkey/login-challenge", json={"email": email})
    assert login_challenge_res.status_code == 200
    login_ch_data = login_challenge_res.json()
    assert "challenge" in login_ch_data
    assert any(c["id"] == credential_id for c in login_ch_data["allowCredentials"])

    # 4. Login Verify
    login_verify_res = client.post(
        "/api/v1/auth/passkey/login-verify",
        json={
            "email": email,
            "credential_id": credential_id,
            "signature": "sample_signature",
            "clientDataJSON": "sample_client_data",
        }
    )
    assert login_verify_res.status_code == 200
    login_res_data = login_verify_res.json()
    assert "access_token" in login_res_data
    assert "refresh_token" in login_res_data
    assert login_res_data["user"]["email"] == email
    assert login_res_data["user"]["role"] == "teacher"


def test_platform_owner_login_mfa_flow():
    """Verifies that platform login challenges for TOTP MFA and grants access after verification."""
    client = TestClient(fastapi_app)
    db = TestingSessionLocal()
    platform_tid = uuid.UUID("c0000000-0000-0000-0000-000000000001")
    owner_uid = uuid.uuid4()

    tenant = Tenant(id=platform_tid, school_name="EducationOS Platform Control Plane", domain="platform.internal")
    db.add(tenant)

    user = User(
        id=owner_uid,
        email="owner@educationos.internal",
        password_hash=get_password_hash("SuperSecretPass123!"),
        role="superadmin",
        tenant_id=platform_tid,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.close()

    secret = "JBSWY3DPEHPK3PXP"
    _MFA_USER_SECRETS[str(owner_uid)] = {
        "secret": secret,
        "recovery_code_hashes": [],
    }

    # Step 1: Initial platform login -> challenges for MFA
    res1 = client.post("/api/v1/auth/platform/login", json={"email": "owner@educationos.internal", "password": "SuperSecretPass123!"})
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1.get("mfa_required") is True
    assert "mfa_token" in data1

    # Step 2: MFA code verification
    totp_code = compute_totp(secret)
    res2 = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": data1["mfa_token"], "code": totp_code})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2.get("mfa_verified") is True
    assert "access_token" in data2
    assert data2.get("role") == "superadmin"

    # Step 3: MFA status check
    auth_headers = {"Authorization": f"Bearer {data2['access_token']}"}
    res3 = client.get("/api/v1/auth/mfa/status", headers=auth_headers)
    assert res3.status_code == 200
    assert res3.json()["mfa_enabled"] is True
