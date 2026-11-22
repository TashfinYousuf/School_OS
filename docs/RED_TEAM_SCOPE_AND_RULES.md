# EducationOS — Red-Team Assessment Scope & Rules of Engagement
**Document ID:** `docs/RED_TEAM_SCOPE_AND_RULES.md`  
**Generated:** 2026-11-09  
**Execution Standard:** Section H1 (Phase 6) Master Engineering Directive  
**Status:** **AUTHORITATIVE RULES OF ENGAGEMENT**  

---

## 1. Authorization Boundary & Target Scope

This security evaluation is authorized strictly within dedicated staging test tenants and local development sandboxes. Testing against third-party production systems or external payment providers is strictly prohibited.

### In-Scope Assets
- **Web Application & Dashboards:** `http://localhost:3000` (Next.js 16/14).
- **Backend API Gateway:** `http://localhost:8000/api/v1` (FastAPI).
- **Authentication Routes:** `/api/v1/auth/*` (Login, Token Refresh, Password Reset, Onboarding).
- **Multi-Tenant Boundary:** Isolation between isolated test tenants (`tid_alpha` vs `tid_beta`).
- **Domain Subsystems:** Students, Attendance, Examinations, Finance, AI Gateway, Workspaces.

### Out-of-Scope Assets
- Live Production Supabase PostgreSQL cluster (`aws-1-ap-south-1.pooler.supabase.com`).
- Live Payment Gateways (bKash, Nagad, SSLCommerz production endpoints).
- Uncontrolled Denial-of-Service (DoS) and volumetric network flooding.
- Mass destructive data deletion against unbacked test environments.

---

## 2. Test Accounts & Personas

| Account Identifier | Role | Tenant ID | Purpose |
| :--- | :--- | :--- | :--- |
| `principal_alpha@school.com` | `admin` | `tid_alpha` | Tenant Alpha Administrator |
| `teacher_alpha@school.com` | `teacher` | `tid_alpha` | Tenant Alpha Classroom Teacher |
| `student_alpha@school.com` | `student` | `tid_alpha` | Tenant Alpha Enrolled Pupil |
| `guardian_alpha@school.com` | `guardian` | `tid_alpha` | Tenant Alpha Linked Parent |
| `admin_beta@school.com` | `admin` | `tid_beta` | Tenant Beta Administrator (Cross-Tenant Target) |
| `student_beta@school.com` | `student` | `tid_beta` | Tenant Beta Enrolled Pupil (Cross-Tenant Target) |

---

## 3. Rules of Engagement & Code of Conduct

1. **Evidence-Driven Verification:** Every security finding must have reproducible proof-of-concept steps, affected endpoints, and verified root causes.
2. **Defensive Disclosure & Patching:** High and Critical vulnerabilities must be remediated immediately and re-tested before release authorization.
3. **Preservation of Audit Trails:** All testing actions must emit standard application audit logs to evaluate log monitoring efficacy.

