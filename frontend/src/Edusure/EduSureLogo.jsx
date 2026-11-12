import React from 'react';

/**
 * EduSureLogo Component
 * Brand mark featuring the official EduSure magnifying glass & growth chart emblem,
 * Navy "Edu" + Green "Sure" typography, and tagline: "Teachers Teach. EduSure Ensures."
 */
export default function EduSureLogo({
  size = 'md',
  showTagline = true,
  theme = 'light', // 'light' for light backgrounds, 'dark' for dark backgrounds
  className = '',
}) {
  const isDark = theme === 'dark';

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const titleSizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const taglineSizes = {
    sm: 'text-[11px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Official Emblem */}
      <div className={`relative flex-shrink-0 ${iconSizes[size] || iconSizes.md} rounded-xl overflow-hidden shadow-xs border border-slate-200/80 bg-white p-0.5`}>
        <img
          src="/edusure-logo.jpg"
          alt="EduSure"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Brand Text & Tagline */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1 leading-none">
          <span
            className={`font-extrabold tracking-tight font-heading ${
              titleSizes[size] || titleSizes.md
            } ${isDark ? 'text-white' : 'text-[#0A192F]'}`}
          >
            Edu<span className="text-[#2E7D32]">Sure</span>
          </span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#2E7D32] mb-2 ml-0.5" />
        </div>

        {showTagline && (
          <p
            className={`font-medium tracking-tight mt-0.5 ${
              taglineSizes[size] || taglineSizes.md
            } ${isDark ? 'text-slate-300' : 'text-slate-500'}`}
          >
            Teachers Teach. EduSure Ensures.
          </p>
        )}
      </div>
    </div>
  );
}
