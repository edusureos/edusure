import React, { useState } from 'react';
import { User, X, AlertCircle } from 'lucide-react';

/**
 * Reusable InputField Component
 * Features rounded styling, subtle borders, focus rings with sky-blue accents, and accessible error states.
 */
export default function InputField({
  id = 'user-id',
  label = 'User ID',
  name = 'userId',
  value = '',
  onChange,
  placeholder = 'Enter your registered ID',
  icon: Icon = User,
  error = '',
  hint = '',
  required = true,
  autoComplete = 'username',
  disabled = false,
  className = '',
}) {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    if (onChange) {
      onChange({ target: { name, value: '' } });
    }
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {/* Label and optional hint */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-xs font-semibold text-slate-700 tracking-wide select-none"
        >
          {label}
          {required && <span className="text-sky-500 ml-1 font-bold">*</span>}
        </label>
        {hint && (
          <span className="text-[11px] text-slate-400 font-normal">
            {hint}
          </span>
        )}
      </div>

      {/* Input container */}
      <div
        className={`relative flex items-center transition-all duration-200 rounded-xl bg-white border ${
          error
            ? 'border-red-400 ring-3 ring-red-500/10'
            : isFocused
            ? 'border-sky-500 ring-4 ring-sky-500/15 shadow-sm'
            : 'border-slate-200 hover:border-slate-300 shadow-xs'
        } ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-75' : ''}`}
      >
        {/* Left Icon */}
        <div
          className={`absolute left-3.5 flex items-center pointer-events-none transition-colors duration-200 ${
            error
              ? 'text-red-500'
              : isFocused
              ? 'text-sky-600'
              : 'text-slate-400'
          }`}
        >
          {Icon && <Icon className="w-5 h-5 stroke-[1.8]" />}
        </div>

        {/* Text Input */}
        <input
          id={id}
          name={name}
          type="text"
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          className="w-full py-3.5 pl-11 pr-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal bg-transparent rounded-xl outline-none transition-colors"
        />

        {/* Clear input button if user has entered text */}
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            tabIndex={-1}
            aria-label="Clear User ID"
            className="absolute right-3.5 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 stroke-[2]" />
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 mt-0.5 animate-fadeIn">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
