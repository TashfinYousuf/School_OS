# EducationOS — AI Gateway, Tenant Quotas & FinOps Specification
**Document ID:** `docs/AI_GATEWAY_AND_TENANT_FINOPS_SPEC.md`  
**Generated:** 2026-11-09  
**Execution Standard:** Section G (Phase 5) Master Engineering Directive  
**Status:** **AUTHORITATIVE SPECIFICATION & COST GOVERNANCE**  

---

## 1. Gateway Architecture & Provider Isolation

EducationOS routes all AI inference requests through a hardened, server-side gateway (`backend/app/services/ai_gateway.py`).
Frontend components have **zero direct access** to underlying AI provider APIs, API keys, or raw inference credentials.

```
       [Next.js Client]
              │ (Authenticated Bearer JWT + X-Tenant-ID)
              ▼
    [FastAPI AI Router]
    ├── Input Sanitization & Tag Stripping
    ├── Prompt Injection Defenses
    └── Tenant Quota & Budget Enforcement
              │
              ▼
     [AI Gateway Service]
     ├── Provider Router: Gemini 1.5 Pro / Flash ──(Failover)──► Groq Llama 3.3
     ├── Token Metering & Cost Attribution
     └── Immutable AI Usage Logging (ai_usage_logs)
              │
              ▼
   [Response to Client]
```

---

## 2. Tenant-Level Quota & Budget Control

### 2.1 Multi-Tenant Budget Enforcement
- Every tenant has an explicit monthly token and cost budget configured in `tenant_ai_budgets`:
  - `monthly_token_limit`: e.g., 500,000 tokens / month.
  - `monthly_cost_limit_usd`: e.g., $10.00 / month.
  - `current_tokens_used`: Monotonically incremented.
  - `hard_lock_enabled`: If `True`, requests exceeding budget are rejected immediately with **HTTP 429 Too Many Requests** (`"Tenant AI budget exceeded"`).

### 2.2 Feature-Level Quotas
- Token consumption is compartmentalized across educational features:
  1. `question_paper`: High context, draft generation.
  2. `lesson_blueprint`: Teacher curriculum copilot.
  3. `doubt_solver`: Socratic tutor (strictly prohibited from revealing direct test answers).
  4. `voice_diary`: Teacher audio log structuring.

### 2.3 Immutable Usage Logging (`ai_usage_logs`)
Every AI invocation persists an immutable audit record containing:
- `id`: UUID primary key.
- `tenant_id`: Cryptographically verified tenant scope.
- `user_id`: Authenticated invoking user.
- `feature_name`: Module invoked.
- `provider`: Primary provider (e.g., `gemini`, `groq`).
- `model`: Exact model name.
- `prompt_tokens` & `completion_tokens`.
- `estimated_cost_usd`: Accurate minor unit cost calculation.
- `latency_ms`: Response time.
- `created_at`: UTC timestamp.

---

## 3. Security & Anti-Abuse Invariants

1. **Prompt Injection Shield:**
   Incoming prompts pass through regex filters stripping system prompt override attempts (`"ignore all previous instructions"`, `"reveal database schema"`, `"<script>"`, `"system:"`).
2. **Socratic Guardrails:**
   Student learning studio tutor prompts are systematically pre-pended with strict pedagogic system instructions forbidding direct answer generation.
3. **Cross-Tenant RAG Isolation:**
   Curriculum vector embeddings and textbook knowledge chunks in `curriculum_chunks` are strictly partitioned by `tenant_id`. No institution's private notes or exam drafts can ever bleed into another tenant's inference context.
4. **Platform Expense vs Tenant Attribution:**
   Platform overhead (core embeddings) is accounted separately from institution-specific inference costs in monthly FinOps reporting.

