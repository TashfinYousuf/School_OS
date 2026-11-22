# backend/app/models/auth.py
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class RefreshTokenSession(Base):
    """
    Persistent Refresh Token & Session Tracking Model.
    Provides:
    - Multi-worker and multi-instance session sharing across application restarts.
    - Strict single-use token rotation.
    - Concurrent replay / token reuse detection.
    - Automatic blast-radius revocation of all user sessions upon detected breach.
    """
    __tablename__ = "refresh_token_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    jti = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    role = Column(String(32), nullable=False, default="student")
    parent_jti = Column(String(64), nullable=True, index=True)
    revoked = Column(Boolean, default=False, nullable=False, index=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class RevokedTokenRecord(Base):
    """
    Persistent Revoked Token Store for access tokens and explicitly revoked tokens.
    Prevents reuse across multi-worker instances and application restarts.
    """
    __tablename__ = "revoked_token_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    jti = Column(String(64), unique=True, nullable=False, index=True)
    token_type = Column(String(32), default="access", nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class AccountInvitation(Base):
    """
    Cryptographic Single-Use Account Activation & Password Setup Token Store.
    Tokens are stored as SHA-256 hashes to guarantee zero-knowledge security.
    """
    __tablename__ = "account_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    student_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    guardian_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    target_role = Column(String(32), default="student", nullable=False)
    identifier = Column(String(120), nullable=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    is_consumed = Column(Boolean, default=False, nullable=False, index=True)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_by_user_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class PasswordResetToken(Base):
    """
    Cryptographic Single-Use Password Reset Token Store.
    Tokens are stored as SHA-256 hashes to guarantee zero-knowledge security.
    """
    __tablename__ = "password_reset_tokens"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    is_consumed = Column(Boolean, default=False, nullable=False, index=True)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class EmailVerificationToken(Base):
    """
    Cryptographic Single-Use Email Verification and OTP Store.
    """
    __tablename__ = "email_verification_tokens"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    otp_code = Column(String(16), nullable=True, index=True)
    is_consumed = Column(Boolean, default=False, nullable=False, index=True)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class UserWebAuthnCredential(Base):
    """
    FIDO2 / WebAuthn Hardware Passkey Credentials Store.
    Enables passwordless authentication and phishing-resistant biometric login.
    """
    __tablename__ = "user_webauthn_credentials"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    credential_id = Column(String(255), unique=True, nullable=False, index=True)
    public_key = Column(String(1024), nullable=False)
    sign_count = Column(DateTime(timezone=True), nullable=True)
    counter = Column(String(64), default="0", nullable=False)
    credential_name = Column(String(100), default="Passkey", nullable=False)
    aaguid = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)


