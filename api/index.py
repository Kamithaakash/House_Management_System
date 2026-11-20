import sys
from pathlib import Path

# Allow importing `app.*` from the backend/ folder on Vercel Serverless
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402, F401
