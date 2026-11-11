"""
Transparent Priority Calculation Module for EcoRoute AI.
Combines fill percentage (75% weight) with elapsed hours since last collection (25% weight).
Strict rule: Any bin with fill_level >= 90% is classified as Critical.
"""

def calculate_priority(fill_level: float, hours_ago: float) -> tuple[str, float, str]:
    # Time factor normalized to a 48-hour cycle
    time_score = min(100.0, (hours_ago / 48.0) * 100.0)
    
    # Combined score
    raw_score = (0.75 * fill_level) + (0.25 * time_score)
    final_score = round(min(100.0, max(0.0, raw_score)), 1)
    
    # Mandatory rule: >= 90% fill is always Critical
    if fill_level >= 90.0:
        priority = "Critical"
        final_score = max(final_score, fill_level)
        action = "Immediate dispatch required: capacity nearly reached"
    elif final_score >= 75.0 or fill_level >= 75.0:
        priority = "High"
        action = "Collection recommended soon before next cycle"
    elif final_score >= 45.0 or fill_level >= 45.0:
        priority = "Medium"
        action = "Regular monitoring: capacity at moderate level"
    else:
        priority = "Low"
        action = "Adequate capacity: no immediate action required"
        
    return priority, final_score, action
