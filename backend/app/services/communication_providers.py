# backend/app/services/communication_providers.py
"""
Truthful Communication Providers Architecture:
Implements EmailProvider and SmsProvider abstractions for institutional notifications,
parent alerts, OTP delivery, password resets, and emergency broadcasts.

Invariants:
1. Truthful Reporting: Never returns fake success when credentials are missing.
   Returns status='NOT_CONFIGURED' and delivered=False with detailed diagnostic messages.
2. Provider Neutrality:
   - Email: Resend, Brevo, SMTP, Mock
   - SMS: GreenWeb, Osel / Onnorokom, SSL Wireless, Generic REST, Mock
3. Transactional Outbox Integration:
   - Dispatches items from NotificationOutbox table with exponential backoff on retry.
4. Bangladesh Telecom Gateway Support: Designed for GreenWeb, SSL Wireless, Banglalink, and Grameenphone.
"""
import os
import re
import json
import smtplib
import logging
import datetime
import urllib.request
import urllib.parse
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict

from sqlalchemy.orm import Session
from app.models.notification import NotificationOutbox

logger = logging.getLogger(__name__)


@dataclass
class DeliveryResult:
    channel: str              # "email" or "sms"
    status: str               # "SENT", "NOT_CONFIGURED", "FAILED"
    delivered: bool
    recipient: str
    provider: str
    message_id: Optional[str] = None
    error: Optional[str] = None
    dispatched_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class EmailProvider:
    """
    Multi-adapter Email Provider supporting:
    - Resend (RESEND_API_KEY)
    - Brevo (BREVO_API_KEY)
    - SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD)
    - Mock (EMAIL_PROVIDER=mock or ALLOW_MOCK_EMAIL=true)
    """
    def __init__(self):
        self.provider_override = os.getenv("EMAIL_PROVIDER", "").strip().lower()
        self.resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
        self.brevo_api_key = os.getenv("BREVO_API_KEY", "").strip()

        # SMTP config
        self.host = os.getenv("SMTP_HOST", "").strip()
        self.port = int(os.getenv("SMTP_PORT", "587").strip() or "587")
        self.user = os.getenv("SMTP_USER", "").strip()
        self.password = os.getenv("SMTP_PASSWORD", "").strip()
        self.from_email = os.getenv("SMTP_FROM_EMAIL", self.user or "no-reply@educationos.local").strip()
        self.from_name = os.getenv("SMTP_FROM_NAME", "EducationOS Platform").strip()
        self.use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")

    @property
    def active_provider_name(self) -> str:
        if self.provider_override:
            return self.provider_override
        if self.resend_api_key:
            return "resend"
        if self.brevo_api_key:
            return "brevo"
        if self.host and self.user and self.password:
            return "smtp"
        if os.getenv("ALLOW_MOCK_EMAIL", "false").lower() in ("true", "1"):
            return "mock"
        return "unconfigured"

    def is_configured(self) -> bool:
        prov = self.active_provider_name
        if prov in ("mock", "resend", "brevo", "smtp"):
            return True
        return False

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None
    ) -> DeliveryResult:
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        clean_to = to_email.strip().lower()
        prov = self.active_provider_name

        if prov == "unconfigured":
            logger.warning(f"Email dispatch omitted for {clean_to}: No email provider configured.")
            return DeliveryResult(
                channel="email",
                status="NOT_CONFIGURED",
                delivered=False,
                recipient=clean_to,
                provider="unconfigured",
                error="Email provider not configured in backend/.env (missing RESEND_API_KEY, BREVO_API_KEY, or SMTP credentials).",
                dispatched_at=now_iso
            )

        if prov == "mock":
            logger.info(f"[MOCK EMAIL] To: {clean_to} | Subject: {subject} | Body: {html_body[:80]}...")
            return DeliveryResult(
                channel="email",
                status="SENT",
                delivered=True,
                recipient=clean_to,
                provider="mock",
                message_id=f"mock_email_{int(datetime.datetime.now().timestamp())}",
                dispatched_at=now_iso
            )

        if prov == "resend":
            return self._send_resend(clean_to, subject, html_body, text_body, now_iso)

        if prov == "brevo":
            return self._send_brevo(clean_to, subject, html_body, text_body, now_iso)

        # Default to SMTP
        return self._send_smtp(clean_to, subject, html_body, text_body, now_iso)

    def _send_resend(self, to_email: str, subject: str, html_body: str, text_body: Optional[str], now_iso: str) -> DeliveryResult:
        try:
            payload = {
                "from": f"{self.from_name} <{self.from_email}>" if "@" in self.from_email else f"EducationOS <onboarding@resend.dev>",
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            }
            if text_body:
                payload["text"] = text_body
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=data,
                headers={
                    "Authorization": f"Bearer {self.resend_api_key}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                msg_id = resp_data.get("id", f"resend_{int(datetime.datetime.now().timestamp())}")
                return DeliveryResult(
                    channel="email",
                    status="SENT",
                    delivered=True,
                    recipient=to_email,
                    provider="resend",
                    message_id=msg_id,
                    dispatched_at=now_iso
                )
        except Exception as exc:
            logger.error(f"Failed to send email via Resend to {to_email}: {exc}")
            return DeliveryResult(
                channel="email",
                status="FAILED",
                delivered=False,
                recipient=to_email,
                provider="resend",
                error=str(exc),
                dispatched_at=now_iso
            )

    def _send_brevo(self, to_email: str, subject: str, html_body: str, text_body: Optional[str], now_iso: str) -> DeliveryResult:
        try:
            payload = {
                "sender": {"name": self.from_name, "email": self.from_email},
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": html_body,
            }
            if text_body:
                payload["textContent"] = text_body
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                "https://api.brevo.com/v3/smtp/email",
                data=data,
                headers={
                    "api-key": self.brevo_api_key,
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                msg_id = resp_data.get("messageId", f"brevo_{int(datetime.datetime.now().timestamp())}")
                return DeliveryResult(
                    channel="email",
                    status="SENT",
                    delivered=True,
                    recipient=to_email,
                    provider="brevo",
                    message_id=msg_id,
                    dispatched_at=now_iso
                )
        except Exception as exc:
            logger.error(f"Failed to send email via Brevo to {to_email}: {exc}")
            return DeliveryResult(
                channel="email",
                status="FAILED",
                delivered=False,
                recipient=to_email,
                provider="brevo",
                error=str(exc),
                dispatched_at=now_iso
            )

    def _send_smtp(self, to_email: str, subject: str, html_body: str, text_body: Optional[str], now_iso: str) -> DeliveryResult:
        if not (self.host and self.user and self.password):
            return DeliveryResult(
                channel="email",
                status="NOT_CONFIGURED",
                delivered=False,
                recipient=to_email,
                provider="smtp",
                error="SMTP credentials missing (SMTP_HOST, SMTP_USER, SMTP_PASSWORD).",
                dispatched_at=now_iso
            )
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to_email

            if text_body:
                msg.attach(MIMEText(text_body, "plain", "utf-8"))
            if html_body:
                msg.attach(MIMEText(html_body, "html", "utf-8"))

            if self.port == 465:
                with smtplib.SMTP_SSL(self.host, self.port, timeout=10) as server:
                    server.login(self.user, self.password)
                    server.sendmail(self.from_email, [to_email], msg.as_string())
            else:
                with smtplib.SMTP(self.host, self.port, timeout=10) as server:
                    if self.use_tls:
                        server.starttls()
                    server.login(self.user, self.password)
                    server.sendmail(self.from_email, [to_email], msg.as_string())

            logger.info(f"Email successfully delivered via SMTP to {to_email} with subject: {subject}")
            return DeliveryResult(
                channel="email",
                status="SENT",
                delivered=True,
                recipient=to_email,
                provider="smtp",
                message_id=f"smtp_{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')}_{to_email[:5]}",
                dispatched_at=now_iso
            )
        except Exception as exc:
            logger.error(f"Failed to send email via SMTP to {to_email}: {exc}")
            return DeliveryResult(
                channel="email",
                status="FAILED",
                delivered=False,
                recipient=to_email,
                provider="smtp",
                error=str(exc),
                dispatched_at=now_iso
            )


class SmsProvider:
    """
    Multi-adapter SMS Provider supporting:
    - GreenWeb (GREENWEB_API_KEY or SMS_API_KEY)
    - Osel / Onnorokom (OSEL_API_KEY)
    - SSL Wireless (SMS_GATEWAY_PROVIDER=sslwireless)
    - Generic REST Gateway
    - Mock (SMS_GATEWAY_PROVIDER=mock or ALLOW_MOCK_SMS=true)
    """
    def __init__(self):
        self.gateway_type = os.getenv("SMS_GATEWAY_PROVIDER", "").strip().lower()
        self.greenweb_api_key = os.getenv("GREENWEB_API_KEY", os.getenv("SMS_API_KEY", "")).strip()
        self.osel_api_key = os.getenv("OSEL_API_KEY", "").strip()
        self.api_key = os.getenv("SMS_API_KEY", "").strip()
        self.api_url = os.getenv("SMS_API_URL", "").strip()
        self.sender_id = os.getenv("SMS_SENDER_ID", "EDUSYS").strip()

    @property
    def active_provider_name(self) -> str:
        if self.gateway_type:
            return self.gateway_type
        if self.greenweb_api_key:
            return "greenweb"
        if self.osel_api_key:
            return "osel"
        if os.getenv("ALLOW_MOCK_SMS", "false").lower() in ("true", "1"):
            return "mock"
        return "unconfigured"

    def is_configured(self) -> bool:
        prov = self.active_provider_name
        if prov in ("mock", "greenweb", "osel", "sslwireless"):
            return True
        if self.api_key and self.api_url:
            return True
        return False

    def send_sms(self, to_phone: str, message: str) -> DeliveryResult:
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        # Clean phone number (format to Bangladesh MSISDN: 8801XXXXXXXXX)
        digits = re.sub(r"\D", "", to_phone)
        if len(digits) == 11 and digits.startswith("01"):
            clean_msisdn = f"88{digits}"
        elif len(digits) == 13 and digits.startswith("8801"):
            clean_msisdn = digits
        else:
            clean_msisdn = digits

        prov = self.active_provider_name

        if prov == "unconfigured":
            logger.warning(f"SMS dispatch omitted for {to_phone}: SMS Gateway not configured.")
            return DeliveryResult(
                channel="sms",
                status="NOT_CONFIGURED",
                delivered=False,
                recipient=to_phone,
                provider="unconfigured",
                error="SMS Gateway credentials are not configured in backend/.env (missing GREENWEB_API_KEY, OSEL_API_KEY, or SMS_API_KEY).",
                dispatched_at=now_iso
            )

        if prov == "mock":
            logger.info(f"[MOCK SMS] Dispatched to {clean_msisdn}: {message[:60]}...")
            return DeliveryResult(
                channel="sms",
                status="SENT",
                delivered=True,
                recipient=clean_msisdn,
                provider="mock",
                message_id=f"mock_sms_{int(datetime.datetime.now().timestamp())}",
                dispatched_at=now_iso
            )

        try:
            if prov == "greenweb":
                endpoint = self.api_url or "http://api.greenweb.com.bd/api.php"
                token = self.greenweb_api_key or self.api_key
                params = {
                    "token": token,
                    "to": clean_msisdn,
                    "message": message,
                }
                encoded = urllib.parse.urlencode(params).encode("utf-8")
                req = urllib.request.Request(endpoint, data=encoded, method="POST")
                with urllib.request.urlopen(req, timeout=10) as resp:
                    resp_text = resp.read().decode("utf-8")
                    if "Ok" in resp_text or "success" in resp_text.lower():
                        return DeliveryResult(
                            channel="sms",
                            status="SENT",
                            delivered=True,
                            recipient=clean_msisdn,
                            provider="greenweb",
                            message_id=resp_text.strip()[:40],
                            dispatched_at=now_iso
                        )
                    return DeliveryResult(
                        channel="sms",
                        status="FAILED",
                        delivered=False,
                        recipient=clean_msisdn,
                        provider="greenweb",
                        error=resp_text[:200],
                        dispatched_at=now_iso
                    )

            elif prov in ("osel", "onnorokom"):
                endpoint = self.api_url or "https://api2.onnorokom.com/sms/v1/send"
                payload = {
                    "apiKey": self.osel_api_key or self.api_key,
                    "messageText": message,
                    "number": clean_msisdn,
                    "type": "TEXT",
                    "maskName": self.sender_id
                }
                data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    endpoint,
                    data=data,
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    resp_json = json.loads(resp.read().decode("utf-8"))
                    if resp_json.get("status") in ("SUCCESS", "OK", 200):
                        return DeliveryResult(
                            channel="sms",
                            status="SENT",
                            delivered=True,
                            recipient=clean_msisdn,
                            provider="osel",
                            message_id=str(resp_json.get("messageId", f"osel_{int(datetime.datetime.now().timestamp())}")),
                            dispatched_at=now_iso
                        )
                    return DeliveryResult(
                        channel="sms",
                        status="FAILED",
                        delivered=False,
                        recipient=clean_msisdn,
                        provider="osel",
                        error=str(resp_json.get("message") or "Osel gateway rejected message"),
                        dispatched_at=now_iso
                    )

            elif prov == "sslwireless":
                endpoint = self.api_url or "https://smsplus.sslwireless.com/api/v3/send-sms"
                payload = {
                    "api_token": self.api_key,
                    "sid": self.sender_id,
                    "msisdn": clean_msisdn,
                    "sms": message,
                    "csms_id": f"edu_{int(datetime.datetime.now().timestamp())}"
                }
                data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    endpoint,
                    data=data,
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    resp_json = json.loads(resp.read().decode("utf-8"))
                    if resp_json.get("status") == "SUCCESS":
                        return DeliveryResult(
                            channel="sms",
                            status="SENT",
                            delivered=True,
                            recipient=clean_msisdn,
                            provider="sslwireless",
                            message_id=str(resp_json.get("smsinfo", [{}])[0].get("sms_id")),
                            dispatched_at=now_iso
                        )
                    return DeliveryResult(
                        channel="sms",
                        status="FAILED",
                        delivered=False,
                        recipient=clean_msisdn,
                        provider="sslwireless",
                        error=resp_json.get("error_message") or "Gateway error",
                        dispatched_at=now_iso
                    )

            else:
                # Generic REST JSON gateway
                payload = {"to": clean_msisdn, "message": message, "sender_id": self.sender_id}
                data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    self.api_url,
                    data=data,
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    return DeliveryResult(
                        channel="sms",
                        status="SENT",
                        delivered=True,
                        recipient=clean_msisdn,
                        provider=prov,
                        message_id="generic_success",
                        dispatched_at=now_iso
                    )

        except Exception as exc:
            logger.error(f"Failed to dispatch SMS to {clean_msisdn}: {exc}")
            return DeliveryResult(
                channel="sms",
                status="FAILED",
                delivered=False,
                recipient=clean_msisdn,
                provider=prov,
                error=str(exc),
                dispatched_at=now_iso
            )


# Singleton instances
email_provider = EmailProvider()
sms_provider = SmsProvider()


def dispatch_outbox_item(db: Session, outbox_item_id: Any) -> DeliveryResult:
    """
    Dispatches a single NotificationOutbox record via the appropriate configured provider,
    handling state transitions, retry counter increments, exponential backoff, and dead-lettering.
    """
    outbox_item = db.query(NotificationOutbox).filter(NotificationOutbox.id == outbox_item_id).first()
    if not outbox_item:
        raise ValueError(f"NotificationOutbox item with ID {outbox_item_id} not found.")

    if outbox_item.status in ("SENT", "DEAD_LETTER"):
        logger.info(f"Outbox item {outbox_item_id} is already in terminal state '{outbox_item.status}'. Skipping.")
        return DeliveryResult(
            channel=outbox_item.channel.lower(),
            status=outbox_item.status,
            delivered=(outbox_item.status == "SENT"),
            recipient=outbox_item.recipient,
            provider=outbox_item.provider or "unknown",
            message_id=outbox_item.provider_message_id,
            error=outbox_item.error_message,
        )

    channel = (outbox_item.channel or "EMAIL").upper()
    now_utc = datetime.datetime.now(datetime.timezone.utc)

    if channel == "EMAIL":
        result = email_provider.send_email(
            to_email=outbox_item.recipient,
            subject=outbox_item.subject or "Notification from EducationOS",
            html_body=outbox_item.body,
        )
    elif channel == "SMS":
        result = sms_provider.send_sms(
            to_phone=outbox_item.recipient,
            message=outbox_item.body,
        )
    else:
        result = DeliveryResult(
            channel=channel.lower(),
            status="FAILED",
            delivered=False,
            recipient=outbox_item.recipient,
            provider="unsupported",
            error=f"Unsupported communication channel: {channel}"
        )

    outbox_item.provider = result.provider

    if result.delivered:
        outbox_item.status = "SENT"
        outbox_item.provider_message_id = result.message_id
        outbox_item.sent_at = now_utc
        outbox_item.error_message = None
        outbox_item.next_retry_at = None
    else:
        outbox_item.retry_count += 1
        outbox_item.error_message = result.error or "Delivery failed"
        if outbox_item.retry_count >= outbox_item.max_retries:
            outbox_item.status = "DEAD_LETTER"
            outbox_item.next_retry_at = None
            logger.warning(f"Outbox item {outbox_item_id} exceeded max retries ({outbox_item.max_retries}). Moved to DEAD_LETTER.")
        else:
            outbox_item.status = "FAILED"
            # Exponential backoff delays: 60s, 300s, 900s
            backoff_intervals = [60, 300, 900]
            delay_sec = backoff_intervals[min(outbox_item.retry_count - 1, len(backoff_intervals) - 1)]
            outbox_item.next_retry_at = now_utc + datetime.timedelta(seconds=delay_sec)
            logger.info(f"Outbox item {outbox_item_id} retry #{outbox_item.retry_count} scheduled at {outbox_item.next_retry_at}")

    db.commit()
    return result


def get_communications_health() -> Dict[str, Any]:
    """Provides unified readiness state for all external communication and notification dependencies."""
    return {
        "email": {
            "channel": "email",
            "provider": email_provider.active_provider_name,
            "configured": email_provider.is_configured(),
            "host": email_provider.host or None,
            "port": email_provider.port,
            "from_email": email_provider.from_email if email_provider.is_configured() else None,
            "status": "READY" if email_provider.is_configured() else "NOT_CONFIGURED",
            "action_required": None if email_provider.is_configured() else "Supply RESEND_API_KEY, BREVO_API_KEY, or SMTP credentials in backend/.env"
        },
        "sms": {
            "channel": "sms",
            "provider": sms_provider.active_provider_name,
            "configured": sms_provider.is_configured(),
            "sender_id": sms_provider.sender_id if sms_provider.is_configured() else None,
            "status": "READY" if sms_provider.is_configured() else "NOT_CONFIGURED",
            "action_required": None if sms_provider.is_configured() else "Supply GREENWEB_API_KEY, OSEL_API_KEY, or SMS_API_KEY in backend/.env"
        },
        "whatsapp": {
            "channel": "whatsapp",
            "configured": bool(os.getenv("WHATSAPP_VERIFY_TOKEN")),
            "status": "READY" if bool(os.getenv("WHATSAPP_VERIFY_TOKEN")) else "NOT_CONFIGURED",
            "action_required": None if bool(os.getenv("WHATSAPP_VERIFY_TOKEN")) else "Supply WHATSAPP_VERIFY_TOKEN in backend/.env"
        }
    }
