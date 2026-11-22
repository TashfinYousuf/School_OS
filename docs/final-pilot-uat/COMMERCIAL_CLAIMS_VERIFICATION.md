# COMMERCIAL CLAIMS VERIFICATION
## Institutional Pricing Engine, 60-Day Pilot Terms & Transparent Quotation Audit

**Document ID:** EOS-UAT-016  
**Pricing Engine Module:** `backend/app/services/pricing_engine.py`  
**Test Endpoints:** `POST /api/v1/pricing/quote` & `GET /api/v1/pricing/tiers`  
**Currency:** Bangladeshi Taka (BDT, ৳)  
**Verdict:** **MATHEMATICALLY VERIFIED & FULLY ALIGNED WITH PILOT CONTRACT**

---

## 1. Commercial Model Overview

EducationOS implements a deterministic, multi-tiered institutional SaaS commercial model tailored for Bangladeshi schools, colleges, and coaching academies:
- **Base Platform Fee:** Fixed per month based on institution tier.
- **Per-Student Charge:** Scaled per enrolled active student.
- **Add-On Modules:** Granular feature activation (Live Exams, Academy Batches, IPEMIS Sync).
- **Billing Frequency Discount:** 15% discount applied automatically on annual upfront billing.
- **Pilot Waiver Policy:** Approved pilot institutions (Kids Shine International School) receive an owner-authorized 60-day complimentary full-featured trial.

---

## 2. Pricing Engine Mathematical Assertions

The pricing calculation engine uses `Decimal` arithmetic to eliminate floating-point rounding errors.

### Test Case A: Standard Institutional School (500 Students, Monthly)
- Base Fee: 4,000.00 BDT
- Student Charge: 500 × 20.00 BDT = 10,000.00 BDT
- Enabled Modules: Core Academic (Included)
- Monthly Gross: 14,000.00 BDT
- Discount: 0.00 BDT
- **Total Due Monthly:** **14,000.00 BDT** (Verified)

### Test Case B: Standard School (500 Students, Annual Pre-pay)
- Annual Gross: 14,000.00 × 12 = 168,000.00 BDT
- 15% Annual Discount: 168,000.00 × 0.15 = 25,200.00 BDT
- **Total Due Annual:** **142,800.00 BDT** (Verified)
- **Net Effective Monthly:** **11,900.00 BDT / month** (Verified)

### Test Case C: Kids Shine International School Pilot Quotation
- Institution: Kids Shine International School (`1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31`)
- Pilot Flag: `is_pilot = True`
- Applied Rule:
  ```python
  if is_pilot:
      notes.append("Approved Pilot Institution: 60-day complimentary trial applied (0.00 BDT due).")
      total_due_dec = ZERO_DEC
      monthly_net_dec = ZERO_DEC
  ```
- **Total Due for Pilot Period:** **0.00 BDT** (Verified)
- **Invoice Status:** `PAID / COMPLIMENTARY PILOT WAIVER`

---

## 3. Transparency & Contract Compliance

1. **Zero Hidden Fees:** All taxes, platform maintenance, and customer support SLAs are clearly itemized on quotation PDFs.
2. **Student Band Elasticity:** Invoices automatically adjust when active student counts cross standard tier thresholds (e.g. 500 to 1,000 students).
3. **No Lock-In:** Standard cancellation policy guarantees school data export in JSON and Excel formats upon request.

