from fastapi import APIRouter, Depends, HTTPException
from app.db.session import get_db_connection
from app.core.cache import KeyValueStore
from app.config import settings
from app.schemas.common import CachedDashboardData
import asyncpg
from datetime import datetime

router = APIRouter()

@router.get("/exec", response_model=CachedDashboardData)
async def get_dashboard_data(
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """
    Retrieves the cached dashboard executive data.
    """
    kv_store = KeyValueStore(conn)
    cached_data = await kv_store.get(settings.DASH_CACHE_KEY)

    if not cached_data:
        raise HTTPException(status_code=404, detail="Dashboard data not found in cache.")

    # Ensure timestamp is a datetime object for Pydantic validation
    # The original JS stores Date.now() which is milliseconds since epoch.
    # Python's fromtimestamp expects seconds.
    if isinstance(cached_data.get('timestamp'), (int, float)):
        cached_data['timestamp'] = datetime.fromtimestamp(cached_data['timestamp'] / 1000)
    elif isinstance(cached_data.get('timestamp'), str):
        # Handle ISO format string if it was stored differently
        try:
            cached_data['timestamp'] = datetime.fromisoformat(cached_data['timestamp'].replace('Z', '+00:00'))
        except ValueError:
            # Fallback if fromisoformat fails, Pydantic might still parse it
            pass

    return CachedDashboardData(**cached_data)
