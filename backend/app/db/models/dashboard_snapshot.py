from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, JSON, func

from app.db.base_class import Base


class DashboardSnapshot(Base):
    """
    Stores a full dashboard payload as a JSON blob.

    Only the most recent snapshot is used by the API to serve analytics,
    but older rows are kept for auditing / debugging purposes.
    """

    __tablename__ = "dashboard_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    source = Column(
        String(length=64),
        nullable=False,
        default="commerce7+vintrace",
    )
    payload = Column(JSON, nullable=False)

