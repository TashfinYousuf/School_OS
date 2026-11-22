# EducationOS — Pricing & Entitlement Matrix
**Document ID:** `docs/PRICING_AND_ENTITLEMENT_MATRIX.md`  
**Generated:** 2026-11-11  
**Scope:** Formal Mapping of Pricing Tiers, Modules, and Feature Entitlement Flags  

---

## 1. Entitlement Architecture & Governance

In EducationOS, subscription status governs the tenant's global write capabilities, while **Module Entitlements** govern access to advanced functional subsystems (such as AI Question Drafting, Custom Websites, or Financial Ledger Exports).

Entitlements are stored in the database table `tenant_entitlements` and evaluated in both:
1. **Backend API Gateways:** Dependency `require_entitlement(feature_key)` returns HTTP 403 Forbidden if the calling tenant lacks the active module.
2. **Frontend UI Components:** `<PermissionGate entitlement="feature_key">` renders fallback upgrade messaging or hides premium controls.

---

## 2. Comprehensive Entitlement Mapping Matrix

| Feature / Capability | Module Category | Entitlement Key | Core (Default) | Paid Module ID | Functional Invariant |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Student 360 Digital Twin** | Academic | `students_360` | **YES** | `core_students` | Viewing grades, attendance, and biographical history. |
| **1-Tap Attendance Roll Call** | Operations | `attendance_core` | **YES** | `core_attendance` | Daily attendance capture, PWA IndexedDB queue sync. |
| **Attendance CSV & Print Report**| Operations | `attendance_export`| **YES** | `core_attendance` | Authenticated binary CSV Blob download and A4 printouts. |
| **Examination Grading Registry**| Academic | `exams_grading` | **YES** | `core_exams` | Term exam marks, GPA calculation, PDF report card. |
| **Guardian Mobile Portal** | Community | `guardian_portal` | **YES** | `core_guardians` | Multi-child mobile view, attendance notices. |
| **Notice Composer** | Communication| `notices_broadcast`| **YES** | `core_notices` | Campus announcements, notice board attachments. |
| **Basic Operational Reports** | Management | `reports_standard` | **YES** | `core_reports` | Class attendance summaries, chronic absence flags. |
| **AI Question Paper Generator** | Intelligence | `ai_copilot` | **NO** | `module_ai_assistant` | Gemini API exam question drafting, syllabus chunk RAG. |
| **Teacher Voice Diary Copilot** | Intelligence | `ai_voice_diary` | **NO** | `module_ai_assistant` | Speech-to-text lesson planning and diary entry. |
| **Dual-Copy Fee Receipts** | Finance | `finance_receipts` | **NO** | `module_advanced_finance`| School Copy + Student Copy printable fee receipts. |
| **Financial Ledger Reconciliation**| Finance | `finance_ledger` | **NO** | `module_advanced_finance`| Cash, bKash, and bank transaction ledger reconciliation.|
| **Hosted School Public Website** | Public Web | `school_website` | **NO** | `module_school_website` | Institutional public website CMS, notices, gallery. |
| **Custom Domain (`school.edu.bd`)**| Domain | `custom_domain` | **NO** | `module_custom_domain` | Wildcard TLS certificate and custom DNS mapping. |
| **WhatsApp Absence Alerts** | Communication| `whatsapp_alerts` | **NO** | `module_whatsapp_alerts`| Automated WhatsApp notifications sent to guardians. |

---

## 3. Entitlement Lifecycle & Enforcement

```
[ Active Subscription ] ──► Evaluate `tenant_entitlements`
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
[ Entitlement Active ]                           [ Entitlement Missing ]
  • HTTP 200 / Full Access                         • Backend: HTTP 403 Forbidden
  • Premium Features Unlocked                      • Frontend: Shows Module Upgrade Card
```

### 3.1 Backend Enforcement Example
```python
@router.post("/generate-questions", dependencies=[Depends(require_entitlement("ai_copilot"))])
def generate_questions(payload: QuestionGenerationRequest):
    return ai_gateway.generate(payload)
```

### 3.2 Frontend Conditional Rendering Example
```tsx
<PermissionGate entitlement="finance_receipts" fallback={<UpgradeNotice module="Advanced Finance" />}>
  <PrintableReceiptButton paymentId={payment.id} />
</PermissionGate>
```

