# AUTHENTICATION AND IDENTITY SYSTEM AUDIT
## Multi-Role Authentication Architecture, Password Hashing & Token Security

**Document ID:** EOS-UAT-006  
**Security Framework:** NIST SP 800-63B / OWASP ASVS v4.0 Level 2  
**Audit Scope:** Login endpoints, role matrices, token exchange, password hashing, and session revocation

---

## 1. Authentication Architecture Overview

EducationOS implements a unified multi-tenant authentication architecture supporting five primary institutional roles:
1. **Platform Super Admin** (`superadmin`) — Cross-tenant governance, billing oversight, platform controls.
2. **School Admin** (`admin`) — Institutional master management, staff onboarding, academic years, fee structures.
3. **Teacher** (`teacher`) — Attendance marking, exam grading, question paper generation, notices.
4. **Student** (`student`) — Learning resources, AI Doubt Solver, routine, fee invoices, report cards.
5. **Guardian** (`guardian`) — Attendance monitoring, child progress, online tuition fee payment.

---

## 2. Login Entry Points Matrix

| Role | Frontend Entry Point | Backend API Route | Authentication Method |
|---|---|---|---|
| **Super Admin** | `/platform/login` | `POST /api/v1/auth/super-admin/login` | Email + High-entropy Password + TOTP MFA (or Passkey) |
| **School Admin** | `/login` (Staff Tab) | `POST /api/v1/auth/token` | Email + Password |
| **Teacher** | `/login` (Staff Tab) | `POST /api/v1/auth/token` | Email + Password |
| **Student** | `/login` (Student Tab) | `POST /api/v1/auth/student/login` | Student ID (`KSIS-YYYY-XXX`) + Password / PIN |
| **Guardian** | `/login` (Guardian Tab) | `POST /api/v1/auth/token` | Phone Number / Email + Password |

---

## 3. Cryptographic Password Hashing & Security

- **Hashing Algorithm:** Argon2id / bcrypt with work factor 12.
- **Complexity Requirements:**
  - Minimum 8 characters.
  - At least one uppercase letter.
  - At least one lowercase letter.
  - At least one numerical digit.
- **Brute-Force Protection:**
  - Progressive rate limiting enabled on all auth endpoints via FastAPI middleware.
  - IP-based and account-based lockout after 5 consecutive failed attempts within 15 minutes.
  - Failed attempt logging in `audit_logs` table.

---

## 4. Session Token Architecture

- **Token Structure:** JWT signed with `HS256` containing:
  - `sub`: UUID of the authenticated user.
  - `tenant_id`: Multi-tenant boundary UUID.
  - `role`: Role string (`superadmin`, `admin`, `teacher`, `student`, `guardian`).
  - `workspace_id`: Primary active workspace ID.
  - `exp`: Unix timestamp (1 hour standard lifetime).
- **Client Storage:**
  - HTTP-only or secure localized storage handled through centralized `frontend/lib/api-client.ts`.
  - Comprehensive `clearSession()` utility purges all auth keys on logout.
- **Open-Redirect Defense:**
  - All post-login redirections use `getSafeReturnUrl(targetUrl, defaultRoleUrl)`.
  - External origins and protocol-relative URLs (`//evil.com`) are stripped and redirected to default role dashboards.

