from fastapi import APIRouter

from app.api.endpoints import health, dashboard, auth, vintrace # Import your new vintrace endpoint

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(dashboard.router, prefix="/dash", tags=["dashboard"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(vintrace.router, prefix="/vintrace", tags=["vintrace"]) # Add vintrace router
