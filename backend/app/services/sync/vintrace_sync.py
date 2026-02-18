from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
import json # To convert Pydantic models to JSON strings for storage

from app.db.models.vintrace import VintraceWineBatch
from app.services.vintrace_client import get_all_blackbird_wine_batches
from app.schemas.vintrace import WineBatchBase

async def sync_vintrace_wine_batches(db: AsyncSession) -> int:
    """
    Fetches all Blackbird wine batches from Vintrace API and syncs them to the database.
    Creates new records or updates existing ones based on batch_code.
    """
    print("[VintraceSyncService] Starting Vintrace wine batch synchronization...")
    vintrace_batches: List[WineBatchBase] = await get_all_blackbird_wine_batches()
    
    synced_count = 0
    for batch_data in vintrace_batches:
        # Check if a batch with this batch_code already exists
        stmt = select(VintraceWineBatch).where(VintraceWineBatch.batch_code == batch_data.batchCode)
        existing_batch = (await db.execute(stmt)).scalar_one_or_none()

        # Convert nested Pydantic models to dictionaries for JSON storage
        owner_data = json.loads(batch_data.owner.model_dump_json())
        designated_variety_data = json.loads(batch_data.designatedVariety.model_dump_json()) if batch_data.designatedVariety else None
        designated_region_data = json.loads(batch_data.designatedRegion.model_dump_json()) if batch_data.designatedRegion else None
        vessels_data = [json.loads(v.model_dump_json()) for v in batch_data.vessels]
        allocations_data = batch_data.allocations # allocations is already List[Any]
        total_cost_data = json.loads(batch_data.totalCost.model_dump_json()) if batch_data.totalCost else None

        if existing_batch:
            # Update existing batch
            update_stmt = (
                update(VintraceWineBatch)
                .where(VintraceWineBatch.batch_code == batch_data.batchCode)
                .values(
                    batch_number=batch_data.batchNumber,
                    description=batch_data.description,
                    production_year=batch_data.productionYear,
                    owner_data=owner_data,
                    designated_variety_data=designated_variety_data,
                    designated_region_data=designated_region_data,
                    vessels_data=vessels_data,
                    allocations_data=allocations_data,
                    inactive=batch_data.inactive,
                    current_volume=batch_data.currentVolume,
                    volume_unit=batch_data.volumeUnit,
                    total_cost_data=total_cost_data,
                    updated_at=func.now()
                )
            )
            await db.execute(update_stmt)
            print(f"[VintraceSyncService] Updated batch: {batch_data.batchCode}")
        else:
            # Create new batch
            new_batch = VintraceWineBatch(
                id=batch_data.id, # Using ID from Vintrace API, assuming it's unique across Vintrace batches
                batch_code=batch_data.batchCode,
                batch_number=batch_data.batchNumber,
                description=batch_data.description,
                production_year=batch_data.productionYear,
                owner_data=owner_data,
                designated_variety_data=designated_variety_data,
                designated_region_data=designated_region_data,
                vessels_data=vessels_data,
                allocations_data=allocations_data,
                inactive=batch_data.inactive,
                current_volume=batch_data.currentVolume,
                volume_unit=batch_data.volumeUnit,
                total_cost_data=total_cost_data,
            )
            db.add(new_batch)
            print(f"[VintraceSyncService] Added new batch: {batch_data.batchCode}")
        synced_count += 1
    
    await db.commit()
    print(f"[VintraceSyncService] Vintrace wine batch synchronization complete. Synced {synced_count} batches.")
    return synced_count
