# EducationOS — Bangladesh SMS Gateway Integration Manual
# বাংলাদেশ এসএমএস গেটওয়ে কনফিগারেশন ম্যানুয়াল

**Module:** `backend/app/services/communication_providers.py`  
**Endpoint:** `POST /api/v1/communication/dispatch-sms`  
**Health Check:** `GET /api/v1/communication/providers/status`

---

## 1. Overview & Gateways Supported
EducationOS provides native driver support for leading telecommunication aggregators in Bangladesh:
1. **Greenweb Bangladesh (BTRC Approved Aggregator)**
2. **SSL Wireless (SMS Plus Gateway)**
3. **Mock Mode (Strict local testing with delivery trace logging)**

---

## 2. Environment Variables Configuration

Configure the appropriate aggregator in your deployment `.env`:

### Option A: Greenweb SMS
```bash
SMS_PROVIDER=greenweb
GREENWEB_SMS_API_TOKEN=your_greenweb_token_here
GREENWEB_SMS_SENDER_ID=8809612000000   # Masking ID approved by BTRC
```

### Option B: SSL Wireless
```bash
SMS_PROVIDER=ssl_wireless
SSL_WIRELESS_API_TOKEN=your_ssl_wireless_token
SSL_WIRELESS_SID=your_ssl_approved_sid
SSL_WIRELESS_STAKEHOLDER_ID=your_stakeholder_id
```

### Option C: Mock / QA Mode (Development Only)
```bash
SMS_PROVIDER=mock
```
In mock mode, dispatches do not hit carrier networks; they return `status = "SENT"` with simulated network latency and write formatted logs to `logs/sms_dispatches.log`.

---

## 3. Bangladesh Phone Number Normalization
The backend service automatically sanitizes and validates Bangladeshi mobile numbers into international E.164 format:
- `01712345678` ➔ `+8801712345678`
- `8801812345678` ➔ `+8801812345678`
- `+8801912345678` ➔ `+8801912345678`
- Non-digits and Bangla numerals (`০১২৩৪৫৬৭৮৯`) are automatically mapped to ASCII digits before parsing.
- Invalid prefixes or lengths are rejected immediately with a 422 Unprocessable Entity error.

---

## 4. BTRC Compliance & Unicode Support
1. **Bangla Unicode SMS (UCS-2):**
   - 1 Standard SMS: up to 70 Unicode characters.
   - Multipart SMS: 67 Unicode characters per segment.
   - EducationOS SMS driver automatically calculates segment count and cost quotas.
2. **English GSM-7 SMS:**
   - 1 Standard SMS: up to 160 GSM-7 characters.
   - Multipart SMS: 153 characters per segment.
3. **Restricted Hours:**
   - Promotional / bulk SMS must observe BTRC curfew windows (09:00 AM to 08:00 PM).
   - Critical transactional alerts (Attendance Absentee Alert, Fee Invoice, Password OTP) are routed via High-Priority Transactional routes.

---

## 5. API Dispatch Test Example
```bash
curl -X POST "http://localhost:8000/api/v1/communication/dispatch-sms" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_phone": "01712345678",
    "message": "সম্মানিত অভিভাবক, আজ কিডস শাইন স্কুলে আপনার সন্তানের উপস্থিতি গৃহীত হয়েছে।"
  }'
```

**Response (Configured Gateway):**
```json
{
  "delivered": true,
  "status": "SENT",
  "provider": "greenweb",
  "message_id": "gw-msg-8f92a10d",
  "recipient": "+8801712345678",
  "timestamp": "2026-11-16T08:00:00Z"
}
```

**Response (Unconfigured Credentials):**
```json
{
  "delivered": false,
  "status": "NOT_CONFIGURED",
  "provider": "greenweb",
  "message_id": null,
  "recipient": "+8801712345678",
  "error": "Greenweb SMS credentials are not configured in system environment."
}
```

