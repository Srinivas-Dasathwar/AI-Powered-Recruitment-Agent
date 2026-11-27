import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import make_url

# Project root: AI_Powered_Recruitment_Agent
PROJECT_ROOT = Path(__file__).resolve().parents[2]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Load environment variables from the project-root .env file.
load_dotenv(PROJECT_ROOT / ".env")

from backend.app.database import Base

# Import every model so all tables are registered in Base.metadata.
from backend.app.models.user import User
from backend.app.models.resume import Resume
from backend.app.models.job import Job
from backend.app.models.match_result import MatchResult
from backend.app.models.interview_evaluation import InterviewEvaluation

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_database_url():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is missing. Check your project-root .env file."
        )

    url = make_url(database_url)

    # Optional database-name override for safe migration testing.
    test_database = os.getenv("ALEMBIC_DATABASE_NAME")

    if test_database:
        url = url.set(database=test_database)

    return url


def run_migrations_offline():
    url = get_database_url()

    context.configure(
        url=url.render_as_string(hide_password=False),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = create_engine(
        get_database_url(),
        poolclass=pool.NullPool,
    )

    try:
        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
            )

            with context.begin_transaction():
                context.run_migrations()
    finally:
        connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()