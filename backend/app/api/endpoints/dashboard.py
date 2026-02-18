from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.db.database import get_async_db
from app.db.models.user import User
from app.schemas.common import CachedDashboardData
from app.services.dashboard_service import compute_dashboard_payload
from app.services.snapshots import create_snapshot, get_latest_snapshot


router = APIRouter()


@router.get("/exec", response_model=CachedDashboardData)
async def get_dashboard_data(
    db: AsyncSession = Depends(get_async_db),
):
    """
    Retrieve the latest dashboard executive data.

    Only the most recent snapshot is returned, ensuring the analytics board
    always reflects the latest successful refresh.
    """
    snapshot = await get_latest_snapshot(db)
    if snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dashboard data not found. Trigger a refresh to compute it.",
        )

    return CachedDashboardData(
        payload=snapshot.payload,
        timestamp=snapshot.created_at,
    )


@router.post("/exec/refresh", response_model=CachedDashboardData)
async def refresh_dashboard_data(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user), # Temporarily removed for CORS debugging
):
    """
    Manually recompute the dashboard payload and persist it as a new snapshot.

    This endpoint is authenticated and should be called when the user clicks
    a \"Reload\" button in the UI. Schedulers (e.g., every 12 hours) can later
    be wired to call the same logic.
    """
    # Compute a fresh payload from upstream APIs.
    payload = await compute_dashboard_payload(db=db)

    # Store as a new snapshot and mirror into KV for backward compatibility.
    snapshot = await create_snapshot(db, payload)

    return CachedDashboardData(
        payload=snapshot.payload,
        timestamp=snapshot.created_at,
    )

