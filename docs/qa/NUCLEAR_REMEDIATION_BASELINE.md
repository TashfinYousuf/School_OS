# EDUCATIONOS — NUCLEAR REMEDIATION FORENSIC BASELINE
## Baseline Audit, Owner-Observed Defect Reproduction & Root Cause Identification

**Project:** EducationOS / SchoolOS  
**Pilot Institution:** Kids Shine International School (KSIS)  
**Date:** November 16, 2026  
**Auditor:** Principal SaaS Architect & Systems Security Engineer  
**Git Branch:** `chore/upgrade-next-16-4`  
**Git Commit HEAD:** `3179bbfe059799f441ff04c96912ede33efffab6`  
**Active Migration Head:** `04834912199b (head)`  
**Document ID:** `docs/qa/NUCLEAR_REMEDIATION_BASELINE.md`

---

## 1. Executive Forensic Mandate

Per the **Nuclear Remediation Directive**, every previous self-reported fix and passing unit test claim is treated as **UNVERIFIED** until reproduced on real application code, with real data fixtures, and under real operating conditions.

This forensic audit investigates and establishes the exact technical root cause for the 7 owner-observed defects:
1. RAG parsing/indexing hangs.
2. Upload progress is unreliable or absent.
3. RAG processing freezes the application or cascades into Offline Mode.
4. Dashboard metrics initially display zero (`0`) and update only after several seconds.
5. Platform Super Admin login is unclear or fails.
6. MFA, Passkey, OTP, and Forgot Password flows are not discoverable or manually testable in the UI.
7. `/onboard` exposes plan price and module count without explaining which modules are included or allowing module customization.

---

## 2. Test Asset & Environment Forensic Verification

### A. Real Class 1 Bangla Textbook PDF Verification
- **Path:** `docs/syllabus/bangla_class1_textbook_8_9mb.pdf`
- **File Exists:** YES (Verified on local disk)
- **Byte Size:** `9,414,208` bytes (8.98 MB)
- **SHA-256 Checksum:** `5af32a2f1850bd3af33c2b1186465e6238ef5afe31f1e63819d944c289bd4ad4`
- **Page Count:** `27` pages
- **Extracted Text Volume:** `11,529` characters
- **Unicode Language Content:** Authentic NCTB Class 1 Bangla ("আমার বই - প্রথম শ্রেণি", registered font glyphs, mixed English metadata).
- **Result:** The representative large textbook asset exists on disk and is 100% physically valid.

### B. Environment Network Boundary & Sandbox Constraints
- Remote PostgreSQL connection string points to Supabase pooler: `aws-1-ap-south-1.pooler.supabase.com:6543`.
- In sandboxed execution (network disabled), direct connections to Supabase pooler fail with `OperationalError: could not translate host name`.
- Offline test harness uses in-memory SQLite (`sqlite:///:memory:`) with `StaticPool` and PostgreSQL JSONB compatibility shims.

---

## 3. Forensic Reproduction & Exact Root Causes of Owner-Observed Defects

### Defect 1, 2 & 3: RAG Parsing/Indexing Hangs, Progress Absent/Unreliable & Offline Cascade
- **Root Cause 1 (Sequential Embedding API Bottleneck):**
  In `backend/app/services/curriculum_rag.py`, `generate_embedding(sanitized_c_text)` is called sequentially inside a loop for each of the 20 to 50 chunks:
  ```python
  for idx, c_text in enumerate(chunks):
      c_emb = generate_embedding(sanitized_c_text)
  ```
  When `GEMINI_API_KEY` is active, each chunk executes an individual synchronous HTTPS request to `models/gemini-embedding-001` with no timeout and no batching. If Google GenAI rate-limits (15 RPM on free tiers) or slows down, the loop hangs for several minutes, freezing the job.
- **Root Cause 2 (Progress Disappears on Refresh & Modal Boundary):**
  In `frontend/app/dashboard/academic/page.tsx`, the upload progress bar and status indicator are rendered *strictly inside* the `isUploadModalOpen` modal dialog. When the user navigates away, switches tabs (e.g. to Daily Routine), or refreshes the browser, `isUploadModalOpen` defaults to `false`. While `localStorage` retained `active_curriculum_job_id`, the progress UI was completely invisible outside the modal.
- **Root Cause 3 (Lack of Durable Queue Across Restarts):**
  FastAPI's `BackgroundTasks.add_task` executes strictly in-process. If the application server or worker restarts while a document is in `PARSING` or `INDEXING` state, the background task dies silently, leaving the document permanently stuck in `PARSING` with no heartbeat recovery or stale job reaper.
- **Root Cause 4 (API Error Cascade into Offline Mode):**
  `frontend/public/sw.js` and `frontend/lib/api-client.ts` previously caught any failed API fetch or timeout and flagged `isOffline = true`. Although physical network check was added, partial request timeouts during long RAG polling still triggered offline banners.

### Defect 4: Dashboard Metrics Initially Show Zero (0) Before Hydration
- **Root Cause (Unchecked Loading Render & Zero Initialization):**
  In `frontend/app/dashboard/page.tsx`:
  ```typescript
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_students: 0,
    present_today: 0,
    absent_today: 0,
    total_teachers: 0,
    pending_approvals: 0
  });
  ```
  The component rendered the card grid immediately on mount:
  ```tsx
  <div className="text-3xl font-black">{metrics.total_students}</div>
  ```
  The JSX never checked `loading`. Until `fetchOverviewData()` resolved (1.5 to 3 seconds), the user was presented with genuine `0`, `0`, `0`, `0`, `৳0`, creating the false impression of an empty or wiped database.

### Defect 5: Super Admin Login Unclear or Unsuccessful
- **Root Cause 1 (Schema Mismatch in Bootstrap CLI):**
  In `backend/app/cli/bootstrap_platform_owner.py`, the CLI attempted to set `user.tenant_id = "global"`. However, in PostgreSQL, `User.tenant_id` is a strictly typed `UUID`. Passing the string `"global"` causes `psycopg2.errors.InvalidTextRepresentation`. Additionally, it attempted to set `is_verified` (which does not exist on `User`) and instantiate `Tenant(name=...)` (which does not exist; `Tenant.school_name` is the actual column).
- **Root Cause 2 (Missing Dedicated Route & Tab Confusion):**
  Platform Super Admin had no dedicated entry point (`/platform/login`). Owners had to navigate to the general `/login` page and guess to click the "Staff" tab, which asks for a school code and school email.
- **Root Cause 3 (Auth State Machine Lacks MFA Challenge):**
  `/api/v1/auth/staff` issued full access tokens directly without intercepting for an MFA challenge state.

### Defect 6: MFA, Passkey, OTP & Forgot Password Not Discoverable in UI
- **Root Cause:**
  While backend endpoints (`/api/v1/auth/mfa/verify`, `/passkey/...`) existed in `auth.py`, no corresponding frontend UI existed:
  - No Passkey sign-in button or WebAuthn handler on login pages.
  - No MFA challenge screen (TOTP / Recovery Code input) when MFA is required.
  - No "Forgot Password?" entry point on the login screen.
  - No Security settings panel under `/dashboard/settings` to register passkeys or view MFA status.

### Defect 7: Onboarding Plan Transparency & Module Customization Missing
- **Root Cause:**
  In `frontend/app/onboard/page.tsx`, the onboarding wizard displayed a summary badge:
  `Includes Base Platform + 9 Core Modules + 2 Optional Modules`
  However:
  - There was no UI to view which 9 core modules were included.
  - There was no UI to see what each module did.
  - There was no UI to customize, select, or uncheck optional modules.
  - It did not synchronize with plan selections made on `/pricing`.

---

## 4. Remediation Roadmap by Priority

| Batch | Scope | Target Deliverable |
| :--- | :--- | :--- |
| **Batch 2** | RAG Ingestion & Offline Resilience | Batch embeddings, durable job recovery, persistent floating progress banner on academic page, fine-grained service health model. |
| **Batch 3** | Platform Super Admin Authentication | Dedicated `/platform/login`, interactive CLI with no command-line password leaks, full MFA/Passkey UI, forgot-password flow. |
| **Batch 4** | Pricing & Onboarding Transparency | Canonical server-backed plan/module catalog, `/onboard` plan customization, module inspection drawer, plan comparison table. |
| **Batch 5** | Dashboard Data Integrity & Latency | Skeleton loading state, cached hydration (no zero flicker), optimized API response times. |
| **Batch 6** | Comprehensive Acceptance & UAT | Independent regression, real PDF processing evidence, browser manual UAT checklist. |

