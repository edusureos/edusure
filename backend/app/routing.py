import math
from typing import List, Dict, Any
from .models import DepotLocation, Bin, RouteStop, RouteResult, VehicleAssumptions, RouteOptimizationResponse

EARTH_RADIUS_KM = 6371.0

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two geographic coordinates in kilometers.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    
    # Numerical guard
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return round(EARTH_RADIUS_KM * c, 3)

def compute_route_from_sequence(stops_points: List[Dict[str, Any]], depot: DepotLocation) -> RouteResult:
    """
    Given a list of bin dictionary objects in visit sequence, builds the full round trip:
    Depot -> Stop 1 -> Stop 2 -> ... -> Stop N -> Depot
    Calculates step distances and total distance.
    """
    if not stops_points:
        return RouteResult(stops=[], total_distance_km=0.0, stop_count=0)

    route_stops: List[RouteStop] = []
    
    # 0. Start at Depot
    current_lat = depot.latitude
    current_lon = depot.longitude
    
    route_stops.append(RouteStop(
        stop_number=0,
        bin_id=None,
        name=f"Depot: {depot.name} (Start)",
        latitude=current_lat,
        longitude=current_lon,
        distance_from_previous_km=0.0
    ))

    total_dist = 0.0

    # 1. Stops along sequence
    for idx, b in enumerate(stops_points, start=1):
        dist = haversine_distance(current_lat, current_lon, b["latitude"], b["longitude"])
        total_dist += dist
        route_stops.append(RouteStop(
            stop_number=idx,
            bin_id=b["id"],
            name=b.get("location_name", b["id"]),
            latitude=b["latitude"],
            longitude=b["longitude"],
            fill_level=b.get("fill_level"),
            priority=b.get("priority"),
            distance_from_previous_km=dist
        ))
        current_lat = b["latitude"]
        current_lon = b["longitude"]

    # 2. Return to Depot
    return_dist = haversine_distance(current_lat, current_lon, depot.latitude, depot.longitude)
    total_dist += return_dist
    route_stops.append(RouteStop(
        stop_number=len(stops_points) + 1,
        bin_id=None,
        name=f"Depot: {depot.name} (Return)",
        latitude=depot.latitude,
        longitude=depot.longitude,
        distance_from_previous_km=return_dist
    ))

    return RouteResult(
        stops=route_stops,
        total_distance_km=round(total_dist, 2),
        stop_count=len(stops_points)
    )

def solve_nearest_neighbor(bins: List[Dict[str, Any]], depot: DepotLocation) -> List[Dict[str, Any]]:
    """
    Nearest-Neighbor TSP heuristic starting at the depot.
    """
    if not bins:
        return []

    unvisited = list(bins)
    ordered: List[Dict[str, Any]] = []
    curr_lat, curr_lon = depot.latitude, depot.longitude

    while unvisited:
        nearest_idx = 0
        min_dist = float("inf")
        for i, b in enumerate(unvisited):
            d = haversine_distance(curr_lat, curr_lon, b["latitude"], b["longitude"])
            if d < min_dist:
                min_dist = d
                nearest_idx = i
        
        chosen = unvisited.pop(nearest_idx)
        ordered.append(chosen)
        curr_lat, curr_lon = chosen["latitude"], chosen["longitude"]

    return ordered

def optimize_waste_route(
    selected_bins: List[Dict[str, Any]],
    depot: DepotLocation
) -> RouteOptimizationResponse:
    assumptions = VehicleAssumptions()
    
    if not selected_bins:
        empty_result = RouteResult(stops=[], total_distance_km=0.0, stop_count=0)
        return RouteOptimizationResponse(
            depot=depot,
            selected_bins_count=0,
            baseline_route=empty_result,
            optimized_route=empty_result,
            distance_saved_km=0.0,
            percentage_saved=0.0,
            fuel_saved_liters=0.0,
            co2_saved_kg=0.0,
            assumptions=assumptions
        )

    # Baseline route: Fixed reproducible sequence (the order provided/ordered by ID)
    baseline_sequence = sorted(selected_bins, key=lambda b: b["id"])
    baseline_result = compute_route_from_sequence(baseline_sequence, depot)

    # Optimized route: Nearest Neighbor algorithm
    optimized_sequence = solve_nearest_neighbor(selected_bins, depot)
    optimized_result = compute_route_from_sequence(optimized_sequence, depot)

    # Comparisons
    baseline_dist = baseline_result.total_distance_km
    optimized_dist = optimized_result.total_distance_km
    distance_saved = round(baseline_dist - optimized_dist, 2)
    
    if baseline_dist > 0.001:
        percentage_saved = round((distance_saved / baseline_dist) * 100.0, 1)
    else:
        percentage_saved = 0.0

    fuel_saved_liters = round(
        (distance_saved * assumptions.fuel_consumption_l_per_100km) / 100.0, 2
    )
    co2_saved_kg = round(
        fuel_saved_liters * assumptions.emission_factor_kg_co2_per_liter, 2
    )

    return RouteOptimizationResponse(
        depot=depot,
        selected_bins_count=len(selected_bins),
        baseline_route=baseline_result,
        optimized_route=optimized_result,
        distance_saved_km=distance_saved,
        percentage_saved=percentage_saved,
        fuel_saved_liters=fuel_saved_liters,
        co2_saved_kg=co2_saved_kg,
        assumptions=assumptions
    )
