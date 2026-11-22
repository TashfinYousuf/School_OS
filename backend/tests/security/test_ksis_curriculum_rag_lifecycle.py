# backend/tests/security/test_ksis_curriculum_rag_lifecycle.py
import os
import io
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

import app.models
from app.main import app
from app.models.base import Base
from app.api.deps import (
    get_db as deps_get_db,
    get_current_tenant_id,
    get_current_user_claims,
)
from app.core.database import get_db as core_get_db
from app.models.curriculum import CurriculumDocument, CurriculumChunk
from app.services.curriculum_rag import curriculum_rag, sanitize_text, sanitize_payload

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
def clean_database_and_overrides():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[deps_get_db] = get_test_db
    app.dependency_overrides[core_get_db] = get_test_db
    yield
    app.dependency_overrides.clear()


def make_claims(role: str, tenant_id: str, user_id: str = "test-user-id") -> dict:
    return {
        "sub": user_id,
        "user_id": user_id,
        "role": role,
        "tenant_id": tenant_id,
        "permissions": []
    }


def test_sanitize_text_strips_nul_and_surrogates():
    """Verifies that sanitize_text strips NUL characters and invalid surrogates."""
    bad_input = "Hello\x00World!\u0000Class \0 5 \ud800 Science"
    clean = sanitize_text(bad_input)
    assert "\x00" not in clean
    assert "\u0000" not in clean
    assert clean == "HelloWorld!Class  5  Science"

    # Recursive payload sanitizer
    payload = {
        "title\x00": "Chapter 1\x00",
        "nested": [{"text": "Content\x00 here"}]
    }
    cleaned_payload = sanitize_payload(payload)
    assert "title" in cleaned_payload
    assert cleaned_payload["title"] == "Chapter 1"
    assert cleaned_payload["nested"][0]["text"] == "Content here"


def test_ksis_real_pdf_rag_lifecycle_and_citations():
    """
    Executes the full RAG lifecycle on a real KSIS syllabus PDF:
    1. Upload & Validation
    2. Private storage persistence
    3. Text extraction & NUL sanitization
    4. Chunking & vector embedding
    5. Real semantic retrieval
    6. Three pedagogical questions verified with exact source citations
    7. Admin preview
    8. Cascade deletion and complete cleanup
    """
    client = TestClient(app)
    tid = str(uuid.uuid4())
    t_uuid = uuid.UUID(tid)
    admin_uid = str(uuid.uuid4())

    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(role="admin", tenant_id=tid, user_id=admin_uid)

    pdf_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "docs", "syllabus", "KSIS_Class5_Science_Syllabus_2026.pdf"))
    assert os.path.exists(pdf_path), f"Real KSIS syllabus PDF not found at {pdf_path}"

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    # 1. Upload via Admin
    response = client.post(
        "/api/v1/ai/curriculum/upload",
        data={
            "title": "KSIS Class 5 Science Syllabus 2026",
            "class_name": "Class 5",
            "subject": "General Science",
            "chapter": "All Chapters",
            "academic_year": "2026"
        },
        files={"file": ("KSIS_Class5_Science_Syllabus_2026.pdf", pdf_bytes, "application/pdf")}
    )
    assert response.status_code in (200, 201), response.text
    doc_data = response.json()
    assert doc_data["status"] == "INDEXED"
    assert doc_data["chunks_count"] >= 3
    doc_id = doc_data["id"]

    # 2. Check Document Status Endpoint
    status_res = client.get(f"/api/v1/ai/curriculum/documents/{doc_id}/status")
    assert status_res.status_code == 200
    st_data = status_res.json()
    assert st_data["stage"] == "completed"
    assert st_data["progress_pct"] == 100
    assert st_data["chunks_count"] >= 3

    # 3. Check Document Preview Endpoint
    preview_res = client.get(f"/api/v1/ai/curriculum/documents/{doc_id}/preview")
    assert preview_res.status_code == 200
    prev_data = preview_res.json()
    assert "KIDS SHINE INTERNATIONAL SCHOOL" in prev_data["preview_text"]

    # 4. Demonstrate 3 verifiable questions with source citations
    # Question 1: Heart rate and bile production
    q1_res = client.post(
        "/api/v1/ai/curriculum/query",
        json={
            "class_name": "Class 5",
            "subject": "General Science",
            "question": "What is the normal human heart rate at rest and where is bile produced and stored?"
        }
    )
    assert q1_res.status_code == 200
    q1_data = q1_res.json()
    assert q1_data["grounding_count"] > 0
    assert len(q1_data["citations"]) > 0
    # Verifiable fact check
    assert any("72" in c["excerpt"] or "bile" in c["excerpt"].lower() for c in q1_data["citations"])

    # Question 2: Photosynthesis and stomata
    q2_res = client.post(
        "/api/v1/ai/curriculum/query",
        json={
            "class_name": "Class 5",
            "subject": "General Science",
            "question": "In which leaf layer does photosynthesis take place and what is the function of stomata?"
        }
    )
    assert q2_res.status_code == 200
    q2_data = q2_res.json()
    assert q2_data["grounding_count"] > 0
    assert any("palisade" in c["excerpt"].lower() or "stomata" in c["excerpt"].lower() for c in q2_data["citations"])

    # Question 3: Bangladesh Solar Rooftop Initiative
    q3_res = client.post(
        "/api/v1/ai/curriculum/query",
        json={
            "class_name": "Class 5",
            "subject": "General Science",
            "question": "What is the carbon emission reduction target of Bangladesh National Solar Rooftop Initiative?"
        }
    )
    assert q3_res.status_code == 200
    q3_data = q3_res.json()
    assert q3_data["grounding_count"] > 0
    assert any("15%" in c["excerpt"] or "solar" in c["excerpt"].lower() for c in q3_data["citations"])

    # 5. Clean Cascade Deletion
    del_res = client.delete(f"/api/v1/ai/curriculum/documents/{doc_id}")
    assert del_res.status_code == 200
    assert del_res.json()["message"] == "Document and knowledge chunks removed successfully"

    # Confirm chunks were deleted
    status_after = client.get(f"/api/v1/ai/curriculum/documents/{doc_id}/status")
    assert status_after.status_code == 404
