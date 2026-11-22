# EducationOS — Production Cost Allocation & FinOps Architecture
**Document ID:** `docs/PRODUCTION_COST_ALLOCATION_AND_FINOPS.md`  
**Generated:** 2026-11-09  
**Execution Standard:** Section K (Phase 9) Master Engineering Directive  
**Status:** **AUTHORITATIVE FINOPS SPECIFICATION**  

---

## 1. External Service Cost Matrix

| Service | Provider | Billing Owner | Usage Metric | Cost Allocation | Quota Limit | Fallback Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary AI Inference** | Google Gemini (1.5 Pro / Flash) | EducationOS Platform | Input & Output Tokens | Tenant AI Budget | Configured per Tier | Fallback to Groq Llama 3.3 |
| **Secondary AI Fallback** | Groq (Llama 3.3 70B Versatile) | EducationOS Platform | Tokens per Minute | Tenant AI Budget | 30 requests / min | Graceful Degradation / Human Draft |
| **Database Engine** | Supabase / AWS RDS | EducationOS Platform | Database Compute & Storage | Shared Platform Overhead | 500 IOPS / 50 GB | Read Replica Auto-scaling |
| **Document Storage** | AWS S3 / Cloudflare R2 | EducationOS Platform | GB-Month & Egress | Tenant Document Quota | 10 GB per Institution | Local Archive / Compression |
| **Application Hosting** | Edge CDN / Container Runner | EducationOS Platform | CPU Hours & Bandwidth | Shared Platform Overhead | Auto-scaled 2–10 Pods | Rate-limiting & Cloudflare Caching |
| **Payment Gateway** | bKash / Nagad / SSLCommerz | Institution / Merchant | Transaction Surcharge (%) | Direct Deducted at Settlement | Merchant Agreement | Cash Counter Manual Entry |
| **Guardian Notifications** | One-Click WhatsApp / Phone | Parent / Carrier | Standard Carrier Airtime | Zero Cost to Platform | Unlimited (P2P Link) | In-App Dashboard Notice |

---

## 2. Platform Overhead vs Tenant Allocation

### 2.1 Shared Platform Expenses (Fixed Infrastructure)
- Core database compute and high-availability standby replicas.
- Continuous WAL archiving and multi-region disaster recovery storage.
- Edge CDN routing, SSL/TLS certificate renewals, and DDoS mitigation.
- Base platform telemetry, error logging, and monitoring containers.

### 2.2 Variable Tenant-Attributed Expenses
- Inbound AI token generation (Question Papers, Lesson Blueprints, Socratic Tutor).
- Private document vault storage (Student birth certificates, transfer certificates, receipts).
- Additional custom campus workspace branches.

---

## 3. Quota Exhaustion & Anti-Noisy-Neighbor Protections

1. **Hard Token Locks:**
   When a tenant reaches 100% of their monthly allocated token quota, the AI Gateway halts further inference for that specific institution with HTTP 429 (`"Tenant AI budget exceeded"`), preventing bill shock.
2. **Rate Limiting Per Tenant:**
   Sliding-window throttles prevent an individual school from saturating connection pools or inference queues during peak morning roll calls.
3. **No Cross-Subsidization:**
   One school cannot consume another institution's pre-paid tokens or database IOPS capacity.

