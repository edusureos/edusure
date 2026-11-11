import React from 'react';
import { Trash2, AlertCircle, AlertTriangle, Compass } from 'lucide-react';

import EmptyState from './EmptyState';

export default function MetricSummary({ analytics, activeRouteDistance }) {
  if (!analytics || !analytics.total_bins) {
    return (
      <EmptyState
        icon={Trash2}
        message="No analytics available yet. Data will appear here once activity is recorded."
      />
    );
  }

  const totalBins = analytics.total_bins;
  const binsNeedingCollection = analytics?.bins_needing_collection ?? 0;
  const criticalBins = analytics?.critical_bins ?? 0;
  // If an active route has been computed by the user, show its distance, otherwise fallback to estimated
  const routeDistance = activeRouteDistance !== null && activeRouteDistance !== undefined
    ? Number(activeRouteDistance).toFixed(1)
    : Number(analytics?.estimated_optimized_route_distance_km ?? 0).toFixed(1);

  const metrics = [
    {
      id: 'total',
      label: 'Total monitored bins',
      value: totalBins,
      unit: 'bins in network',
      icon: Trash2,
      badge: 'All active',
      badgeColor: 'bg-[#E6EFE5] text-[#234C36]'
    },
    {
      id: 'needing',
      label: 'Bins needing collection',
      value: binsNeedingCollection,
      unit: 'urgent & high',
      icon: AlertTriangle,
      badge: 'Requires dispatch',
      badgeColor: 'bg-amber-50 text-amber-800 border border-amber-200'
    },
    {
      id: 'critical',
      label: 'Critical bins',
      value: criticalBins,
      unit: '≥ 90% full',
      icon: AlertCircle,
      badge: 'Immediate action',
      badgeColor: 'bg-red-50 text-red-700 border border-red-200'
    },
    {
      id: 'distance',
      label: 'Estimated route distance',
      value: `${routeDistance} km`,
      unit: 'geodesic baseline',
      icon: Compass,
      badge: 'Optimized loop',
      badgeColor: 'bg-[#E6EFE5] text-[#183D2B]'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.id}
            className="bg-white border border-[#E5E8DF] rounded-xl p-4 transition-all hover:border-[#8BA88E]/60 shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#788278] truncate">
                {m.label}
              </span>
              <Icon className="w-4 h-4 text-[#8BA88E] shrink-0" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#183D2B]">
                {m.value}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-[#788278]">{m.unit}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${m.badgeColor}`}>
                {m.badge}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
