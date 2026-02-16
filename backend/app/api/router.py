from fastapi import APIRouter

from app.api.endpoints import health, dashboard, auth # Import your new dashboard endpoint and auth

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(dashboard.router, prefix="/dash", tags=["dashboard"]) # Add dashboard router
api_router.include_router(auth.router, tags=["auth"]) # Add auth router
