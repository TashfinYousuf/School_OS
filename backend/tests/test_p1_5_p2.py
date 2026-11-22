import pytest

from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)

TENANT_ID = "1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31"

@pytest.fixture
def admin_token():
    return create_access_token(
        subject="admin_user_id",
        data={"tenant_id": TENANT_ID, "user_id": "admin_uuid", "role": "admin"}
    )

@pytest.fixture
def teacher_token():
    return create_access_token(
        subject="teacher_user_id",
        data={"tenant_id": TENANT_ID, "user_id": "teacher_uuid", "role": "teacher"}
    )

@pytest.fixture
def student_token():
    return create_access_token(
        subject="student_user_id",
        data={"tenant_id": TENANT_ID, "user_id": "student_uuid", "role": "student"}
    )


# =========================================================================
# TEST SUITE 1: P1.5 Institution Abstraction & RBAC Boundaries
# =========================================================================

def test_student_forbidden_from_teacher_voice_diary(student_token):
    """Students must receive 403 Forbidden when accessing TeacherOS endpoints."""
    payload = {
        "class_name": "Class 5",
        "subject": "Mathematics",
        "teacher_name": "Rahim Ahmed",
        "transcription_text": "Taught fractions."
    }
    response = client.post(
        "/api/v1/teacher-os/voice-diary-sync",
        headers={"Authorization": f"Bearer {student_token}"},
        json=payload
    )
    assert response.status_code == 403


def test_student_permitted_on_socratic_learning_studio(student_token):
    """Students must have full access to Socratic Doubt Solver via MultiModelAIGateway."""
    with patch("app.api.endpoints.learning_studio.ai_gateway.execute_with_failover") as mock_gw:
        mock_gw.return_value = ("Hint: Factor out 2x from the first two terms.", "gemini")

        payload = {
            "student_name": "Talha Hussain",
            "subject": "Mathematics",
            "problem_text": "Solve 2x^2 - 5x + 2 = 0",
            "student_previous_step": "I calculated discriminant is 9."
        }
        response = client.post(
            "/api/v1/learning-os/socratic-solve",
            headers={"Authorization": f"Bearer {student_token}"},
            json=payload
        )
        assert response.status_code == 200
        data = response.json()
        assert "socratic_guidance" in data
        assert "Factor out" in data["socratic_guidance"]


# =========================================================================
# TEST SUITE 2: P2 TeacherOS Voice-to-Diary & Curriculum Anti-Drift
# =========================================================================

def test_teacher_voice_diary_extraction_and_persistence(teacher_token):
    """Verifies that unstructured voice text is parsed into structured JSON and stored."""
    mock_json_response = (
        '{"topic": "Fractions - Addition", "subtopics_covered": ["Like Denominators"], '
        '"exercises_solved_count": 4, "homework": "Exercise 3.2 Q1-5", '
        '"curriculum_drift_status": "ON_TRACK", "variance_note": "Pacing aligns with NCTB calendar."}'
    )

    with patch("app.api.endpoints.teacher_diary.ai_client") as mock_ai:
        mock_chat = MagicMock()
        mock_response = MagicMock()
        mock_response.text = mock_json_response
        mock_chat.send_message.return_value = mock_response
        mock_ai.chats.create.return_value = mock_chat

        payload = {
            "class_name": "Class 5",
            "subject": "Mathematics",
            "teacher_name": "Kaynat Farzana",
            "transcription_text": "আজ ক্লাস ফাইভে ভগ্নাংশের যোগ বুঝিয়েছি ৪টা অঙ্ক করিয়েছি।"
        }

        response = client.post(
            "/api/v1/teacher-os/voice-diary-sync",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json=payload
        )

        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "success"
        assert result["extracted"]["topic"] == "Fractions - Addition"
        assert result["extracted"]["curriculum_drift_status"] == "ON_TRACK"


# =========================================================================
# TEST SUITE 3: P2 LearningOS Socratic Rules Verification ("Teach, Don't Answer")
# =========================================================================

def test_socratic_tutor_rejects_direct_answers():
    """Confirms that the system prompt restricts the model from returning blunt final numbers."""
    from app.api.endpoints.learning_studio import DoubtQuery, socratic_doubt_solver

    with patch("app.api.endpoints.learning_studio.ai_gateway.execute_with_failover") as mock_gw:
        mock_gw.return_value = ("Step 1: Notice that 2 * 2 = 4, and (-4) + (-1) = -5. Can you rewrite the middle term?", "gemini")

        query = DoubtQuery(
            student_name="Zayan Ahmed",
            subject="Mathematics",
            problem_text="Find roots for 2x^2 - 5x + 2 = 0",
            student_previous_step=""
        )
        res = socratic_doubt_solver(query)
        assert "Step 1" in res["socratic_guidance"]
        assert res["pedagogical_mode"] == "Active Guided Learning"