# app/services/institution.py
import threading, time, uuid
from sqlalchemy.orm import Session
from app.models.tenant import SchoolProfile, Tenant
from app.schemas.institution import InstitutionProfile

DEFAULT_NAME = "Your School"        # neutral; kokhono onno tenant er nam na
_TTL = 60
_cache: dict = {}
_lock = threading.Lock()

def invalidate_institution_cache(tenant_id) -> None:
    with _lock:
        _cache.pop(str(tenant_id), None)

def get_institution_profile(db: Session, tenant_id) -> InstitutionProfile:
    tid = str(tenant_id)
    now = time.monotonic()
    with _lock:
        hit = _cache.get(tid)
        if hit and now - hit[0] < _TTL:
            return hit[1]

    sp = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == tid).first()
    try:
        tenant = db.query(Tenant).filter(Tenant.id == uuid.UUID(tid)).first()
    except ValueError:
        tenant = None

    profile = InstitutionProfile(
        tenant_id=tid,
        name=((sp.school_name if sp else None) or (getattr(tenant, "school_name", None)) or DEFAULT_NAME).strip(),
        address=getattr(sp, "address", None),
        phone=getattr(sp, "contact_phone", None),
        email=getattr(sp, "contact_email", None),
        academic_year=getattr(sp, "academic_year", None),
        school_code=getattr(tenant, "domain", None),
        logo_url=getattr(sp, "logo_url", None),
        tagline=getattr(sp, "tagline", None),
        eiin_or_code=getattr(sp, "eiin_or_code", None),
    )
    with _lock:
        _cache[tid] = (now, profile)
    return profile