from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.cache import KeyValueStore
from app.db.models.dashboard_snapshot import DashboardSnapshot
from app.db.session import get_db_connection  # reuse asyncpg KV pool


async def create_snapshot(
    db: AsyncSession,
    payload: Dict[str, Any],
    *,
    source: str = "commerce7+vintrace",
) -> DashboardSnapshot:
    """
    Persist a new dashboard snapshot row and mirror it into the KV store
    under the same cache key that the legacy backend used.
    """
    snapshot = DashboardSnapshot(source=source, payload=payload)
    db.add(snapshot)
    await db.commit()
    await db.refresh(snapshot)

    return snapshot


async def get_latest_snapshot(db: AsyncSession) -> Optional[DashboardSnapshot]:
    """
    Return the most recent dashboard snapshot, if any.
    """
    stmt = (
        select(DashboardSnapshot)
        .order_by(DashboardSnapshot.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalars().first()

