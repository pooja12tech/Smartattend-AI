"""add_liveness_challenges_table

Revision ID: f4a819b25c3d
Revises: e3f819a14c2b
Create Date: 2026-10-24 20:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4a819b25c3d'
down_revision: Union[str, Sequence[str], None] = 'e3f819a14c2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create liveness_challenges table
    op.create_table(
        'liveness_challenges',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('challenge_id', sa.String(length=64), nullable=False),
        sa.Column('session_id', sa.String(length=128), nullable=False),
        sa.Column('roll_no', sa.String(length=64), nullable=False),
        sa.Column('token_hash', sa.String(length=128), nullable=False),
        sa.Column('is_consumed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['session_id'], ['lecture_sessions.session_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['roll_no'], ['users.roll_no'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_liveness_challenges_challenge_id', 'liveness_challenges', ['challenge_id'], unique=True)
    op.create_index('idx_challenge_lookup', 'liveness_challenges', ['challenge_id', 'roll_no', 'session_id', 'is_consumed'])
    op.create_index('idx_challenge_expiry', 'liveness_challenges', ['expires_at'])

    # 2. Add challenge_id audit column to attendance_records
    op.add_column('attendance_records', sa.Column('challenge_id', sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column('attendance_records', 'challenge_id')
    op.drop_index('idx_challenge_expiry', table_name='liveness_challenges')
    op.drop_index('idx_challenge_lookup', table_name='liveness_challenges')
    op.drop_index('ix_liveness_challenges_challenge_id', table_name='liveness_challenges')
    op.drop_table('liveness_challenges')
