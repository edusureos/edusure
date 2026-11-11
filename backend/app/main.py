from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

from .models import (
    Bin,
    BinDetail,
    DepotLocation,
    RouteOptimizationRequest,
    RouteOptimizationResponse,
    AnalyticsSummary
)
from .data import (
    get_all_bins,
    get_bin_by_id,
    init_dataset,
    refresh_simulated_readings,
    DEFAULT_DEPOT
)
from .routing import optimize_waste_route
from .analytics import compute_analytics_summary

app = FastAPI(
    title="EcoRoute AI API",
    description="Intelligent Waste Collection Routing and Municipal Fleet Optimization Engine",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "EcoRoute AI",
        "version": "1.0.0",
        "demonstration_area": "Delhi Smart Urban Zone (Rohini / DTU)",
        "simulated_environment": False
    }

@app.get("/api/bins", response_model=List[Bin])
def list_bins(
    priority: Optional[str] = Query(None, description="Filter by priority: Critical, High, Medium, Low"),
    waste_type: Optional[str] = Query(None, description="Filter by waste type"),
    search: Optional[str] = Query(None, description="Search by ID or Location name")
):
    bins = get_all_bins()
    
    if priority:
        bins = [b for b in bins if b["priority"].lower() == priority.lower()]
    if waste_type:
        bins = [b for b in bins if b["waste_type"].lower() == waste_type.lower()]
    if search:
        s = search.lower()
        bins = [b for b in bins if s in b["id"].lower() or s in b["location_name"].lower()]

    return bins

@app.get("/api/bins/{bin_id}", response_model=BinDetail)
def get_bin(bin_id: str):
    bin_data = get_bin_by_id(bin_id)
    if not bin_data:
        raise HTTPException(status_code=404, detail=f"Waste bin with ID '{bin_id}' was not found.")
    return bin_data

@app.post("/api/simulation/generate")
def regenerate_simulation(seed: Optional[int] = Query(None, description="Optional seed for dataset generation")):
    if seed is not None:
        updated = init_dataset(seed)
    else:
        updated = refresh_simulated_readings()
        
    return {
        "status": "success",
        "message": "No stored sensor readings to refresh.",
        "bins_count": len(updated),
        "disclaimer": "Telemetry is shown only when records exist in the dataset."
    }

@app.post("/api/routes/optimize", response_model=RouteOptimizationResponse)
def optimize_route(request: RouteOptimizationRequest):
    all_bins = {b["id"]: b for b in get_all_bins()}
    
    # Validate selected bins
    selected_bins = []
    for bin_id in request.selected_bin_ids:
        if bin_id in all_bins:
            selected_bins.append(all_bins[bin_id])
    
    if request.max_bins and request.max_bins > 0:
        selected_bins = selected_bins[:request.max_bins]

    depot = request.depot if request.depot else DEFAULT_DEPOT

    result = optimize_waste_route(selected_bins, depot)
    return result

@app.get("/api/analytics/summary", response_model=AnalyticsSummary)
def get_analytics():
    return compute_analytics_summary()
