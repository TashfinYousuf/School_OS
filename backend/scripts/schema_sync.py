# backend/scripts/schema_sync.py
"""
Model-e ache kintu DB-te nei: ber kore.
  python scripts/schema_sync.py                  -> plan + SQL print (DB te kichu bodlay na)
  python scripts/schema_sync.py --out sync.sql   -> SQL file e likhe
  python scripts/schema_sync.py --create-tables  -> shudhu MISSING TABLE banay (additive)
Type/nullability mismatch ar FK auto-fix kore na: oigulo manual decision.
"""
import decimal
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import Enum, inspect
from sqlalchemy.sql.elements import TextClause

import app.main  # noqa: F401  (shob model register hoy)
from app.core.database import engine
from app.models.base import Base


def literal(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float, decimal.Decimal)):
        return str(v)
    if isinstance(v, str):
        return "'" + v.replace("'", "''") + "'"
    return None


def static_default(col):
    sd = col.server_default
    if sd is not None and getattr(sd, "arg", None) is not None:
        arg = sd.arg
        if isinstance(arg, str):
            return literal(arg)
        if isinstance(arg, TextClause):
            return arg.text
        try:
            return str(arg.compile(dialect=engine.dialect))
        except Exception:
            return None
    d = col.default
    if d is None:
        return None
    if getattr(d, "is_scalar", False):
        return literal(d.arg)
    if getattr(d, "is_clause_element", False):
        try:
            return str(d.arg.compile(dialect=engine.dialect))
        except Exception:
            return None
    if getattr(d, "is_callable", False) and col.name.endswith("_at") and "DATE" in type(col.type).__name__.upper():
        return "now()"
    return None


insp = inspect(engine)
live = set(insp.get_table_names())
missing_tables = [t.name for t in Base.metadata.sorted_tables if t.name not in live]

if "--create-tables" in sys.argv:
    if not missing_tables:
        sys.exit("Kono missing table nei.")
    print("Create hobe:", ", ".join(missing_tables))
    if input("Type 'yes' to continue: ").strip().lower() != "yes":
        sys.exit("Cancelled.")
    Base.metadata.create_all(
        bind=engine, tables=[Base.metadata.tables[n] for n in missing_tables], checkfirst=True)
    sys.exit("Done. Ekhon `python scripts/schema_drift.py` chalao.")

out, todo = ["begin;"], []
for table in Base.metadata.sorted_tables:
    if table.name in missing_tables:
        continue
    live_cols = {c["name"] for c in insp.get_columns(table.name)}
    for col in table.columns:
        if col.name in live_cols:
            continue
        t, c = table.name, col.name
        if isinstance(col.type, Enum):
            todo.append(f"{t}.{c}: Enum column. Age CREATE TYPE, tarpor column haate add koro")
            continue
        try:
            ddl_type = col.type.compile(dialect=engine.dialect)
        except Exception as exc:
            todo.append(f"{t}.{c}: type compile hoyni ({exc})")
            continue
        out.append(f'ALTER TABLE "{t}" ADD COLUMN IF NOT EXISTS "{c}" {ddl_type};')
        default = static_default(col)
        if default is not None:
            out.append(f'UPDATE "{t}" SET "{c}" = {default} WHERE "{c}" IS NULL;')
            out.append(f'ALTER TABLE "{t}" ALTER COLUMN "{c}" SET DEFAULT {default};')
        if not col.nullable:
            if default is not None:
                out.append(f'ALTER TABLE "{t}" ALTER COLUMN "{c}" SET NOT NULL;')
            else:
                todo.append(f"{t}.{c}: model NOT NULL kintu static default nei. Backfill value thik kore shesh e SET NOT NULL")
out.append("commit;")

sql = "\n".join(out) if len(out) > 2 else "-- kono missing column nei"
header = "-- MISSING TABLES (alada: --create-tables diye banao): " + (", ".join(missing_tables) or "none")
if "--out" in sys.argv:
    path = sys.argv[sys.argv.index("--out") + 1]
    open(path, "w").write(header + "\n" + sql + "\n")
    print("likhlam:", path)
else:
    print(header + "\n" + sql)
if todo:
    print("\n-- MANUAL DECISION LAGBE:")
    for item in todo:
        print("--  ", item)