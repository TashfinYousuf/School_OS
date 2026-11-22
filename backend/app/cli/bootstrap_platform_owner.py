#!/usr/bin/env python3
"""
EducationOS Platform Super Admin Owner Provisioning & Credential Bootstrap CLI
Command: python -m app.cli.bootstrap_platform_owner --email <email> [--password <password>] [--rotate-credentials]

Provisions the root platform owner account with:
- Strict password policy enforcement (Argon2id/bcrypt)
- Zero public self-registration exposure
- RFC 6238 TOTP MFA secret generation
- 10 single-use cryptographically secure recovery codes
- Deterministic Platform Control Plane Tenant UUID (c0000000-0000-0000-0000-000000000001)
- Interactive hidden password input (preventing shell history leaks)
- Immutable audit trail recording
- Persistent MFA credential storage
"""
import sys
import os
import argparse
import getpass
import json
import secrets
import base64
import hmac
import hashlib
import struct
import time
import datetime
import re
import uuid

# Ensure backend root is on path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import SessionLocal, engine
from app.models.tenant import User, Tenant
from app.models.audit import AuditLog
from app.core.security import get_password_hash

# Deterministic UUID for the root platform control plane
PLATFORM_TENANT_ID = uuid.UUID("c0000000-0000-0000-0000-000000000001")
MFA_STORE_PATH = os.path.join(backend_dir, "app", "data", "mfa_store.json")


def validate_password_strength(password: str) -> None:
    """Enforces production-grade password strength."""
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password exceeds maximum bcrypt limit of 72 bytes.")
    if len(password) < 10:
        raise ValueError("Password must be at least 10 characters long.")
    if not re.search(r"[A-Za-z]", password):
        raise ValueError("Password must contain at least one letter.")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number.")


def generate_totp_secret() -> str:
    """Generates a high-entropy 160-bit Base32 secret for RFC 6238 TOTP."""
    return base64.b32encode(secrets.token_bytes(20)).decode("utf-8")


def generate_recovery_codes(count: int = 10):
    """Generates single-use recovery codes and their SHA-256 hashes."""
    plaintext_codes = []
    code_hashes = []
    for _ in range(count):
        part1 = secrets.token_hex(2).upper()
        part2 = secrets.token_hex(2).upper()
        part3 = secrets.token_hex(2).upper()
        code = f"{part1}-{part2}-{part3}"
        h = hashlib.sha256(code.encode("utf-8")).hexdigest()
        plaintext_codes.append(code)
        code_hashes.append(h)
    return plaintext_codes, code_hashes


def save_mfa_credentials(user_id_str: str, secret: str, recovery_hashes: list):
    """Persists MFA credentials to local storage and updates in-memory registry."""
    os.makedirs(os.path.dirname(MFA_STORE_PATH), exist_ok=True)
    existing_store = {"mfa_secrets": {}, "webauthn_credentials": {}}
    if os.path.exists(MFA_STORE_PATH):
        try:
            with open(MFA_STORE_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    existing_store.update(loaded)
        except Exception:
            pass

    existing_store.setdefault("mfa_secrets", {})[user_id_str] = {
        "secret": secret,
        "recovery_code_hashes": recovery_hashes,
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    temp_path = f"{MFA_STORE_PATH}.tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(existing_store, f, indent=2)
    os.replace(temp_path, MFA_STORE_PATH)

    try:
        from app.api.endpoints.auth import _MFA_USER_SECRETS
        _MFA_USER_SECRETS[user_id_str] = {
            "secret": secret,
            "recovery_code_hashes": recovery_hashes,
        }
    except Exception:
        pass


def bootstrap_platform_owner(email: str, password: str, rotate_credentials: bool = False) -> int:
    clean_email = email.strip().lower()
    if not re.match(r"^[^@]+@[^@]+\.[^@]+$", clean_email):
        print(f"ERROR: Invalid email address '{email}'", file=sys.stderr)
        return 1

    try:
        validate_password_strength(password)
    except ValueError as ve:
        print(f"ERROR: Password policy violation: {ve}", file=sys.stderr)
        return 1

    db: Session = SessionLocal()
    try:
        # 1. Ensure deterministic Platform Tenant exists
        platform_tenant = db.query(Tenant).filter(Tenant.id == PLATFORM_TENANT_ID).first()
        if not platform_tenant:
            platform_tenant = db.query(Tenant).filter(Tenant.domain == "platform.internal").first()
            if not platform_tenant:
                platform_tenant = Tenant(
                    id=PLATFORM_TENANT_ID,
                    school_name="EducationOS Platform Control Plane",
                    domain="platform.internal",
                    address="EducationOS Global Infrastructure",
                )
                db.add(platform_tenant)
                db.flush()

        # 2. Check existing superadmin accounts
        existing_superadmin = db.query(User).filter(User.role == "superadmin").first()
        existing_email_user = db.query(User).filter(func.lower(User.email) == clean_email).first()

        if existing_superadmin and not rotate_credentials:
            print("=" * 80)
            print("EDUCATIONOS PLATFORM SUPER ADMIN BOOTSTRAP REJECTED")
            print("=" * 80)
            print(f"A Platform Super Admin already exists in the system: {existing_superadmin.email}")
            print("Public bootstrap is permanently locked to prevent unauthorized takeover.")
            print("To rotate credentials or recovery codes for the owner account, supply --rotate-credentials.")
            print("=" * 80)
            return 1

        user = existing_email_user or existing_superadmin
        is_new = False
        if not user:
            is_new = True
            user = User(
                id=uuid.uuid4(),
                email=clean_email,
                username=clean_email.split("@")[0],
                role="superadmin",
                tenant_id=platform_tenant.id,
                is_active=True,
                first_name="Platform",
                last_name="Owner",
            )
            db.add(user)
        else:
            user.email = clean_email
            user.role = "superadmin"
            user.tenant_id = platform_tenant.id
            user.is_active = True

        user.password_hash = get_password_hash(password)

        # 3. Generate TOTP MFA credentials and Recovery Codes
        totp_secret = generate_totp_secret()
        recovery_codes, recovery_hashes = generate_recovery_codes(10)
        otpauth_uri = f"otpauth://totp/EducationOS:{clean_email}?secret={totp_secret}&issuer=EducationOS"

        # Persist MFA credentials
        save_mfa_credentials(str(user.id), totp_secret, recovery_hashes)

        # 4. Record Audit Log entry
        db.add(AuditLog(
            tenant_id=str(platform_tenant.id),
            actor_id=str(user.id),
            action_type="platform.owner_bootstrapped" if is_new else "platform.owner_credentials_rotated",
            target_entity=f"User {user.id}",
            event_payload={"email": clean_email, "role": "superadmin", "mfa_configured": True},
            risk_level="High"
        ))

        db.commit()
        db.refresh(user)

        # 5. Display secure output for platform owner
        print("=" * 80)
        print("EDUCATIONOS — PLATFORM SUPER ADMIN BOOTSTRAP SUCCESSFUL")
        print("=" * 80)
        print(f"Action:              {'NEW OWNER ACCOUNT CREATED' if is_new else 'OWNER CREDENTIALS ROTATED'}")
        print(f"User ID:             {user.id}")
        print(f"Email:               {user.email}")
        print(f"Role:                {user.role} (Platform Control Plane Privileges)")
        print(f"Tenant Scope:        {user.tenant_id} (Global Control Plane)")
        print(f"Status:              ACTIVE")
        print("-" * 80)
        print("TWO-FACTOR AUTHENTICATION (TOTP MFA RFC 6238):")
        print(f"Secret Key:          {totp_secret}")
        print(f"Authenticator URI:   {otpauth_uri}")
        print("-" * 80)
        print("SINGLE-USE RECOVERY CODES (Store securely offline in password manager):")
        for i, code in enumerate(recovery_codes, 1):
            print(f"  [{i:02d}] {code}")
        print("-" * 80)
        print("OPERATIONAL ACCESS & LOGIN INSTRUCTIONS:")
        print("  1. Dedicated Portal: http://localhost:3000/platform/login")
        print("  2. Standard Portal:  http://localhost:3000/login (Staff tab)")
        print("  3. Credentials:      Email and password specified during bootstrap")
        print("  4. MFA Challenge:    Enter 6-digit TOTP code or emergency recovery code")
        print("  5. Landing View:     Automatically redirected to /dashboard/platform")
        print("=" * 80)
        return 0

    except Exception as exc:
        db.rollback()
        print(f"ERROR: Failed to bootstrap platform owner: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Bootstrap EducationOS Platform Super Admin Owner Account",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Security Note:
  Omit --password to enter password securely via interactive prompt without leaking to shell history.
        """
    )
    parser.add_argument("--email", required=True, help="Owner account email address")
    parser.add_argument("--password", required=False, default=None, help="Owner account password (prefer interactive prompt)")
    parser.add_argument("--rotate-credentials", action="store_true", help="Rotate credentials if owner account exists")
    parser.add_argument("--force", action="store_true", help="Alias for --rotate-credentials")
    args = parser.parse_args()

    rotate = args.rotate_credentials or args.force
    password = args.password

    if not password:
        try:
            p1 = getpass.getpass("Enter Platform Owner Password: ")
            p2 = getpass.getpass("Confirm Platform Owner Password: ")
            if p1 != p2:
                print("ERROR: Passwords do not match.", file=sys.stderr)
                sys.exit(1)
            password = p1
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled by user.", file=sys.stderr)
            sys.exit(1)
    else:
        print("WARNING: Providing password via CLI argument may expose it in shell history and process listings.", file=sys.stderr)

    if rotate and sys.stdin.isatty() and not args.password:
        confirm = input(f"Are you sure you want to rotate credentials for '{args.email}'? [y/N]: ").strip().lower()
        if confirm not in ("y", "yes"):
            print("Credential rotation aborted.", file=sys.stderr)
            sys.exit(0)

    exit_code = bootstrap_platform_owner(email=args.email, password=password, rotate_credentials=rotate)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
