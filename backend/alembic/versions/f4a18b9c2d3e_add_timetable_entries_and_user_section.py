"""add_timetable_entries_and_user_section

Revision ID: f4a18b9c2d3e
Revises: e3f819a14c2b
Create Date: 2026-10-24 15:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4a18b9c2d3e'
down_revision: Union[str, Sequence[str], None] = 'e3f819a14c2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Add section column to users table if missing
    user_cols = [c['name'] for c in insp.get_columns('users')]
    if 'section' not in user_cols:
        op.add_column('users', sa.Column('section', sa.String(length=16), nullable=True, server_default='A'))

    # 2. Create timetable_entries table if missing
    existing_tables = insp.get_table_names()
    if 'timetable_entries' not in existing_tables:
        op.create_table(
            'timetable_entries',
            sa.Column('id', sa.Uuid(), nullable=False),
            sa.Column('subject_id', sa.Uuid(), nullable=True),
            sa.Column('subject_code', sa.String(length=32), nullable=False),
            sa.Column('subject_name', sa.String(length=255), nullable=False),
            sa.Column('faculty_id', sa.String(length=64), nullable=False),
            sa.Column('faculty_name', sa.String(length=255), nullable=False),
            sa.Column('department', sa.String(length=255), nullable=False),
            sa.Column('semester', sa.Integer(), nullable=False),
            sa.Column('section', sa.String(length=16), nullable=False, server_default='A'),
            sa.Column('academic_year', sa.String(length=32), nullable=False, server_default='2025-2026'),
            sa.Column('room_no', sa.String(length=64), nullable=False),
            sa.Column('day_of_week', sa.String(length=16), nullable=False),
            sa.Column('start_time', sa.String(length=8), nullable=False),
            sa.Column('end_time', sa.String(length=8), nullable=False),
            sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.text('true')),
            sa.Column('created_by', sa.String(length=64), nullable=True),
            sa.Column('updated_by', sa.String(length=64), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
            sa.CheckConstraint('end_time > start_time', name='ck_timetable_time_range')
        )

    # 3. Create indexes safely
    existing_indexes = []
    if 'timetable_entries' in insp.get_table_names():
        existing_indexes = [idx['name'] for idx in insp.get_indexes('timetable_entries')]

    indexes_to_create = [
        ('ix_timetable_entries_subject_code', ['subject_code']),
        ('ix_timetable_entries_faculty_id', ['faculty_id']),
        ('ix_timetable_entries_department', ['department']),
        ('ix_timetable_entries_semester', ['semester']),
        ('ix_timetable_entries_section', ['section']),
        ('ix_timetable_entries_room_no', ['room_no']),
        ('ix_timetable_entries_day_of_week', ['day_of_week']),
        ('ix_timetable_entries_is_published', ['is_published']),
        ('idx_timetable_faculty_slot', ['faculty_id', 'day_of_week']),
        ('idx_timetable_class_slot', ['department', 'semester', 'section', 'day_of_week']),
        ('idx_timetable_room_slot', ['room_no', 'day_of_week']),
    ]
    for idx_name, cols in indexes_to_create:
        if idx_name not in existing_indexes:
            op.create_index(idx_name, 'timetable_entries', cols, unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = insp.get_table_names()

    if 'timetable_entries' in existing_tables:
        existing_indexes = [idx['name'] for idx in insp.get_indexes('timetable_entries')]
        indexes_to_drop = [
            'idx_timetable_room_slot',
            'idx_timetable_class_slot',
            'idx_timetable_faculty_slot',
            'ix_timetable_entries_is_published',
            'ix_timetable_entries_day_of_week',
            'ix_timetable_entries_room_no',
            'ix_timetable_entries_section',
            'ix_timetable_entries_semester',
            'ix_timetable_entries_department',
            'ix_timetable_entries_faculty_id',
            'ix_timetable_entries_subject_code',
        ]
        for idx in indexes_to_drop:
            if idx in existing_indexes:
                op.drop_index(idx, table_name='timetable_entries')
        op.drop_table('timetable_entries')

    user_cols = [c['name'] for c in insp.get_columns('users')]
    if 'section' in user_cols:
        op.drop_column('users', 'section')
