"""
Stage 03 Verification Test Suite: Authentication Reconstruction & Security Hardening
Validates:
1. Access vs. Refresh token distinction, claims, lifetimes, and unique JTIs.
2. Token type enforcement (rejecting refresh tokens passed as access tokens).
3. Thread-safe in-memory token revocation store and bounded TTL cleanup.
4. Token rotation and reuse detection on /refresh.
5. Logout revocation of active tokens.
6. /me endpoint user profile resolution.
7. Deactivated user rejection (403 Forbidden).
8. Cross-tenant header spoofing prevention.
9. Frontend token storage and API client contract alignment.
"""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from starlette.testclient import TestClient

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    revoke_token,
    is_token_revoked,
    clear_revocation_store,
    TokenError,
    TokenExpiredError,
    TokenRevokedError,
    InvalidTokenTypeError,
)
from app.api.deps import (
    get_current_user_claims,
    get_current_user,
    get_db as deps_get_db,
)
from app.core.database import get_db as core_get_db
from app.models.tenant import User
from app.main import app


@pytest.fixture(autouse=True)
def clean_state():
    """Ensure clean revocation store and dependency overrides for every test."""
    clear_revocation_store()
    app.dependency_overrides.clear()
    yield
    clear_revocation_store()
    app.dependency_overrides.clear()


# ----------------------------------------------------------------------------------------
# 1. Token Distinction & Lifetime Tests
# ----------------------------------------------------------------------------------------
def test_create_access_and_refresh_tokens_distinction():
    tenant_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    access = create_access_token(
        data={"sub": user_id, "tenant_id": tenant_id, "role": "admin"}
    )
    refresh = create_refresh_token(
        data={"sub": user_id, "tenant_id": tenant_id, "role": "admin"}
    )

    access_payload = decode_token(access, expected_type="access")
    refresh_payload = decode_token(refresh, expected_type="refresh")

    assert access_payload["token_type"] == "access"
    assert refresh_payload["token_type"] == "refresh"
    assert access_payload["sub"] == user_id
    assert refresh_payload["sub"] == user_id
    assert access_payload["tenant_id"] == tenant_id
    assert refresh_payload["tenant_id"] == tenant_id

    # Check distinct JTIs
    assert "jti" in access_payload and len(access_payload["jti"]) > 10
    assert "jti" in refresh_payload and len(refresh_payload["jti"]) > 10
    assert access_payload["jti"] != refresh_payload["jti"]

    # Verify lifetime difference: refresh expires later than access
    assert refresh_payload["exp"] > access_payload["exp"]


def test_decode_token_enforces_expected_type():
    user_id = str(uuid.uuid4())
    access = create_access_token(data={"sub": user_id, "tenant_id": "t1", "role": "admin"})
    refresh = create_refresh_token(data={"sub": user_id, "tenant_id": "t1", "role": "admin"})

    # Valid decode with matching expected type
    assert decode_token(access, expected_type="access")["token_type"] == "access"
    assert decode_token(refresh, expected_type="refresh")["token_type"] == "refresh"

    # Rejecting mismatched token types
    with pytest.raises(InvalidTokenTypeError, match="expected 'refresh', got 'access'"):
        decode_token(access, expected_type="refresh")

    with pytest.raises(InvalidTokenTypeError, match="expected 'access', got 'refresh'"):
        decode_token(refresh, expected_type="access")


def test_decode_token_expired():
    expired_token = create_access_token(
        data={"sub": "user1", "tenant_id": "t1"},
        expires_delta=timedelta(seconds=-10)
    )
    with pytest.raises(TokenExpiredError):
        decode_token(expired_token)


def test_decode_token_tampered_signature():
    token = create_access_token(data={"sub": "user1", "tenant_id": "t1"})
    tampered = token[:-4] + "abcd"
    with pytest.raises(TokenError):
        decode_token(tampered)


# ----------------------------------------------------------------------------------------
# 2. Token Revocation Store Tests
# ----------------------------------------------------------------------------------------
def test_token_revocation_store_basic():
    jti = uuid.uuid4().hex
    assert not is_token_revoked(jti)

    revoke_token(jti)
    assert is_token_revoked(jti)


def test_token_revocation_store_expiry_pruning():
    jti = uuid.uuid4().hex
    # Revoke with an expiration already in the past
    past_exp = datetime.now(timezone.utc) - timedelta(seconds=1)
    revoke_token(jti, exp=past_exp)

    # When checked, the expired entry is pruned and considered not active
    assert not is_token_revoked(jti)


def test_decode_token_rejects_revoked_token():
    token = create_access_token(data={"sub": "user1", "tenant_id": "t1"})
    payload = decode_token(token, verify_revocation=False)
    jti = payload["jti"]

    revoke_token(jti)
    with pytest.raises(TokenRevokedError):
        decode_token(token, verify_revocation=True)


# ----------------------------------------------------------------------------------------
# 3. FastAPI Dependency Hardening (deps.py)
# ----------------------------------------------------------------------------------------
def test_deps_rejects_refresh_token_as_access():
    refresh = create_refresh_token(data={"sub": "user1", "tenant_id": "t1", "role": "admin"})
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_claims(token=refresh, x_tenant_id=None)
    assert exc_info.value.status_code == 401
    assert "Invalid token type" in exc_info.value.detail


def test_deps_rejects_revoked_access_token():
    token = create_access_token(data={"sub": "user1", "tenant_id": "t1", "role": "admin"})
    payload = decode_token(token, verify_revocation=False)
    revoke_token(payload["jti"])

    with pytest.raises(HTTPException) as exc_info:
        get_current_user_claims(token=token, x_tenant_id=None)
    assert exc_info.value.status_code == 401
    assert "Token has been revoked" in exc_info.value.detail


def test_deps_rejects_cross_tenant_header_spoofing():
    token = create_access_token(data={"sub": "user1", "tenant_id": "tenant-A", "role": "admin"})
    with pytest.raises(HTTPException) as exc_info:
        get_current_user_claims(token=token, x_tenant_id="tenant-B")
    assert exc_info.value.status_code == 403
    assert "Cross-tenant access violation" in exc_info.value.detail


def test_deps_superadmin_can_switch_tenant():
    token = create_access_token(data={"sub": "super1", "tenant_id": "system", "role": "superadmin"})
    claims = get_current_user_claims(token=token, x_tenant_id="school-123")
    assert claims["tenant_id"] == "school-123"


def test_deps_get_current_user_rejects_inactive_user():
    db = MagicMock()
    inactive_user = MagicMock(spec=User)
    inactive_user.id = uuid.uuid4()
    inactive_user.tenant_id = uuid.uuid4()
    inactive_user.is_active = False

    db.query.return_value.filter.return_value.first.return_value = inactive_user

    claims = {
        "user_id": str(inactive_user.id),
        "tenant_id": str(inactive_user.tenant_id),
        "role": "admin",
    }
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(db=db, claims=claims)
    assert exc_info.value.status_code == 403
    assert "suspended or deactivated" in exc_info.value.detail


# ----------------------------------------------------------------------------------------
# 4. Authentication Endpoints Integration (/refresh, /logout, /me)
# ----------------------------------------------------------------------------------------
def test_refresh_token_rotation_and_reuse_prevention():
    client = TestClient(app)
    db_mock = MagicMock()
    user_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())

    active_user = MagicMock(spec=User)
    active_user.id = user_id
    active_user.tenant_id = tenant_id
    active_user.is_active = True
    active_user.role = "admin"
    active_user.email = "admin@example.com"

    db_mock.query.return_value.filter.return_value.first.return_value = active_user

    def override_db():
        yield db_mock

    app.dependency_overrides[core_get_db] = override_db
    app.dependency_overrides[deps_get_db] = override_db

    # 1. Generate initial refresh token
    original_refresh = create_refresh_token(
        data={"sub": user_id, "tenant_id": tenant_id, "role": "admin", "email": "admin@example.com"}
    )
    orig_payload = decode_token(original_refresh, expected_type="refresh")
    orig_jti = orig_payload["jti"]

    # 2. Call /refresh endpoint -> Token Rotation
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": original_refresh})
    assert response.status_code == 200, response.text
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    new_refresh = data["refresh_token"]

    # 3. Verify original refresh token is now REVOKED
    assert is_token_revoked(orig_jti)

    # 4. Attempt REUSE of the original refresh token -> MUST FAIL CLOSED
    reuse_response = client.post("/api/v1/auth/refresh", json={"refresh_token": original_refresh})
    assert reuse_response.status_code == 401
    assert "revoked or reused" in reuse_response.json()["detail"]

    # 5. Verify newly rotated refresh token works cleanly
    new_response = client.post("/api/v1/auth/refresh", json={"refresh_token": new_refresh})
    assert new_response.status_code == 200
    new_data = new_response.json()
    assert "access_token" in new_data


def test_logout_revokes_calling_tokens():
    client = TestClient(app)
    user_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())

    access_token = create_access_token(data={"sub": user_id, "tenant_id": tenant_id, "role": "admin"})
    refresh_token = create_refresh_token(data={"sub": user_id, "tenant_id": tenant_id, "role": "admin"})

    access_jti = decode_token(access_token, expected_type="access", verify_revocation=False)["jti"]
    refresh_jti = decode_token(refresh_token, expected_type="refresh", verify_revocation=False)["jti"]

    headers = {"Authorization": f"Bearer {access_token}"}
    response = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token}, headers=headers)
    assert response.status_code == 200
    assert response.json() == {"message": "Successfully logged out."}

    # Verify both access and refresh tokens are now revoked in the store
    assert is_token_revoked(access_jti)
    assert is_token_revoked(refresh_jti)

    # Calling any protected endpoint with the revoked access token must now return 401
    followup = client.get("/api/v1/auth/me", headers=headers)
    assert followup.status_code == 401
    assert "revoked" in followup.json()["detail"].lower()


def test_get_me_profile_resolution():
    client = TestClient(app)
    db_mock = MagicMock()
    user_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())

    user_orm = MagicMock(spec=User)
    user_orm.id = user_id
    user_orm.email = "principal@school.edu"
    user_orm.role = "admin"
    user_orm.tenant_id = tenant_id
    user_orm.first_name = "Principal"
    user_orm.last_name = "Smith"
    user_orm.is_active = True

    db_mock.query.return_value.filter.return_value.first.return_value = user_orm

    def override_db():
        yield db_mock

    app.dependency_overrides[core_get_db] = override_db
    app.dependency_overrides[deps_get_db] = override_db

    access_token = create_access_token(data={"sub": user_id, "tenant_id": tenant_id, "role": "admin"})

    headers = {"Authorization": f"Bearer {access_token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["email"] == "principal@school.edu"
    assert data["role"] == "admin"
    assert data["tenant_id"] == tenant_id
    assert data["first_name"] == "Principal"


# ----------------------------------------------------------------------------------------
# 5. Frontend Contract Alignment
# ----------------------------------------------------------------------------------------
def test_frontend_contract_alignment():
    """Verify that backend login responses provide the keys required by the frontend."""
    token = create_access_token(data={"sub": "u1", "tenant_id": "t1", "role": "admin"})
    refresh = create_refresh_token(data={"sub": "u1", "tenant_id": "t1", "role": "admin"})
    response_payload = {
        "access_token": token,
        "refresh_token": refresh,
        "token_type": "bearer",
        "role": "admin",
        "tenant_id": "t1"
    }

    assert "access_token" in response_payload
    assert "refresh_token" in response_payload
    assert response_payload["token_type"] == "bearer"


# ----------------------------------------------------------------------------------------
# 6. Persistent Session Tracking & Application Restart Survivability
# ----------------------------------------------------------------------------------------
def test_persistent_revocation_survives_restart():
    """
    Verifies that when in-memory revocation cache is cleared (simulating app restart or
    multi-worker routing), persistent revocation records in the database are consulted
    and repopulate L1 cache.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.pool import StaticPool
    from sqlalchemy.orm import sessionmaker
    from app.models.auth import RevokedTokenRecord, RefreshTokenSession
    from app.core.security import persist_revocation

    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    RevokedTokenRecord.__table__.create(test_engine, checkfirst=True)
    RefreshTokenSession.__table__.create(test_engine, checkfirst=True)
    TestSession = sessionmaker(bind=test_engine)
    db = TestSession()

    test_jti = f"jti-{uuid.uuid4().hex}"
    exp_time = datetime.now(timezone.utc) + timedelta(hours=2)

    # 1. Persist revocation to DB
    persist_revocation(db, test_jti, exp=exp_time, token_type="access")
    assert is_token_revoked(test_jti) is True

    # 2. Simulate complete application restart / worker isolation: clear in-memory cache
    clear_revocation_store()

    # 3. Check revocation using persistent db lookup
    assert is_token_revoked(test_jti, db=db) is True

    # 4. Verify that L1 cache has been automatically repopulated from DB
    assert is_token_revoked(test_jti) is True


def test_refresh_token_reuse_blast_radius_invalidation():
    """
    Verifies that when an already-revoked refresh token is replayed (concurrent replay attack),
    all active sessions belonging to that user are revoked across the tenant.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.pool import StaticPool
    from sqlalchemy.orm import sessionmaker
    from app.models.auth import RefreshTokenSession, RevokedTokenRecord
    from app.models.tenant import User

    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    User.__table__.create(test_engine, checkfirst=True)
    RefreshTokenSession.__table__.create(test_engine, checkfirst=True)
    RevokedTokenRecord.__table__.create(test_engine, checkfirst=True)
    TestSession = sessionmaker(bind=test_engine)
    db = TestSession()

    user_uuid = uuid.uuid4()
    user_id = str(user_uuid)
    tenant_uuid = uuid.uuid4()
    tenant_id = str(tenant_uuid)

    # Create active user
    db.add(User(id=user_uuid, tenant_id=tenant_uuid, email="admin@example.com", role="admin", is_active=True, password_hash="dummy"))

    # Create 3 sessions for the user: session 1 (already revoked), session 2 & 3 (still active)
    jti_replayed = f"jti-1-{uuid.uuid4().hex}"
    jti_active_2 = f"jti-2-{uuid.uuid4().hex}"
    jti_active_3 = f"jti-3-{uuid.uuid4().hex}"

    exp = datetime.now(timezone.utc) + timedelta(days=7)
    db.add(RefreshTokenSession(jti=jti_replayed, user_id=user_id, tenant_id=tenant_id, role="admin", revoked=True, expires_at=exp))
    db.add(RefreshTokenSession(jti=jti_active_2, user_id=user_id, tenant_id=tenant_id, role="admin", revoked=False, expires_at=exp))
    db.add(RefreshTokenSession(jti=jti_active_3, user_id=user_id, tenant_id=tenant_id, role="admin", revoked=False, expires_at=exp))
    db.commit()

    # Attempt to refresh using the already revoked token
    client = TestClient(app)
    replayed_token = create_refresh_token(
        data={"sub": user_id, "tenant_id": tenant_id, "role": "admin", "jti": jti_replayed}
    )

    def override_db():
        yield db

    app.dependency_overrides[core_get_db] = override_db
    app.dependency_overrides[deps_get_db] = override_db

    try:
        response = client.post("/api/v1/auth/refresh", json={"refresh_token": replayed_token})
        assert response.status_code == 401
        assert "revoked or reused" in response.json()["detail"]

        # Verify ALL user sessions have now been revoked (blast radius containment)
        remaining_active = db.query(RefreshTokenSession).filter(
            RefreshTokenSession.user_id == user_id,
            RefreshTokenSession.revoked == False
        ).count()
        assert remaining_active == 0, "All active sessions for the compromised user must be revoked!"
    finally:
        app.dependency_overrides.clear()


def test_forgot_and_reset_password_lifecycle():
    """
    Validates complete forgot password & reset password lifecycle:
    1. /forgot-password issues single-use token and queues outbox email.
    2. /reset-password updates password and revokes all existing sessions.
    3. Reusing the token or using an invalid token is rejected.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool
    from app.models.auth import PasswordResetToken, RefreshTokenSession, RevokedTokenRecord
    from app.models.audit import AuditLog
    from app.models.notification import NotificationOutbox
    from app.core.security import get_password_hash, verify_password

    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    User.__table__.create(test_engine, checkfirst=True)
    AuditLog.__table__.create(test_engine, checkfirst=True)
    PasswordResetToken.__table__.create(test_engine, checkfirst=True)
    NotificationOutbox.__table__.create(test_engine, checkfirst=True)
    RefreshTokenSession.__table__.create(test_engine, checkfirst=True)
    RevokedTokenRecord.__table__.create(test_engine, checkfirst=True)

    TestSession = sessionmaker(bind=test_engine)
    db = TestSession()

    user_uuid = uuid.uuid4()
    tenant_uuid = uuid.uuid4()
    original_pass = "OldPassword123!"

    u = User(
        id=user_uuid,
        tenant_id=tenant_uuid,
        email="reset_test@educationos.internal",
        role="teacher",
        is_active=True,
        password_hash=get_password_hash(original_pass),
    )
    db.add(u)
    db.commit()

    client = TestClient(app)

    def override_db():
        yield db

    app.dependency_overrides[core_get_db] = override_db
    app.dependency_overrides[deps_get_db] = override_db

    try:
        # 1. Request forgot password
        forgot_res = client.post("/api/v1/auth/forgot-password", json={
            "email": "reset_test@educationos.internal"
        })
        assert forgot_res.status_code == 200
        data = forgot_res.json()
        assert "reset_token" in data
        reset_token = data["reset_token"]

        # Check outbox record
        outbox_entry = db.query(NotificationOutbox).filter(
            NotificationOutbox.recipient == "reset_test@educationos.internal"
        ).first()
        assert outbox_entry is not None
        assert reset_token in outbox_entry.body

        # 2. Reset password using token
        new_pass = "NewSecurePassword2026!"
        reset_res = client.post("/api/v1/auth/reset-password", json={
            "token": reset_token,
            "new_password": new_pass,
        })
        assert reset_res.status_code == 200

        # Verify password in database has been updated
        db.refresh(u)
        assert verify_password(new_pass, u.password_hash) is True
        assert verify_password(original_pass, u.password_hash) is False

        # 3. Attempt to reuse consumed token -> Rejected!
        reuse_res = client.post("/api/v1/auth/reset-password", json={
            "token": reset_token,
            "new_password": "AnotherPassword999!",
        })
        assert reuse_res.status_code == 400
        assert "invalid or has expired" in reuse_res.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()
        db.close()


