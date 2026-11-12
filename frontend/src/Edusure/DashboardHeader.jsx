import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function DashboardHeader({ onRefresh, isRefreshing, lastUpdated }) {
  return (
    <header className="bg-white border-b border-[#E5E8DF] px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#183D2B]">
            Operations dashboard
          </h2>
          <p className="text-sm text-[#788278] mt-0.5">
            Monitor waste. Prioritize collection. Reduce unnecessary travel.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E6EFE5] border border-[#8BA88E]/30 text-xs font-medium text-[#183D2B]">
            <span className="w-2 h-2 rounded-full bg-[#234C36]" />
            <span>{lastUpdated ? `Updated ${lastUpdated}` : 'Waiting for recorded activity'}</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#234C36] hover:bg-[#183D2B] text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-60 cursor-pointer"
            title="Reload stored readings"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
