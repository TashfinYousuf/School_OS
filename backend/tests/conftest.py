import sys
from pathlib import Path
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

# Add backend directory to sys.path so 'app' is always resolvable
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Guarantee SQLite in-memory test compatibility with PostgreSQL JSONB columns
if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"
