# Subscription & Payment State Machine

## 1. Payment Intent State Transitions (`subscription_payments.status`)

```text
PENDING ──[tenant admin submits TrxID / manual-claim]──▶ SUBMITTED
   │                                                          │
   ├──[signed gateway webhook SUCCESS]────────────────────────┼──▶ PAID
   │                                                          │
   └──[superadmin /admin/reject-payment]──────────────────────┴──▶ REJECTED

PAID ──[superadmin /admin/reverse-payment]──▶ REVERSED (voids invoice, demotes sub to PAST_DUE)
```

### Invariants Enforced
- **No Unverified Client Activation:** Tenant admins calling `/checkout` or `/verify-payment` can NEVER move a payment to `PAID`.
- **Single-Approval / Dual-Custody:** Tenant admins cannot call `/admin/reconcile-payment` (HTTP 403), and any claim submitter cannot also approve their own claim (`submitted_by == operator_id` -> HTTP 403).
- **Idempotency:** Duplicate replay of a `PAID` webhook or reconciliation returns `ALREADY_PROCESSED` / `ALREADY_CONFIRMED` without double-extending `valid_until`.

## 2. Institution Subscription State Machine (`institution_subscriptions.subscription_status`)
- `TRIAL`: Active trial period until `valid_until` / `trial_ends_at`.
- `ACTIVE`: Paid / reconciled active window (`valid_until > now`), full plan entitlements active in `tenant_entitlements`.
- `PAST_DUE` / `GRACE_PERIOD`: Triggered upon expiry inside grace window OR upon `REVERSED` payment; allows read/dunning notices before hard lock.
- `SUSPENDED` / `EXPIRED` / `CANCELLED`: Feature entitlements evaluate disabled/read-only fallback.
- Renewal / Cycle Extension: `base = max(now, existing.valid_until)` + `cycle_days` (30 monthly / 365 annual), preventing premature time truncation on early renewal.
