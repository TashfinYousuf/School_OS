# backend/tests/test_communication_outbox_and_providers.py
import os
import uuid
import pytest
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.notification import NotificationOutbox
from app.services.communication_providers import (
    EmailProvider,
    SmsProvider,
    dispatch_outbox_item,
    get_communications_health,
)
from app.workers.outbox_worker import OutboxWorkerDaemon


@pytest.fixture
def test_db_session():
    """Provides an isolated in-memory SQLite session with NotificationOutbox table."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine, tables=[NotificationOutbox.__table__])
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def test_email_provider_unconfigured_truthful_failure(monkeypatch):
    """Verifies that EmailProvider never fakes success when credentials are not configured."""
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.delenv("BREVO_API_KEY", raising=False)
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("SMTP_USER", raising=False)
    monkeypatch.delenv("SMTP_PASSWORD", raising=False)
    monkeypatch.delenv("EMAIL_PROVIDER", raising=False)
    monkeypatch.delenv("ALLOW_MOCK_EMAIL", raising=False)

    provider = EmailProvider()
    assert not provider.is_configured()

    result = provider.send_email(
        to_email="test@example.com",
        subject="Test Alert",
        html_body="<p>Test Content</p>"
    )
    assert not result.delivered
    assert result.status == "NOT_CONFIGURED"
    assert "missing" in result.error.lower() or "not configured" in result.error.lower()


def test_email_provider_mock_delivery(monkeypatch):
    """Verifies mock email delivery when explicitly allowed in sandbox/testing."""
    monkeypatch.setenv("ALLOW_MOCK_EMAIL", "true")
    monkeypatch.setenv("EMAIL_PROVIDER", "mock")

    provider = EmailProvider()
    assert provider.is_configured()

    result = provider.send_email(
        to_email="parent@school.edu.bd",
        subject="Attendance Notice",
        html_body="<p>Your child was present today.</p>"
    )
    assert result.delivered
    assert result.status == "SENT"
    assert result.provider == "mock"
    assert result.message_id is not None


def test_sms_provider_unconfigured_truthful_failure(monkeypatch):
    """Verifies that SmsProvider does not fabricate SMS delivery without real credentials."""
    monkeypatch.delenv("GREENWEB_API_KEY", raising=False)
    monkeypatch.delenv("OSEL_API_KEY", raising=False)
    monkeypatch.delenv("SMS_API_KEY", raising=False)
    monkeypatch.delenv("SMS_GATEWAY_PROVIDER", raising=False)
    monkeypatch.delenv("ALLOW_MOCK_SMS", raising=False)

    provider = SmsProvider()
    assert not provider.is_configured()

    result = provider.send_sms(
        to_phone="01700000000",
        message="Class 5 test results published"
    )
    assert not result.delivered
    assert result.status == "NOT_CONFIGURED"
    assert result.provider == "unconfigured"


def test_sms_provider_mock_delivery_and_msisdn_cleaning(monkeypatch):
    """Verifies phone number normalization to BD MSISDN (8801...) and mock dispatch."""
    monkeypatch.setenv("ALLOW_MOCK_SMS", "true")
    monkeypatch.setenv("SMS_GATEWAY_PROVIDER", "mock")

    provider = SmsProvider()
    assert provider.is_configured()

    # Local BD format: 01812345678 -> 8801812345678
    result = provider.send_sms(
        to_phone="01812345678",
        message="Fee payment reminder"
    )
    assert result.delivered
    assert result.recipient == "8801812345678"
    assert result.provider == "mock"


def test_outbox_dispatch_lifecycle_success(test_db_session, monkeypatch):
    """Verifies full lifecycle of NotificationOutbox transition from PENDING to SENT."""
    monkeypatch.setenv("ALLOW_MOCK_EMAIL", "true")
    monkeypatch.setenv("EMAIL_PROVIDER", "mock")

    # Refresh module singleton state
    from app.services import communication_providers
    communication_providers.email_provider = EmailProvider()

    outbox_item = NotificationOutbox(
        tenant_id="ksis-dhaka",
        channel="EMAIL",
        recipient="guardian@gmail.com",
        subject="Report Card Ready",
        body="<h1>Term 1 Grades Available</h1>",
        status="PENDING",
        retry_count=0,
        max_retries=3
    )
    test_db_session.add(outbox_item)
    test_db_session.commit()
    test_db_session.refresh(outbox_item)

    result = dispatch_outbox_item(test_db_session, outbox_item.id)
    assert result.delivered
    assert result.status == "SENT"

    # Verify persisted DB attributes
    test_db_session.refresh(outbox_item)
    assert outbox_item.status == "SENT"
    assert outbox_item.sent_at is not None
    assert outbox_item.provider == "mock"
    assert outbox_item.provider_message_id is not None
    assert outbox_item.error_message is None


def test_outbox_dispatch_retry_and_dead_letter(test_db_session, monkeypatch):
    """Verifies retry increment, exponential backoff scheduling, and transition to DEAD_LETTER."""
    monkeypatch.delenv("ALLOW_MOCK_SMS", raising=False)
    monkeypatch.delenv("SMS_API_KEY", raising=False)
    monkeypatch.setenv("SMS_GATEWAY_PROVIDER", "")

    from app.services import communication_providers
    communication_providers.sms_provider = SmsProvider()

    outbox_item = NotificationOutbox(
        tenant_id="ksis-dhaka",
        channel="SMS",
        recipient="01711112222",
        body="School closed tomorrow due to weather",
        status="PENDING",
        retry_count=0,
        max_retries=2
    )
    test_db_session.add(outbox_item)
    test_db_session.commit()
    test_db_session.refresh(outbox_item)

    # First attempt fails -> status FAILED, retry_count = 1, next_retry_at scheduled
    res1 = dispatch_outbox_item(test_db_session, outbox_item.id)
    assert not res1.delivered
    test_db_session.refresh(outbox_item)
    assert outbox_item.status == "FAILED"
    assert outbox_item.retry_count == 1
    assert outbox_item.next_retry_at is not None

    # Second attempt fails -> hits max_retries (2) -> DEAD_LETTER
    res2 = dispatch_outbox_item(test_db_session, outbox_item.id)
    assert not res2.delivered
    test_db_session.refresh(outbox_item)
    assert outbox_item.status == "DEAD_LETTER"
    assert outbox_item.retry_count == 2
    assert outbox_item.next_retry_at is None


def test_communications_health_introspection(monkeypatch):
    """Verifies unified readiness diagnosis endpoint structure."""
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.delenv("BREVO_API_KEY", raising=False)
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("ALLOW_MOCK_EMAIL", raising=False)
    monkeypatch.delenv("EMAIL_PROVIDER", raising=False)

    from app.services import communication_providers
    communication_providers.email_provider = EmailProvider()
    communication_providers.sms_provider = SmsProvider()

    health = get_communications_health()
    assert "email" in health
    assert "sms" in health
    assert "whatsapp" in health
    assert health["email"]["channel"] == "email"
    assert health["email"]["status"] in ("READY", "NOT_CONFIGURED")

