#!/usr/bin/env python3
"""
OpenAPI Contract Verification Tool for EducationOS.
Enforces API backwards-compatibility:
- A breaking API change (removed route, removed HTTP method) fails.
- Additions need '--update' and display a unified diff.
"""
import sys
import json
import difflib
import argparse
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app

CONTRACT_PATH = backend_dir / "openapi_contract.json"


def get_current_spec() -> dict:
    return app.openapi()


def check_contract(update: bool = False) -> int:
    current_spec = get_current_spec()
    current_json = json.dumps(current_spec, indent=2, sort_keys=True)

    if not CONTRACT_PATH.exists():
        if update:
            with open(CONTRACT_PATH, "w", encoding="utf-8") as f:
                f.write(current_json + "\n")
            print(f"Initialized OpenAPI contract at {CONTRACT_PATH}")
            return 0
        else:
            print(f"FAIL: Contract file {CONTRACT_PATH} does not exist. Run with --update to create it.")
            return 1

    with open(CONTRACT_PATH, "r", encoding="utf-8") as f:
        recorded_spec = json.load(f)

    # Detect breaking changes
    breaking_errors = []

    # 1. Removed paths or methods
    old_paths = recorded_spec.get("paths", {})
    new_paths = current_spec.get("paths", {})
    for path, methods in old_paths.items():
        if path not in new_paths:
            breaking_errors.append(f"REMOVED PATH: {path}")
        else:
            for method in methods:
                if method.lower() in ["get", "post", "put", "delete", "patch"] and method not in new_paths[path]:
                    breaking_errors.append(f"REMOVED METHOD: {method.upper()} {path}")

    recorded_json = json.dumps(recorded_spec, indent=2, sort_keys=True)

    if breaking_errors:
        print("FAIL: Breaking API changes detected:")
        for err in breaking_errors:
            print(f"  - {err}")
        return 1

    if recorded_json == current_json:
        print("OK: OpenAPI contract matches recorded specification (no diff).")
        return 0

    diff = list(
        difflib.unified_diff(
            recorded_json.splitlines(keepends=True),
            current_json.splitlines(keepends=True),
            fromfile="openapi_contract.json",
            tofile="current_spec.json",
            n=3,
        )
    )

    if update:
        print("OpenAPI Contract Changes Detected:")
        sys.stdout.writelines(diff)
        with open(CONTRACT_PATH, "w", encoding="utf-8") as f:
            f.write(current_json + "\n")
        print(f"\nSUCCESS: Updated OpenAPI contract at {CONTRACT_PATH}")
        return 0
    else:
        print("FAIL: OpenAPI spec differs from recorded contract:")
        sys.stdout.writelines(diff)
        print("\nIf these changes are purely additive, accept them by running:")
        print("  python backend/scripts/openapi_contract.py --update")
        return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Check or update OpenAPI contract.")
    parser.add_argument("--update", action="store_true", help="Accept additions and update contract")
    args = parser.parse_args()

    sys.exit(check_contract(update=args.update))
