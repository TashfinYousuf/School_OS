# EducationOS — Email Provider Configuration & Dispatch Manual
# ইমেইল নোটিফিকেশন কনফিগারেশন ম্যানুয়াল

**Module:** `backend/app/services/communication_providers.py`  
**Endpoint:** `POST /api/v1/communication/dispatch-email`  
**Health Check:** `GET /api/v1/communication/providers/status`

---

## 1. Architectural Principles
EducationOS strictly enforces **truthful communication status reporting**:
- If SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) are not present in `.env`, the provider returns status `NOT_CONFIGURED` with `delivered = False`.
- Zero fake success responses or silent mock drops in production.
- All email dispatch attempts record tenant-isolated audit log events (`communication.email_sent`, `communication.email_failed`, or `communication.email_skipped`).

---

## 2. Environment Variables Configuration

Add the following keys to your deployment `.env` file:

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@kidsshine.edu.bd
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM_EMAIL=notifications@kidsshine.edu.bd
SMTP_FROM_NAME="Kids Shine International School"
SMTP_USE_TLS=true
```

### Supported SMTP Providers
1. **Google Workspace / Gmail:**
   - Host: `smtp.gmail.com`
   - Port: `587` (TLS)
   - Note: Requires 2-Step Verification and an **App Password** (not personal Google password).
2. **Amazon Simple Email Service (SES):**
   - Host: `email-smtp.ap-south-1.amazonaws.com`
   - Port: `587`
   - Note: Requires IAM SES SMTP credentials and domain verification.
3. **SendGrid / Twilio:**
   - Host: `smtp.sendgrid.net`
   - Port: `587`
   - Username: `apikey`
   - Password: `<Your SendGrid API Key>`

---

## 3. API Contract & Testing

### A. Health & Readiness Verification
```bash
curl -X GET "http://localhost:8000/api/v1/communication/providers/status" \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected Response (Configured):**
```json
{
  "email": {
    "provider": "smtp",
    "status": "CONFIGURED",
    "from_email": "notifications@kidsshine.edu.bd"
  },
  "sms": {
    "provider": "greenweb",
    "status": "CONFIGURED",
    "sender_id": "8809612000000"
  },
  "whatsapp": {
    "provider": "meta_cloud_api",
    "status": "NOT_CONFIGURED",
    "message": "WhatsApp Business Cloud API keys not configured"
  }
}
```

### B. Dispatch Single Email
```bash
curl -X POST "http://localhost:8000/api/v1/communication/dispatch-email" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_email": "guardian@example.com",
    "subject": "Kids Shine School Fee Notice — 2026",
    "html_content": "<h1>Kids Shine International School</h1><p>Dear Guardian, your monthly tuition invoice is ready.</p>",
    "text_content": "Dear Guardian, your monthly tuition invoice is ready."
  }'
```

---

## 4. Operational Invariants
1. **Recipient Sanitization:** Email addresses are checked against RFC 5322 syntax and lowercased.
2. **Anti-Spam Throttling:** Outbound emails are subject to tenant-level quotas.
3. **Audit Trail:** Every sent message records `recipient_email_masked` (`g***n@example.com`) to protect personal data in audit records.

