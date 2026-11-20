from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import get_settings

settings = get_settings()

# pool_pre_ping=True checks if Neon closed an idle connection and reconnects automatically
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    """Dependency Injection: gives each API request its own DB session and closes it safely."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()