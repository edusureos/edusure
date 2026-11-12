import React from 'react';
import { 
  X, 
  Trash2, 
  Battery, 
  Thermometer, 
  Clock, 
  CheckCircle2, 
  PlusCircle, 
  Activity,
  Layers,
  MapPin
} from 'lucide-react';

export default function BinDetailsModal({
  bin,
  isOpen,
  onClose,
  isSelected,
  onToggleSelect
}) {
  if (!isOpen || !bin) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
      <div 
        className="bg-white rounded-2xl border border-[#E5E8DF] shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#E5E8DF] flex items-center justify-between bg-[#F8F7F1]/80">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
              bin.priority === 'Critical' ? 'bg-red-600' :
              bin.priority === 'High' ? 'bg-orange-500' :
              bin.priority === 'Medium' ? 'bg-amber-500' :
              'bg-emerald-600'
            }`}>
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#183D2B]">{bin.id}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  bin.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                  bin.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                  bin.priority === 'Medium' ? 'bg-amber-100 text-amber-800' :
                  'bg-emerald-100 text-emerald-800'
                }`}>
                  {bin.priority} Priority
                </span>
              </div>
              <p className="text-xs text-[#788278]">{bin.location_name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#788278] hover:text-[#252B26] hover:bg-[#E5E8DF]/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Fill Gauge */}
          <div className="p-3.5 bg-[#F8F7F1] rounded-xl border border-[#E5E8DF]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-[#788278]">Current Capacity Fill</span>
              <span className="font-bold text-sm text-[#183D2B]">
                {bin.fill_level}% ({Math.round(bin.capacity_liters * (bin.fill_level / 100))} / {bin.capacity_liters} L)
              </span>
            </div>
            <div className="w-full bg-[#E5E8DF] rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  bin.fill_level >= 90 ? 'bg-red-600' :
                  bin.fill_level >= 75 ? 'bg-orange-500' :
                  bin.fill_level >= 45 ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`}
                style={{ width: `${bin.fill_level}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-[#788278] italic">
              Recommended: "{bin.recommended_action}"
            </p>
          </div>

          {/* Telemetry Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-white border border-[#E5E8DF] rounded-xl">
              <div className="flex items-center gap-1.5 text-[#788278] mb-1">
                <Layers className="w-3.5 h-3.5 text-[#8BA88E]" />
                <span>Waste Stream</span>
              </div>
              <span className="font-bold text-[#183D2B]">{bin.waste_type}</span>
            </div>

            <div className="p-3 bg-white border border-[#E5E8DF] rounded-xl">
              <div className="flex items-center gap-1.5 text-[#788278] mb-1">
                <Clock className="w-3.5 h-3.5 text-[#8BA88E]" />
                <span>Last Collection</span>
              </div>
              <span className="font-bold text-[#183D2B]">
                {bin.last_collection_hours_ago} hours ago
              </span>
            </div>

            <div className="p-3 bg-white border border-[#E5E8DF] rounded-xl">
              <div className="flex items-center gap-1.5 text-[#788278] mb-1">
                <Battery className="w-3.5 h-3.5 text-[#8BA88E]" />
                <span>Sensor Battery</span>
              </div>
              <span className="font-bold text-[#183D2B]">
                {bin.battery_percentage ?? 92}%
              </span>
            </div>

            <div className="p-3 bg-white border border-[#E5E8DF] rounded-xl">
              <div className="flex items-center gap-1.5 text-[#788278] mb-1">
                <Thermometer className="w-3.5 h-3.5 text-[#8BA88E]" />
                <span>Ambient Temp</span>
              </div>
              <span className="font-bold text-[#183D2B]">
                {bin.ambient_temperature_c ?? 29.2}°C
              </span>
            </div>
          </div>

          {/* Coordinates & Status */}
          <div className="p-3 bg-[#F8F7F1]/60 rounded-xl border border-[#E5E8DF] flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-[#788278]">
              <MapPin className="w-3.5 h-3.5 text-[#234C36]" />
              <span>Location Coordinates:</span>
            </div>
            <span className="font-semibold text-[#183D2B]">
              {bin.latitude.toFixed(5)}, {bin.longitude.toFixed(5)}
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E5E8DF] bg-[#F8F7F1]/40 flex gap-3">
          <button
            onClick={() => {
              onToggleSelect?.(bin.id);
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              isSelected
                ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                : 'bg-[#234C36] text-white hover:bg-[#183D2B]'
            }`}
          >
            {isSelected ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-red-600" />
                Remove from Collection Route
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                Add to Collection Route
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
