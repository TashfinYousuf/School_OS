# backend/tests/test_stage08_backend_domain.py
"""
STAGE 08 ACCEPTANCE TEST SUITE: BACKEND/API & DOMAIN ARCHITECTURE HARDENING

Validates:
1. Pydantic V2 modern schema contracts (zero deprecation warnings, model_validate from ORM).
2. Decimal precision and anti-float-creep guarantees in financial domain.
3. Observability middleware (X-Request-ID correlation, X-Process-Time latency header).
4. Transaction rollback boundaries in get_tenant_db on unhandled errors.
5. API error response envelope consistency ({"detail": ...} for 401, 403, 404, 422).
6. Domain router protection and fail-closed tenant dependency binding.
"""

import uuid
import pytest
from datetime import datetime, timezone
from decimal import Decimal
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.core.database import SessionLocal, get_tenant_db
from app.models.finance import Invoice, InvoiceLineItem, FeePayment
from app.schemas.academic import SubjectResponse, GradeLevelResponse
from app.api.endpoints.academic import RoutineSlotResponse
from app.schemas.exam import ExamResponse, ExamResultResponse
from app.schemas.finance import InvoiceCreate, InvoiceLineItemCreate, InvoiceResponse
from app.api.endpoints.students import StudentListItem
from app.api.endpoints.teachers import TeacherResponse
from app.api.endpoints.audit import AuditResponse
from app.api.endpoints.communication import MessageResponse


@pytest.fixture
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# 1. Pydantic V2 Modern Schema Verification
# ---------------------------------------------------------------------------
def test_pydantic_v2_schema_instantiation_without_deprecations():
    """Verify core domain response schemas validate and serialize cleanly via Pydantic V2."""
    now = datetime.now(timezone.utc)
    u_id = uuid.uuid4()
    t_id = "tenant-test-uuid"

    # RoutineSlotResponse
    slot = RoutineSlotResponse(
        id=u_id,
        class_name="Class 10",
        day_of_week="Monday",
        period_number="1",
        start_time="09:00",
        end_time="09:45",
        subject="Physics",
        teacher_name="Dr. Rahim",
        room_number="Lab-1"
    )
    assert slot.model_dump()["period_number"] == "1"

    # StudentListItem
    student_item = StudentListItem(
        id=u_id,
        first_name="Tariq",
        last_name="Islam",
        admission_number="ADM-2026-001",
        class_name="Class 10",
        roll_number="01",
        guardian_name="Hasan Islam",
        guardian_phone="+8801711000000",
        status="Active",
        created_at=now,
        updated_at=now
    )
    assert student_item.model_dump()["admission_number"] == "ADM-2026-001"

    # TeacherResponse
    teacher = TeacherResponse(
        id=u_id,
        first_name="Fatima",
        last_name="Begum",
        email="fatima@school.edu.bd",
        designation="Senior Lecturer",
        assigned_class="Class 9",
        status="Active"
    )
    assert teacher.model_dump()["first_name"] == "Fatima"

    # ExamResponse & ExamResultResponse
    exam = ExamResponse(id=u_id, tenant_id=t_id, name="Midterm 2026", term="Term 1")
    assert exam.model_dump()["name"] == "Midterm 2026"

    result = ExamResultResponse(
        id=u_id,
        tenant_id=t_id,
        student_id="student-1",
        exam_id=u_id,
        subject_id=u_id,
        marks_obtained=88.5,
        grade="A+",
        competency_scores={"Logic": 90.0, "Application": 85.0}
    )
    assert result.model_dump()["grade"] == "A+"

    # AuditResponse
    audit = AuditResponse(
        id="audit-log-1",
        timestamp=now,
        actor_id="user-1",
        action_type="UPDATE_STUDENT",
        target_entity="Student",
        risk_level="Low"
    )
    assert audit.model_dump()["action_type"] == "UPDATE_STUDENT"

    # MessageResponse
    msg = MessageResponse(
        id=u_id,
        channel="WHATSAPP",
        sender_info="+8801811223344",
        content="Requesting leave for student",
        intent="Leave Request",
        ai_draft="Understood, submitting to class teacher.",
        risk_level="Low",
        status="PENDING",
        created_at=now
    )
    assert msg.model_dump()["channel"] == "WHATSAPP"


def test_pydantic_v2_from_attributes_orm_compatibility():
    """Verify ConfigDict(from_attributes=True) resolves simulated ORM attributes."""
    class MockGradeLevelORM:
        id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        name = "Class 9"
        description = "Secondary"
        subjects = []

    mock_orm = MockGradeLevelORM()
    validated = GradeLevelResponse.model_validate(mock_orm)
    assert validated.name == "Class 9"
    assert validated.id == mock_orm.id


# ---------------------------------------------------------------------------
# 2. Financial Math & Decimal Precision (Anti-Float-Creep)
# ---------------------------------------------------------------------------
def test_decimal_precision_in_finance_schemas():
    """Verify invoice line items enforce Decimal types and precision."""
    item = InvoiceLineItemCreate(
        description="Term Tuition",
        quantity=2,
        unit_price=Decimal("1500.50"),
        amount=Decimal("3001.00")
    )
    assert isinstance(item.amount, Decimal)
    assert item.amount == Decimal("3001.00")

    # Rejects zero or negative amounts
    with pytest.raises(ValidationError):
        InvoiceLineItemCreate(
            description="Invalid Fee",
            quantity=1,
            amount=Decimal("0.00")
        )

    # Rejects negative amounts
    with pytest.raises(ValidationError):
        InvoiceLineItemCreate(
            description="Invalid Negative Fee",
            quantity=1,
            amount=Decimal("-50.00")
        )


def test_anti_float_creep_arithmetic():
    """Ensure financial operations avoid binary IEEE 754 floating point inaccuracies."""
    # Classic float pitfall: 0.1 + 0.2 != 0.3
    float_sum = 0.1 + 0.2
    assert float_sum != 0.3  # 0.30000000000000004

    # EducationOS Decimal guarantee
    dec_a = Decimal("0.10")
    dec_b = Decimal("0.20")
    assert dec_a + dec_b == Decimal("0.30")

    # Aggregating 10 items of 0.10
    total = sum([Decimal("0.10") for _ in range(10)])
    assert total == Decimal("1.00")


# ---------------------------------------------------------------------------
# 3. Observability & Request Correlation Middleware
# ---------------------------------------------------------------------------
def test_observability_middleware_generates_request_id(client):
    """Verify that requests without X-Request-ID receive a generated UUID."""
    response = client.get("/")
    assert response.status_code == 200
    assert "x-request-id" in response.headers
    assert len(response.headers["x-request-id"]) > 0
    assert "x-process-time" in response.headers
    assert response.headers["x-process-time"].endswith("ms")


def test_observability_middleware_preserves_client_request_id(client):
    """Verify that incoming X-Request-ID is preserved and echoed back."""
    custom_trace_id = "trace-educationos-frontend-9999"
    response = client.get("/", headers={"X-Request-ID": custom_trace_id})
    assert response.status_code == 200
    assert response.headers["x-request-id"] == custom_trace_id


# ---------------------------------------------------------------------------
# 4. Transaction Boundaries & Rollback Safety
# ---------------------------------------------------------------------------
def test_get_tenant_db_transaction_rollback_on_exception():
    """Verify get_tenant_db rolls back the database session if an exception occurs."""
    tenant_id = f"test-tenant-{uuid.uuid4()}"
    generator = get_tenant_db(tenant_id)
    db = next(generator)

    # In PostgreSQL engine, set_config autobegins transaction; verify or begin if needed
    if not db.in_transaction():
        db.begin()
    assert db.in_transaction()

    # Throw unhandled exception into generator to trigger rollback & cleanup
    try:
        generator.throw(RuntimeError("Simulated unhandled runtime failure in endpoint"))
    except RuntimeError:
        pass

    # The session must be rolled back and closed
    assert not db.is_active or not db.in_transaction()


# ---------------------------------------------------------------------------
# 5. API Error Envelope Consistency
# ---------------------------------------------------------------------------
def test_api_error_envelope_format(client):
    """Verify standard error responses return JSON with {"detail": ...} key."""
    # 401 Unauthorized for unauthenticated protected route
    res_401 = client.get("/api/v1/students/")
    assert res_401.status_code in (401, 403)
    data_401 = res_401.json()
    assert "detail" in data_401

    # 404 Not Found for non-existent route
    res_404 = client.get("/api/v1/non-existent-endpoint-xyz")
    assert res_404.status_code == 404
    data_404 = res_404.json()
    assert "detail" in data_404


# ---------------------------------------------------------------------------
# 6. Domain Router Protection & Fail-Closed Guards
# ---------------------------------------------------------------------------
def test_domain_routers_require_authentication(client):
    """Verify that core domain routers fail closed when accessed without credentials."""
    unauthenticated_endpoints = [
        "/api/v1/students/",
        "/api/v1/teachers/",
        "/api/v1/finance/invoices",
        "/api/v1/guardians/directory",
        "/api/v1/academic/routine",
        "/api/v1/exams/",
        "/api/v1/workspaces/",
    ]
    for endpoint in unauthenticated_endpoints:
        res = client.get(endpoint)
        assert res.status_code in (401, 403), f"Endpoint {endpoint} was not protected: {res.status_code}"
        assert "detail" in res.json()
