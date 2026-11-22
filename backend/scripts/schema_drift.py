# backend/scripts/schema_drift.py  (read-only; DB te kichu bodlay na; issue thakle exit code 1)
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import Enum, inspect
from sqlalchemy.schema import CreateColumn

import app.main  # noqa: F401  (shob router import hoy, tai shob model register hoy)
from app.core.database import engine
from app.models.base import Base


def family(t):
    n = type(t).__name__.upper()
    if "UUID" in n: return "uuid"
    if n in {"STRING", "VARCHAR", "TEXT", "CHAR", "UNICODE", "UNICODETEXT"}: return "text"
    if n in {"INTEGER", "BIGINTEGER", "SMALLINTEGER", "INT", "BIGINT", "SMALLINT"}: return "int"
    if n in {"NUMERIC", "DECIMAL", "FLOAT", "REAL", "DOUBLE_PRECISION", "DOUBLE"}: return "num"
    if n in {"DATETIME", "TIMESTAMP"}: return "timestamp"
    if n == "DATE": return "date"
    if n in {"BOOLEAN", "BOOL"}: return "bool"
    return None


only = set(sys.argv[1:])
unknown = only - set(Base.metadata.tables)
if unknown:
    sys.exit(f"Unknown table(s): {sorted(unknown)}\nAvailable: {sorted(Base.metadata.tables)}")
insp = inspect(engine)
live_tables = set(insp.get_table_names())
issues = 0


def report(msg, fix=None):
    global issues
    issues += 1
    print(f"-- {msg}")
    if fix:
        print(fix)


for table in Base.metadata.sorted_tables:
    if only and table.name not in only:
        continue
    if table.name not in live_tables:
        report(f"MISSING TABLE: {table.name}")
        continue

    live = {c["name"]: c for c in insp.get_columns(table.name)}
    model_cols = {c.name for c in table.columns}

    for col in table.columns:
        if col.name not in live:
            if isinstance(col.type, Enum):
                report(f"MISSING ENUM COLUMN {table.name}.{col.name}: age CREATE TYPE kore nao")
                continue
            ddl = str(CreateColumn(col).compile(dialect=engine.dialect))
            note = ""
            if not col.nullable and col.server_default is None:
                ddl = ddl.replace(" NOT NULL", "")
                note = "   -- model e NOT NULL: backfill kore pore SET NOT NULL"
            report(f"MISSING COLUMN {table.name}.{col.name}",
                   f'ALTER TABLE "{table.name}" ADD COLUMN IF NOT EXISTS {ddl};{note}')
            continue

        lc = live[col.name]
        mf, lf = family(col.type), family(lc["type"])
        if mf and lf and mf != lf:
            if mf == "uuid" and lf == "text":
                report(f"TYPE {table.name}.{col.name}: model=uuid live=text",
                       f'ALTER TABLE "{table.name}" ALTER COLUMN "{col.name}" TYPE uuid USING "{col.name}"::uuid;')
            else:
                report(f"TYPE {table.name}.{col.name}: model={mf} live={lf}   -> DB thik hole MODEL bodlao")

        if col.nullable and not lc["nullable"] and not col.primary_key:
            report(f"NULLABILITY {table.name}.{col.name}: model nullable kintu DB NOT NULL (NULL insert fail korbe)",
                   f'-- ALTER TABLE "{table.name}" ALTER COLUMN "{col.name}" DROP NOT NULL;')

        ml, ll = getattr(col.type, "length", None), getattr(lc["type"], "length", None)
        if ml and ll and ml > ll:
            report(f"LENGTH {table.name}.{col.name}: model={ml} live={ll} (lomba value fail korbe)")

    for name, c in live.items():              # DB te ache, model e nei, NOT NULL: insert fail (students.user_id er moto)
        if name not in model_cols and not c["nullable"] and c.get("default") is None and not c.get("identity"):
            report(f"LIVE-ONLY NOT NULL {table.name}.{name}: model e nei, insert fail korbe")

print(f"\n{issues} issue(s)." + ("  DDL gulo Supabase SQL Editor e porkhe chalao." if issues else "  Schema mile gache."))
sys.exit(1 if issues else 0)
