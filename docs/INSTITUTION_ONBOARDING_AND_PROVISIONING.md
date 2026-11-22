# EducationOS — Institution Onboarding & Tenant Provisioning Specification
**Document ID:** `docs/INSTITUTION_ONBOARDING_AND_PROVISIONING.md`  
**Generated:** 2026-11-11  
**Author:** Principal Software Architect & DevOps Lead  
**Scope:** Stage 3 Canonical Onboarding, Registration Drafting, and Idempotent Provisioning State Machine  

---

## 1. Architectural Philosophy & The Single Journey Rule

Previous iterations of the platform suffered from fragmented onboarding: a brochureware wizard at `/onboard` competed with a hidden registration form inside `/login`.

Under Stage 3:
1. **`/onboard` is the Sole Canonical Registration Journey:** There is no registration form on `/login`. All public buttons, pricing CTAs, and marketing links point exclusively to `/onboard`.
2. **Progressive Disclosure:** Instead of overwhelming a school administrator with a massive 20-field form, information is collected in clear stages: Institution Identity -> Principal Account -> Dynamic Capacity & Pilot Codes -> Instant Provisioning.
3. **Zero Phantom Resource Allocation:** Registration drafts stored in the browser do not create empty database rows or reserve expensive server resources until verified submission.

---

## 2. Separation of Architectural Concepts

To guarantee financial and tenant integrity, the platform strictly segregates the following entities:

```
┌─────────────────────────┐
│ 1. Registration Draft   │ Client-side state in sessionStorage; non-persisted in primary DB.
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 2. Payment Order        │ Immutable record in billing_invoices (status = DRAFT / PENDING).
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 3. Payment Transaction  │ Gateway TrxID or Bank Deposit verification (status = VERIFIED).
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 4. Tenant & Workspaces  │ Cryptographically isolated School & Academy row in tenants.
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ 5. Active Entitlements  │ Modular feature flags provisioned in tenant_entitlements.
└─────────────────────────┘
```

---

## 3. Authoritative Provisioning State Machine

```
                        ┌──────────────┐
                        │    DRAFT     │ (Browser sessionStorage)
                        └──────┬───────┘
                               │ Submit Onboarding Form
                               ▼
                        ┌──────────────┐
     Payment Fails /    │   PENDING_   │
     Expired            │   PAYMENT    │
    ┌───────────────────┤              ├────────────────────────┐
    │                   └──────┬───────┘                        │ Verified Pilot Code
    │                          │ Gateway IPN /                  │ (KIDSSHINE)
    │                          │ Manual Bank Approval           │
    ▼                          ▼                                ▼
┌──────────────┐        ┌──────────────┐                 ┌──────────────┐
│   PAYMENT_   │        │   PAYMENT_   │                 │ COMPLIMENTARY│
│    FAILED    │        │   VERIFIED   │                 │  PILOT_PASS  │
└──────────────┘        └──────┬───────┘                 └──────┬───────┘
                               │                                │
                               └──────────────┬─────────────────┘
                                              │ Run Idempotent DDL / Workspace Creation
                                              ▼
                                       ┌──────────────┐
                                       │ PROVISIONING │
                                       └──────┬───────┘
                                              │
                          ┌───────────────────┴───────────────────┐
                          │ Success                               │ Exception
                          ▼                                       ▼
                   ┌──────────────┐                        ┌──────────────┐
                   │    ACTIVE    │                        │ PROVISIONING_│
                   └──────┬───────┘                        │    FAILED    │
                          │                                └──────────────┘
            ┌─────────────┴─────────────┐
            ▼                           ▼
     ┌──────────────┐            ┌──────────────┐
     │ GRACE_PERIOD │            │  SUSPENDED   │
     │  (Read-Only) │            │ (Hard Abuse) │
     └──────────────┘            └──────────────┘
```

### State Definitions & Invariants:
1. **`DRAFT`:** Configuration saved in client `sessionStorage` under `educationos_onboarding_draft`. Expired automatically upon tab/browser closure or successful account registration.
2. **`PENDING_PAYMENT`:** A server-side invoice is created with unique reference ID (`INV-2026-XXXX`). No active student capacity or paid module access is granted.
3. **`PAYMENT_VERIFIED`:** Payment confirmed via server-to-server gateway callback (bKash/Nagad) or manual admin bank reconciliation.
4. **`PROVISIONING`:** Transactional creation of the tenant row, school profile, default workspaces (School + Academy), initial administrator account, and modular feature entitlements.
5. **`ACTIVE`:** JWT tokens issued; school administration enters the live dashboard with full write access.
6. **`PROVISIONING_FAILED`:** If an unhandled error occurs during tenant initialization, the payment record is preserved and an automated alert pages the on-call engineer. The customer is NEVER charged a second time.

---

## 4. Idempotency Guarantees

To ensure that duplicate webhook deliveries, browser refreshes, or network retries never spawn duplicate schools or subscriptions:
1. **Unique Email & School Constraint:** `admin_email` and `school_name` have database-enforced unique constraints per tenant.
2. **Idempotency Keys:** Every checkout and provisioning call accepts an `X-Idempotency-Key` header (UUID v4). If the key already exists in the `billing_idempotency_keys` table within 24 hours, the backend returns the cached response rather than re-executing provisioning.
3. **Single Transaction Boundary:** All tenant, workspace, user, and subscription insertions are executed inside a single atomic database transaction (`db.commit()`); if any model fails, the entire transaction rolls back cleanly (`db.rollback()`).

---

## 5. Complimentary Pilot Access Protocol (Kids Shine School)

For authorized institutional pilot deployments:
- **Pilot Code:** `KIDSSHINE`
- **Verification Rule:** Backend inspects `invite_code == "KIDSSHINE"` during registration.
- **Terms Granted:**
  - 60-day complimentary full-access subscription.
  - Active student capacity: up to 350 students.
  - Core Modules + Smart Attendance + Advanced Finance + Offline Sync enabled.
  - Zero upfront payment required.
- **Audit Logging:** An immutable record is appended to `audit_logs` capturing `action="PROVISION_COMPLIMENTARY_PILOT"`, `tenant_id`, and `timestamp`.

