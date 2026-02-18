from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, JSON
from sqlalchemy.sql import func
from app.db.base_class import Base # Import Base from the common base_class

class VintraceWineBatch(Base):
    __tablename__ = "vintrace_wine_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_code = Column(String, unique=True, index=True, nullable=False)
    batch_number = Column(String, nullable=True)
    description = Column(String, nullable=False)
    production_year = Column(Integer, nullable=False)

    owner_data = Column(JSON, nullable=False) # Store owner object as JSON
    designated_variety_data = Column(JSON, nullable=True) # Store as JSON
    designated_region_data = Column(JSON, nullable=True) # Store as JSON
    vessels_data = Column(JSON, nullable=False) # Store list of vessels as JSON
    allocations_data = Column(JSON, nullable=False) # Store list of allocations as JSON

    inactive = Column(Boolean, nullable=False)
    current_volume = Column(Float, nullable=False)
    volume_unit = Column(String, nullable=False)
    total_cost_data = Column(JSON, nullable=True) # Store totalCost object as JSON

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=False, server_default=func.now())

    def __repr__(self):
        return f"<VintraceWineBatch(id={self.id}, batch_code='{self.batch_code}')>"
