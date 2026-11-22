"""academic_expansion_class_1_to_12

Revision ID: 407a7716be83
Revises: cedb24c053f7
Create Date: 2026-11-14 03:29:53.896824

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '407a7716be83'
down_revision: Union[str, Sequence[str], None] = 'cedb24c053f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. New Table: curriculum_documents
    op.create_table(
        'curriculum_documents',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('class_name', sa.String(length=50), nullable=False),
        sa.Column('subject', sa.String(length=100), nullable=False),
        sa.Column('chapter', sa.String(length=100), nullable=True),
        sa.Column('academic_year', sa.String(length=20), nullable=False, server_default='2026'),
        sa.Column('group', sa.String(length=50), nullable=True),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('file_hash', sa.String(length=64), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='PENDING'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('chunks_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('metadata_payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_curriculum_docs_tenant_status', 'curriculum_documents', ['tenant_id', 'status'], unique=False)
    op.create_index('ix_curriculum_documents_class_name', 'curriculum_documents', ['class_name'], unique=False)
    op.create_index('ix_curriculum_documents_status', 'curriculum_documents', ['status'], unique=False)
    op.create_index('ix_curriculum_documents_subject', 'curriculum_documents', ['subject'], unique=False)
    op.create_index('ix_curriculum_documents_tenant_id', 'curriculum_documents', ['tenant_id'], unique=False)

    # 2. New Table: student_enrollment_history
    op.create_table(
        'student_enrollment_history',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('academic_year', sa.String(length=20), nullable=False),
        sa.Column('class_name', sa.String(length=50), nullable=False),
        sa.Column('section', sa.String(length=50), nullable=False, server_default='A'),
        sa.Column('roll_number', sa.String(length=50), nullable=True),
        sa.Column('group', sa.String(length=50), nullable=True),
        sa.Column('shift', sa.String(length=50), nullable=True, server_default='Morning'),
        sa.Column('promotion_status', sa.String(length=30), nullable=False, server_default='PROMOTED'),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('promoted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_student_enrollment_history_academic_year', 'student_enrollment_history', ['academic_year'], unique=False)
    op.create_index('ix_student_enrollment_history_class_name', 'student_enrollment_history', ['class_name'], unique=False)
    op.create_index('ix_student_enrollment_history_student_id', 'student_enrollment_history', ['student_id'], unique=False)
    op.create_index('ix_student_enrollment_history_tenant_id', 'student_enrollment_history', ['tenant_id'], unique=False)

    # 3. Add columns to admission_applications
    op.add_column('admission_applications', sa.Column('shift', sa.String(length=50), nullable=True, server_default='Morning'))
    op.add_column('admission_applications', sa.Column('group', sa.String(length=50), nullable=True))
    op.add_column('admission_applications', sa.Column('desired_section', sa.String(length=50), nullable=True))
    op.add_column('admission_applications', sa.Column('first_name_bn', sa.String(length=100), nullable=True))
    op.add_column('admission_applications', sa.Column('last_name_bn', sa.String(length=100), nullable=True))
    op.add_column('admission_applications', sa.Column('name_bn', sa.String(length=200), nullable=True))
    op.add_column('admission_applications', sa.Column('nationality', sa.String(length=50), nullable=True, server_default='Bangladeshi'))
    op.add_column('admission_applications', sa.Column('religion', sa.String(length=50), nullable=True))
    op.add_column('admission_applications', sa.Column('birth_registration_number', sa.String(length=50), nullable=True))
    op.add_column('admission_applications', sa.Column('father_name_en', sa.String(length=150), nullable=True))
    op.add_column('admission_applications', sa.Column('father_name_bn', sa.String(length=150), nullable=True))
    op.add_column('admission_applications', sa.Column('mother_name_en', sa.String(length=150), nullable=True))
    op.add_column('admission_applications', sa.Column('mother_name_bn', sa.String(length=150), nullable=True))
    op.add_column('admission_applications', sa.Column('present_address', sa.Text(), nullable=True))
    op.add_column('admission_applications', sa.Column('permanent_address', sa.Text(), nullable=True))
    op.add_column('admission_applications', sa.Column('division', sa.String(length=50), nullable=True))
    op.add_column('admission_applications', sa.Column('district', sa.String(length=50), nullable=True))
    op.add_column('admission_applications', sa.Column('upazila', sa.String(length=50), nullable=True))
    op.add_column('admission_applications', sa.Column('union_ward', sa.String(length=50), nullable=True))
    op.add_column('admission_applications', sa.Column('previous_board', sa.String(length=50), nullable=True))
    op.add_column('admission_applications', sa.Column('previous_roll', sa.String(length=50), nullable=True))
    op.add_column('admission_applications', sa.Column('previous_gpa', sa.String(length=20), nullable=True))
    op.add_column('admission_applications', sa.Column('declaration_accepted', sa.Boolean(), nullable=False, server_default=sa.text('false')))

    # 4. Add columns & constraint to attendance_events
    op.add_column('attendance_events', sa.Column('period_number', sa.String(length=32), nullable=True, server_default='DAILY'))
    op.add_column('attendance_events', sa.Column('subject', sa.String(length=100), nullable=True))
    op.add_column('attendance_events', sa.Column('shift', sa.String(length=50), nullable=True, server_default='Morning'))
    op.add_column('attendance_events', sa.Column('section', sa.String(length=50), nullable=True, server_default='A'))
    op.add_column('attendance_events', sa.Column('group', sa.String(length=50), nullable=True))
    op.create_index('ix_attendance_events_period_number', 'attendance_events', ['period_number'], unique=False)
    op.create_index('ix_attendance_events_subject', 'attendance_events', ['subject'], unique=False)

    # Safe upgrade of uniqueness constraint: drop old uq_attendance_student_day and add uq_attendance_student_day_period
    op.execute("ALTER TABLE attendance_events DROP CONSTRAINT IF EXISTS uq_attendance_student_day;")
    op.execute("ALTER TABLE attendance_events DROP CONSTRAINT IF EXISTS uq_attendance_student_day_period;")
    op.create_unique_constraint('uq_attendance_student_day_period', 'attendance_events', ['tenant_id', 'student_id', 'date', 'period_number'])

    # 5. Add columns to class_routines
    op.add_column('class_routines', sa.Column('section', sa.String(length=50), nullable=False, server_default='A'))
    op.add_column('class_routines', sa.Column('shift', sa.String(length=50), nullable=False, server_default='Morning'))
    op.add_column('class_routines', sa.Column('group', sa.String(length=50), nullable=True))

    # 6. Add columns to classes
    op.add_column('classes', sa.Column('group', sa.String(length=50), nullable=True))
    op.add_column('classes', sa.Column('shift', sa.String(length=50), nullable=True, server_default='Morning'))

    # 7. Add columns to curriculum_chunks
    op.add_column('curriculum_chunks', sa.Column('document_id', sa.UUID(), nullable=True))
    op.add_column('curriculum_chunks', sa.Column('academic_year', sa.String(length=20), nullable=True, server_default='2026'))
    op.add_column('curriculum_chunks', sa.Column('group', sa.String(length=50), nullable=True))
    op.create_index('ix_curriculum_chunks_document_id', 'curriculum_chunks', ['document_id'], unique=False)
    op.create_foreign_key('fk_curriculum_chunks_doc', 'curriculum_chunks', 'curriculum_documents', ['document_id'], ['id'], ondelete='CASCADE')

    # 8. Add columns to daily_lesson_logs
    op.add_column('daily_lesson_logs', sa.Column('section', sa.String(length=50), nullable=True, server_default='A'))
    op.add_column('daily_lesson_logs', sa.Column('group', sa.String(length=50), nullable=True))

    # 9. Add columns to grade_levels
    op.add_column('grade_levels', sa.Column('group', sa.String(length=50), nullable=True))
    op.add_column('grade_levels', sa.Column('academic_year', sa.String(length=20), nullable=True, server_default='2026'))

    # 10. Add columns to students
    op.add_column('students', sa.Column('first_name_bn', sa.String(length=100), nullable=True))
    op.add_column('students', sa.Column('last_name_bn', sa.String(length=100), nullable=True))
    op.add_column('students', sa.Column('name_bn', sa.String(length=200), nullable=True))
    op.add_column('students', sa.Column('group', sa.String(length=50), nullable=True))
    op.add_column('students', sa.Column('shift', sa.String(length=50), nullable=True, server_default='Morning'))
    op.add_column('students', sa.Column('academic_year', sa.String(length=20), nullable=True, server_default='2026'))
    op.add_column('students', sa.Column('address', sa.Text(), nullable=True))
    op.add_column('students', sa.Column('emergency_contact', sa.String(length=50), nullable=True))
    op.add_column('students', sa.Column('previous_school', sa.String(length=150), nullable=True))
    op.add_column('students', sa.Column('photo_url', sa.String(length=500), nullable=True))
    op.add_column('students', sa.Column('disciplinary_notes', sa.Text(), nullable=True))
    op.add_column('students', sa.Column('health_notes', sa.Text(), nullable=True))
    op.create_index('ix_students_academic_year', 'students', ['academic_year'], unique=False)
    op.create_index('ix_students_group', 'students', ['group'], unique=False)

    # 11. Add columns to subjects
    op.add_column('subjects', sa.Column('subject_code', sa.String(length=50), nullable=True))
    op.add_column('subjects', sa.Column('group', sa.String(length=50), nullable=True))
    op.add_column('subjects', sa.Column('is_optional', sa.Boolean(), nullable=True, server_default=sa.text('false')))

    # 12. Add columns to teachers
    op.add_column('teachers', sa.Column('name_bn', sa.String(length=200), nullable=True))
    op.add_column('teachers', sa.Column('employee_id', sa.String(length=50), nullable=True))
    op.add_column('teachers', sa.Column('department', sa.String(length=100), nullable=True))
    op.add_column('teachers', sa.Column('employment_type', sa.String(length=50), nullable=True, server_default='Permanent'))
    op.add_column('teachers', sa.Column('joining_date', sa.Date(), nullable=True))
    op.add_column('teachers', sa.Column('address', sa.Text(), nullable=True))
    op.add_column('teachers', sa.Column('emergency_contact', sa.String(length=50), nullable=True))
    op.add_column('teachers', sa.Column('qualifications', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'[]'::jsonb")))
    op.add_column('teachers', sa.Column('experience', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'[]'::jsonb")))
    op.add_column('teachers', sa.Column('cv_url', sa.String(length=500), nullable=True))
    op.add_column('teachers', sa.Column('bio', sa.Text(), nullable=True))
    op.create_index('ix_teachers_employee_id', 'teachers', ['employee_id'], unique=False)

    # 13. Enable Native PostgreSQL RLS & grants for new tables
    op.execute("ALTER TABLE curriculum_documents ENABLE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_curriculum_documents ON curriculum_documents;")
    op.execute("""
        CREATE POLICY tenant_isolation_curriculum_documents ON curriculum_documents
        AS PERMISSIVE FOR ALL
        TO authenticated
        USING (tenant_id::text = current_setting('app.current_tenant_id', true))
        WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
    """)
    op.execute("GRANT ALL ON curriculum_documents TO authenticated;")

    op.execute("ALTER TABLE student_enrollment_history ENABLE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_student_enrollment_history ON student_enrollment_history;")
    op.execute("""
        CREATE POLICY tenant_isolation_student_enrollment_history ON student_enrollment_history
        AS PERMISSIVE FOR ALL
        TO authenticated
        USING (tenant_id::text = current_setting('app.current_tenant_id', true))
        WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
    """)
    op.execute("GRANT ALL ON student_enrollment_history TO authenticated;")


def downgrade() -> None:
    # 1. Drop teachers columns
    op.drop_index('ix_teachers_employee_id', table_name='teachers')
    op.drop_column('teachers', 'bio')
    op.drop_column('teachers', 'cv_url')
    op.drop_column('teachers', 'experience')
    op.drop_column('teachers', 'qualifications')
    op.drop_column('teachers', 'emergency_contact')
    op.drop_column('teachers', 'address')
    op.drop_column('teachers', 'joining_date')
    op.drop_column('teachers', 'employment_type')
    op.drop_column('teachers', 'department')
    op.drop_column('teachers', 'employee_id')
    op.drop_column('teachers', 'name_bn')

    # 2. Drop subjects columns
    op.drop_column('subjects', 'is_optional')
    op.drop_column('subjects', 'group')
    op.drop_column('subjects', 'subject_code')

    # 3. Drop students columns
    op.drop_index('ix_students_group', table_name='students')
    op.drop_index('ix_students_academic_year', table_name='students')
    op.drop_column('students', 'health_notes')
    op.drop_column('students', 'disciplinary_notes')
    op.drop_column('students', 'photo_url')
    op.drop_column('students', 'previous_school')
    op.drop_column('students', 'emergency_contact')
    op.drop_column('students', 'address')
    op.drop_column('students', 'academic_year')
    op.drop_column('students', 'shift')
    op.drop_column('students', 'group')
    op.drop_column('students', 'name_bn')
    op.drop_column('students', 'last_name_bn')
    op.drop_column('students', 'first_name_bn')

    # 4. Drop grade_levels columns
    op.drop_column('grade_levels', 'academic_year')
    op.drop_column('grade_levels', 'group')

    # 5. Drop daily_lesson_logs columns
    op.drop_column('daily_lesson_logs', 'group')
    op.drop_column('daily_lesson_logs', 'section')

    # 6. Drop curriculum_chunks columns
    op.drop_constraint('fk_curriculum_chunks_doc', 'curriculum_chunks', type_='foreignkey')
    op.drop_index('ix_curriculum_chunks_document_id', table_name='curriculum_chunks')
    op.drop_column('curriculum_chunks', 'group')
    op.drop_column('curriculum_chunks', 'academic_year')
    op.drop_column('curriculum_chunks', 'document_id')

    # 7. Drop classes columns
    op.drop_column('classes', 'shift')
    op.drop_column('classes', 'group')

    # 8. Drop class_routines columns
    op.drop_column('class_routines', 'group')
    op.drop_column('class_routines', 'shift')
    op.drop_column('class_routines', 'section')

    # 9. Revert attendance_events
    op.drop_constraint('uq_attendance_student_day_period', 'attendance_events', type_='unique')
    op.create_unique_constraint('uq_attendance_student_day', 'attendance_events', ['tenant_id', 'student_id', 'date'])
    op.drop_index('ix_attendance_events_subject', table_name='attendance_events')
    op.drop_index('ix_attendance_events_period_number', table_name='attendance_events')
    op.drop_column('attendance_events', 'group')
    op.drop_column('attendance_events', 'section')
    op.drop_column('attendance_events', 'shift')
    op.drop_column('attendance_events', 'subject')
    op.drop_column('attendance_events', 'period_number')

    # 10. Drop admission_applications columns
    op.drop_column('admission_applications', 'declaration_accepted')
    op.drop_column('admission_applications', 'previous_gpa')
    op.drop_column('admission_applications', 'previous_roll')
    op.drop_column('admission_applications', 'previous_board')
    op.drop_column('admission_applications', 'union_ward')
    op.drop_column('admission_applications', 'upazila')
    op.drop_column('admission_applications', 'district')
    op.drop_column('admission_applications', 'division')
    op.drop_column('admission_applications', 'permanent_address')
    op.drop_column('admission_applications', 'present_address')
    op.drop_column('admission_applications', 'mother_name_bn')
    op.drop_column('admission_applications', 'mother_name_en')
    op.drop_column('admission_applications', 'father_name_bn')
    op.drop_column('admission_applications', 'father_name_en')
    op.drop_column('admission_applications', 'birth_registration_number')
    op.drop_column('admission_applications', 'religion')
    op.drop_column('admission_applications', 'nationality')
    op.drop_column('admission_applications', 'name_bn')
    op.drop_column('admission_applications', 'last_name_bn')
    op.drop_column('admission_applications', 'first_name_bn')
    op.drop_column('admission_applications', 'desired_section')
    op.drop_column('admission_applications', 'group')
    op.drop_column('admission_applications', 'shift')

    # 11. Drop new tables
    op.drop_index('ix_student_enrollment_history_tenant_id', table_name='student_enrollment_history')
    op.drop_index('ix_student_enrollment_history_student_id', table_name='student_enrollment_history')
    op.drop_index('ix_student_enrollment_history_class_name', table_name='student_enrollment_history')
    op.drop_index('ix_student_enrollment_history_academic_year', table_name='student_enrollment_history')
    op.drop_table('student_enrollment_history')

    op.drop_index('ix_curriculum_documents_tenant_id', table_name='curriculum_documents')
    op.drop_index('ix_curriculum_documents_subject', table_name='curriculum_documents')
    op.drop_index('ix_curriculum_documents_status', table_name='curriculum_documents')
    op.drop_index('ix_curriculum_documents_class_name', table_name='curriculum_documents')
    op.drop_index('ix_curriculum_docs_tenant_status', table_name='curriculum_documents')
    op.drop_table('curriculum_documents')
