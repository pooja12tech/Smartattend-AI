"""face_embeddings_and_enrollment_table

Revision ID: e3f819a14c2b
Revises: d2e718b52f10
Create Date: 2026-10-18 23:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3f819a14c2b'
down_revision: Union[str, Sequence[str], None] = 'd2e718b52f10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create face_enrollments table
    op.create_table(
        'face_enrollments',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('embedding', sa.LargeBinary(), nullable=False),
        sa.Column('model_name', sa.String(length=64), nullable=False, server_default='buffalo_sc'),
        sa.Column('model_version', sa.String(length=32), nullable=False, server_default='insightface-2.1'),
        sa.Column('consent_given_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('consent_text_version', sa.String(length=32), nullable=False, server_default='v1.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('retention_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_face_enrollments_user_id')
    )
    op.create_index(op.f('ix_face_enrollments_user_id'), 'face_enrollments', ['user_id'], unique=True)

    # 2. Add liveness_status to attendance_records
    op.add_column('attendance_records', sa.Column('liveness_status', sa.String(length=32), nullable=False, server_default='NOT_CHECKED'))

    # 3. Drop legacy raw base64 columns
    op.drop_column('users', 'registered_face_base64')
    op.drop_column('attendance_records', 'live_selfie_base64')


def downgrade() -> None:
    # Restore legacy columns
    op.add_column('attendance_records', sa.Column('live_selfie_base64', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('registered_face_base64', sa.Text(), nullable=True))

    op.drop_column('attendance_records', 'liveness_status')

    op.drop_index(op.f('ix_face_enrollments_user_id'), table_name='face_enrollments')
    op.drop_table('face_enrollments')
