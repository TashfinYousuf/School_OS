"""storage_auth_security_and_outbox

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-11-17 02:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f8a9b0c1d2e3'
down_revision: Union[str, Sequence[str], None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"
    existing_tables = set()
    user_cols = []
    try:
        insp = sa.inspect(bind)
        if insp:
            existing_tables = set(insp.get_table_names())
            if 'users' in existing_tables:
                user_cols = [c['name'] for c in insp.get_columns('users')]
    except Exception:
        pass

    # 1. Add security and MFA columns to users table
    with op.batch_alter_table('users') as batch_op:
        if 'is_email_verified' not in user_cols:
            batch_op.add_column(sa.Column('is_email_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')))
        if 'mfa_enabled' not in user_cols:
            batch_op.add_column(sa.Column('mfa_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')))
        if 'mfa_totp_secret' not in user_cols:
            batch_op.add_column(sa.Column('mfa_totp_secret', sa.String(length=255), nullable=True))
        if 'mfa_recovery_codes' not in user_cols:
            batch_op.add_column(sa.Column('mfa_recovery_codes', postgresql.JSONB(astext_type=sa.Text()) if is_pg else sa.JSON(), nullable=True))

    # 2. Create uploaded_assets table
    if 'uploaded_assets' not in existing_tables:
        op.create_table(
            'uploaded_assets',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('tenant_id', sa.String(length=64), nullable=False),
            sa.Column('category', sa.String(length=64), nullable=False),
            sa.Column('storage_provider', sa.String(length=32), server_default='r2', nullable=False),
            sa.Column('storage_key', sa.String(length=512), nullable=False),
            sa.Column('file_name', sa.String(length=255), nullable=False),
            sa.Column('file_type', sa.String(length=32), nullable=False),
            sa.Column('mime_type', sa.String(length=128), nullable=False),
            sa.Column('file_size_bytes', sa.BigInteger(), nullable=False),
            sa.Column('sha256_checksum', sa.String(length=64), nullable=False),
            sa.Column('is_public', sa.Boolean(), server_default=sa.text('false'), nullable=False),
            sa.Column('uploaded_by_user_id', sa.String(length=64), nullable=True),
            sa.Column('metadata_payload', postgresql.JSONB(astext_type=sa.Text()) if is_pg else sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('storage_key', name='uq_uploaded_assets_storage_key')
        )
        op.create_index(op.f('ix_uploaded_assets_id'), 'uploaded_assets', ['id'], unique=False)
        op.create_index(op.f('ix_uploaded_assets_tenant_id'), 'uploaded_assets', ['tenant_id'], unique=False)
        op.create_index(op.f('ix_uploaded_assets_category'), 'uploaded_assets', ['category'], unique=False)
        op.create_index(op.f('ix_uploaded_assets_sha256_checksum'), 'uploaded_assets', ['sha256_checksum'], unique=False)
        op.create_index('ix_uploaded_assets_tenant_category', 'uploaded_assets', ['tenant_id', 'category'], unique=False)

    # 3. Create password_reset_tokens table
    if 'password_reset_tokens' not in existing_tables:
        op.create_table(
            'password_reset_tokens',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('tenant_id', sa.String(length=64), nullable=False),
            sa.Column('user_id', sa.UUID(), nullable=False),
            sa.Column('token_hash', sa.String(length=64), nullable=False),
            sa.Column('is_consumed', sa.Boolean(), server_default=sa.text('false'), nullable=False),
            sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('token_hash', name='uq_password_reset_tokens_token_hash')
        )
        op.create_index(op.f('ix_password_reset_tokens_id'), 'password_reset_tokens', ['id'], unique=False)
        op.create_index(op.f('ix_password_reset_tokens_tenant_id'), 'password_reset_tokens', ['tenant_id'], unique=False)
        op.create_index(op.f('ix_password_reset_tokens_user_id'), 'password_reset_tokens', ['user_id'], unique=False)
        op.create_index(op.f('ix_password_reset_tokens_expires_at'), 'password_reset_tokens', ['expires_at'], unique=False)

    # 4. Create email_verification_tokens table
    if 'email_verification_tokens' not in existing_tables:
        op.create_table(
            'email_verification_tokens',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('tenant_id', sa.String(length=64), nullable=False),
            sa.Column('user_id', sa.UUID(), nullable=False),
            sa.Column('token_hash', sa.String(length=64), nullable=False),
            sa.Column('otp_code', sa.String(length=16), nullable=True),
            sa.Column('is_consumed', sa.Boolean(), server_default=sa.text('false'), nullable=False),
            sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('token_hash', name='uq_email_verification_tokens_token_hash')
        )
        op.create_index(op.f('ix_email_verification_tokens_id'), 'email_verification_tokens', ['id'], unique=False)
        op.create_index(op.f('ix_email_verification_tokens_tenant_id'), 'email_verification_tokens', ['tenant_id'], unique=False)
        op.create_index(op.f('ix_email_verification_tokens_user_id'), 'email_verification_tokens', ['user_id'], unique=False)
        op.create_index(op.f('ix_email_verification_tokens_otp_code'), 'email_verification_tokens', ['otp_code'], unique=False)

    # 5. Create user_webauthn_credentials table
    if 'user_webauthn_credentials' not in existing_tables:
        op.create_table(
            'user_webauthn_credentials',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('tenant_id', sa.String(length=64), nullable=False),
            sa.Column('user_id', sa.UUID(), nullable=False),
            sa.Column('credential_id', sa.String(length=255), nullable=False),
            sa.Column('public_key', sa.String(length=1024), nullable=False),
            sa.Column('counter', sa.String(length=64), server_default='0', nullable=False),
            sa.Column('credential_name', sa.String(length=100), server_default='Passkey', nullable=False),
            sa.Column('aaguid', sa.String(length=64), nullable=True),
            sa.Column('sign_count', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('credential_id', name='uq_webauthn_credential_id')
        )
        op.create_index(op.f('ix_user_webauthn_credentials_id'), 'user_webauthn_credentials', ['id'], unique=False)
        op.create_index(op.f('ix_user_webauthn_credentials_tenant_id'), 'user_webauthn_credentials', ['tenant_id'], unique=False)
        op.create_index(op.f('ix_user_webauthn_credentials_user_id'), 'user_webauthn_credentials', ['user_id'], unique=False)

    # 6. Create notification_outbox table
    if 'notification_outbox' not in existing_tables:
        op.create_table(
            'notification_outbox',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('tenant_id', sa.String(length=64), nullable=False),
            sa.Column('channel', sa.String(length=32), nullable=False),
            sa.Column('recipient', sa.String(length=255), nullable=False),
            sa.Column('subject', sa.String(length=255), nullable=True),
            sa.Column('body', sa.Text(), nullable=False),
            sa.Column('status', sa.String(length=32), server_default='PENDING', nullable=False),
            sa.Column('retry_count', sa.Integer(), server_default='0', nullable=False),
            sa.Column('max_retries', sa.Integer(), server_default='3', nullable=False),
            sa.Column('next_retry_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('provider', sa.String(length=32), nullable=True),
            sa.Column('provider_message_id', sa.String(length=255), nullable=True),
            sa.Column('metadata_payload', postgresql.JSONB(astext_type=sa.Text()) if is_pg else sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_notification_outbox_id'), 'notification_outbox', ['id'], unique=False)
        op.create_index(op.f('ix_notification_outbox_tenant_id'), 'notification_outbox', ['tenant_id'], unique=False)
        op.create_index(op.f('ix_notification_outbox_status'), 'notification_outbox', ['status'], unique=False)
        op.create_index('ix_notification_outbox_tenant_status', 'notification_outbox', ['tenant_id', 'status'], unique=False)
        op.create_index('ix_notification_outbox_pending_dispatch', 'notification_outbox', ['status', 'next_retry_at'], unique=False)

    # 7. Apply Row Level Security (RLS) for PostgreSQL
    if is_pg:
        for tbl in ['uploaded_assets', 'password_reset_tokens', 'email_verification_tokens', 'user_webauthn_credentials', 'notification_outbox']:
            op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY;")
            op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY;")
            op.execute(f"DROP POLICY IF EXISTS tenant_isolation_{tbl} ON {tbl};")
            op.execute(f"""
                CREATE POLICY tenant_isolation_{tbl} ON {tbl}
                FOR ALL
                USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
                WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
            """)
        # Allow public read on uploaded_assets if is_public = true
        op.execute("DROP POLICY IF EXISTS public_select_uploaded_assets ON uploaded_assets;")
        op.execute("""
            CREATE POLICY public_select_uploaded_assets ON uploaded_assets
            FOR SELECT
            USING (is_public = TRUE);
        """)


def downgrade() -> None:
    op.drop_table('notification_outbox')
    op.drop_table('user_webauthn_credentials')
    op.drop_table('email_verification_tokens')
    op.drop_table('password_reset_tokens')
    op.drop_table('uploaded_assets')
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('mfa_recovery_codes')
        batch_op.drop_column('mfa_totp_secret')
        batch_op.drop_column('mfa_enabled')
        batch_op.drop_column('is_email_verified')

