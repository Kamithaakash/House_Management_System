import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env when running locally (Vercel uses its own Environment Variables)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Settings:
    def __init__(self):
        self.database_url = os.getenv("DATABASE_URL")
        self.secret_key = os.getenv("SECRET_KEY")
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        self.environment = os.getenv("ENVIRONMENT", "development")

        # Fail fast if secrets are missing
        if not self.database_url:
            raise RuntimeError("DATABASE_URL is missing in .env")
        if not self.secret_key or len(self.secret_key) < 32:
            raise RuntimeError("SECRET_KEY must be at least 32 characters in .env")


@lru_cache
def get_settings() -> Settings:
    """Singleton pattern: create Settings once and reuse it."""
    return Settings()