"""
Database session and engine management using SQLAlchemy 2.
Supports SQLite (demo fallback) and PostgreSQL via DATABASE_URL configuration.
"""

import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from apps.api.core.config import settings

# For SQLite, ensure connect_args allows multi-threading
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    future=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

Base = declarative_base()


def ensure_demo_schema() -> None:
    """Apply tiny additive demo migrations without requiring Alembic.

    This keeps an existing local SQLite database usable after adding the
    applicant ownership column. Fresh databases are handled by create_all().
    """
    inspector = inspect(engine)
    if "applications" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("applications")}
    if "applicant_id" not in columns:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE applications ADD COLUMN applicant_id VARCHAR(36)")
            )
            connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_applications_applicant_id "
                    "ON applications (applicant_id)"
                )
            )


def get_db():
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
