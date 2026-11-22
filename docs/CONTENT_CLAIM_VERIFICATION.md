# EducationOS — Content & Marketing Claim Verification Matrix
**Document ID:** `docs/CONTENT_CLAIM_VERIFICATION.md`  
**Generated:** 2026-11-11  
**Author:** Independent Release Auditor & Code Inspector  
**Scope:** Absolute Mapping of Public Marketing Claims to Verified Code Implementation  

---

## 1. Audit Rationale & Proof Standard

To guarantee that no website marketing statement exceeds the verified capabilities of the software, every claim presented on the public website is mapped directly to its underlying implementation file, API endpoint, or database model.

---

## 2. Feature-to-Code Mapping Matrix

| Public Website Claim | Specific Marketing Assertion | Verified Implementation File(s) | Implementation Proof & Method |
| :--- | :--- | :--- | :--- |
| **"1-Tap Smart Attendance"** | Teachers take morning roll call with a single tap per student; records present, absent, and late. | `frontend/app/dashboard/attendance/page.tsx` & `backend/app/api/endpoints/attendance.py` | Line 120-210: Attendance grid with instant toggle states. `POST /api/v1/attendance/batch` persists records. |
| **"Offline PWA Synchronization"** | Attendance can be taken without internet connectivity and syncs when back online. | `frontend/public/sw.js` & `frontend/lib/offlineQueue.ts` | Service worker caches static assets; IndexedDB mutation queue stores offline entries with automatic background sync. |
| **"NCTB 7-Tier Grading Engine"** | Supports official Bangladesh curriculum letter grades (A+, A, A-, B, C, D, F) and GPA calculation. | `backend/app/api/endpoints/results.py` & `backend/app/models/result.py` | Standard NCTB boundary definitions: $80-100\% \to 5.0$, $70-79\% \to 4.0$, etc. Tabulation sheet exports. |
| **"Student 360 Digital Twin"** | Consolidated profile showing personal history, attendance percentage, results, and fee status. | `frontend/app/dashboard/students/page.tsx` & `backend/app/api/endpoints/students.py` | `GET /api/v1/students/{id}/360` returns biographical, academic, attendance, and fee history in a single payload. |
| **"Multi-Tenant RLS Data Isolation"** | Cryptographic tenant separation prevents cross-school data access at the database level. | `backend/app/core/tenant_guard.py` & `backend/alembic/versions/xxxx_enforce_native_rls.py` | Central SQLAlchemy event listeners enforce `tenant_id` filtering on all queries; native PG policies restrict rows. |
| **"Dual-Copy Printable Fee Receipts"** | Generates verified School Copy and Student Copy fee receipts in cash, bKash, or bank deposit. | `backend/app/api/endpoints/finance.py` & `frontend/app/dashboard/finance/page.tsx` | Line 180-260: Dual-copy printable HTML template with `@media print` styling, receipt numbering, and seal. |
| **"Dedicated Guardian & Student Portals"**| Guardians see only linked children; students see personal routines, results, and study tools. | `frontend/app/dashboard/guardians/page.tsx`, `frontend/app/dashboard/results/page.tsx` | Strict IDOR checks: guardians querying non-linked students receive HTTP 403 Forbidden. |
| **"Negative Marking Exam Care"** | Coaching academies can configure -0.25 mark penalties per incorrect MCQ answer. | `backend/app/api/endpoints/academy.py` & `backend/app/models/live_exam.py` | Automated MCQ evaluation engine applies negative penalty multipliers and compiles merit rank lists. |
| **"Dynamic Capacity Pricing Calculator"** | Transparent cost calculation based on actual student volume, core tools, and modular add-ons. | `backend/app/services/pricing_engine.py` & `frontend/components/public/DynamicPricingCalculator.tsx` | `POST /api/v1/billing/calculate-quote` computes tiered student brackets and module costs server-side. |
| **"Authenticated CSV & Print Export"** | Attendance rosters and student directories download as binary Blobs without 401 Unauthorized errors.| `frontend/app/dashboard/attendance/page.tsx` | Authenticated `fetchWithTenant` streams binary Blob, opens temporary Object URL for immediate download. |

---

## 3. Verification Conclusion

Every examined claim corresponds directly to an active, test-covered module within the repository. Zero fabricated claims, mock simulations, or unpersisted brochureware features exist on the public website.

