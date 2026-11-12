/**
 * EcoRoute AI API Service
 */

const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchBins(params = {}) {
  const query = new URLSearchParams();
  if (params.priority) query.append('priority', params.priority);
  if (params.waste_type) query.append('waste_type', params.waste_type);
  if (params.search) query.append('search', params.search);

  const url = `${API_BASE}/bins${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load bins: ${res.statusText}`);
  return res.json();
}

export async function fetchBinDetail(binId) {
  const res = await fetch(`${API_BASE}/bins/${binId}`);
  if (!res.ok) throw new Error(`Failed to load bin ${binId}`);
  return res.json();
}

export async function refreshSimulation(seed = null) {
  const url = seed !== null 
    ? `${API_BASE}/simulation/generate?seed=${seed}` 
    : `${API_BASE}/simulation/generate`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to refresh simulation: ${res.statusText}`);
  return res.json();
}

export async function optimizeRoute(selectedBinIds, depot = null, maxBins = null) {
  const payload = {
    selected_bin_ids: selectedBinIds,
    depot: depot,
    max_bins: maxBins
  };
  const res = await fetch(`${API_BASE}/routes/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Optimization failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAnalytics() {
  const res = await fetch(`${API_BASE}/analytics/summary`);
  if (!res.ok) throw new Error(`Failed to load analytics: ${res.statusText}`);
  return res.json();
}
