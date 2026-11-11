import React, { useState } from 'react';
import { 
  Navigation, 
  ArrowRight, 
  Building2, 
  CheckCircle, 
  Sliders, 
  MapPin, 
  ListOrdered,
  Sparkles,
  Info
} from 'lucide-react';

export default function RouteOptimizer({
  selectedBinIds = [],
  depot,
  onOptimizeRoute,
  isOptimizing,
  routeResult = null,
  onSelectBinDetail
}) {
  const [maxStops, setMaxStops] = useState(25);

  const handleOptimizeClick = () => {
    onOptimizeRoute(maxStops);
  };

  const hasResult = !!routeResult;
  const isPositiveSaving = routeResult ? routeResult.distance_saved_km >= 0 : true;

  return (
    <div className="bg-white border border-[#E5E8DF] rounded-2xl p-6 shadow-xs">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E5E8DF]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-[#183D2B]">
              Plan a smarter collection route
            </h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E6EFE5] text-[#234C36]">
              TSP Nearest-Neighbor
            </span>
          </div>
          <p className="text-sm text-[#788278] mt-1">
            Prioritize the bins that need attention and calculate an efficient collection sequence.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Max Bins slider / count */}
          <div className="flex items-center gap-2 bg-[#F8F7F1] border border-[#E5E8DF] rounded-lg px-3 py-1.5 text-xs text-[#252B26]">
            <Sliders className="w-3.5 h-3.5 text-[#788278]" />
            <span>Max Stops:</span>
            <input
              type="number"
              min="1"
              max="50"
              value={maxStops}
              onChange={(e) => setMaxStops(Math.max(1, Math.min(50, Number(e.target.value))))}
              className="w-12 text-center font-bold bg-white border border-[#E5E8DF] rounded py-0.5 focus:outline-hidden"
            />
          </div>

          {/* Primary Action Button */}
          <button
            onClick={handleOptimizeClick}
            disabled={selectedBinIds.length === 0 || isOptimizing}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#234C36] hover:bg-[#183D2B] text-white text-sm font-semibold shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Navigation className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
            <span>{isOptimizing ? 'Calculating Route...' : `Optimize Route (${selectedBinIds.length} stops)`}</span>
          </button>
        </div>
      </div>

      {/* Depot Information Banner */}
      <div className="my-4 p-3 bg-[#F8F7F1] border border-[#E5E8DF] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[#183D2B]">
          <Building2 className="w-4 h-4 text-[#234C36] shrink-0" />
          <span className="font-semibold">{depot?.name ?? 'Rohini Municipal Depot'}</span>
          <span className="text-[#788278]">({depot?.latitude?.toFixed(4)}° N, {depot?.longitude?.toFixed(4)}° E)</span>
        </div>
        <div className="text-[11px] text-[#788278]">
          Fixed Dispatch & Return Anchor Point
        </div>
      </div>

      {/* Route Results Visualization */}
      {hasResult ? (
        <div className="space-y-6 pt-2">
          {/* Comparison Cards: Baseline vs Optimized */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Baseline Route */}
            <div className="p-4 rounded-xl border border-[#E5E8DF] bg-[#F8F7F1]/50">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#788278]">
                Baseline Route
              </span>
              <div className="mt-2 text-2xl font-bold text-[#252B26]">
                {routeResult.baseline_route.total_distance_km.toFixed(1)} km
              </div>
              <p className="mt-1 text-[11px] text-[#788278]">
                Standard fixed-order dispatch loop ({routeResult.baseline_route.stop_count} stops)
              </p>
            </div>

            {/* Optimized Route */}
            <div className="p-4 rounded-xl border-2 border-[#234C36] bg-[#E6EFE5]/40 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#234C36]">
                  Optimized Route
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#234C36] text-white">
                  RECOMMENDED
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-[#183D2B]">
                {routeResult.optimized_route.total_distance_km.toFixed(1)} km
              </div>
              <p className="mt-1 text-[11px] text-[#234C36]/80 font-medium">
                Nearest-neighbor heuristic loop
              </p>
            </div>

            {/* Distance Difference & Reduction */}
            <div className="p-4 rounded-xl border border-[#E5E8DF] bg-white">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#788278]">
                Potential Distance Reduction
              </span>
              <div className={`mt-2 text-2xl font-bold flex items-baseline gap-2 ${
                isPositiveSaving ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                <span>{routeResult.percentage_saved}%</span>
                <span className="text-xs font-medium text-[#788278]">
                  ({routeResult.distance_saved_km > 0 ? `-${routeResult.distance_saved_km}` : routeResult.distance_saved_km} km)
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#788278]">
                {isPositiveSaving 
                  ? 'Calculated reduction vs unoptimized sequence' 
                  : 'Sequence evaluated; no shorter heuristic found'}
              </p>
            </div>
          </div>

          {/* Straight-line distance notice */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#F8F7F1] border border-[#E5E8DF] text-[11px] text-[#788278]">
            <Info className="w-4 h-4 text-[#8BA88E] shrink-0" />
            <span>
              <strong>Note on prototype calculations:</strong> Distances are calculated using the Haversine great-circle formula. Straight-line geodesic distance represents a comparative approximation and does not reflect turn-by-turn road networks or traffic conditions.
            </span>
          </div>

          {/* Recommended Collection Sequence */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#183D2B] flex items-center gap-1.5">
                <ListOrdered className="w-4 h-4 text-[#234C36]" />
                Recommended Collection Sequence ({routeResult.optimized_route.stops.length} checkpoints)
              </h4>
              <span className="text-[11px] text-[#788278]">
                {routeResult.selected_bins_count} collection stops + start/end depot
              </span>
            </div>

            <div className="bg-[#F8F7F1] rounded-xl border border-[#E5E8DF] p-3 max-h-[220px] overflow-y-auto divide-y divide-[#E5E8DF]/60">
              {routeResult.optimized_route.stops.map((stop, index) => {
                const isDepot = index === 0 || index === routeResult.optimized_route.stops.length - 1;
                return (
                  <div key={index} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        isDepot ? 'bg-[#183D2B] text-white' : 'bg-white border border-[#E5E8DF] text-[#183D2B]'
                      }`}>
                        {index}
                      </span>
                      <div>
                        <span className={`font-semibold ${isDepot ? 'text-[#183D2B]' : 'text-[#252B26]'}`}>
                          {stop.name}
                        </span>
                        {stop.bin_id && (
                          <span className="ml-2 text-[10px] text-[#788278]">
                            [{stop.bin_id}]
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[#788278]">
                      {stop.fill_level !== undefined && stop.fill_level !== null && (
                        <span className="font-medium text-[#183D2B]">
                          {stop.fill_level}% full
                        </span>
                      )}
                      <span>+{stop.distance_from_previous_km} km</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-xs text-[#788278]">
          Select urgent bins above and click <strong>Optimize Route</strong> to generate an efficient collection sequence and compare against baseline.
        </div>
      )}
    </div>
  );
}
