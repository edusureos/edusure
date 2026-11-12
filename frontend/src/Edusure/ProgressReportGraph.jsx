import React from 'react';
import { BarChart3, LineChart } from 'lucide-react';
import EmptyState from './EmptyState';

/**
 * Progress report panel.
 * Charts render only from supplied records. With no records, the panel stays empty.
 */
export default function ProgressReportGraph({ terms = [], subjects = [] }) {
  const hasData = terms.length > 0 || subjects.length > 0;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-[#0A192F] shadow-xs">
          <LineChart className="w-3.5 h-3.5" />
          <span>Performance Curve</span>
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Subject Analysis</span>
        </span>
      </div>

      {hasData ? (
        <div className="space-y-2 text-xs">
          {terms.map((term) => (
            <div key={term.label} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="font-semibold text-[#0A192F]">{term.label}</span>
              <span className="text-slate-600">{term.score}</span>
            </div>
          ))}
          {subjects.map((subject) => (
            <div key={subject.name} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="font-semibold text-[#0A192F]">{subject.name}</span>
              <span className="text-slate-600">{subject.score}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BarChart3}
          message="No reports available yet. Reports will appear here once generated."
        />
      )}
    </div>
  );
}
