# NOTICES API 500 ROOT CAUSE AND RESOLUTION REPORT (DEF-11)

## 1. Incident Overview
- **Observed Defect:** `GET /api/v1/notices/` returned HTTP 500 (Internal Server Error) during manual testing, while the CORS preflight `OPTIONS` request succeeded with HTTP 200.
- **Defect Classification:** Pydantic `ResponseValidationError` triggered during response model serialization on FastAPI response delivery.

## 2. Root Cause Analysis
1. **Schema vs Database Nullability Mismatch:**
   - In `NoticeResponse` (`backend/app/schemas/notice.py`), `published_at` was defined as non-optional `published_at: datetime`.
   - In `Notice` model (`backend/app/models/notice.py`), `published_at` is nullable (`Column(DateTime(timezone=True), default=func.now())`). Notices drafted or inserted via alternate pathways without explicit `published_at` stored NULL in PostgreSQL.
   - Pydantic strictly raised a validation error when serializing records with `published_at=None`.
2. **Missing Content Attribute Fallback:**
   - `NoticeBase` required `content: str = Field(..., min_length=5)`.
   - Notices saved by the AI composer or legacy records stored text in `official_notice` while `content` was NULL or empty.
   - Attempting to serialize `content=None` triggered Pydantic validation failure.
3. **Audience Regex Case Sensitivity:**
   - `NoticeBase` enforced `pattern="^(ALL|PARENTS|TEACHERS|STUDENTS)$"`.
   - Any database record containing mixed-case values (e.g. `"All"`, `"Parents"`) failed the regex validator.
4. **FastAPI Error Masking:**
   - In FastAPI, any unhandled validation exception occurring on the return path from the route handler is treated as an internal server error (HTTP 500) rather than a client 422 error. The OPTIONS preflight passed because it only resolves CORS headers and never triggers endpoint serialization.

## 3. Implemented Fixes
1. **Defensive Schema Validation (`backend/app/schemas/notice.py`):**
   - Changed `published_at: Optional[datetime] = None` and `created_at: Optional[datetime] = None`.
   - Changed `content: Optional[str] = ""` with `@field_validator("content", mode="before")` falling back to empty string instead of failing.
   - Replaced strict regex with `@field_validator("target_audience", mode="before")` which normalizes input strings to uppercase and safely falls back to `"ALL"`.
2. **Defensive Database Queries (`backend/app/api/endpoints/notices.py`):**
   - Updated `is_published` and `expiry_date` filters to use SQL idioms (`Notice.is_published.is_(True)` and `Notice.expiry_date.is_(None)`).
   - Applied `func.upper(Notice.target_audience)` to prevent case-sensitivity misses in SQL filters.
   - Added content backfill (`n.content = n.official_notice` if content is empty) prior to serialization.
3. **Frontend Dialog Upgrade:**
   - Upgraded Notice Board modal dialogs to `ResponsiveDialog` (`frontend/app/dashboard/notices/page.tsx`), adding backdrop click dismissal, keyboard Escape closing, and mobile responsive constraints.

