import calendar
import datetime
from typing import List, Tuple, Optional
from zoneinfo import ZoneInfo

BD_TZ = ZoneInfo("Asia/Dhaka")


def now_bd() -> datetime.datetime:
    """Returns current localized timestamp in Asia/Dhaka."""
    return datetime.datetime.now(BD_TZ)


def today_bd() -> datetime.date:
    """Returns current date in Asia/Dhaka."""
    return datetime.datetime.now(BD_TZ).date()


def day_bounds_bd(day: datetime.date) -> Tuple[datetime.datetime, datetime.datetime]:
    """Returns start and end boundaries for a date in Asia/Dhaka."""
    start = datetime.datetime.combine(day, datetime.time.min, tzinfo=BD_TZ)
    return start, start + datetime.timedelta(days=1)


def sunday_start_week_bounds(dt: Optional[datetime.datetime] = None) -> Tuple[datetime.datetime, datetime.datetime, datetime.date, datetime.date]:
    """
    Computes strict Sunday-to-Saturday week boundary in Asia/Dhaka.
    Returns (week_start_dt, week_exclusive_end_dt, week_start_date, week_end_date).
    - week_start_dt: Sunday 00:00:00 (inclusive lower bound)
    - week_exclusive_end_dt: Next Sunday 00:00:00 (exclusive upper bound for created_at < end_dt)
    - week_start_date: Sunday date
    - week_end_date: Saturday date (inclusive end date for UI display)
    Example: On Sunday Nov 15, 2026 -> Start: Nov 15 00:00:00, Display End: Nov 21, Exclusive Upper: Nov 22 00:00:00.
    """
    ref_dt = dt or now_bd()
    if ref_dt.tzinfo is None:
        ref_dt = ref_dt.replace(tzinfo=BD_TZ)
    else:
        ref_dt = ref_dt.astimezone(BD_TZ)

    # In Python, Monday is 0 and Sunday is 6.
    # To make Sunday 0: (weekday + 1) % 7
    days_since_sunday = (ref_dt.weekday() + 1) % 7
    week_start_date = (ref_dt - datetime.timedelta(days=days_since_sunday)).date()
    week_end_date = week_start_date + datetime.timedelta(days=6)
    next_sunday_date = week_start_date + datetime.timedelta(days=7)

    week_start_dt = datetime.datetime.combine(week_start_date, datetime.time.min, tzinfo=BD_TZ)
    week_exclusive_end_dt = datetime.datetime.combine(next_sunday_date, datetime.time.min, tzinfo=BD_TZ)
    return week_start_dt, week_exclusive_end_dt, week_start_date, week_end_date


def monthly_week_slices(year: int, month: int) -> List[Tuple[str, datetime.datetime, datetime.datetime, datetime.date, datetime.date]]:
    """
    Splits an institutional reporting month into actual calendar week slices (Sunday-start):
    - Week 1 begins on Day 1 of the month and extends to the first Saturday (or month end).
    - Subsequent weeks start on each Sunday and end on the following Saturday (or month end).
    Returns list of tuples: (label, start_dt, exclusive_end_dt, start_date, end_date).
    Upper bound datetime is strictly exclusive (< exclusive_end_dt) to prevent edge collision.
    """
    _, last_day_num = calendar.monthrange(year, month)
    first_day = datetime.date(year, month, 1)
    last_day = datetime.date(year, month, last_day_num)

    results = []
    curr_start = first_day
    week_idx = 1

    while curr_start <= last_day:
        # Days from current start to next Saturday (Saturday is weekday 5)
        days_to_sat = (5 - curr_start.weekday()) % 7
        candidate_end = curr_start + datetime.timedelta(days=days_to_sat)
        curr_end = min(candidate_end, last_day)

        start_dt = datetime.datetime.combine(curr_start, datetime.time.min, tzinfo=BD_TZ)
        exclusive_end_date = curr_end + datetime.timedelta(days=1)
        exclusive_end_dt = datetime.datetime.combine(exclusive_end_date, datetime.time.min, tzinfo=BD_TZ)

        label = f"Week {week_idx} (Days {curr_start.day}–{curr_end.day})"
        results.append((label, start_dt, exclusive_end_dt, curr_start, curr_end))

        curr_start = curr_end + datetime.timedelta(days=1)
        week_idx += 1

    return results
