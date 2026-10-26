"""
Main FastAPI Application Entrypoint for VeriScope.
Configures CORS, mounts routers, and serves API documentation.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from apps.api.core.config import settings
from apps.api.routers import auth, applications, documents, audit, rules

app = FastAPI(
    title=f"{settings.APP_NAME} Regulatory Scrutiny Decision-Support API",
    description="Backend services for AICTE application validation, document authentication & regulatory compliance verification.",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth.router)
app.include_router(applications.router)
app.include_router(documents.router)
app.include_router(audit.router)
app.include_router(rules.router)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "assessment_date_default": settings.ASSESSMENT_DATE_DEFAULT,
        "mock_connector_enabled": settings.MOCK_CONNECTOR_ENABLED
    }


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )
