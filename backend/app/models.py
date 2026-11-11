from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class DepotLocation(BaseModel):
    name: str = "Rohini Municipal Depot (DTU Environs)"
    latitude: float = 28.7485
    longitude: float = 77.1150

class Bin(BaseModel):
    id: str
    location_name: str
    latitude: float
    longitude: float
    fill_level: float = Field(..., ge=0, le=100, description="Fill level percentage (0-100)")
    waste_type: str = Field(..., description="Organic, Recyclable, General, Hazardous, E-Waste")
    last_collection_hours_ago: float
    capacity_liters: int = 240
    operational_status: str = "active"
    priority: str = Field(..., description="Critical, High, Medium, Low")
    priority_score: float = Field(..., description="Calculated priority score 0-100")
    recommended_action: str

class BinDetail(Bin):
    sensor_health: str = "Optimal"
    battery_percentage: int = 94
    ambient_temperature_c: float = 28.5

class RouteStop(BaseModel):
    stop_number: int
    bin_id: Optional[str] = None
    name: str
    latitude: float
    longitude: float
    fill_level: Optional[float] = None
    priority: Optional[str] = None
    distance_from_previous_km: float = 0.0

class RouteOptimizationRequest(BaseModel):
    selected_bin_ids: List[str]
    depot: Optional[DepotLocation] = None
    max_bins: Optional[int] = None

class RouteResult(BaseModel):
    stops: List[RouteStop]
    total_distance_km: float
    stop_count: int

class VehicleAssumptions(BaseModel):
    vehicle_type: str = "Medium Refuse Collection Vehicle (16-tonne diesel)"
    fuel_consumption_l_per_100km: float = 28.0
    emission_factor_kg_co2_per_liter: float = 2.68
    distance_metric: str = "Geodesic Haversine straight-line approximation (prototype MVP)"

class RouteOptimizationResponse(BaseModel):
    depot: DepotLocation
    selected_bins_count: int
    baseline_route: RouteResult
    optimized_route: RouteResult
    distance_saved_km: float
    percentage_saved: float
    fuel_saved_liters: float
    co2_saved_kg: float
    assumptions: VehicleAssumptions
    algorithm: str = "Nearest-Neighbor TSP Heuristic"

class AnalyticsSummary(BaseModel):
    total_bins: int
    bins_needing_collection: int
    critical_bins: int
    high_priority_bins: int
    medium_priority_bins: int
    low_priority_bins: int
    average_fill_level: float
    estimated_optimized_route_distance_km: float
    waste_type_breakdown: Dict[str, int]
    priority_breakdown: Dict[str, int]
    simulated: bool = False
