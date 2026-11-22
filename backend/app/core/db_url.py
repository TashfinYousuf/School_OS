import os

from sqlalchemy.engine import URL, make_url

from app.core.config import settings


def migration_url() -> URL:
    raw = os.getenv("ALEMBIC_DATABASE_URL") or getattr(settings, "DATABASE_URL", None) or os.getenv("DATABASE_URL")
    if not raw:
        raise RuntimeError("DATABASE_URL / ALEMBIC_DATABASE_URL set kora nei")
    url = make_url(raw)
    if (url.host or "").endswith(".pooler.supabase.com") and url.port == 6543:
        url = url.set(port=5432)          # DDL er jonno session mode lage, transaction pooler na
    return url