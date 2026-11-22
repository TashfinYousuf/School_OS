# EDUCATIONOS — PRODUCT TRUTH & CLAIMS REGISTER
## Authoritative Codebase Evidence, Capability Verification & Marketing Guardrails

**Document Version:** 2026.1-TRUTH  
**Classification:** Internal Governance & Legal/Compliance Reference  
**Strict Mandate:** Every claim made in sales proposals, web copy, user guides, and executive briefs must strictly adhere to the approved wording and restrictions documented in this register.

---

## 1. Classification Taxonomy

Each platform capability is classified into one of three rigorous compliance states:

1. **`VERIFIED LIVE`**: Fully implemented in the production codebase, backed by automated test suites, and verified in local or staging execution.
2. **`IMPLEMENTED, READY FOR PILOT`**: Codebase implementation is structurally complete and verified with mock/test fixtures; requires external production credentials (e.g., live SMS gateway API keys, live merchant payment accounts) or real-world school deployment to execute live transactions.
3. **`INTEGRATION DEFERRED / ROADMAP`**: Architectural specifications or endpoints exist as stubs, but live hardware integration (e.g., physical biometric turnstiles, proprietary OMR scanner machines) is planned for future enterprise phases.

---

## 2. Authoritative Feature & Claims Matrix

### 2.1 Multi-Tenancy & Data Security

| Feature / Claim | Status | Codebase File Evidence | Allowed Public Wording | Explicit Restrictions (Do NOT Claim) |
| :--- | :---: | :--- | :--- | :--- |
| **PostgreSQL Native Row-Level Security (RLS)** | **`VERIFIED LIVE`** | `backend/alembic/versions/*.py`<br>`backend/app/api/deps.py` (`set_config('app.current_tenant_id')`) | "Data is isolated directly at the PostgreSQL database kernel level via Native RLS." | Do NOT claim proprietary hardware-level encryption chips or multi-cloud database sharding. |
| **100% Institutional Data Ownership** | **`VERIFIED LIVE`** | `backend/app/api/v1/endpoints/export.py`<br>`docs/production-hardening/` | "The institution retains 100% legal ownership of all data. Export complete records via CSV/Excel at any time." | Do NOT claim automated blockchain notarization. |
| **Zero Third-Party Data Monetization** | **`VERIFIED LIVE`** | Entire backend codebase (Zero tracking pixels, zero ad networks) | "EducationOS maintains a strict zero-monetization policy. Student and guardian data is never sold or used for ad targeting." | None. This is an absolute contractual commitment. |
| **TOTP Multi-Factor Authentication (MFA)** | **`VERIFIED LIVE`** | `backend/app/api/v1/endpoints/auth.py`<br>`backend/app/models/user.py` | "Standard RFC 6238 TOTP two-factor authentication compatible with Google Authenticator, Microsoft Authenticator, and Apple Keychain." | Do NOT claim mandatory hardware YubiKey enforcement for regular teachers. |
| **Active Session Tracking & Remote Revocation** | **`VERIFIED LIVE`** | `backend/app/models/user.py` (`UserSession`)<br>`backend/app/api/v1/endpoints/auth.py` | "View active sessions across all devices and remotely revoke compromised logins with a single click." | Do NOT claim real-time GPS geolocation tracking of staff devices. |
| **Magic-Byte Binary Upload Validation** | **`VERIFIED LIVE`** | `backend/app/services/storage.py`<br>`backend/app/api/v1/endpoints/admissions.py` | "Multi-layered file inspection verifies true binary file headers (magic bytes) to reject disguised executable scripts." | Do NOT claim military-grade AI deepfake photo detection. |

---

### 2.2 Classroom Operations & Offline Resilience

| Feature / Claim | Status | Codebase File Evidence | Allowed Public Wording | Explicit Restrictions (Do NOT Claim) |
| :--- | :---: | :--- | :--- | :--- |
| **Progressive Web App (PWA) Offline Sync** | **`VERIFIED LIVE`** | `frontend/public/manifest.json`<br>`frontend/public/sw.js`<br>`frontend/lib/offlineQueue.ts` | "Teachers can take attendance offline in low-connectivity classrooms; records queue safely in browser IndexedDB and sync automatically upon reconnection." | Do NOT claim that video streaming or heavy file downloads work completely offline. |
| **1-Tap Fast Attendance Roll Call** | **`VERIFIED LIVE`** | `frontend/app/attendance/page.tsx`<br>`backend/app/api/v1/endpoints/attendance.py` | "Fast, touch-optimized morning roll call takes approximately 30 seconds per classroom on any standard smartphone." | Do NOT claim facial recognition automated attendance without manual verification. |
| **Dual-Copy Fee Receipts** | **`VERIFIED LIVE`** | `backend/app/models/finance.py`<br>`backend/app/api/v1/endpoints/finance.py`<br>`frontend/app/finance/` | "Instantly generates dual-copy printable fee receipts (one copy for parent, one for cashier counter) with institutional seal and audit verification." | Do NOT claim automated direct-debit bank clearing for student bank accounts. |
| **Multi-Child Unified Guardian Portal** | **`VERIFIED LIVE`** | `backend/app/models/guardian.py`<br>`frontend/app/parent/` | "Parents log in using their registered phone number and can seamlessly switch between all siblings enrolled in the same school from a single view." | Do NOT claim inter-school cross-institution guardian networking. |

---

### 2.3 Artificial Intelligence & Curriculum RAG

| Feature / Claim | Status | Codebase File Evidence | Allowed Public Wording | Explicit Restrictions (Do NOT Claim) |
| :--- | :---: | :--- | :--- | :--- |
| **Multi-Model AI Gateway & Failover** | **`VERIFIED LIVE`** | `backend/app/services/ai_gateway.py` | "Enterprise AI Gateway with primary Google Gemini (25s timeout) and automatic failover to Groq/Llama-3.3 for guaranteed uptime." | Do NOT claim that EducationOS owns or trained a trillion-parameter proprietary foundational LLM. |
| **Curriculum RAG & Bengali Boundary Parsing** | **`VERIFIED LIVE`** | `backend/app/services/curriculum_rag.py`<br>`backend/app/workers/rag_worker.py` | "Retrieval-Augmented Generation (RAG) strictly grounds questions in uploaded NCTB textbooks, with specialized chunking respecting Bengali Dari (`।`) punctuation." | Do NOT claim 100% automated autonomous grading of handwritten subjective essays without teacher review. |
| **Pedagogical Human Invariant (Educator Authority)** | **`VERIFIED LIVE`** | `backend/app/services/ai_gateway.py`<br>`backend/app/api/v1/endpoints/ai.py` | "All AI-generated questions and lesson plans are saved in `Draft` state; a human educator must review and approve before publishing." | None. Emphasize this as an institutional safety strength. |
| **Prompt Injection Defense** | **`VERIFIED LIVE`** | `backend/app/services/ai_gateway.py` (OWASP LLM01 heuristics) | "Multi-layered heuristic defenses screen out jailbreak attempts, system prompt extraction, and malicious payload injections." | Do NOT claim mathematical zero-probability of adversarial prompting. |
| **Zero Banglish Translation Policy** | **`VERIFIED LIVE`** | `backend/app/services/ai_gateway.py` | "Outputs strictly adhere to natural Bengali script (বাংলা) or formal English. Distracting Banglish transliterations are blocked." | None. |

---

### 2.4 Commercial Billing & Subscription Governance

| Feature / Claim | Status | Codebase File Evidence | Allowed Public Wording | Explicit Restrictions (Do NOT Claim) |
| :--- | :---: | :--- | :--- | :--- |
| **Transparent Dynamic Pricing Formula** | **`VERIFIED LIVE`** | `backend/app/services/pricing_engine.py` | "Transparent mathematical billing: 1,500 BDT base infrastructure + graduated student volume charges (12/10/8 BDT) + optional modules." | Do NOT quote unapproved promotional discounts without leadership authorization. |
| **Non-Destructive Subscription Suspension** | **`VERIFIED LIVE`** | `backend/app/services/entitlement.py`<br>`backend/app/models/billing.py` | "If payment lapses, accounts transition through a 7-day grace period into a non-destructive read-only state. Institutional records are never deleted." | Do NOT claim infinite indefinite free write-access during non-payment. |
| **14-Day Complimentary Sandbox Trial** | **`VERIFIED LIVE`** | `backend/app/services/entitlement.py` (`free_trial`) | "Institutions can evaluate the complete system in a private 14-day zero-risk trial." | Do NOT promise unlimited AI token consumption during free evaluation. |

---

### 2.5 External Integrations & Staged Modules

| Feature / Claim | Status | Codebase File Evidence | Allowed Public Wording | Explicit Restrictions (Do NOT Claim) |
| :--- | :---: | :--- | :--- | :--- |
| **SMS Gateway Dispatch** | **`IMPLEMENTED, READY FOR PILOT`** | `backend/app/services/communication.py`<br>`backend/app/workers/outbox_worker.py` | "Integrated SMS alert architecture supporting Bangladesh telco/bulk-SMS gateways. Activated upon provisioning school gateway credentials." | Do NOT claim free unlimited international SMS. Must clarify that telco SMS credits are billed as usage add-ons. |
| **Online Payment Gateway (bKash/SSLCommerz)** | **`IMPLEMENTED, READY FOR PILOT`** | `backend/app/models/billing.py` (`BillingWebhookEvent`)<br>`backend/app/api/v1/endpoints/payments.py` | "Architecture supports automated online fee collection via bKash, Nagad, and SSLCommerz upon linking the school's commercial merchant account." | Do NOT claim that EducationOS acts as an unregulated money transmitter or handles merchant funds directly without school banking setup. |
| **Hardware Biometric Turnstile API** | **`INTEGRATION DEFERRED / ROADMAP`** | `backend/app/api/v1/endpoints/attendance.py` (API specs) | "Hardware-agnostic API ready to receive automated check-in events from supported RFID and biometric turnstiles." | Do NOT promise plug-and-play compatibility with uncertified proprietary biometric hardware without custom technical scoping. |
| **Computer Vision OMR Sheet Scanning** | **`INTEGRATION DEFERRED / ROADMAP`** | `backend/app/services/entitlement.py` (`omr_scanner` entitlement key) | "Advanced OMR bubble-sheet evaluation module scheduled for enterprise roadmap release." | Do NOT sell OMR scanner capabilities as currently live in standard pilot deployments. |

---

## 3. Mandatory Compliance Directives for Sales & Marketing

1. **No Phantom Case Studies:** Sales representatives may reference the *Kids Shine International School (KSIS)* pilot validation, but must never invent fictional customer quotes or embellish unverified statistics.
2. **Clear Demarcation of Hardware:** Marketing materials must clearly state that mobile PWA attendance runs on the school's existing teacher smartphones; EducationOS does not provide free physical smartphones or tablets.
3. **Currency & Tax Compliance:** All BDT pricing figures are net of statutory VAT/taxes where applicable under National Board of Revenue (NBR) regulations.

