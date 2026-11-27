
import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .database import engine

from .routes.auth import router as auth_router
from .routes.resume import router as resume_router
from .routes.job import router as job_router
from .routes.match import router as match_router
from .routes.recruiter_agent import router as recruiter_agent_router
from .routes.applicant_agent import router as applicant_agent_router
from .routes.chatbot import router as chatbot_router


# ==================================================
# LOGGING
# ==================================================

logger = logging.getLogger(__name__)


# ==================================================
# APPLICATION CONFIGURATION
# ==================================================

APP_ENV = os.getenv(
    "APP_ENV", "development"
).strip().lower()

IS_PRODUCTION = APP_ENV == "production"


# ==================================================
# CORS CONFIGURATION
# ==================================================

configured_origins = os.getenv(
    "CORS_ORIGINS", ""
).strip()

if configured_origins:
    ALLOWED_ORIGINS = [
        origin.strip().rstrip("/")
        for origin in configured_origins.split(",")
        if origin.strip()
    ]

elif IS_PRODUCTION:
    raise RuntimeError(
        "CORS_ORIGINS must be configured in production."
    )

else:
    ALLOWED_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:62498",
    ]


if not ALLOWED_ORIGINS:
    raise RuntimeError(
        "At least one CORS origin must be configured."
    )


# ==================================================
# FASTAPI APPLICATION
# ==================================================

app = FastAPI(
    title="AI-Powered Recruitment Agent",
    description=(
        "AI-powered recruitment platform for resume analysis, "
        "candidate matching, interview preparation, "
        "and recruitment evaluation."
    ),
    version="1.0.0",
    debug=False,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)


# ==================================================
# CORS MIDDLEWARE
# ==================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
    ],
    max_age=600,
)


# ==================================================
# REGISTER API ROUTERS
# ==================================================

app.include_router(auth_router)
app.include_router(resume_router)
app.include_router(job_router)
app.include_router(match_router)
app.include_router(recruiter_agent_router)
app.include_router(applicant_agent_router)
app.include_router(chatbot_router)


# ==================================================
# ROOT ENDPOINT
# ==================================================

@app.get("/", tags=["System"])
def home():
    return {
        "message": "AI-Powered Recruitment Agent API is running",
        "environment": APP_ENV,
    }


# ==================================================
# LIVENESS CHECK
# ==================================================

@app.get("/health/live", tags=["Health"])
def health_live():
    """
    Check whether the application process is running.

    This endpoint does not access the database.
    """

    return {
        "status": "alive"
    }


# ==================================================
# READINESS CHECK
# ==================================================

@app.get("/health/ready", tags=["Health"])
def health_ready():
    """
    Check whether the application can communicate with PostgreSQL.
    """

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "ready",
            "database": "connected",
        }

    except SQLAlchemyError:
        logger.exception(
            "Database readiness check failed."
        )

        raise HTTPException(
            status_code=503,
            detail="Service is temporarily unavailable."
        )

    except Exception:
        logger.exception(
            "Unexpected readiness check failure."
        )

        raise HTTPException(
            status_code=503,
            detail="Service is temporarily unavailable."
        )
