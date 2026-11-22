# EducationOS — Owner Manual UAT Verification Checklist
## Step-by-Step Production Acceptance Scripts for Kids Shine International School Pilot

**Classification:** Acceptance Verification  
**Author:** QA Lead & Principal Architect  
**Target:** Localhost Staging Environment (`http://localhost:3000` / `http://localhost:8000`)  
**Document Reference:** `docs/qa/OWNER_MANUAL_UAT_CHECKLIST.md`  

---

## Pre-Requisites & Environment Preparation

Before beginning manual UAT:
1. Backend running:
   ```bash
   cd /Users/tashfinyousuf/Python/SCHOOL_OS
   PYTHONPATH=backend ./venv/bin/uvicorn app.main:app --port 8000 --reload
   ```
2. Frontend running:
   ```bash
   cd /Users/tashfinyousuf/Python/SCHOOL_OS/frontend
   npm run dev
   ```
3. Test PDF fixture verified: `docs/syllabus/bangla_class1_textbook_8_9mb.pdf` (8.97 MB).

---

## Workflow 1: Real Bangla Textbook RAG Ingestion & Semantic Retrieval

**Objective:** Verify that the 8.95 MB NCTB Class 1 Bangla textbook uploads asynchronously, embeds in batches without hanging, displays persistent UI progress across page reloads, and answers semantic Bangla queries.

### Test Steps:
1. Open Chrome and navigate to `http://localhost:3000/login`.
2. Sign in as Staff:
   - **Email:** `admin@school.com` (or provisioned teacher account)
   - **Password:** `TestPass123!`
3. Navigate to **Academic Management** (`/dashboard/academic`).
4. Click on the **Curriculum & Knowledge Base** tab.
5. Click **"Upload Curriculum PDF"**.
6. Select `docs/syllabus/bangla_class1_textbook_8_9mb.pdf` and click **"Begin Ingestion"**.
7. **Verify Upload & Immediate Response:**
   - [ ] The upload modal closes or transitions within 1 second.
   - [ ] A persistent **Active Ingestion Banner** appears across the top of the Academic page showing:
     - Document: `bangla_class1_textbook_8_9mb.pdf`
     - Stage: `EMBEDDING (Chunks X of 23)`
     - Progress Bar: monotonically increasing from 0% to 100%.
8. **Verify Page Refresh Resilience:**
   - [ ] Press `Cmd + R` (reload page) while progress is at ~40%.
   - [ ] Confirm the persistent banner immediately restores and continues updating without opening any modal dialog.
   - [ ] Confirm the page does NOT redirect to `/offline`.
9. **Verify Semantic Search Retrieval:**
   - [ ] Once status reaches `COMPLETED (100%)`, navigate to the **Lesson Plan AI Studio**.
   - [ ] Enter query: `আমার পণ কবিতা প্রথম শ্রেণি মদনমোহন তর্কালঙ্কার`.
   - [ ] Confirm the AI returns chunk citation with Page 6 text: *"সকালে উঠিয়া আমি মনে মনে বলি..."*.
   - [ ] Enter query: `ইতল বিতল গাছের পাতা`.
   - [ ] Confirm citation returns Page 11 with poem text: *"ইতল বিতল গাছের পাতা, গাছের তলায় ব্যাঙের ছাতা..."*.

**Acceptance Result:** `[ ] PASS   [ ] FAIL`

---

## Workflow 2: Platform Super Admin Bootstrap & Dedicated Login Portal

**Objective:** Verify that the platform owner can be securely provisioned without command-line password leakage, log in via `/platform/login`, and satisfy the step-up TOTP MFA challenge.

### Test Steps:
1. Open Terminal and run the bootstrap CLI without passing `--password`:
   ```bash
   PYTHONPATH=backend ./venv/bin/python backend/app/cli/bootstrap_platform_owner.py \
     --email "owner@educationos.internal" \
     --rotate-credentials
   ```
2. Enter password interactively at the hidden prompts:
   - **Password:** `PlatformMaster2026!`
   - **Confirm:** `PlatformMaster2026!`
3. **Verify Output:**
   - [ ] The CLI outputs without SQL UUID errors.
   - [ ] A 160-bit Base32 secret key (e.g. `JBSWY3DPEHPK3PXP`) and otpauth URI are displayed.
   - [ ] Exactly 10 single-use recovery codes (`XXXX-XXXX-XXXX`) are printed.
4. Copy the Base32 secret into an authenticator app (Google Authenticator, 1Password) or note it for generating tokens.
5. In your browser, navigate to: `http://localhost:3000/platform/login`.
6. Enter credentials:
   - **Email:** `owner@educationos.internal`
   - **Password:** `PlatformMaster2026!`
   - Click **"Authenticate Platform Session"**.
7. **Verify MFA Step-Up Challenge:**
   - [ ] The form transitions to the **Two-Factor Challenge** screen.
   - [ ] Enter the 6-digit code from your authenticator app.
   - [ ] Click **"Verify Code & Access Platform"**.
   - [ ] Confirm you are redirected immediately to `/dashboard/platform`.
8. **Verify Emergency Recovery Code:**
   - [ ] Open an incognito window and go to `/platform/login`.
   - [ ] Enter email and password.
   - [ ] At the 2FA screen, click **"Lost access to authenticator? Use an emergency recovery code"**.
   - [ ] Enter Code #1 from your bootstrap output (e.g. `A1B2-C3D4-E5F6`).
   - [ ] Confirm login succeeds and redirects to `/dashboard/platform`.
   - [ ] Try using Code #1 a second time; confirm it is rejected as expired/used.

**Acceptance Result:** `[ ] PASS   [ ] FAIL`

---

## Workflow 3: Onboarding Module Transparency & Pre-Packaged Plans

**Objective:** Verify that `/onboard` eliminates the black-box summary, allows full inspection of all 9 Core Modules, enables customizable optional module toggles, and recalculates pricing transparently.

### Test Steps:
1. Navigate to `http://localhost:3000/onboard`.
2. Locate the **Commercial Configuration & Quotas** section.
3. **Inspect Core Modules:**
   - [ ] Click **"Included Core Platform Modules (9 Core Operations)"**.
   - [ ] Confirm all 9 modules appear with description and "FREE" badge.
   - [ ] Click **"Inspect details"** on *Examinations & Grading Registry*.
   - [ ] Confirm the Module Details Modal opens with capabilities and SLAs.
   - [ ] Close the modal.
4. **Customize Optional Modules:**
   - [ ] Observe the initial quote.
   - [ ] Check **"Hosted Institutional Public Website (+৳1,000/mo)"**.
   - [ ] Confirm the estimated billing summary immediately increases by ৳1,000.
   - [ ] Toggle **"Annual"** billing cycle.
   - [ ] Confirm the "Save 15%" discount is applied to the gross sum.
5. **Compare Pre-Packaged Plans:**
   - [ ] Click **"Compare Pre-Packaged Plans"**.
   - [ ] Confirm Starter (৳990), Growth (৳2,490), and Pro (৳5,990) are displayed.
   - [ ] Click **"Select School Growth"**.
   - [ ] Confirm the capacity slider automatically adjusts to 500 students and relevant modules are activated.
6. **Register Institution:**
   - [ ] Fill in School Name: `UAT Model School`.
   - [ ] Admin Email: `uat.principal@uatmodel.edu.bd`.
   - [ ] Admin Password: `UatMasterPassword2026!`.
   - [ ] Click **"Complete Registration & Launch Workspace"**.
   - [ ] Confirm successful provisioning with dedicated campus code.

**Acceptance Result:** `[ ] PASS   [ ] FAIL`

---

## Workflow 4: Dashboard Data Loading & Latency Optimization

**Objective:** Verify that `/dashboard` no longer flashes `0` on metric cards and renders skeletons smoothly during initial data loading.

### Test Steps:
1. Log in as an administrator and go to `http://localhost:3000/dashboard`.
2. Perform a hard refresh (`Cmd + Shift + R`).
3. **Verify Zero-Metric Elimination:**
   - [ ] Confirm that cards (`Total Students`, `Present Today`, `Absent`, `Active Faculty`, `Action Center`) do NOT flash `0`.
   - [ ] Confirm they either render instantly from session cache or display animated skeleton pulses (`animate-pulse`) while calculating.
   - [ ] Confirm that when the server returns authentic data, numbers transition smoothly.
   - [ ] Confirm that if a metric is genuinely 0 (e.g. 0 pending approvals), it renders as a crisp solid number rather than looking like a stalled loading state.

**Acceptance Result:** `[ ] PASS   [ ] FAIL`
