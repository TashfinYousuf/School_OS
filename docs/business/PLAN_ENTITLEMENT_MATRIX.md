# EDUCATIONOS PLAN ENTITLEMENT MATRIX

**Document Version:** 2026.1-PROD  
**Status:** CANONICAL COMMERCIAL SPECIFICATION  
**Target Platform:** EducationOS SaaS  
**Timezone:** Asia/Dhaka  

---

## 1. Commercial Plan Tiers & Entitlements

The following matrix defines the exact features, operational capacities, and quotas provisioned for each subscription plan.

| Plan Key | Name | Monthly (BDT) | Max Students | AI Questions/mo | Included Feature Keys |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `free_trial` | 14-Day Free Trial | 0.00 | 50 | 30 | `attendance_ledger`, `student_directory`, `report_cards`, `ai_questions`, `offline_sync` |
| `school_starter` | School Starter | 990.00 | 100 | 100 | `attendance_ledger`, `student_directory`, `fee_receipts`, `report_cards`, `ai_questions`, `offline_sync` |
| `school_growth` | School Growth | 2,490.00 | 500 | 500 | `attendance_ledger`, `student_directory`, `fee_receipts`, `report_cards`, `whatsapp_alerts`, `nctb_grading`, `teacher_diary`, `ai_questions`, `offline_sync` |
| `school_pro` | School Professional | 5,990.00 | 1,500 | 2,000 | `attendance_ledger`, `student_directory`, `fee_receipts`, `report_cards`, `whatsapp_alerts`, `nctb_grading`, `teacher_diary`, `omr_scanner`, `multi_branch`, `audit_ledger`, `biometric_api`, `ai_questions`, `offline_sync` |
| `academy_starter` | Academy Starter | 1,490.00 | 150 | 200 | `student_directory`, `batch_management`, `mcq_exams`, `negative_marking`, `merit_rankings`, `ai_questions`, `offline_sync` |
| `academy_growth` | Academy Growth | 3,990.00 | 600 | 1,000 | `student_directory`, `batch_management`, `mcq_exams`, `negative_marking`, `merit_rankings`, `live_exams`, `socratic_ai`, `solution_sheets`, `due_alerts`, `ai_questions`, `offline_sync` |
| `academy_pro` | Academy Professional | 7,990.00 | 2,000 | 3,000 | `student_directory`, `batch_management`, `mcq_exams`, `negative_marking`, `merit_rankings`, `live_exams`, `socratic_ai`, `solution_sheets`, `due_alerts`, `central_question_bank`, `performance_heatmap`, `ai_questions`, `offline_sync` |
| `unified_starter` | Unified Campus Starter | 2,990.00 | 300 | 500 | Dual workspace (School + Academy), `attendance_ledger`, `student_directory`, `fee_receipts`, `batch_management`, `mcq_exams`, `ai_questions`, `offline_sync` |
| `unified_growth` | Unified Campus Growth | 5,990.00 | 1,000 | 1,500 | Dual workspace, `attendance_ledger`, `student_directory`, `fee_receipts`, `report_cards`, `whatsapp_alerts`, `nctb_grading`, `batch_management`, `mcq_exams`, `live_exams`, `ai_questions`, `offline_sync` |
| `unified_pro` | Unified Campus Pro | 9,990.00 | 2,500 | 5,000 | All features from School Pro & Academy Pro, Dual workspaces, Multi-branch, Dedicated OMR pipeline, Audit ledger, Biometric API |

---

## 2. Dynamic Modular Pricing Model (Alternative to Bundles)

For institutions requiring bespoke configurations rather than standardized packages, the dynamic pricing engine calculates monthly billing as:

$$\text{Gross Monthly Fee} = \text{Base Infrastructure Fee} + \text{Tiered Student Charge} + \sum \text{Optional Modules} + \sum \text{Add-ons}$$

### 2.1 Base Infrastructure Fee
- **1,500.00 BDT / month** (covers isolated database tenant namespace, backup retention, security monitoring, and core administrative modules).

### 2.2 Tiered Student Volume Rates
- **Tier 1 (1 – 300 students):** 12.00 BDT / student / month
- **Tier 2 (301 – 800 students):** 10.00 BDT / student / month
- **Tier 3 (801+ students):** 8.00 BDT / student / month

### 2.3 Annual Prepayment Incentive
- **15% discount** applied to the 12-month gross total for upfront annual commitments (equivalent to approximately 1.8 months free of charge).

---

## 3. Enforcement Architecture

1. **API Layer (`require_entitlement`):**
   - Routes check whether the requesting tenant holds the required entitlement key before entering business logic.
   - Unauthorized attempts return HTTP 403 Forbidden with `{ "error": "FEATURE_NOT_ENTITLED", "feature": "<feature_key>" }`.
2. **Quota Layer (`check_and_consume_quota`):**
   - High-cost operations (AI question generation, student admissions) query the tenant's current usage vs plan quota with PostgreSQL row locking (`with_for_update`).
   - If exceeded, returns HTTP 403 Forbidden with exact usage details and upgrade prompts.
3. **Frontend UI Layer (`PermissionGate` / `useEntitlement`):**
   - Sidebar navigation and action buttons dynamically render badges or upgrade prompts based on the tenant's entitled feature set, preventing dead clicks and user frustration.

