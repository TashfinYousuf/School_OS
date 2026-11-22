"""Add extended fields to guardians table

Revision ID: a1b2c3d4e5f6
Revises: f3a1b2c4d5e6
Create Date: 2026-09-05 23:12:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f3a1b2c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add missing columns to guardians table."""
    op.add_column('guardians', sa.Column('phone_number', sa.String(), nullable=True))
    op.add_column('guardians', sa.Column('email', sa.String(), nullable=True))
    op.add_column('guardians', sa.Column('profession', sa.String(), nullable=True))
    op.add_column('guardians', sa.Column('nid_number', sa.String(), nullable=True))
    op.create_index(op.f('ix_guardians_phone_number'), 'guardians', ['phone_number'], unique=False)


def downgrade() -> None:
    """Remove extended guardian columns."""
    op.drop_index(op.f('ix_guardians_phone_number'), table_name='guardians')
    op.drop_column('guardians', 'nid_number')
    op.drop_column('guardians', 'profession')
    op.drop_column('guardians', 'email')
    op.drop_column('guardians', 'phone_number')
