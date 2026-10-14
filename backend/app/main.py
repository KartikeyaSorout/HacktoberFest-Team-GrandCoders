"""
Hacktoberfest Copilot — FastAPI Application Entry Point

This module creates and configures the FastAPI application with:
- CORS middleware for frontend communication
- API routers for all endpoints
- Health check endpoint
"""

import time
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import settings
from app.exceptions import AppException

START_TIME = time.time()
from app.routers import repo, issues, plan, pr, tests, user

# ─── App Setup ───────────────────────────────────────────────────────

tags_metadata = [
    {"name": "Health", "description": "API health status and diagnostic checks."},
    {"name": "User", "description": "Connected GitHub user profile and live PR sync."},
    {"name": "Repository", "description": "Analyze GitHub repository structure, tech stack, and beginner issues."},
    {"name": "Issues", "description": "Explain and simplify GitHub issues using Gemma 4 AI."},
    {"name": "Plan", "description": "Generate step-by-step contribution implementation roadmap."},
    {"name": "Tests", "description": "Recommend test framework, test cases, and code scaffolding."},
    {"name": "Pull Request", "description": "Generate professional PR title and description."},
    {"name": "Root", "description": "Service links and documentation index."},
]

app = FastAPI(
    title="Hacktoberfest Copilot API",
    description=(
        "AI-powered assistant that helps beginners navigate "
        "the open-source contribution process. Powered by Gemma 4."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=tags_metadata,
)

# ─── CORS Middleware ─────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ─── Exception Handlers ──────────────────────────────────────────────

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    """Handle all custom application exceptions uniformly."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.error_code,
            "message": exc.message,
            "details": exc.details,
            "path": request.url.path,
        },
    )

# ─── Register Routers ───────────────────────────────────────────────

app.include_router(repo.router, prefix="/api", tags=["Repository"])
app.include_router(issues.router, prefix="/api", tags=["Issues"])
app.include_router(plan.router, prefix="/api", tags=["Plan"])
app.include_router(pr.router, prefix="/api", tags=["Pull Request"])
app.include_router(tests.router, prefix="/api", tags=["Tests"])
app.include_router(user.router, prefix="/api", tags=["User"])


# ─── Health Check ────────────────────────────────────────────────────

@app.get("/api/health", tags=["Health"])
async def health_check():
    """Health check endpoint to verify API uptime, cache utilization, and system status."""
    from app.services.github_client import github_client

    return {
        "status": "healthy",
        "service": "hacktoberfest-copilot-api",
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "cache": github_client.get_cache_stats(),
    }


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "message": "🎃 Hacktoberfest Copilot API",
        "docs": "/docs",
        "health": "/api/health",
    }
