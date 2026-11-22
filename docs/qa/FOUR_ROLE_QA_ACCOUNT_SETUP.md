# EducationOS — Four-Role QA Account Provisioning & Verification Guide

**Artifact ID:** `QA-DOC-SETUP-01`  
**Target Environment:** Isolated Test Academy (`recon.edu.bd`)  
**CLI Tool:** `backend/app/cli/qa_accounts.py`  
**Execution Date:** November 14, 2026  
**Status:** **PROVISIONED & CRYPTOGRAPHICALLY VERIFIED**

---

## 1. Overview & Purpose
To enable thorough manual User Acceptance Testing (UAT) across the full suite of EducationOS capabilities, a dedicated, reproducible CLI tool has been developed: `backend/app/cli/qa_accounts.py`.

This tool provisions four distinct synthetic user accounts across all platform roles within an isolated synthetic tenant: **Reconstruction Test Academy** (`recon.edu.bd`).

---

## 2. Security & Anti-Leak Controls
1. **Production Environment Refusal:** The CLI strictly inspects `ENV`, `ENVIRONMENT`, and database connection strings. Execution is blocked if the environment is set to `production` or if connecting to a production Supabase host.
2. **Restricted Local Credential Storage:** Generated passwords are saved exclusively to `.qa-credentials.local` with strict filesystem permissions (`0600` / `-rw-------`, accessible only to the owner).
3. **Git-Ignored:** `.qa-credentials.local` is registered in `.gitignore` (line 49) to ensure zero risk of credential commits.
4. **Zero-Secret Logging:** Plaintext passwords are never written to standard output or log streams during provisioning or verification.

---

## 3. Provisioned QA Roles & Context

| Role | Identifier | Profile Context | Linked Entities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@recon.edu.bd` | System Administrator / Head of Institution | Full Tenant Scope (`01c56493-9174-459c-a17d-946af31634ff`) |
| **Teacher** | `teacher@recon.edu.bd` | Senior Science Educator (Tariqul Islam) | Assigned Class: `Class 5`<br>Subjects: `Mathematics, General Science` |
| **Student** | `STU-2026-0001` | Primary Terminal Student (Rafiq Ahmed) | Class: `Class 5-A`, Roll: `01`<br>Academic Year: `2026` |
| **Guardian** | `01712345678` | Verified Father (Farid Ahmed) | Linked Student: `STU-2026-0001`<br>Status: `VERIFIED` (Primary Contact) |

---

## 4. CLI Commands & Execution Evidence

### A. Provisioning Command
```bash
PYTHONPATH=backend venv/bin/python -m app.cli.qa_accounts provision
```
**Execution Output:**
```
======================================================================
EDUCATIONOS — FOUR-ROLE QA ACCOUNT PROVISIONING
======================================================================
[OK] Tenant: Reconstruction Test Academy (ID: 01c56493-9174-459c-a17d-946af31634ff)
[OK] Admin User provisioned: admin@recon.edu.bd
[OK] Teacher User & Profile provisioned: teacher@recon.edu.bd (Class 5 Math/Sci)
[OK] Student User & Registry provisioned: STU-2026-0001 (Rafiq Ahmed, Class 5-A, Roll 01)
[OK] Guardian User, Profile & Student Link provisioned: 01712345678 (Linked to STU-2026-0001)
======================================================================
[SUCCESS] All 4 QA Accounts provisioned and persisted successfully.
[PROTECTED] Credentials saved to local file: /Users/tashfinyousuf/Python/SCHOOL_OS/.qa-credentials.local (permissions: 0600).
[AUDIT SAFE] No plaintext passwords have been written to stdout.
======================================================================
```

### B. Verification Command
```bash
PYTHONPATH=backend venv/bin/python -m app.cli.qa_accounts verify
```
**Execution Output:**
```
================================================================================
EDUCATIONOS — FOUR-ROLE QA ACCOUNT INDEPENDENT VERIFICATION
================================================================================
Target Tenant: Reconstruction Test Academy (Domain: recon.edu.bd, ID: 01c56493-9174-459c-a17d-946af31634ff)
--------------------------------------------------------------------------------
ROLE       | IDENTIFIER               | ACTIVE | HASH   | PROFILE & LINKAGE                    | RESULT
---------------------------------------------------------------------------------------------------------
Admin      | admin@recon.edu.bd       | YES    | PASS   | System Administrator                 | PASS
Teacher    | teacher@recon.edu.bd     | YES    | PASS   | Class 5 (Mathematics, General Science) | PASS
Student    | STU-2026-0001            | YES    | PASS   | Rafiq Ahmed (Roll 01)                | PASS
Guardian   | 01712345678              | YES    | PASS   | Linked to STU-2026-0001 (Father)     | PASS
---------------------------------------------------------------------------------------------------------

[VERIFIED] All 4 QA Accounts are present, cryptographically verified, and ready for UAT.
```

---

## 5. How to Obtain Credentials for Manual Browser UAT
To inspect the generated credentials for browser sign-in on your local terminal:
```bash
cat .qa-credentials.local
```
*(Keep this file local; do not transmit or share outside local staging testing).*

