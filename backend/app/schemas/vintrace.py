from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class OwnerBase(BaseModel):
    id: int
    name: str
    extId: Optional[str] = None

class DesignatedVarietyBase(BaseModel):
    id: int
    name: str

class DesignatedRegionBase(BaseModel):
    id: int
    name: str

class VesselAmountBase(BaseModel):
    value: float
    unit: str

class VesselBase(BaseModel):
    id: int
    name: str
    type: str
    amount: VesselAmountBase

class TotalCostBase(BaseModel):
    total: float
    fruit: float
    overhead: float
    storage: float
    additive: float
    bulk: float
    packaging: float
    operation: float
    freight: float
    other: float

class WineBatchBase(BaseModel):
    id: int
    batchCode: str
    batchNumber: Optional[str] = None
    description: str
    productionYear: int
    owner: OwnerBase
    designatedVariety: Optional[DesignatedVarietyBase] = None
    designatedRegion: Optional[DesignatedRegionBase] = None
    vessels: List[VesselBase] = Field(default_factory=list)
    allocations: List[Any] = Field(default_factory=list) # Use Any for now, can refine if schema is known
    inactive: bool
    currentVolume: float
    volumeUnit: str
    totalCost: Optional[TotalCostBase] = None

class WineBatchCreate(WineBatchBase):
    # This schema can be used for creating new entries if needed,
    # but primarily the data will come from Vintrace API
    pass

class WineBatchInDB(WineBatchBase):
    created_at: str # Will be datetime, but as string from JSON
    updated_at: str # Will be datetime, but as string from JSON

    class Config:
        from_attributes = True