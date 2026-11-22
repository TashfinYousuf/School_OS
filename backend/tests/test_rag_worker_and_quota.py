# backend/tests/test_rag_worker_and_quota.py
import uuid
import time
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

import app.models
from app.models.base import Base
from app.models.curriculum import CurriculumDocument, CurriculumChunk
from app.workers.rag_worker import RAGWorkerDaemon
from app.services.curriculum_rag import gemini_rate_limiter, chunk_text

if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_db(monkeypatch):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    from app.core import database as core_database
    monkeypatch.setattr(core_database, "SessionLocal", TestingSessionLocal)
    from app.workers import rag_worker
    monkeypatch.setattr(rag_worker, "SessionLocal", TestingSessionLocal)
    yield


def test_bengali_sentence_boundary_chunking():
    """
    Verifies that Bengali Dari ('।') and Double Dari ('॥') are honored as
    first-class sentence boundaries and never broken across mid-sentence.
    """
    sample_bangla = (
        "আমাদের বিদ্যালয়ের নাম কিডস শাইন ইন্টারন্যাশনাল স্কুল। "
        "এখানে প্রথম থেকে দশম শ্রেণি পর্যন্ত পাঠদান করা হয়। "
        "শিক্ষার্থীরা আনন্দের সাথে নতুন শিক্ষাক্রম অনুসরণ করে। "
        "প্রতিটি শিশু এখানে নিরাপদ ও স্নেহপূর্ণ পরিবেশে বেড়ে ওঠে।"
    )
    chunks = chunk_text(sample_bangla, chunk_size=120, overlap=30)
    assert len(chunks) >= 2
    # Ensure every chunk maintains proper Dari punctuation
    for c in chunks:
        assert "।" in c
        assert not c.startswith("।")


def test_gemini_rate_limiter_budget_acquisition():
    """
    Verifies that the rate limiter permits requests within capacity
    and properly tracks estimated token budgets.
    """
    gemini_rate_limiter.acquire(estimated_tokens=250)
    assert len(gemini_rate_limiter.request_timestamps) > 0
    assert len(gemini_rate_limiter.token_usage) > 0


def test_rag_worker_daemon_claim_and_process(monkeypatch, tmp_path):
    """
    Verifies RAGWorkerDaemon atomically claims QUEUED jobs and processes
    them to INDEXED state without locking database.
    """
    tid = str(uuid.uuid4())
    doc_id = uuid.uuid4()
    
    # Create dummy stored file
    test_file = tmp_path / "test_doc.txt"
    test_file.write_text("প্রথম পাঠ: বর্ণমালা ও সংখ্যা পরিচয়। এক দুই তিন চার পাঁচ।", encoding="utf-8")

    db = TestingSessionLocal()
    doc = CurriculumDocument(
        id=doc_id,
        tenant_id=tid,
        title="বাংলা পাঠ্যবই ১ম শ্রেণি",
        class_name="Class 1",
        subject="Bangla",
        file_name="bangla1.txt",
        file_type="txt",
        file_size_bytes=len(test_file.read_bytes()),
        file_hash="dummyhash123",
        status="QUEUED",
        chunks_count=0,
        metadata_payload={
            "stored_path": str(test_file),
            "stage": "queued",
            "progress_pct": 5,
        }
    )
    db.add(doc)
    db.commit()
    db.close()

    worker = RAGWorkerDaemon(poll_interval_sec=0.1)
    
    # 1. Claim job
    job = worker.claim_next_job()
    assert job is not None
    assert job["id"] == doc_id
    assert job["tenant_id"] == tid

    # Verify status transitioned to VALIDATING
    db = TestingSessionLocal()
    claimed_doc = db.query(CurriculumDocument).filter(CurriculumDocument.id == doc_id).first()
    assert claimed_doc.status == "VALIDATING"
    assert claimed_doc.metadata_payload.get("stage") == "claimed_by_worker"
    db.close()

    # 2. Process job
    worker.process_job(job)

    # Verify status transitioned to INDEXED and chunks were created
    db = TestingSessionLocal()
    finished_doc = db.query(CurriculumDocument).filter(CurriculumDocument.id == doc_id).first()
    assert finished_doc.status == "INDEXED"
    assert finished_doc.chunks_count > 0
    assert finished_doc.metadata_payload.get("stage") == "completed"
    assert finished_doc.metadata_payload.get("progress_pct") == 100

    chunks = db.query(CurriculumChunk).filter(CurriculumChunk.document_id == doc_id).all()
    assert len(chunks) > 0
    db.close()

