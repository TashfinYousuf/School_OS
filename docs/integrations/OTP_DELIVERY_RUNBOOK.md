# EducationOS — One-Time Password (OTP) Delivery & Security Runbook
# ওটিপি ডেলিভারি ও সিকিউরিটি পরিচালনা নির্দেশিকা

---

## 1. Security Architecture
EducationOS OTP delivery is built on zero-trust principles:
1. **Entropy:** 6-digit cryptographically pseudo-random numeric tokens generated using `secrets.randbelow(900000) + 100000`.
2. **Storage:** Plaintext OTPs are NEVER persisted to the database. Only the SHA-256 hash (`hashlib.sha256(otp.encode()).hexdigest()`) is stored with a strict TTL.
3. **Single-Use:** As soon as an OTP is validated, its state is marked `is_consumed = True` and invalidated immediately.
4. **Time-To-Live (TTL):** Standard expiration is 5 minutes (300 seconds). After expiry, the token cannot be redeemed.

---

## 2. Rate Limiting & Anti-Enumeration Protection
To prevent SMS pumping, wallet draining, and brute-force attacks:
- **Per-Identifier Throttling:** Maximum 3 OTP requests per phone number / email per 15-minute sliding window.
- **Per-IP Throttling:** Maximum 10 OTP requests per source IP per 10 minutes.
- **Progressive Delay:** After 3 consecutive failed attempts on an active OTP, a mandatory 60-second cooldown is enforced.
- **Timing Equalization:** Verification routines execute constant-time comparisons (`hmac.compare_digest`) to prevent side-channel timing analysis.

---

## 3. Fallback Channels & Delivery Failover
When telecommunication networks experience degradation:
1. **Primary Delivery:** High-priority Transactional SMS via Greenweb or SSL Wireless.
2. **Secondary Fallback:** If SMS gateway returns a non-200 code or network timeout (>= 4.0s), the system automatically attempts registered primary Guardian Email delivery.
3. **Institutional In-Person Recovery:** If guardian has lost access to both SMS and Email, School Administration can generate a signed single-use physical activation slip via `POST /api/v1/auth/password-reset/initiate`.

---

## 4. Incident Response & Troubleshooting

| Symptom | Probable Cause | Diagnostic Command | Remediation Action |
| :--- | :--- | :--- | :--- |
| Guardian reports "OTP not received" | Gateway balance exhausted | Check gateway console | Top up SMS credits or switch to fallback provider |
| SMS delivery delayed (> 2 min) | MNO DND (Do Not Disturb) or network congestion | Check gateway delivery report | Inform parent; suggest verified email delivery |
| Error `429 Too Many Requests` | OTP rate limit exceeded | Check IP / phone hits in logs | Advise user to wait 15 minutes before retry |
| Error `NOT_CONFIGURED` | Missing `.env` gateway token | `GET /api/v1/communication/providers/status` | Supply valid SMS credentials in `.env` |

