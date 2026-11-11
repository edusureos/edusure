import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

/**
 * Reusable PasswordField Component
 * Features lock icon, show/hide password toggle button, and Caps Lock notification.
 */
export default function PasswordField({
  id = 'password',
  label = 'Password',
  name = 'password',
  value = '',
  onChange,
  placeholder = 'Enter your password',
  error = '',
  required = true,
  autoComplete = 'current-password',
  disabled = false,
  className = '',
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  const toggleShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleKeyUp = (e) => {
    if (e.getModifierState) {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {/* Label and Caps Lock Alert */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-xs font-semibold text-slate-700 tracking-wide select-none"
        >
          {label}
          {required && <span className="text-sky-500 ml-1 font-bold">*</span>}
        </label>
        {isCapsLockOn && (
          <span className="text-[11px] font-medium text-amber-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Caps Lock is ON
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
        {/* Left Lock Icon */}
        <div
          className={`absolute left-3.5 flex items-center pointer-events-none transition-colors duration-200 ${
            error
              ? 'text-red-500'
              : isFocused
              ? 'text-sky-600'
              : 'text-slate-400'
          }`}
        >
          <Lock className="w-5 h-5 stroke-[1.8]" />
        </div>

        {/* Password Input */}
        <input
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyUp={handleKeyUp}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          className="w-full py-3.5 pl-11 pr-11 text-sm font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal bg-transparent rounded-xl outline-none tracking-normal transition-colors"
        />

        {/* Toggle Visibility Button */}
        <button
          type="button"
          onClick={toggleShowPassword}
          disabled={disabled}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-3.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus:text-sky-600 transition-colors cursor-pointer"
        >
          {showPassword ? (
            <EyeOff className="w-4.5 h-4.5 stroke-[1.9]" />
          ) : (
            <Eye className="w-4.5 h-4.5 stroke-[1.9]" />
          )}
        </button>
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
