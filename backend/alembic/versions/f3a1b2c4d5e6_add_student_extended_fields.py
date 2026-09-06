"""Add extended fields to students table

Revision ID: f3a1b2c4d5e6
Revises: 1b75f5036285
Create Date: 2026-09-05 23:07:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3a1b2c4d5e6'
down_revision: Union[str, Sequence[str], None] = '1b75f5036285'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add missing columns to students table that exist in the model but not the DB."""
    op.add_column('students', sa.Column('class_name', sa.String(), nullable=True))
    op.add_column('students', sa.Column('section', sa.String(), nullable=True))
    op.add_column('students', sa.Column('roll_number', sa.String(), nullable=True))
    op.add_column('students', sa.Column('birth_certificate_no', sa.String(), nullable=True))
    op.add_column('students', sa.Column('gender', sa.String(), nullable=True))
    op.add_column('students', sa.Column('blood_group', sa.String(), nullable=True))
    op.add_column('students', sa.Column('status', sa.String(), nullable=True, server_default='Active'))
    op.create_index(op.f('ix_students_class_name'), 'students', ['class_name'], unique=False)
    op.create_index(op.f('ix_students_admission_number'), 'students', ['admission_number'], unique=False)


def downgrade() -> None:
    """Remove extended student columns."""
    op.drop_index(op.f('ix_students_class_name'), table_name='students')
    op.drop_index(op.f('ix_students_admission_number'), table_name='students')
    op.drop_column('students', 'status')
    op.drop_column('students', 'blood_group')
    op.drop_column('students', 'gender')
    op.drop_column('students', 'birth_certificate_no')
    op.drop_column('students', 'roll_number')
    op.drop_column('students', 'section')
    op.drop_column('students', 'class_name')
