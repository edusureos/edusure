import React, { useState } from 'react';
import { 
  Leaf, 
  Fuel, 
  Route, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp,
  ShieldAlert
} from 'lucide-react';

export default function ImpactSummary({ routeResult }) {
  const [showAssumptions, setShowAssumptions] = useState(false);

  if (!routeResult) {
    return (
      <div className="bg-white border border-[#E5E8DF] rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-[#183D2B]">
          Potential environmental impact
        </h3>
        <p className="text-xs text-[#788278] mt-1">
          Optimize a collection route to view estimated fuel and carbon emissions savings.
        </p>
      </div>
    );
  }

  const { distance_saved_km, fuel_saved_liters, co2_saved_kg, assumptions } = routeResult;
  const isPositive = distance_saved_km >= 0;

  return (
    <div className="bg-white border border-[#E5E8DF] rounded-2xl p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E5E8DF]">
        <div>
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-[#234C36]" />
            <h3 className="text-base font-bold text-[#183D2B]">
              Potential environmental impact
            </h3>
          </div>
          <p className="text-xs text-[#788278] mt-0.5">
            Estimates from the recorded route and the fleet fuel model.
          </p>
        </div>

        <button
          onClick={() => setShowAssumptions(!showAssumptions)}
          className="text-xs text-[#234C36] font-medium flex items-center gap-1 hover:underline cursor-pointer"
        >
          <span>{showAssumptions ? 'Hide calculation assumptions' : 'View calculation assumptions'}</span>
          {showAssumptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Three Primary Impact Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        {/* Distance Saved */}
        <div className="p-4 rounded-xl bg-[#F8F7F1] border border-[#E5E8DF]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#788278]">
              Estimated distance saved
            </span>
            <Route className="w-4 h-4 text-[#8BA88E]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold tracking-tight ${
              isPositive ? 'text-[#183D2B]' : 'text-amber-800'
            }`}>
              {distance_saved_km > 0 ? `+${distance_saved_km}` : distance_saved_km}
            </span>
            <span className="text-xs font-semibold text-[#788278]">km</span>
          </div>
          <p className="mt-1 text-[11px] text-[#788278]">
            Reduction in collection travel per cycle
          </p>
        </div>

        {/* Fuel Saved */}
        <div className="p-4 rounded-xl bg-[#F8F7F1] border border-[#E5E8DF]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#788278]">
              Estimated fuel saved
            </span>
            <Fuel className="w-4 h-4 text-[#8BA88E]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold tracking-tight ${
              isPositive ? 'text-[#183D2B]' : 'text-amber-800'
            }`}>
              {fuel_saved_liters > 0 ? `+${fuel_saved_liters}` : fuel_saved_liters}
            </span>
            <span className="text-xs font-semibold text-[#788278]">liters diesel</span>
          </div>
          <p className="mt-1 text-[11px] text-[#788278]">
            Based on heavy municipal refuse vehicle
          </p>
        </div>

        {/* CO2 Emissions Avoided */}
        <div className="p-4 rounded-xl bg-[#E6EFE5]/50 border border-[#8BA88E]/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#234C36]">
              Estimated CO₂ avoided
            </span>
            <Leaf className="w-4 h-4 text-[#234C36]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold tracking-tight ${
              isPositive ? 'text-[#183D2B]' : 'text-amber-800'
            }`}>
              {co2_saved_kg > 0 ? `+${co2_saved_kg}` : co2_saved_kg}
            </span>
            <span className="text-xs font-semibold text-[#234C36]">kg CO₂e</span>
          </div>
          <p className="mt-1 text-[11px] text-[#234C36]/80 font-medium">
            Avoided diesel combustion emissions
          </p>
        </div>
      </div>

      {/* Assumptions Accordion */}
      {showAssumptions && (
        <div className="mt-4 p-4 rounded-xl bg-[#F8F7F1] border border-[#E5E8DF] text-xs text-[#252B26] space-y-2">
          <div className="font-bold text-[#183D2B] mb-1">
            Fleet Model Assumptions & Parameters
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            <div>
              <span className="text-[#788278]">Vehicle Classification:</span>
              <p className="font-medium">{assumptions?.vehicle_type ?? 'Medium Refuse Truck (16t)'}</p>
            </div>
            <div>
              <span className="text-[#788278]">Specific Fuel Consumption:</span>
              <p className="font-medium">{assumptions?.fuel_consumption_l_per_100km ?? 28.0} L / 100 km</p>
            </div>
            <div>
              <span className="text-[#788278]">Diesel CO₂ Emission Factor:</span>
              <p className="font-medium">{assumptions?.emission_factor_kg_co2_per_liter ?? 2.68} kg CO₂ / L</p>
            </div>
            <div>
              <span className="text-[#788278]">Distance Approximation:</span>
              <p className="font-medium">{assumptions?.distance_metric ?? 'Haversine Geodesic'}</p>
            </div>
          </div>
          <p className="text-[10px] text-[#788278] pt-2 border-t border-[#E5E8DF]">
            * Disclaimer: All figures are theoretical estimates provided for operational prototyping. Actual road network geometry, stops, idle time, and vehicle load affect real-world emissions.
          </p>
        </div>
      )}
    </div>
  );
}
