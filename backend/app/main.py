from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.routers import auth
from app.config import get_settings
from app.database import Base, engine, get_db
import app.models  # noqa: F401 - registers all 12 tables with Base

settings = get_settings()
is_prod = settings.environment == "production"

# Hide /docs and /redoc in production for security
app = FastAPI(
    title="Boarding Management System API",
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else "/openapi.json",
)

# Strict CORS: only allow our own frontend (never "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)


# Security headers on every response
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


# Never leak internal errors or stack traces in production
@app.exception_handler(Exception)
async def safe_exception_handler(request: Request, exc: Exception):
    if is_prod:
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
    raise exc


# Create tables in Neon if they don't exist yet
Base.metadata.create_all(bind=engine)
app.include_router(auth.router)


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}