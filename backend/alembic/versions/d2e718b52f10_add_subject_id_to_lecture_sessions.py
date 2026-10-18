"""add_subject_id_to_lecture_sessions

Revision ID: d2e718b52f10
Revises: 86b91409d6f5
Create Date: 2026-10-18 22:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2e718b52f10'
down_revision: Union[str, Sequence[str], None] = '86b91409d6f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('lecture_sessions', sa.Column('subject_id', sa.Uuid(), nullable=True))
    op.create_index(op.f('ix_lecture_sessions_subject_id'), 'lecture_sessions', ['subject_id'], unique=False)
    op.create_foreign_key(
        'fk_lecture_sessions_subject_id',
        'lecture_sessions',
        'subjects',
        ['subject_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_lecture_sessions_subject_id', 'lecture_sessions', type_='foreignkey')
    op.drop_index(op.f('ix_lecture_sessions_subject_id'), table_name='lecture_sessions')
    op.drop_column('lecture_sessions', 'subject_id')
