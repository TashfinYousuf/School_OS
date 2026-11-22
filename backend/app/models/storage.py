# backend/app/models/storage.py
import uuid
import datetime
from sqlalchemy import Column, String, BigInteger, Boolean, DateTime, Index
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import Base, SafeUUID


class UploadedAsset(Base):
    """
    Authoritative Cloud Object Storage Asset Ledger.
    Tracks every file stored in private S3/R2 cloud storage with tenant isolation,
    SHA-256 fingerprinting, MIME type verification, and access controls.
    """
    __tablename__ = "uploaded_assets"
    __table_args__ = (
        Index("ix_uploaded_assets_tenant_category", "tenant_id", "category"),
        {"extend_existing": True}
    )

    id = Column(SafeUUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)  # curriculum, admissions, avatars, receipts, notices
    storage_provider = Column(String(32), nullable=False, default="r2")  # r2, s3, local
    storage_key = Column(String(512), nullable=False, unique=True, index=True)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(32), nullable=False)
    mime_type = Column(String(128), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    sha256_checksum = Column(String(64), nullable=False, index=True)
    is_public = Column(Boolean, nullable=False, default=False)
    uploaded_by_user_id = Column(String(64), nullable=True)
    metadata_payload = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

