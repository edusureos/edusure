import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  compact = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 ${
        compact ? 'px-4 py-6' : 'px-6 py-10'
      }`}
    >
      <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mb-3 shadow-xs">
        <Icon className="w-5 h-5" />
      </div>
      {title && (
        <p className="text-sm font-semibold text-[#0A192F]">{title}</p>
      )}
      {message && (
        <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
          {message}
        </p>
      )}
    </div>
  );
}
