# EducationOS — Kids Shine International School Pilot Activation Runbook
# কিডস শাইন ইন্টারন্যাশনাল স্কুল পাইলট অ্যাক্টিভেশন রানবুক

**Target Institution:** Kids Shine International School (KSIS)  
**Academic Year:** 2026  
**Status:** Pilot Deployment Execution Checklist

---

## 1. Executive Summary & Activation Objectives
This runbook guides technical operators and institutional leads through the activation of EducationOS for Kids Shine International School. The objective is to transition from staging/sandbox verification to a live, controlled pilot across pre-selected test cohorts.

---

## 2. Phase 1: Pre-Flight Technical Verification
Before inviting institutional users, execute the following verification steps:

- [ ] **1. API Server Health:**
  ```bash
  curl -s http://localhost:8000/api/v1/health | grep '"status":"ok"'
  ```
- [ ] **2. Static Assets & PWA Service Worker:**
  - Verify `http://localhost:3000/sw.js` loads with MIME type `application/javascript`.
  - Confirm offline navigation decoupling (network interruptions do not trap active users in offline mode).
- [ ] **3. Quality Acceptance Gates:**
  - `bash backend/scripts/check.sh` returns `ALL OK`.
  - `python backend/scripts/openapi_contract.py` returns `OK (no diff)`.
  - `bash scripts/check_hardcoded_tenant.sh` returns `0 hardcoded tenant references`.
- [ ] **4. Telecommunication Readiness:**
  - `GET /api/v1/communication/providers/status` reports active gateway or honest `NOT_CONFIGURED` fallback.

---

## 3. Phase 2: Pilot Personas & Seed Credentials

The following pilot personas must be active and tested in the tenant:

| Role | Email / Identifier | Purpose in Pilot |
| :--- | :--- | :--- |
| **Super Admin** | `owner@educationos.internal` | Platform governance, SLA telemetry, tenant oversight |
| **School Admin** | `admin@kidsshine.edu.bd` | Institutional setup, teacher rosters, fee schedules |
| **Teacher** | `teacher.bangla@kidsshine.edu.bd` | Daily roll-call, lesson diary, Bangla textbook RAG queries |
| **Guardian** | `guardian.karim@kidsshine.edu.bd` | Multi-child portal, attendance alerts, fee invoice review |
| **Student** | `student.karim.cl1@kidsshine.edu.bd` | Socratic doubt-solver, daily class routine, diary viewing |

---

## 4. Phase 3: Curriculum & RAG Verification
- [ ] Ingest Class 1 Bangla Textbook PDF (`docs/syllabus/bangla_class1_textbook_8_9mb.pdf`) using asynchronous ingestion:
  ```bash
  POST /api/v1/ai/curriculum/upload (async_mode=true)
  ```
- [ ] Confirm background job completes and stage reaches `completed` (100%).
- [ ] Query RAG system with authentic Bangla curriculum questions (`POST /api/v1/ai/curriculum/query`).
- [ ] Confirm source citations accurately cite the NCTB textbook.

---

## 5. Phase 4: Operational Day-0 Checklist

- [ ] **Step 1: Admin Workspace Switcher**
  Log into `/login` with School Admin credentials. Verify Kids Shine workspace is selected and dashboard statistics load.
- [ ] **Step 2: Classroom Roll Call**
  Log into Teacher portal. Select Class 1 (Bangla). Mark roll call (20 present, 2 absent). Submit attendance.
- [ ] **Step 3: Lesson Diary Recording**
  Record today's lesson entry: "পাঠ ১: আমাদের দেশ — কবিতা আবৃত্তি ও শব্দের অর্থ আলোচনা". Confirm visible on student portal.
- [ ] **Step 4: Fee Collection & Receipt Generation**
  In Admin portal, collect monthly tuition for student. Generate and print two-copy institutional receipt.
- [ ] **Step 5: Student AI Learning Studio**
  Log into Student portal. Ask AI Tutor about a lesson question. Verify Socratic pedagogy (hints provided without revealing direct homework answers).

---

## 6. Phase 5: Escalation & Rollback Plan

### Incident Levels:
- **P0 (Blocker):** Platform down, database connection pool failure, or data leak across tenants.
  - *Action:* Immediately revert to previous deployment tag, notify institution headmaster, activate offline attendance ledger.
- **P1 (Major):** SMS gateway failure, PDF parsing delay.
  - *Action:* Fall back to registered email or physical activation slips; async queue absorbs background document jobs.
- **P2 (Minor):** Non-blocking UI glitch, formatting inconsistency.
  - *Action:* Log in issue tracker, schedule hotfix in next maintenance window.

