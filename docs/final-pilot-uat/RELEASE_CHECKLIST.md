# RELEASE CHECKLIST
## Pre-Flight, Launch Day & Post-Launch Operational Execution Steps

**Document ID:** EOS-UAT-019  
**Pilot Target:** Kids Shine International School (KSIS)  
**Execution Phase:** Phase 1 Controlled Launch  
**Lead Coordinator:** Release Engineering Team

---

## 1. Pre-Flight Verification (T-48 to T-24 Hours)

- [x] **Git Repository Sanitized:** All scratch diffs, `.env` files, and test binary uploads removed from tracking.
- [x] **Secret Audit Verified:** Commit history clean; zero exposed production keys or tokens.
- [x] **All 5 Release Gates Passing:**
  - [x] `bash backend/scripts/check.sh` -> `ALL OK`
  - [x] `cd backend && pytest -q` -> `246 passed`
  - [x] `python backend/scripts/openapi_contract.py` -> `OK (no diff)`
  - [x] `bash scripts/check_hardcoded_tenant.sh` -> `OK: no hardcoded tenant branding`
  - [x] `cd frontend && npx tsc --noEmit` -> Clean 0 errors (Next.js build 57/57 passed)
- [x] **Tenant Identities Seeded:**
  - [x] KSIS School Admin: `admin@kidsshine.com`
  - [x] KSIS Teacher: `kaynat@kidsshine.com`
  - [x] KSIS Student: Talha Hussain (`KSIS-2027-001`)
  - [x] KSIS Guardian: Taki (`01673998729`)
- [x] **Database Baseline:** Alembic migration head at `f8a9b0c1d2e3`; 0 schema drift issues.

---

## 2. Launch Day Operations (T-0 Hours)

- [ ] **Database Snapshot Backup:** Trigger manual point-in-time snapshot of Supabase PostgreSQL database prior to live traffic.
- [ ] **DNS & SSL Verification:** Confirm Cloudflare edge SSL certificate validity for production domain.
- [ ] **Admin Account Verification:** Verify initial login for School Principal (`admin@kidsshine.com`) and confirm school profile details.
- [ ] **Staff Onboarding Walkthrough:** Conduct live orientation for teachers; verify attendance marking on mobile devices.
- [ ] **Guardian Invitation Dispatch:** Issue first batch of guardian onboarding SMS invitations via `/api/v1/auth/guardian/{id}/invite`.

---

## 3. Post-Launch Monitoring (T+24 to T+72 Hours)

- [ ] **Error Rate Monitoring:** Ensure HTTP 5xx error rate remains below 0.05% across all API requests.
- [ ] **Database Connection Pool Inspection:** Verify active connections to Supabase pooler remain < 30% of pool capacity.
- [ ] **RAG Indexing Monitoring:** Monitor background ingestion latency when teachers upload new curriculum notes or worksheets.
- [ ] **User Feedback Collection:** Log initial usability feedback from teachers and administrative staff for minor ergonomics tuning.
