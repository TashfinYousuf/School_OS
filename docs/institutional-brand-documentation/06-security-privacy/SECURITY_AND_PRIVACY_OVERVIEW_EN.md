# EDUCATIONOS — SECURITY, PRIVACY & INSTITUTIONAL TRUST OVERVIEW
## Complete Data Ownership, Kernel-Level Isolation & Enterprise Governance

**Document Version:** 2026.1-TRUST  
**Classification:** Customer-Facing & Board-Level Security Overview  
**Security Model:** Defense-in-Depth Architecture  

---

## 1. Executive Trust Commitment

Educational institutions are entrusted with sensitive personal records: student identities, birth certificate numbers, family contact details, guardian national identity credentials (NID), academic performance evaluations, and financial fee ledgers.

EducationOS is engineered around three foundational trust covenants:
1. **Unconditional Institutional Ownership:** Your institution retains 100% legal ownership of all uploaded data and generated academic records.
2. **Zero Third-Party Commercialization:** EducationOS maintains a strict zero-monetization policy. We never sell, rent, license, or target advertisements against student, educator, or guardian data.
3. **Engine-Level Multi-Tenancy Isolation:** Tenant isolation is enforced directly at the database engine level (PostgreSQL Native Row-Level Security), not by fragile application-layer filters.

---

## 2. Multi-Tenant Data Isolation (PostgreSQL Native RLS)

In conventional software platforms, multiple schools share the same database tables, and the application uses simple code filters (`WHERE tenant_id = '...'`) to separate records. If a developer makes a single programming mistake, one school's records can accidentally be exposed to another.

**EducationOS uses PostgreSQL Native Row-Level Security (RLS):**
- Every tenant table (students, guardians, academic sessions, financial ledgers, audit logs, exam records) has `FORCE ROW LEVEL SECURITY` enabled.
- Whenever an API request executes, the database transaction is cryptographically bound to the authenticated school’s tenant ID (`app.current_tenant_id`).
- The database engine itself enforces the isolation rule. Even if an attacker attempts an Insecure Direct Object Reference (IDOR) manipulation, the database kernel physically refuses to return any row belonging to another institution.

---

## 3. Identity, Authentication & Session Defenses

### 3.1 Password Security & Cryptography
- Passwords are never stored in plaintext or reversible encryption. They are hashed using industry-standard Passlib **bcrypt** with individual cryptographic salts.
- Default administrative passwords must be changed upon first login.

### 3.2 Two-Factor Authentication (TOTP MFA)
- Platform Super Administrators and Institution Owners can activate two-factor authentication compliant with RFC 6238 (compatible with Google Authenticator, Microsoft Authenticator, or Apple Keychain).
- Ten single-use emergency recovery codes are generated during MFA enrollment to protect against accidental phone loss.

### 3.3 Active Session Management & Remote Revocation
- Every logged-in device is tracked in the database.
- If a teacher or administrator misplaces their phone or tablet, they can immediately log in from another device and click **Revoke All Other Sessions** to instantly invalidate compromised tokens across all locations.

### 3.4 Open-Redirect & CSRF Safeguards
- All login redirects validate target URLs through `getSafeReturnUrl`, rejecting protocol injections (`javascript:`) and domain-level spoofing.

---

## 4. File Storage & Upload Security

Educational files (admission documents, student photos, curriculum PDFs) are stored in enterprise object storage (Cloudflare R2 / AWS S3) with multi-layered defenses:
- **Strict Key Partitioning:** Files are saved to isolated directory paths:  
  `tenant/{tenant_id}/{category}/{asset_id}/{safe_filename}`.
- **Magic-Byte Content Validation:** File extensions are untrusted. The backend inspects the actual file binary headers (magic bytes) to guarantee that an uploaded `.pdf` or `.png` is genuine and not an executable binary or malicious script.
- **Cryptographic SHA-256 Fingerprinting:** Every file is hashed on ingest to detect corruption and prevent duplicate bloat.
- **Time-Limited Pre-Signed URLs:** Private documents (student birth certificates, exam papers) are never served over public URLs. The system generates secure pre-signed URLs that expire automatically after a short window.

---

## 5. Artificial Intelligence & Third-Party Processing

Institutions frequently ask how their data is handled when using EducationOS's AI features:
- **Zero Public Model Training:** When generating question papers or lesson plans via our Multi-Model AI Gateway, institutional queries are transmitted under enterprise API agreements that strictly forbid foundational model providers (Google Gemini) from retaining or using your institution’s data to train public commercial models.
- **Pedagogical Human Invariant:** AI outputs are always generated in `Draft` state. They require verified educator sign-off before entering any academic workflow.

---

## 6. Institutional Responsibilities & Best Practices

Security is a shared responsibility between EducationOS and institutional leadership:
- **Staff Credential Discipline:** Instruct administrative staff never to share passwords or write passwords on sticky notes in reception areas.
- **Authorized Device Policy:** Ensure institutional laptops and tablets have screen locks enabled.
- **Prompt Role Deprovisioning:** When a staff member or educator departs the institution, an administrator should promptly toggle their account status to `Inactive` in the Staff Directory to immediately terminate their access.

