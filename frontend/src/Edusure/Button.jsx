import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable Button Component
 * Supports prominent SaaS gradient/navy aesthetics, subtle hover scale & elevation, and loading spinners.
 */
export default function Button({
  children,
  type = 'button',
  variant = 'primary', // 'primary', 'secondary', 'outline', 'ghost'
  size = 'md',
  fullWidth = false,
  isLoading = false,
  disabled = false,
  onClick,
  icon: Icon,
  className = '',
}) {
  const baseStyles =
    'relative inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-4 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none';

  const sizeStyles = {
    sm: 'py-2 px-3.5 text-xs gap-1.5',
    md: 'py-3.5 px-5 text-sm gap-2',
    lg: 'py-4 px-6 text-base gap-2.5',
  };

  const variants = {
    primary:
      'bg-[#0A192F] hover:bg-[#112240] text-white shadow-md hover:shadow-lg hover:shadow-sky-950/20 active:scale-[0.99] focus:ring-sky-500/25 border border-slate-800',
    brand:
      'bg-gradient-to-r from-[#0284C7] via-[#0369A1] to-[#0A192F] hover:from-[#0369A1] hover:to-[#08172E] text-white shadow-md hover:shadow-xl hover:shadow-sky-500/20 active:scale-[0.99] focus:ring-sky-500/30',
    secondary:
      'bg-slate-100 hover:bg-slate-200 text-slate-800 active:scale-[0.99] focus:ring-slate-300',
    outline:
      'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-2xs active:scale-[0.99] focus:ring-sky-500/20',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus:ring-slate-200',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        ${baseStyles}
        ${sizeStyles[size] || sizeStyles.md}
        ${variants[variant] || variants.primary}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {/* Loading Spinner */}
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current" />
          <span>Signing In...</span>
        </>
      ) : (
        <>
          {Icon && <Icon className="w-4.5 h-4.5 flex-shrink-0" />}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}
