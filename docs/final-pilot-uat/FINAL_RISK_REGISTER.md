# FINAL RISK REGISTER
## Residual Vulnerabilities, External Dependencies & Mitigation Controls

**Document ID:** EOS-UAT-018  
**Pilot Context:** Kids Shine International School Rollout  
**Review Frequency:** Weekly during pilot operation  
**Risk Tolerance:** Low (Academic & Financial SaaS)

---

## 1. Risk Assessment Matrix

| Risk ID | Category | Description | Severity | Likelihood | Mitigation & Fallback Strategy | Owner |
|---|---|---|---|---|---|---|
| **RSK-01** | External Integration | **Live SMS Provider Dependency:** Carrier gateway delays or temporary credit depletion during urgent attendance dispatch. | Medium | Medium | Hardened outbox retry queue with fallback to in-app notification center and parent email. Local sandbox mock enables offline verification. | Backend Lead |
| **RSK-02** | Payment Operations | **Payment Merchant Account Activation:** KSIS commercial merchant KYC pending for direct automated bKash/Nagad checkout. | Medium | Low | Manual payment logging and offline voucher approval workflow active in `/dashboard/finance` as approved pilot fallback. | Finance Lead |
| **RSK-03** | Network Resilience | **Intermittent Cellular Data at School Campus:** Unstable internet in classrooms during live morning attendance taking. | High | Medium | PWA offline caching layer in `/offline`; attendance events buffered locally in IndexedDB and synchronized upon reconnection. | Frontend Lead |
| **RSK-04** | User Adoption | **Teacher Technical Literacy:** Resistance to digital marks entry or routine management among non-technical teaching staff. | Medium | Medium | Simplified Bengali UI toggle; one-click attendance marking; comprehensive on-site training sessions scheduled for Day 1. | Customer Success |
| **RSK-05** | Cloud AI Quotas | **Gemini API Token Limits:** Simultaneous textbook indexing and classroom doubt solving exceeding API request thresholds. | Low | Low | Tiered token pooling; chunk caching; graceful degradation to extractive textbook search if external AI rate limits are reached. | AI Architect |

---

## 2. Risk Sign-off & Pilot Tolerance

All residual risks are either mitigated by architectural fail-safes (offline queues, manual voucher workflows) or managed via operational protocols. No unmitigated critical or high-severity security vulnerabilities exist.
