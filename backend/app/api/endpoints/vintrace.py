from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated, Any, Dict, List, Optional
from sqlalchemy import select

from app.db.database import get_async_db
from app.core.auth import get_current_active_user
from app.db.models.user import User
from app.db.models.vintrace import VintraceWineBatch
from app.services.sync.vintrace_sync import sync_vintrace_wine_batches

router = APIRouter()

def _batch_to_payload(batch: VintraceWineBatch) -> Dict[str, Any]:
    return {
        "id": batch.id,
        "batchCode": batch.batch_code,
        "batchNumber": batch.batch_number,
        "description": batch.description,
        "productionYear": batch.production_year,
        "owner": batch.owner_data or {},
        "designatedVariety": batch.designated_variety_data,
        "designatedRegion": batch.designated_region_data,
        "vessels": batch.vessels_data or [],
        "allocations": batch.allocations_data or [],
        "inactive": batch.inactive,
        "currentVolume": batch.current_volume,
        "volumeUnit": batch.volume_unit,
        "totalCost": batch.total_cost_data,
    }

@router.get("/wine-batches", status_code=status.HTTP_200_OK)
async def list_wine_batches(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    bbvOnly: Optional[bool] = None,
    current_user: Annotated[User, Depends(get_current_active_user)] = None,
):
    """
    Return cached Vintrace wine batches from the database.
    The frontend expects a `batches` array with camelCase keys.
    """
    stmt = select(VintraceWineBatch).order_by(VintraceWineBatch.batch_code.asc())
    rows = (await db.execute(stmt)).scalars().all()
    batches = [_batch_to_payload(b) for b in rows]
    return {"batches": batches, "count": len(batches)}

@router.post("/sync-batches", status_code=status.HTTP_200_OK)
async def trigger_vintrace_batch_sync(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: Annotated[User, Depends(get_current_active_user)] # Requires authentication
):
    """
    Triggers a synchronization of Vintrace wine batches from the Vintrace API to the database.
    This operation requires authentication.
    """
    try:
        synced_count = await sync_vintrace_wine_batches(db)
        return {"message": f"Successfully synced {synced_count} Vintrace wine batches."}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync Vintrace wine batches: {str(e)}"
        )
