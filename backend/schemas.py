"""Pydantic request/response schemas for the FastAPI layer."""
from typing import Optional
from pydantic import BaseModel, Field


class InventoryCreate(BaseModel):
    owner_id: int
    food_item: str
    category: str
    quantity: float = Field(gt=0)
    unit: str = "kg"
    location_id: int
    available_date: str
    shelf_life_hours: float = Field(gt=0)
    priority: str = "NORMAL"


class InventoryUpdate(BaseModel):
    food_item: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = Field(default=None, ge=0)
    unit: Optional[str] = None
    shelf_life_hours: Optional[float] = Field(default=None, gt=0)
    priority: Optional[str] = None
    status: Optional[str] = None


class DemandCreate(BaseModel):
    requester_id: int
    food_item: str
    category: str
    quantity: float = Field(gt=0)
    needed_by: str
    location_id: int
    priority: str = "NORMAL"
    recurring: bool = False


class DemandUpdate(BaseModel):
    food_item: Optional[str] = None
    quantity: Optional[float] = Field(default=None, gt=0)
    needed_by: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    recurring: Optional[bool] = None


class AcceptMatchBody(BaseModel):
    quantity: Optional[float] = Field(default=None, gt=0)
    initiated_by: Optional[str] = None


class RequestSupplyBody(BaseModel):
    """A buyer requesting a specific quantity straight from a listing."""
    inventory_id: int
    demand_id: int
    quantity: float = Field(gt=0)
    initiated_by: Optional[str] = None


class AssignDistributorBody(BaseModel):
    distributor_id: int


class ClockBody(BaseModel):
    hours: Optional[float] = None
    reset: bool = False
