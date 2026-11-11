from typing import List, Dict, Any
from .models import AnalyticsSummary, DepotLocation
from .data import get_all_bins, DEFAULT_DEPOT
from .routing import optimize_waste_route

def compute_analytics_summary() -> AnalyticsSummary:
    bins = get_all_bins()
    total_bins = len(bins)
    
    if total_bins == 0:
        return AnalyticsSummary(
            total_bins=0,
            bins_needing_collection=0,
            critical_bins=0,
            high_priority_bins=0,
            medium_priority_bins=0,
            low_priority_bins=0,
            average_fill_level=0.0,
            estimated_optimized_route_distance_km=0.0,
            waste_type_breakdown={},
            priority_breakdown={},
            simulated=False
        )

    critical_count = sum(1 for b in bins if b["priority"] == "Critical")
    high_count = sum(1 for b in bins if b["priority"] == "High")
    medium_count = sum(1 for b in bins if b["priority"] == "Medium")
    low_count = sum(1 for b in bins if b["priority"] == "Low")
    
    bins_needing_collection = critical_count + high_count
    avg_fill = round(sum(b["fill_level"] for b in bins) / total_bins, 1)

    waste_types: Dict[str, int] = {}
    for b in bins:
        wt = b.get("waste_type", "General")
        waste_types[wt] = waste_types.get(wt, 0) + 1

    priorities = {
        "Critical": critical_count,
        "High": high_count,
        "Medium": medium_count,
        "Low": low_count
    }

    # Calculate estimated route distance for all bins needing collection
    urgent_bins = [b for b in bins if b["priority"] in ("Critical", "High")]
    if urgent_bins:
        route_eval = optimize_waste_route(urgent_bins, DEFAULT_DEPOT)
        est_distance = route_eval.optimized_route.total_distance_km
    else:
        est_distance = 0.0

    return AnalyticsSummary(
        total_bins=total_bins,
        bins_needing_collection=bins_needing_collection,
        critical_bins=critical_count,
        high_priority_bins=high_count,
        medium_priority_bins=medium_count,
        low_priority_bins=low_count,
        average_fill_level=avg_fill,
        estimated_optimized_route_distance_km=est_distance,
        waste_type_breakdown=waste_types,
        priority_breakdown=priorities,
        simulated=False
    )
