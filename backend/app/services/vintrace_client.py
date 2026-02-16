from typing import Any, Dict, List, Optional

from app.config import settings
from app.core.http_client import (
    create_vintrace_client,
    vintrace_request,
)


async def fetch_inventory(max_result: int = 100) -> Dict[str, Any]:
    """
    Minimal Vintrace inventory fetch, aligned with the TS
    `/vintrace/inventory` endpoint used for debugging.
    """
    async with create_vintrace_client() as client:
        return await vintrace_request(
            client,
            f"/inventory",
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

