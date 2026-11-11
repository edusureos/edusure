import React from 'react';
import { 
  BarChart3, 
  Leaf, 
  Truck, 
  Fuel, 
  Layers, 
  Percent, 
  ShieldCheck,
  TrendingDown
} from 'lucide-react';
import EmptyState from './EmptyState';

export default function AnalyticsView({ analytics, routeResult }) {
  if (!analytics || !analytics.total_bins) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-[#E5E8DF] rounded-2xl p-6 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#234C36] flex items-center justify-center text-white">
              <BarChart3 className="w-5 h-5 text-[#E6EFE5]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#183D2B]">
                Environmental Intelligence & Fleet Analytics
              </h2>
              <p className="text-xs text-[#788278] mt-0.5">
                Aggregate operational efficiency across recorded collection activity.
              </p>
            </div>
          </div>
        </div>
        <EmptyState
          icon={BarChart3}
          message="No analytics available yet. Data will appear here once activity is recorded."
        />
      </div>
    );
  }

  const {
    total_bins,
    bins_needing_collection,
    critical_bins,
    high_priority_bins,
    medium_priority_bins,
    low_priority_bins,
    average_fill_level,
    waste_type_breakdown,
    priority_breakdown
  } = analytics;

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-white border border-[#E5E8DF] rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#234C36] flex items-center justify-center text-white">
            <BarChart3 className="w-5 h-5 text-[#E6EFE5]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#183D2B]">
              Environmental Intelligence & Fleet Analytics
            </h2>
            <p className="text-xs text-[#788278] mt-0.5">
              Aggregate operational efficiency and carbon mitigation metrics across the Delhi Smart Urban Zone.
            </p>
          </div>
        </div>
      </div>

      {/* Top 4 Insight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#E5E8DF] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#788278]">
            <span>Average Fill Level</span>
            <Percent className="w-4 h-4 text-[#8BA88E]" />
          </div>
          <div className="text-3xl font-bold text-[#183D2B] mt-2">
            {average_fill_level}%
          </div>
          <p className="text-[11px] text-[#788278] mt-1">Across {total_bins} recorded receptacles</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E5E8DF] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#788278]">
            <span>Immediate Dispatch Ratio</span>
            <Truck className="w-4 h-4 text-[#8BA88E]" />
          </div>
          <div className="text-3xl font-bold text-[#183D2B] mt-2">
            {Math.round((bins_needing_collection / total_bins) * 100)}%
          </div>
          <p className="text-[11px] text-[#788278] mt-1">{bins_needing_collection} bins requiring vehicle dispatch</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E5E8DF] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#788278]">
            <span>Avoided Dead-Runs</span>
            <TrendingDown className="w-4 h-4 text-[#234C36]" />
          </div>
          <div className="text-3xl font-bold text-[#234C36] mt-2">
            {total_bins - bins_needing_collection}
          </div>
          <p className="text-[11px] text-[#788278] mt-1">Bins skipped due to sufficient capacity</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#E6EFE5]/40 border border-[#8BA88E]/50 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#234C36] font-semibold">
            <span>CO₂ Mitigation Target</span>
            <Leaf className="w-4 h-4 text-[#234C36]" />
          </div>
          <div className="text-3xl font-bold text-[#183D2B] mt-2">
            {analytics.estimated_optimized_route_distance_km ?? 0}
          </div>
          <p className="text-[11px] text-[#234C36]/80 font-medium mt-1">Estimated optimized route distance (km)</p>
        </div>
      </div>

      {/* Grid: Priority Distribution & Waste Streams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Priority Breakdown */}
        <div className="bg-white border border-[#E5E8DF] rounded-2xl p-6 shadow-xs">
          <h3 className="font-bold text-sm text-[#183D2B] mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#234C36]" />
            Collection Priority Distribution
          </h3>

          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-red-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  Critical (≥90% capacity)
                </span>
                <span className="font-bold text-[#252B26]">{critical_bins} bins</span>
              </div>
              <div className="w-full bg-[#E5E8DF] rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-red-600 h-full rounded-full" 
                  style={{ width: `${(critical_bins / total_bins) * 100}%` }} 
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-orange-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  High (75% - 89% capacity)
                </span>
                <span className="font-bold text-[#252B26]">{high_priority_bins} bins</span>
              </div>
              <div className="w-full bg-[#E5E8DF] rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-orange-500 h-full rounded-full" 
                  style={{ width: `${(high_priority_bins / total_bins) * 100}%` }} 
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-amber-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Medium (45% - 74% capacity)
                </span>
                <span className="font-bold text-[#252B26]">{medium_priority_bins} bins</span>
              </div>
              <div className="w-full bg-[#E5E8DF] rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full" 
                  style={{ width: `${(medium_priority_bins / total_bins) * 100}%` }} 
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  Low (&lt;45% capacity)
                </span>
                <span className="font-bold text-[#252B26]">{low_priority_bins} bins</span>
              </div>
              <div className="w-full bg-[#E5E8DF] rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full" 
                  style={{ width: `${(low_priority_bins / total_bins) * 100}%` }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Waste Stream Segregation */}
        <div className="bg-white border border-[#E5E8DF] rounded-2xl p-6 shadow-xs">
          <h3 className="font-bold text-sm text-[#183D2B] mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#8BA88E]" />
            Waste Stream Segregation
          </h3>

          <div className="space-y-3">
            {Object.entries(waste_type_breakdown || {}).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8F7F1] border border-[#E5E8DF] text-xs">
                <span className="font-medium text-[#252B26]">{type}</span>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-[#183D2B]">{count} bins</span>
                  <span className="text-[11px] text-[#788278]">({Math.round((count / total_bins) * 100)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fleet Standards & Transparency Disclosure */}
      <div className="p-5 rounded-2xl bg-white border border-[#E5E8DF] text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-[#183D2B]">
          <ShieldCheck className="w-4 h-4 text-[#234C36]" />
          Methodology & Mathematical Reproducibility
        </div>
        <p className="text-[#788278] leading-relaxed">
          EcoRoute AI evaluates municipal routing using the <strong>Haversine great-circle distance matrix</strong> coupled with a <strong>Nearest-Neighbor Traveling Salesperson Problem (TSP) heuristic</strong>. The baseline route visits selected points in sequential order from the depot and returns to the depot. The optimized route initiates at the municipal depot, sequentially traverses to the unvisited node with minimal geodesic distance, and closes the circuit back at the depot.
        </p>
        <div className="pt-2 flex flex-wrap gap-4 text-[11px] text-[#234C36] font-medium">
          <span>• Emission factor: 2.68 kg CO₂ / liter diesel</span>
          <span>• Fleet fuel rate: 28.0 L / 100 km</span>
        </div>
      </div>
    </div>
  );
}
