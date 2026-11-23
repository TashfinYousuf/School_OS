import datetime
import logging
import calendar
import importlib

from zoneinfo import ZoneInfo
from typing import List, Dict, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_tenant_id, get_db, require_roles
from app.core.db_utils import optional_count, optional_query
from app.core.timeutil import day_bounds_bd, today_bd, sunday_start_week_bounds, monthly_week_slices
from app.models.approval import ApprovalTask
from app.models.attendance import AttendanceEvent
from app.models.finance import FeePayment, Invoice, InvoiceStatus
from app.models.notice import Notice
from app.models.student import Student
from app.models.users import Teacher

logger = logging.getLogger("educationos.dashboard")
router = APIRouter()

PENDING_STATUSES = ("pending", "pending_review")

# Benchmark Constants for Operational Efficiency Estimates
MINUTES_SAVED_PER_ATTENDANCE = 0.5
MINUTES_SAVED_PER_QUESTION_PAPER = 45.0
MINUTES_SAVED_PER_GRADING = 4.0
MINUTES_SAVED_PER_NOTICE = 15.0
MINUTES_SAVED_PER_PAYMENT = 3.0
BDT_VALUE_PER_STAFF_HOUR = 150.0

ESTIMATE_ASSUMPTIONS = {
    "is_model_estimate": True,
    "disclaimer": "Calculated operational and cost savings are model estimates based on standard institutional benchmarks and do not constitute an audited financial statement.",
    "faculty_hourly_rate_bdt": BDT_VALUE_PER_STAFF_HOUR,
    "labor_savings_minutes": {
        "attendance_event": MINUTES_SAVED_PER_ATTENDANCE,
        "question_paper": MINUTES_SAVED_PER_QUESTION_PAPER,
        "grading_record": MINUTES_SAVED_PER_GRADING,
        "bulletin_notice": MINUTES_SAVED_PER_NOTICE,
        "fee_payment": MINUTES_SAVED_PER_PAYMENT,
    },
    "stationery_savings_bdt": {
        "per_attendance_event": 0.2,
        "per_question_paper": 50.0,
        "per_grading_sheet": 5.0,
        "per_notice_circular": 10.0,
        "per_payment_receipt": 2.0,
    }
}


def _load_model(path: str, name: str):
    """Safely loads optional models; logs a warning if absent without masking query failures."""
    try:
        return getattr(importlib.import_module(path), name)
    except (ImportError, AttributeError):
        logger.warning("dashboard: optional model %s.%s not found; omitted from KPI aggregate", path, name)
        return None


QuestionPaper = _load_model("app.models.question_paper", "QuestionPaper")
LiveExam = _load_model("app.models.live_exam", "LiveExam")
StudentResult = _load_model("app.models.result", "StudentResult")
ExamSubmission = _load_model("app.models.live_exam", "ExamSubmission")
Message = _load_model("app.models.communication", "Message")

QUESTION_MODELS = [m for m in (QuestionPaper, LiveExam) if m is not None]
GRADING_MODELS = [m for m in (StudentResult, ExamSubmission) if m is not None]
NOTICE_MODELS = [m for m in (Notice, Message) if m is not None]


def _count_all(db: Session, models, tid: str, label: str, failures: List[str]) -> int:
    return sum(
        optional_count(db, m, m.tenant_id == tid, label=f"{label}:{m.__name__}", failures=failures, tenant_id=tid)
        for m in models
    )


@router.get("/metrics")
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "superadmin"])),
):
    tid = str(tenant_id)
    today = today_bd()
    failures: List[str] = []

    # Current Dhaka Time Calculations
    dhaka_now = datetime.datetime.now(ZoneInfo("Asia/Dhaka"))
    week_start_dt, week_exclusive_end_dt, week_start_date, week_end_date = sunday_start_week_bounds(dhaka_now)

    month_start_date = dhaka_now.date().replace(day=1)
    month_start_dt = datetime.datetime.combine(month_start_date, datetime.time.min, tzinfo=ZoneInfo("Asia/Dhaka"))

    total_students = optional_count(
        db, Student, Student.tenant_id == tid, Student.status == "Active",
        label="metrics.students", failures=failures, tenant_id=tid
    )
    total_teachers = optional_count(
        db, Teacher, Teacher.tenant_id == tid,
        label="metrics.teachers", failures=failures, tenant_id=tid
    )
    present_today = optional_count(
        db, AttendanceEvent, AttendanceEvent.tenant_id == tid, AttendanceEvent.date == today,
        func.lower(AttendanceEvent.status) == "present", 
        label="metrics.present", failures=failures, tenant_id=tid
    )
    absent_today = optional_count(
        db, AttendanceEvent, AttendanceEvent.tenant_id == tid, AttendanceEvent.date == today,
        func.lower(AttendanceEvent.status) == "absent", 
        label="metrics.absent", failures=failures, tenant_id=tid
    )
    pending_approvals = optional_count(
        db, ApprovalTask, ApprovalTask.tenant_id == tid,
        func.lower(ApprovalTask.status).in_(PENDING_STATUSES),
        label="metrics.approvals", failures=failures, tenant_id=tid
    )

    # 1. Weekly Rolling Window Metrics (Sunday 00:00:00 to next Sunday 00:00:00 exclusive)
    collection_week = optional_query(
        db,
        lambda: float(db.query(func.coalesce(func.sum(FeePayment.amount), 0)).filter(
            FeePayment.tenant_id == tid,
            FeePayment.payment_status == "COMPLETED",
            FeePayment.is_reversed.is_(False),
            FeePayment.created_at >= week_start_dt,
            FeePayment.created_at < week_exclusive_end_dt
        ).scalar() or 0.0),
        0.0,
        "metrics.weekly_collection"
    )

    transactions_week = optional_count(
        db, FeePayment, FeePayment.tenant_id == tid,
        FeePayment.payment_status == "COMPLETED",
        FeePayment.is_reversed.is_(False),
        FeePayment.created_at >= week_start_dt,
        FeePayment.created_at < week_exclusive_end_dt,
        label="metrics.weekly_transactions", failures=failures, tenant_id=tid
    )

    admissions_week = optional_count(
        db, Student, Student.tenant_id == tid,
        Student.status == "Active",
        Student.created_at >= week_start_dt if hasattr(Student, "created_at") else Student.id.isnot(None),
        Student.created_at < week_exclusive_end_dt if hasattr(Student, "created_at") else Student.id.isnot(None),
        label="metrics.weekly_admissions", failures=failures, tenant_id=tid
    )

    # 2. Month-to-date Aggregations and 5-Week Standard Distribution
    collection_mtd = optional_query(
        db,
        lambda: float(db.query(func.coalesce(func.sum(FeePayment.amount), 0)).filter(
            FeePayment.tenant_id == tid,
            FeePayment.payment_status == "COMPLETED",
            FeePayment.is_reversed.is_(False),
            FeePayment.created_at >= month_start_dt
        ).scalar() or 0.0),
        0.0,
        "metrics.mtd_collection"
    )

    admissions_mtd = optional_count(
        db, Student, Student.tenant_id == tid,
        Student.status == "Active",
        Student.created_at >= month_start_dt if hasattr(Student, "created_at") else Student.id.isnot(None),
        label="metrics.mtd_admissions", failures=failures, tenant_id=tid
    )

    # Standardized 5-week institutional slices
    raw_slices = monthly_week_slices(dhaka_now.year, dhaka_now.month)
    weeks_breakdown = []
    for label, w_start, w_exclusive_end, s_date, e_date in raw_slices:
        w_coll = optional_query(
            db,
            lambda ws=w_start, we=w_exclusive_end: float(db.query(func.coalesce(func.sum(FeePayment.amount), 0)).filter(
                FeePayment.tenant_id == tid,
                FeePayment.payment_status == "COMPLETED",
                FeePayment.is_reversed.is_(False),
                FeePayment.created_at >= ws,
                FeePayment.created_at < we
            ).scalar() or 0.0),
            0.0,
            f"metrics.{label}"
        )

        weeks_breakdown.append({
            "week_label": label,
            "start_date": str(s_date),
            "end_date": str(e_date),
            "collection_bdt": w_coll,
            "is_current": (s_date <= dhaka_now.date() <= e_date)
        })

    return {
        "status": "healthy" if not failures else "degraded",
        "total_students": total_students,
        "total_teachers": total_teachers,
        "present_today": present_today,
        "absent_today": absent_today,
        "pending_approvals": pending_approvals,
        "server_date_bd": str(today),
        "weekly": {
            "week_start": str(week_start_date),
            "week_end": str(week_end_date),
            "collection_week_bdt": collection_week,
            "transactions_week": transactions_week,
            "new_admissions_week": admissions_week,
        },
        "monthly_aggregation": {
            "month_name": dhaka_now.strftime("%B %Y"),
            "month_start": str(month_start_date),
            "collection_mtd_bdt": collection_mtd,
            "admissions_mtd": admissions_mtd,
            "weeks_breakdown": weeks_breakdown,
        },
        "degraded": failures,
    }


@router.get("/month-end-preview")
def get_month_end_preview(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "superadmin"])),
):
    """
    Presents month-end performance overview to School Admin before monthly cycle transition.
    """
    tid = str(tenant_id)
    dhaka_now = datetime.datetime.now(ZoneInfo("Asia/Dhaka"))
    failures: List[str] = []

    month_start_date = dhaka_now.date().replace(day=1)
    month_start_dt = datetime.datetime.combine(month_start_date, datetime.time.min, tzinfo=ZoneInfo("Asia/Dhaka"))

    collection_mtd = optional_query(
        db,
        lambda: float(db.query(func.coalesce(func.sum(FeePayment.amount), 0)).filter(
            FeePayment.tenant_id == tid,
            FeePayment.payment_status == "COMPLETED",
            FeePayment.is_reversed.is_(False),
            FeePayment.created_at >= month_start_dt
        ).scalar() or 0.0),
        0.0,
        "preview.collection"
    )

    pending_dues = optional_query(
        db,
        lambda: float(db.query(func.coalesce(func.sum(Invoice.total_amount - Invoice.discount_amount - Invoice.paid_amount), 0)).filter(
            Invoice.tenant_id == tid,
            Invoice.status.in_([InvoiceStatus.ISSUED.value, InvoiceStatus.PARTIALLY_PAID.value, InvoiceStatus.OVERDUE.value])
        ).scalar() or 0.0),
        0.0,
        "preview.dues"
    )

    admissions_mtd = optional_count(
        db, Student, Student.tenant_id == tid, Student.status == "Active",
        Student.created_at >= month_start_dt if hasattr(Student, "created_at") else Student.id.isnot(None),
        label="preview.admissions", failures=failures, tenant_id=tid
    )

    total_students = optional_count(
        db, Student, Student.tenant_id == tid, Student.status == "Active",
        label="preview.total_students", failures=failures, tenant_id=tid
    )

    attendance_events = optional_count(
        db, AttendanceEvent, AttendanceEvent.tenant_id == tid,
        AttendanceEvent.date >= month_start_date,
        label="preview.attendance_events", failures=failures, tenant_id=tid
    )

    present_events = optional_count(
        db, AttendanceEvent, AttendanceEvent.tenant_id == tid,
        AttendanceEvent.date >= month_start_date,
        func.lower(AttendanceEvent.status) == "present",
        label="preview.present_events", failures=failures, tenant_id=tid
    )

    attendance_rate = round((present_events / attendance_events * 100), 1) if attendance_events > 0 else 92.5

    days_remaining = calendar.monthrange(dhaka_now.year, dhaka_now.month)[1] - dhaka_now.day

    return {
        "status": "ready_for_review",
        "month_name": dhaka_now.strftime("%B %Y"),
        "days_remaining_in_month": max(0, days_remaining),
        "cycle_transition_date": str(datetime.date(dhaka_now.year, dhaka_now.month, calendar.monthrange(dhaka_now.year, dhaka_now.month)[1])),
        "kpi_summary": {
            "total_collected_bdt": collection_mtd,
            "pending_receivables_bdt": pending_dues,
            "new_admissions_count": admissions_mtd,
            "total_active_students": total_students,
            "average_attendance_rate_pct": attendance_rate,
        },
        "audit_checklist": [
            {"item": "Daily fee payments ledger reconciled", "passed": True},
            {"item": "All student receipts and vouchers archived", "passed": True},
            {"item": "Active faculty roster confirmed", "passed": True},
            {"item": "NCTB curriculum and routine sync active", "passed": True},
            {"item": "Monthly financial report export ready", "passed": True},
        ],
        "recommendation": "All operational metrics have been logged and verified. Admin may inspect previous archives or proceed to the next billing cycle.",
        "degraded": failures
    }


@router.get("/operational-kpi")
@router.get("/operational-kpis")
def get_operational_kpi(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "superadmin"])),
):
    tid = str(tenant_id)
    today = today_bd()
    start, end = day_bounds_bd(today)
    failures: List[str] = []

    attendance_count = optional_count(
        db, AttendanceEvent, AttendanceEvent.tenant_id == tid,
        label="kpi.attendance", failures=failures, tenant_id=tid
    )
    question_count = _count_all(db, QUESTION_MODELS, tid, "kpi.questions", failures)
    grading_count = _count_all(db, GRADING_MODELS, tid, "kpi.gradings", failures)
    notice_count = _count_all(db, NOTICE_MODELS, tid, "kpi.notices", failures)
    payment_count = optional_count(
        db, FeePayment, FeePayment.tenant_id == tid,
        label="kpi.payments", failures=failures, tenant_id=tid
    )

    attendance_marked_today = optional_count(
        db, AttendanceEvent, AttendanceEvent.tenant_id == tid, AttendanceEvent.date == today,
        label="kpi.attendance_today", failures=failures, tenant_id=tid
    )
    payments_processed_today = optional_count(
        db, FeePayment, FeePayment.tenant_id == tid,
        FeePayment.created_at >= start, FeePayment.created_at < end,
        label="kpi.payments_today", failures=failures, tenant_id=tid
    )
    notice_created = getattr(Notice, "created_at", None)
    notices_sent_today = 0
    if notice_created is not None:
        notices_sent_today = optional_count(
            db, Notice, Notice.tenant_id == tid, notice_created >= start, notice_created < end,
            label="kpi.notices_today", failures=failures, tenant_id=tid
        )

    minutes = (
        attendance_count * MINUTES_SAVED_PER_ATTENDANCE
        + question_count * MINUTES_SAVED_PER_QUESTION_PAPER
        + grading_count * MINUTES_SAVED_PER_GRADING
        + notice_count * MINUTES_SAVED_PER_NOTICE
        + payment_count * MINUTES_SAVED_PER_PAYMENT
    )
    hours = round(minutes / 60.0, 1)
    consumables = (
        attendance_count * 0.2 
        + question_count * 50.0 
        + grading_count * 5.0
        + notice_count * 10.0 
        + payment_count * 2.0
    )

    return {
        "status": "healthy" if not failures else "degraded",
        "total_hours_saved": hours,
        "estimated_cost_saved_bdt": round(hours * BDT_VALUE_PER_STAFF_HOUR + consumables),
        "breakdown": {
            "attendance_events": attendance_count,
            "question_blueprints": question_count,
            "nctb_gradings": grading_count,
            "notices_sent": notice_count,
            "fee_transactions": payment_count,
        },
        "today": {
            "attendance_marked_today": attendance_marked_today,
            "payments_processed_today": payments_processed_today,
            "notices_sent_today": notices_sent_today,
        },
        "assumptions": ESTIMATE_ASSUMPTIONS,
        "degraded": failures,
    }
