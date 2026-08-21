import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# 1. Add project root to sys.path so Alembic can find the 'app' module
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# 2. Import our application configuration to get the DATABASE_URL
from app.core.config import settings

# 3. Import Base and ALL models so Alembic can detect the tables
from app.models.base import Base
from app.models.tenant import *
from app.models.users import *
from app.models.academic import *
# Note: As we add new models (like finance, hr), we must import them here too!

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# 4. Override the database URL dynamically from our .env file
# This is secure because we don't hardcode passwords in alembic.ini
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 5. Set target_metadata to our SQLAlchemy Base's metadata
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
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
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()