from typing import List, Dict, Any
from .models import DepotLocation

DEFAULT_DEPOT = DepotLocation(
    name="Rohini Municipal Depot (DTU Environs)",
    latitude=28.7485,
    longitude=77.1150
)

# Live records only. Nothing is fabricated on startup.
CURRENT_DATASET: List[Dict[str, Any]] = []

def init_dataset(seed: int | None = None):
    """Keep the dataset empty. Seeded sample generation has been removed."""
    global CURRENT_DATASET
    CURRENT_DATASET = []
    return CURRENT_DATASET

def get_all_bins() -> List[Dict[str, Any]]:
    return CURRENT_DATASET

def get_bin_by_id(bin_id: str) -> Dict[str, Any] | None:
    for b in CURRENT_DATASET:
        if b["id"] == bin_id:
            return b
    return None

def refresh_simulated_readings() -> List[Dict[str, Any]]:
    """Return stored records without inventing new telemetry."""
    return CURRENT_DATASET
