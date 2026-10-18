import os
import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool, create_engine
from alembic import context

# Ensure backend root is on Python sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from db_postgres import Base, NORM_DATABASE_URL, get_engine
import models  # Ensure all model tables are registered in Base.metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def get_effective_url() -> str:
    """Retrieves normalized database URL from environment or fallback for offline generation."""
    if NORM_DATABASE_URL and "YOUR_NEON_" not in NORM_DATABASE_URL:
        return NORM_DATABASE_URL
    ini_url = config.get_main_option("sqlalchemy.url")
    if ini_url and not ini_url.startswith("driver://"):
        return ini_url
    return "sqlite:///alembic_schema.db"

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_effective_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    url = get_effective_url()
    connectable = create_engine(
        url,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
