# EDUCATIONOS — STAGE 12.5.1 SECURITY REVIEW
## Pilot-Critical Stabilization: Multi-Tenant Workspace Isolation & Access Guard Analysis

**Execution Date:** 9 November 2026  
**Auditor:** Application Security & Multi-Tenant Infrastructure Lead  
**Scope:** Stage 12.5.1 Header Decoupling, Workspace Access Control & Academic Endpoints  
**Verdict:** APPROVED FOR PILOT DEPLOYMENT  

---

## 1. Threat Modeling & Scope

The decoupling of root institutional tenancy (`tenant_id`) from localized operational workspaces (`active_workspace_id`) introduces a multi-tier boundary model. A security analysis was conducted against horizontal privilege escalation, Broken Object Level Authorization (BOLA), and cross-tenant context poisoning.

```
+-----------------------------------------------------------------------------------------+
|                                    SECURITY BOUNDARIES                                  |
|                                                                                         |
|   [ Client App ]                                                                        |
|         │                                                                               |
|         │ Bearer JWT (contains sub, user_id, tenant_id, role)                           |
|         │ X-Tenant-ID: [Claim Tenant UUID]                                              |
|         │ X-Workspace-ID: [Campus Workspace UUID]                                       |
|         ▼                                                                               |
|   [ Security Guard: get_current_user_claims ]                                           |
|         │ 1. Cryptographically verify signature, exp, not-revoked                      |
|         │ 2. Reject if X-Tenant-ID != claims.tenant_id (403 Forbidden)                  |
|         ▼                                                                               |
|   [ Security Guard: get_current_workspace_id ]                                          |
|         │ 1. Validate UUID syntax (400 Bad Request if invalid)                          |
|         │ 2. Verify workspace.tenant_id == claims.tenant_id (403 Forbidden)             |
|         │ 3. Verify workspace.is_active == TRUE (403 Forbidden)                         |
|         │ 4. For non-admin (teacher/student/guardian), verify WorkspaceMembership       |
|         ▼                                                                               |
|   [ RLS-Locked Session: get_db ]                                                        |
|         └─ SET LOCAL app.current_tenant_id = :claims_tenant_id                         |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Threat Vector Evaluation

### 2.1 Threat Vector 1: Cross-Tenant Workspace Spoofing (BOLA)
- **Vector:** An authenticated user in Tenant A supplies an `X-Workspace-ID` corresponding to a campus in Tenant B.
- **Pre-Fix Risk:** In earlier iterations, `X-Workspace-ID` was unvalidated and simply returned as the active workspace, allowing cross-tenant data query contamination if queries filtered by workspace without checking root tenant.
- **Mitigation in 12.5.1:** `get_current_workspace_id` performs an explicit database query:
  ```python
  ws = db.query(Workspace).filter(
      Workspace.id == ws_uuid,
      Workspace.tenant_id == claims["tenant_id"],
      Workspace.is_active == True
  ).first()
  if not ws:
      raise HTTPException(status_code=403, detail="Cross-tenant access violation: ...")
  ```
- **Test Evidence:** `test_workspace_belonging_to_another_tenant_rejected` asserts HTTP 403.

### 2.2 Threat Vector 2: Intra-Tenant Horizontal Privilege Escalation
- **Vector:** A teacher assigned only to "Primary School Campus" specifies the workspace ID for "High School Academic Coaching", gaining unauthorized visibility into coaching batches or exams.
- **Mitigation in 12.5.1:** Role-aware membership verification:
  ```python
  user_role = (claims.get("role") or "").lower()
  if user_role not in ("admin", "superadmin"):
      membership = db.query(WorkspaceMembership).filter(
          WorkspaceMembership.workspace_id == ws_uuid,
          WorkspaceMembership.user_id == claims["user_id"],
          WorkspaceMembership.is_active == True
      ).first()
      if not membership:
          raise HTTPException(status_code=403, detail="Unauthorized workspace: ...")
  ```
- **Test Evidence:** `test_teacher_blocked_from_unassigned_workspace` asserts HTTP 403.

### 2.3 Threat Vector 3: Malformed Header / SQL Injection Injection Probe
- **Vector:** An attacker sends non-UUID strings (`' OR 1=1 --`, `../../../etc/passwd`) in `X-Workspace-ID`.
- **Mitigation in 12.5.1:** Strict UUID instantiation with fail-closed error handling:
  ```python
  try:
      ws_uuid = uuid.UUID(ws_id_str)
  except (ValueError, AttributeError):
      raise HTTPException(status_code=400, detail="Invalid workspace ID format: Must be a valid UUID.")
  ```
- **Test Evidence:** `test_malformed_workspace_id_fails_closed` asserts HTTP 400.

### 2.4 Threat Vector 4: Academic Curriculum Route Tampering & BOLA
- **Vector:** An unauthenticated or unauthorized party attempts to tamper with institutional grade levels via `POST /api/v1/academic/grades`.
- **Mitigation in 12.5.1:** Protected by `require_roles(["admin", "teacher"])` and scoped to the verified `claims["tenant_id"]`. Auto-seeding is isolated to the tenant's transaction scope.

---

## 3. OWASP Top 10 (2021) Compliance Matrix

| OWASP Category | Relevant Risk | EducationOS 12.5.1 Control | Status |
|:---|:---|:---|:---:|
| **A01: Broken Access Control** | Cross-tenant or cross-branch data access | Tenant check + WorkspaceMembership query | **PASS** |
| **A02: Cryptographic Failures** | Token tampering | HMAC-SHA256 signature verification + blacklisting | **PASS** |
| **A03: Injection** | SQL/header injection via `X-Workspace-ID` | Type coercion to `uuid.UUID` before ORM execution | **PASS** |
| **A04: Insecure Design** | Mixing root tenant ID with sub-branch ID | Full architectural separation in client and server | **PASS** |
| **A05: Security Misconfiguration** | Route shadowing (Starlette 405) | Correct route ordering in FastAPI router | **PASS** |
| **A07: Identification & Auth** | Session retention across logouts | Explicit purging of `active_workspace_id` in `clearSession` | **PASS** |

---

## 4. Auditor Conclusion

The Stage 12.5.1 stabilization fixes eliminate root-tenant context corruption and enforce rigorous multi-tenant workspace isolation. No outstanding P0 or P1 security vulnerabilities were identified in the modified subsystems.

