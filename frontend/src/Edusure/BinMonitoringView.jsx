import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Trash2, 
  CheckSquare, 
  Square, 
  ExternalLink,
  CheckCheck,
  ChevronRight
} from 'lucide-react';
import EmptyState from './EmptyState';

export default function BinMonitoringView({
  bins = [],
  selectedBinIds = [],
  onToggleBinSelection,
  onSelectAllUrgent,
  onClearSelection,
  onOpenDetail
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [wasteFilter, setWasteFilter] = useState('ALL');

  const filteredBins = bins.filter((bin) => {
    if (priorityFilter !== 'ALL' && bin.priority !== priorityFilter) return false;
    if (wasteFilter !== 'ALL' && bin.waste_type !== wasteFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        bin.id.toLowerCase().includes(q) ||
        bin.location_name.toLowerCase().includes(q) ||
        bin.waste_type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const wasteTypes = ['ALL', 'Recyclable', 'General', 'Organic', 'Hazardous', 'E-Waste'];
  const priorities = ['ALL', 'Critical', 'High', 'Medium', 'Low'];

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-white border border-[#E5E8DF] rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#183D2B]">
              Municipal Bin Monitoring Network
            </h2>
            <p className="text-xs text-[#788278] mt-1">
              {bins.length === 0
                ? 'Registered receptacles and their latest readings.'
                : `Active telemetry for ${bins.length} recorded receptacles.`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSelectAllUrgent}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#234C36] hover:bg-[#183D2B] text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              Select All Urgent
            </button>
            {selectedBinIds.length > 0 && (
              <button
                onClick={onClearSelection}
                className="px-3 py-2 text-xs font-medium rounded-xl border border-[#E5E8DF] text-[#788278] hover:bg-[#F8F7F1] transition-colors cursor-pointer"
              >
                Clear Selected ({selectedBinIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-6 pt-5 border-t border-[#E5E8DF] flex flex-wrap items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#788278] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by bin ID or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-[#F8F7F1] border border-[#E5E8DF] focus:bg-white focus:outline-hidden focus:border-[#8BA88E]"
            />
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#788278] font-medium mr-1">Priority:</span>
            {priorities.map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  priorityFilter === p
                    ? 'bg-[#234C36] text-white font-semibold'
                    : 'bg-[#F8F7F1] text-[#788278] hover:bg-[#E5E8DF]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Waste Type Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#788278] font-medium mr-1">Stream:</span>
            <select
              value={wasteFilter}
              onChange={(e) => setWasteFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs bg-[#F8F7F1] border border-[#E5E8DF] text-[#252B26] focus:outline-hidden"
            >
              {wasteTypes.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {bins.length === 0 ? (
        <EmptyState
          icon={Trash2}
          message="No bins registered yet. Add your first bin to start monitoring."
        />
      ) : filteredBins.length === 0 ? (
        <EmptyState
          icon={Search}
          message="No bins match the current search or filters."
        />
      ) : (
      <div className="bg-white border border-[#E5E8DF] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F7F1] border-b border-[#E5E8DF] text-[#788278] uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 w-10">Select</th>
                <th className="py-3 px-4">Bin ID</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Waste Stream</th>
                <th className="py-3 px-4">Fill Level</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Last Collected</th>
                <th className="py-3 px-4">Sensor Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E8DF]/60 text-[#252B26]">
              {filteredBins.map((bin) => {
                const isSelected = selectedBinIds.includes(bin.id);
                return (
                  <tr
                    key={bin.id}
                    className={`hover:bg-[#F8F7F1]/60 transition-colors ${
                      isSelected ? 'bg-[#E6EFE5]/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onToggleBinSelection?.(bin.id)}
                        className="text-[#234C36] cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#234C36]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#8BA88E]" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-bold text-[#183D2B]">
                      {bin.id}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#252B26]">
                      {bin.location_name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E6EFE5] text-[#234C36]">
                        {bin.waste_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#183D2B] w-9">
                          {bin.fill_level}%
                        </span>
                        <div className="w-16 bg-[#E5E8DF] rounded-full h-1.5 overflow-hidden">
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
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        bin.priority === 'Critical' ? 'bg-red-100 text-red-700' :
                        bin.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                        bin.priority === 'Medium' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {bin.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#788278]">
                      {bin.last_collection_hours_ago}h ago
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#234C36]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {bin.sensor_health || 'Not reported'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onOpenDetail?.(bin)}
                        className="px-2 py-1 rounded-md text-[11px] font-medium text-[#234C36] hover:bg-[#E6EFE5] transition-colors cursor-pointer"
                      >
                        Telemetry
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-[#E5E8DF] bg-[#F8F7F1]/60 flex items-center justify-between text-xs text-[#788278]">
          <span>Showing {filteredBins.length} of {bins.length} monitored bins</span>
          <span>{selectedBinIds.length} bins queued for route optimization</span>
        </div>
      </div>
      )}
    </div>
  );
}
