from typing import Any, Dict, List, Optional
import httpx

from app.config import settings
from app.core.http_client import (
    create_vintrace_client,
    vintrace_request,
)
from app.schemas.vintrace import WineBatchBase, DesignatedVarietyBase, DesignatedRegionBase, OwnerBase, VesselBase, TotalCostBase, VesselAmountBase

# Vintrace API endpoints (derived from vintrace.tsx)
V6_BASE_PATH = "/api/v6"
V7_BASE_PATH = "/api/v7"

# Helper to reconstruct wine batch structure from API response
def _parse_wine_batch(batch_data: Dict[str, Any]) -> WineBatchBase:
    owner_data = OwnerBase(**batch_data.get("owner", {}))
    designated_variety_data = None
    if batch_data.get("designatedVariety"):
        designated_variety_data = DesignatedVarietyBase(**batch_data["designatedVariety"])
    designated_region_data = None
    if batch_data.get("designatedRegion"):
        designated_region_data = DesignatedRegionBase(**batch_data["designatedRegion"])

    vessels_data = []
    for vessel in batch_data.get("vessels", []):
        amount = VesselAmountBase(**vessel.get("amount", {}))
        vessels_data.append(VesselBase(
            id=vessel.get("id"),
            name=vessel.get("name"),
            type=vessel.get("type"),
            amount=amount
        ))
    
    total_cost_data = None
    if batch_data.get("totalCost"):
        total_cost_data = TotalCostBase(**batch_data["totalCost"])

    # Some tenants omit fields like currentVolume/volumeUnit; default safely.
    return WineBatchBase(
        id=batch_data.get("id"),
        batchCode=batch_data.get("batchCode", ""),
        batchNumber=batch_data.get("batchNumber"),
        description=batch_data.get("description", ""),
        productionYear=batch_data.get("productionYear") or 0,
        owner=owner_data,
        designatedVariety=designated_variety_data,
        designatedRegion=designated_region_data,
        vessels=vessels_data,
        allocations=batch_data.get("allocations", []),
        inactive=bool(batch_data.get("inactive", False)),
        currentVolume=float(batch_data.get("currentVolume") or 0.0),
        volumeUnit=batch_data.get("volumeUnit") or "",
        totalCost=total_cost_data,
    )

async def fetch_inventory(max_result: int = 100) -> Dict[str, Any]:
    """
    Minimal Vintrace inventory fetch, aligned with the TS
    `/vintrace/inventory` endpoint used for debugging.
    """
    async with create_vintrace_client() as client:
        return await vintrace_request(
            client,
            f"{V6_BASE_PATH}/inventory",
            params={"maxResult": max_result},
        )


async def fetch_blackbird_inventory() -> List[Dict[str, Any]]:
    """
    Placeholder for richer Vintrace inventory/owner-specific calls.
    This can be expanded to mirror `VintraceAPI.getBlackbirdInventory`.
    """
    data = await fetch_inventory(max_result=100)
    items = data.get("inventorySummaries") or data.get("results") or []
    return items

async def get_wine_batches(
    owner_id: Optional[int] = None,
    offset: int = 0,
    limit: int = 100,
    client: Optional[httpx.AsyncClient] = None
) -> Dict[str, Any]:
    """
    Get wine batches from v7/operation/wine-batches endpoint
    """
    close_client = False
    if client is None:
        client = create_vintrace_client()
        close_client = True

    try:
        path = f"{V7_BASE_PATH}/operation/wine-batches"
        params: Dict[str, Any] = {"offset": offset, "limit": limit}

        if owner_id:
            params["ownerId"] = owner_id
        
        response = await vintrace_request(client, path, params=params)
        return response
    finally:
        if close_client:
            await client.aclose()


async def get_all_blackbird_wine_batches(
    production_years: Optional[List[int]] = None
) -> List[WineBatchBase]:
    """
    Get all Blackbird wine batches (owner ID 3) by fetching all pages automatically.
    """
    all_batches: List[WineBatchBase] = []
    offset = 0
    limit = 100
    total_results = 0
    
    async with create_vintrace_client() as client:
        while True:
            response = await get_wine_batches(owner_id=3, offset=offset, limit=limit, client=client)
            
            results = response.get("results")
            if not results or not isinstance(results, list):
                print(f"[Vintrace Client] Unexpected response format at offset {offset}")
                break
            
            for batch_data in results:
                try:
                    all_batches.append(_parse_wine_batch(batch_data))
                except Exception as e:
                    print(f"[Vintrace Client] Error parsing wine batch data: {e} - Data: {batch_data}")

            total_results = response.get("totalResults", 0)
            offset += limit
            
            if len(all_batches) >= total_results:
                break
            
            if offset > 10000: # Safety break to prevent infinite loops
                print("[Vintrace Client] Safety limit reached at offset 10000")
                break
    
    if production_years:
        all_batches = [
            batch for batch in all_batches
            if batch.productionYear in production_years
        ]

    return all_batches
