"""SQLAlchemy engine + session factory.

Usage:
    from .db import Base, get_db, init_db, SessionLocal
"""
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


_engine: Engine | None = None
SessionLocal: sessionmaker[Session] | None = None


def _normalize_database_url(url: str) -> str:
    # SQLAlchemy + psycopg v3 expects "postgresql+psycopg://..."
    if url.startswith("postgresql+"):
        return url
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def init_db() -> None:
    """Create engine + session factory and ensure tables exist."""
    global _engine, SessionLocal

    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not configured")

    url = _normalize_database_url(settings.database_url)
    _engine = create_engine(url, pool_pre_ping=True, future=True)
    SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, future=True)

    # Import models so their tables are registered against Base.metadata
    from . import models  # noqa: F401

    Base.metadata.create_all(_engine)
    _apply_lightweight_migrations(_engine)


def _apply_lightweight_migrations(engine: Engine) -> None:
    """Add columns introduced after the initial create_all for existing deployments."""
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(32)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMP",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            try:
                conn.exec_driver_sql(stmt)
            except Exception:
                # Non-Postgres backends or insufficient privileges — ignore.
                pass


def get_engine() -> Engine:
    if _engine is None:
        init_db()
    assert _engine is not None
    return _engine


def get_db() -> Generator[Session, None, None]:
    if SessionLocal is None:
        init_db()
    assert SessionLocal is not None
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
