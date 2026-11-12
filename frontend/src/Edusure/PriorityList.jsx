import React, { useState } from 'react';
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckSquare, 
  Square, 
  MapPin, 
  ChevronRight,
  Filter,
  CheckCheck
} from 'lucide-react';

export default function PriorityList({
  bins = [],
  selectedBinIds = [],
  onToggleBinSelection,
  onSelectAllUrgent,
  onClearSelection,
  onFocusBin,
  onOpenDetail
}) {
  const [filterPriority, setFilterPriority] = useState('urgent'); // 'urgent', 'all', 'critical'
  const [searchTerm, setSearchTerm] = useState('');

  // Sort bins by priority_score descending (or Critical first, then High, etc.)
  const sortedBins = [...bins].sort((a, b) => {
    // Critical first, then High, then score
    const pRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const diff = (pRank[b.priority] || 0) - (pRank[a.priority] || 0);
    if (diff !== 0) return diff;
    return b.priority_score - a.priority_score;
  });

  const filteredBins = sortedBins.filter(bin => {
    if (filterPriority === 'critical' && bin.priority !== 'Critical') return false;
    if (filterPriority === 'urgent' && !['Critical', 'High'].includes(bin.priority)) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return bin.id.toLowerCase().includes(q) || bin.location_name.toLowerCase().includes(q);
    }
    return true;
  });

  const urgentCount = bins.filter(b => ['Critical', 'High'].includes(b.priority)).length;
  const criticalCount = bins.filter(b => b.priority === 'Critical').length;

  return (
    <div className="bg-white border border-[#E5E8DF] rounded-2xl p-5 shadow-xs flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E8DF]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-[#183D2B]">Needs attention</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
              {urgentCount} Urgent
            </span>
          </div>
          <p className="text-xs text-[#788278] mt-0.5">
            Prioritized by current fill capacity and elapsed telemetry time
          </p>
        </div>

        {/* Quick Batch Actions */}
        <div className="flex items-center gap-2 pt-1 sm:pt-0">
          <button
            onClick={onSelectAllUrgent}
            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-[#E6EFE5] hover:bg-[#d6e5d5] text-[#234C36] transition-colors flex items-center gap-1 cursor-pointer"
            title="Select all Critical and High priority bins for route calculation"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Select Urgent ({urgentCount})
          </button>
          {selectedBinIds.length > 0 && (
            <button
              onClick={onClearSelection}
              className="px-2 py-1 text-xs font-medium text-[#788278] hover:text-[#252B26] transition-colors cursor-pointer"
            >
              Clear ({selectedBinIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 py-3 border-b border-[#E5E8DF]/60">
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterPriority('urgent')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              filterPriority === 'urgent'
                ? 'bg-[#234C36] text-white font-semibold'
                : 'bg-[#F8F7F1] text-[#788278] hover:bg-[#E5E8DF]'
            }`}
          >
            Urgent ({urgentCount})
          </button>
          <button
            onClick={() => setFilterPriority('critical')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              filterPriority === 'critical'
                ? 'bg-red-700 text-white font-semibold'
                : 'bg-[#F8F7F1] text-[#788278] hover:bg-[#E5E8DF]'
            }`}
          >
            Critical ({criticalCount})
          </button>
          <button
            onClick={() => setFilterPriority('all')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              filterPriority === 'all'
                ? 'bg-[#234C36] text-white font-semibold'
                : 'bg-[#F8F7F1] text-[#788278] hover:bg-[#E5E8DF]'
            }`}
          >
            All Bins ({bins.length})
          </button>
        </div>

        <input
          type="text"
          placeholder="Filter bins..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="text-xs px-2.5 py-1 rounded-md border border-[#E5E8DF] bg-[#F8F7F1] focus:bg-white focus:outline-hidden focus:border-[#8BA88E] max-w-[130px]"
        />
      </div>

      {/* Scrollable Bin Priority List */}
      <div className="overflow-y-auto divide-y divide-[#E5E8DF]/60 flex-1 max-h-[420px] pr-1">
        {filteredBins.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#788278]">
            No bins found matching current filter criteria.
          </div>
        ) : (
          filteredBins.map((bin) => {
            const isSelected = selectedBinIds.includes(bin.id);
            const isCritical = bin.priority === 'Critical';
            const isHigh = bin.priority === 'High';

            return (
              <div
                key={bin.id}
                onClick={() => onFocusBin?.(bin)}
                className={`py-2.5 px-2 rounded-lg transition-colors flex items-center justify-between gap-3 group cursor-pointer ${
                  isSelected ? 'bg-[#F8F7F1]' : 'hover:bg-[#F8F7F1]/60'
                }`}
              >
                {/* Checkbox and ID */}
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBinSelection?.(bin.id);
                    }}
                    className="text-[#234C36] hover:opacity-80 transition-opacity shrink-0 cursor-pointer"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#234C36]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#8BA88E]" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#183D2B]">{bin.id}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        isCritical ? 'bg-red-100 text-red-700' :
                        isHigh ? 'bg-orange-100 text-orange-700' :
                        bin.priority === 'Medium' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {bin.priority}
                      </span>
                      <span className="text-[10px] text-[#788278] truncate hidden sm:inline">
                        • {bin.location_name}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#788278] truncate mt-0.5">
                      "{bin.recommended_action}"
                    </p>
                  </div>
                </div>

                {/* Fill Percentage & Map Focus Indicator */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-[#183D2B]">
                      {bin.fill_level}% full
                    </div>
                    <div className="w-16 bg-[#E5E8DF] rounded-full h-1 mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          bin.fill_level >= 90 ? 'bg-red-600' :
                          bin.fill_level >= 75 ? 'bg-orange-500' :
                          bin.fill_level >= 45 ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`}
                        style={{ width: `${bin.fill_level}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetail?.(bin);
                    }}
                    className="p-1 rounded text-[#788278] hover:text-[#183D2B] hover:bg-[#E5E8DF]/40 transition-colors"
                    title="View sensor telemetry"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-[#E5E8DF] flex items-center justify-between text-xs text-[#788278]">
        <span>{selectedBinIds.length} stops selected</span>
        <span className="text-[11px]">Click row to locate on map</span>
      </div>
    </div>
  );
}
