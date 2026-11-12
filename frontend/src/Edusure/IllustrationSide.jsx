import React from 'react';

/**
 * IllustrationSide Component
 * Left-hand showcase panel with pure white background and the official EduSure logo.
 * All extra decorative overlays, badges, and grids have been removed for a clean, minimal look.
 */
export default function IllustrationSide({ className = '' }) {
  return (
    <div
      className={`hidden lg:flex items-center justify-center bg-white border-r border-slate-100 p-8 xl:p-16 select-none ${className}`}
    >
      <div className="w-full max-w-[420px] xl:max-w-[460px] flex items-center justify-center p-6">
        <img
          src="/edusure-logo.jpg"
          alt="EduSure - Teachers Teach. EduSure Ensures."
          className="w-full h-auto object-contain max-h-[480px]"
        />
      </div>
    </div>
  );
}
