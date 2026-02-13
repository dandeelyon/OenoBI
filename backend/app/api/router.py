from fastapi import APIRouter

from app.api.endpoints import health, sales, auth # Import your new sales endpoint and auth

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(sales.router, prefix="/dash", tags=["dashboard"]) # Add sales router
api_router.include_router(auth.router, tags=["auth"]) # Add auth router
