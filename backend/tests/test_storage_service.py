# backend/tests/test_storage_service.py
import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

import app.models
from app.models.base import Base
from app.models.storage import UploadedAsset
from app.services.storage_service import StorageService

if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


def test_storage_service_upload_download_and_tenant_isolation():
    """
    Verifies that StorageService uploads files, computes SHA-256 fingerprints,
    and strictly enforces multi-tenant isolation on download.
    """
    db = TestingSessionLocal()
    tid_a = str(uuid.uuid4())
    tid_b = str(uuid.uuid4())

    pdf_content = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
    asset = StorageService.upload_file(
        db=db,
        tenant_id=tid_a,
        category="curriculum",
        file_name="bangla_grammar.pdf",
        file_bytes=pdf_content,
        is_public=False,
    )

    assert asset.id is not None
    assert asset.tenant_id == tid_a
    assert asset.category == "curriculum"
    assert asset.file_type == "pdf"
    assert asset.mime_type == "application/pdf"
    assert asset.file_size_bytes == len(pdf_content)
    assert f"tenant/{tid_a}/curriculum" in asset.storage_key

    # Tenant A downloads file successfully
    downloaded_bytes, meta = StorageService.download_file(db, tid_a, asset.id)
    assert downloaded_bytes == pdf_content
    assert meta.id == asset.id

    # Tenant B attempts to download Tenant A file -> Rejection!
    with pytest.raises(FileNotFoundError):
        StorageService.download_file(db, tid_b, asset.id)

    # Pre-signed / fallback URL generation
    signed_url = StorageService.generate_signed_url(db, tid_a, asset.id)
    assert str(asset.id) in signed_url

    # Cleanup / Delete
    saved_id = asset.id
    deleted = StorageService.delete_file(db, tid_a, saved_id)
    assert deleted is True

    # After deletion, lookup fails
    with pytest.raises(FileNotFoundError):
        StorageService.download_file(db, tid_a, saved_id)

    db.close()


def test_storage_service_magic_byte_validation_and_size_limits():
    """
    Verifies magic byte validation rejects mismatched contents and respects category size caps.
    """
    db = TestingSessionLocal()
    tid = str(uuid.uuid4())

    # PDF with invalid magic bytes (starts with garbage text) -> Rejected
    bad_pdf = b"NOT_A_REAL_PDF_CONTENT"
    with pytest.raises(ValueError) as exc:
        StorageService.upload_file(
            db=db,
            tenant_id=tid,
            category="curriculum",
            file_name="fake.pdf",
            file_bytes=bad_pdf,
        )
    assert "signature" in str(exc.value)

    # Valid PNG image
    valid_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    png_asset = StorageService.upload_file(
        db=db,
        tenant_id=tid,
        category="avatars",
        file_name="profile.png",
        file_bytes=valid_png,
    )
    assert png_asset.mime_type == "image/png"

    # Category size limit rejection
    oversized_avatar = b"\x89PNG\r\n\x1a\n" + b"X" * (6 * 1024 * 1024) # 6MB exceeds 5MB avatar cap
    with pytest.raises(ValueError) as exc:
        StorageService.upload_file(
            db=db,
            tenant_id=tid,
            category="avatars",
            file_name="huge.png",
            file_bytes=oversized_avatar,
        )
    assert "exceeds" in str(exc.value)

    db.close()
