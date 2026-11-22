"""
backend/app/services/pricing_engine.py
Authoritative Dynamic Pricing Engine for EducationOS / SchoolOS Enterprise.

Provides single-source-of-truth calculations for:
- Public Interactive Pricing Calculator
- Progressive Institutional Onboarding
- Dynamic Checkout & Subscription Provisioning
- Immutable Invoice Line Item Snapshots
- Entitlement Verification
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

ZERO_DEC = Decimal("0.00")


def _q(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# -----------------------------------------------------------------------------
# Pricing Configuration Constants (Configurable Draft Defaults)
# In accordance with Stage 2 governance, these are staged defaults pending formal owner ratification.
# -----------------------------------------------------------------------------
PRICING_VERSION = "2026.1-dynamic"
IS_OWNER_APPROVED = False  # Staged configurable draft

# Minimum Base Platform Infrastructure Fee (covers DB, storage, baseline compute)
BASE_PLATFORM_FEE_BDT = 1500.0
BASE_PLATFORM_FEE_DEC = Decimal("1500.00")

# Tiered Active Student Rates (BDT / active student / month)
STUDENT_TIERS = [
    {"up_to": 300, "rate_per_student": 12.0},  # Tier 1: 1-300 students
    {"up_to": 800, "rate_per_student": 10.0},  # Tier 2: 301-800 students
    {"up_to": None, "rate_per_student": 8.0},  # Tier 3: 801+ students
]

# Core Platform Modules (Included in Base Platform Fee)
CORE_MODULES = {
    "core_admin": {
        "id": "core_admin",
        "name": "Institution Administration & Workspaces",
        "category": "core",
        "price_bdt": 0.0,
        "is_core": True,
        "description": "Multi-role RBAC, security settings, academic calendar, and campus configuration."
    },
    "core_students": {
        "id": "core_students",
        "name": "Student Directory & Admissions",
        "category": "core",
        "price_bdt": 0.0,
        "is_core": True,
        "description": "Student 360 digital twin, enrollment records, class roster import."
    },
    "core_teachers": {
        "id": "core_teachers",
        "name": "Teacher & Staff Management",
        "category": "core",
        "price_bdt": 0.0,
        "is_core": True,
        "description": "Staff roster, class routines, subject assignment, and attendance taking."
    },
    "core_guardians": {
        "id": "core_guardians",
        "name": "Guardian / Parent Mobile Portal",
        "category": "core",
        "price_bdt": 0.0,
        "is_core": True,
        "description": "Secure multi-child view, attendance tracking, and fee receipt inspection."
    },
    "core_academic": {
        "id": "core_academic",
        "name": "Academic Structure & Routines",
        "category": "core",
        "price_bdt": 0.0,
        "is_core": True,
        "description": "Classes, sections, subjects, periods, and timetable builder."
    },
    "core_attendance": {
        "id": "core_attendance",
        "name": "Smart Attendance & Offline Sync",
        "category": "core",
        "price_bdt": 0.0,
        "is_core": True,
        "description": "1-tap roll call, offline IndexedDB sync, CSV export, and A4 print view."
    },
    "core_exams": {
        "id": "core_exams",
        "name": "Examinations & Grading Registry",
        "category": "core",
        "price_bdt": 0.0,
        "is_core": True,
        "description": "Exam schedules, mark sheets, NCTB/GPA calculation, and PDF report cards."
    },
    "core_notices": {
        "id": "core_notices",
        "name": "Notices & Institutional Communication",
        "category": "core",
        "price_bdt": 0.0,
        "is_core": True,
        "description": "Official notice board, SMS push alerts, and broadcast messaging."
    },
    "core_reports": {
        "id": "core_reports",
        "name": "Standard Operational Reports",
        "category": "core",
        "price_bdt": 0.0,
        "is_core": True,
        "description": "Class-wise attendance summaries, absentee rosters, and basic metrics."
    }
}

# Optional Paid Modules
OPTIONAL_MODULES = {
    "module_ai_assistant": {
        "id": "module_ai_assistant",
        "name": "AI Copilot & Question Paper Generator",
        "category": "ai",
        "price_bdt": 1200.0,
        "is_core": False,
        "description": "Includes 250k monthly Gemini API tokens, exam question composer, and syllabus chunk RAG."
    },
    "module_advanced_finance": {
        "id": "module_advanced_finance",
        "name": "Advanced Finance & Fee Collection",
        "category": "finance",
        "price_bdt": 800.0,
        "is_core": False,
        "description": "Dual-copy student fee receipts, bank/bKash ledger reconciliation, and tuition fee history."
    },
    "module_school_website": {
        "id": "module_school_website",
        "name": "Hosted Institutional Public Website",
        "category": "web",
        "price_bdt": 1000.0,
        "is_core": False,
        "description": "Templated public website with school about, notices, gallery, and admission inquiries."
    },
    "module_custom_domain": {
        "id": "module_custom_domain",
        "name": "Custom Domain Integration & SSL",
        "category": "web",
        "price_bdt": 500.0,
        "is_core": False,
        "description": "Automated DNS hostname mapping (school.edu.bd) with managed wildcard TLS certificate."
    },
    "module_whatsapp_alerts": {
        "id": "module_whatsapp_alerts",
        "name": "Automated WhatsApp Absentee Alerts",
        "category": "communication",
        "price_bdt": 600.0,
        "is_core": False,
        "description": "Instant WhatsApp message delivery to parents when child is marked absent."
    }
}

# Service Add-ons & Usage Unit Costs
AVAILABLE_ADDONS = {
    "sms_bundle_500": {
        "id": "sms_bundle_500",
        "name": "500 SMS Communication Credits",
        "unit_price_bdt": 175.0,  # 0.35 BDT / SMS
        "units_included": 500
    },
    "ai_tokens_500k": {
        "id": "ai_tokens_500k",
        "name": "500,000 Extra AI Tokens Pack",
        "unit_price_bdt": 250.0,
        "units_included": 500000
    }
}

# Annual Billing Discount Percentage (Configurable Draft: 15% discount for 1-year prepayment)
ANNUAL_DISCOUNT_PERCENT = 15.0


# -----------------------------------------------------------------------------
# Pydantic Schemas for Quote Requests & Responses
# -----------------------------------------------------------------------------
class PricingQuoteRequest(BaseModel):
    institution_type: str = Field(default="school", description="'school', 'college', or 'academy'")
    student_count: int = Field(default=150, ge=0, le=20000, description="Billable active student count")
    selected_modules: List[str] = Field(default_factory=list, description="List of optional paid module IDs")
    add_ons: Dict[str, int] = Field(default_factory=dict, description="Dictionary of add-on ID to quantity")
    billing_cycle: str = Field(default="monthly", description="'monthly' or 'annual'")
    pilot_code: Optional[str] = Field(default=None, description="Optional approved pilot code e.g. 'KIDSSHINE'")


class LineItemDetail(BaseModel):
    id: str
    name: str
    category: str
    unit_price_bdt: float
    quantity: int
    total_bdt: float


class PricingQuoteResponse(BaseModel):
    pricing_version: str
    is_owner_approved: bool
    institution_type: str
    student_count: int
    billing_cycle: str
    base_platform_fee_bdt: float
    student_charge_bdt: float
    modules_subtotal_bdt: float
    addons_subtotal_bdt: float
    monthly_gross_bdt: float
    discount_percent: float
    discount_amount_bdt: float
    monthly_net_bdt: float
    total_due_bdt: float
    billing_period_months: int
    line_items: List[LineItemDetail]
    entitlements_granted: List[str]
    is_complimentary_pilot: bool
    notes: List[str]


# -----------------------------------------------------------------------------
# Pricing Engine Calculator
# -----------------------------------------------------------------------------
class PricingEngine:
    @staticmethod
    def calculate_student_charge_decimal(student_count: int) -> Decimal:
        """
        Fixed-precision Decimal graduated tiered student charges:
        - 1-300: 12.00 BDT / student
        - 301-800: 10.00 BDT / student
        - 801+: 8.00 BDT / student
        """
        if student_count <= 0:
            return ZERO_DEC

        total = ZERO_DEC
        remaining = int(student_count)

        # Tier 1: up to 300
        tier1_count = min(remaining, 300)
        total += Decimal(tier1_count) * Decimal("12.00")
        remaining -= tier1_count

        # Tier 2: 301 to 800 (500 capacity)
        if remaining > 0:
            tier2_count = min(remaining, 500)
            total += Decimal(tier2_count) * Decimal("10.00")
            remaining -= tier2_count

        # Tier 3: 801+
        if remaining > 0:
            total += Decimal(remaining) * Decimal("8.00")

        return _q(total)

    @staticmethod
    def calculate_student_charge(student_count: int) -> float:
        return float(PricingEngine.calculate_student_charge_decimal(student_count))

    @classmethod
    def calculate_quote(cls, request: PricingQuoteRequest) -> PricingQuoteResponse:
        """
        Authoritative fixed-precision Decimal calculation of quote across all billing surfaces.
        """
        line_items: List[LineItemDetail] = []
        entitlements: List[str] = []
        notes: List[str] = []

        is_pilot = bool(request.pilot_code and request.pilot_code.strip().upper() == "KIDSSHINE")

        # 1. Base Platform Fee
        base_dec = BASE_PLATFORM_FEE_DEC
        line_items.append(LineItemDetail(
            id="base_platform_fee",
            name="Base Platform Infrastructure Fee",
            category="base",
            unit_price_bdt=float(base_dec),
            quantity=1,
            total_bdt=float(base_dec)
        ))

        for core_id in CORE_MODULES:
            entitlements.append(core_id)

        # 2. Student Capacity Charge
        student_dec = cls.calculate_student_charge_decimal(request.student_count)
        if request.student_count > 0:
            effective_avg_dec = _q(student_dec / Decimal(request.student_count))
            line_items.append(LineItemDetail(
                id="student_volume_charge",
                name=f"Active Student Capacity ({request.student_count} students @ avg {float(effective_avg_dec)} BDT)",
                category="students",
                unit_price_bdt=float(effective_avg_dec),
                quantity=request.student_count,
                total_bdt=float(student_dec)
            ))

        # 3. Optional Modules (deduplicated defensively)
        modules_dec = ZERO_DEC
        for mod_id in dict.fromkeys(request.selected_modules):
            if mod_id in OPTIONAL_MODULES:
                mod = OPTIONAL_MODULES[mod_id]
                mod_price = _q(Decimal(str(mod["price_bdt"])))
                modules_dec += mod_price
                entitlements.append(mod_id)
                line_items.append(LineItemDetail(
                    id=mod["id"],
                    name=mod["name"],
                    category="module",
                    unit_price_bdt=float(mod_price),
                    quantity=1,
                    total_bdt=float(mod_price)
                ))

        # 4. Add-ons & Service Usage
        addons_dec = ZERO_DEC
        for addon_id, qty in request.add_ons.items():
            if addon_id in AVAILABLE_ADDONS and qty > 0:
                addon = AVAILABLE_ADDONS[addon_id]
                unit_dec = _q(Decimal(str(addon["unit_price_bdt"])))
                addon_cost_dec = _q(unit_dec * Decimal(int(qty)))
                addons_dec += addon_cost_dec
                line_items.append(LineItemDetail(
                    id=addon["id"],
                    name=f"{addon['name']} (x{qty})",
                    category="addon",
                    unit_price_bdt=float(unit_dec),
                    quantity=qty,
                    total_bdt=float(addon_cost_dec)
                ))

        # Gross Monthly Amount
        monthly_gross_dec = _q(base_dec + student_dec + modules_dec + addons_dec)

        # Billing Cycle & Discount Calculation
        is_annual = (request.billing_cycle.lower() == "annual")
        billing_months = 12 if is_annual else 1
        discount_pct_dec = Decimal(str(ANNUAL_DISCOUNT_PERCENT)) if is_annual else ZERO_DEC

        if is_annual:
            annual_gross_dec = _q(monthly_gross_dec * Decimal("12"))
            discount_amt_dec = _q(annual_gross_dec * (discount_pct_dec / Decimal("100")))
            total_due_dec = _q(annual_gross_dec - discount_amt_dec)
            notes.append(f"Annual billing applied: 15% discount saved {float(discount_amt_dec):,.2f} BDT.")
        else:
            discount_amt_dec = ZERO_DEC
            total_due_dec = monthly_gross_dec

        monthly_net_dec = _q(total_due_dec / Decimal(billing_months))

        if is_pilot:
            notes.append("Approved Pilot Institution: 60-day complimentary trial applied (0.00 BDT due).")
            total_due_dec = ZERO_DEC
            monthly_net_dec = ZERO_DEC

        return PricingQuoteResponse(
            pricing_version=PRICING_VERSION,
            is_owner_approved=IS_OWNER_APPROVED,
            institution_type=request.institution_type,
            student_count=request.student_count,
            billing_cycle=request.billing_cycle,
            base_platform_fee_bdt=float(base_dec),
            student_charge_bdt=float(student_dec),
            modules_subtotal_bdt=float(modules_dec),
            addons_subtotal_bdt=float(addons_dec),
            monthly_gross_bdt=float(monthly_gross_dec),
            discount_percent=float(discount_pct_dec),
            discount_amount_bdt=float(discount_amt_dec),
            monthly_net_bdt=float(monthly_net_dec),
            total_due_bdt=float(total_due_dec),
            billing_period_months=billing_months,
            line_items=line_items,
            entitlements_granted=entitlements,
            is_complimentary_pilot=is_pilot,
            notes=notes
        )
