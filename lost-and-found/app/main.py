"""
Lost & Found Portal — FastAPI application entry point.

Start the dev server:
    uvicorn app.main:app --reload

API docs:
    http://localhost:8000/docs    (Swagger UI)
    http://localhost:8000/redoc  (ReDoc)
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import create_all_tables
from app.routers import auth, lost_items, found_items, claims, admin

settings = get_settings()

# ---------------------------------------------------------------------------
# Lifespan (Startup / Shutdown Events)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks and initialize database tables before serving requests."""
    create_all_tables()
    print(f"✅  {settings.app_name} v{settings.app_version} started successfully.")
    yield
    print("🛑  Application shutting down.")


# ---------------------------------------------------------------------------
# FastAPI App Instance
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Smart Campus Lost and Found Portal",
    description="Official Lost and Found API Portal for BIT Mesra Lalpur Campus.",
    version="1.0.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# CORS Middleware Configuration (Allows all origins including [::]:5500)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# API Routers Registration
# ---------------------------------------------------------------------------

API_PREFIX = "/api/v1"

app.include_router(auth.router,        prefix=API_PREFIX, tags=["Authentication"])
app.include_router(lost_items.router,  prefix=API_PREFIX, tags=["Lost Items"])
app.include_router(found_items.router, prefix=API_PREFIX, tags=["Found Items"])
app.include_router(claims.router,      prefix=API_PREFIX, tags=["Claims"])
app.include_router(admin.router,       prefix=API_PREFIX, tags=["Admin Panel"])


# ---------------------------------------------------------------------------
# Root & Health Check Endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"], summary="Root endpoint returning API metadata")
def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "redoc": "/redoc",
    }


@app.get("/health", tags=["Health"], summary="Health check endpoint")
def health_check():
    return JSONResponse(content={"status": "ok"})