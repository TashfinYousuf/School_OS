import datetime
import os
import shutil
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
from app.core.db_url import migration_url  # noqa: E402

if not shutil.which("pg_dump"):
    sys.exit("pg_dump nei: brew install libpq, tarpor brew link --force libpq")

url = migration_url()
out_dir = BACKEND / "backups"
out_dir.mkdir(exist_ok=True)
out = out_dir / f"{url.database}_{datetime.datetime.now():%Y%m%d_%H%M%S}.dump"

env = {**os.environ, "PGPASSWORD": url.password or "", "PGSSLMODE": "require"}
subprocess.run(
    ["pg_dump", "-h", url.host, "-p", str(url.port or 5432), "-U", url.username, "-d", url.database,
     "--schema=public", "--no-owner", "--no-privileges", "-Fc", "-f", str(out)],
    env=env, check=True,
)
out.chmod(0o600)
print(f"backup: {out}")