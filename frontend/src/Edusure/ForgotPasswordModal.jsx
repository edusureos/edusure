import React, { useState, useEffect } from 'react';
import { X, KeyRound, Mail, ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';

/**
 * ForgotPasswordModal Component
 * Interactive recovery dialog allowing users to initiate a password reset link for EduSure.
 */
export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your User ID .');
      return;
    }
    setError('');
    setIsSubmitted(true);
  };

  const handleResetModal = () => {
    setIdentifier('');
    setIsSubmitted(false);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0A192F]/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={handleResetModal}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 sm:p-7 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Sky Blue Ambient Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-500 via-sky-400 to-[#0A192F]" />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleResetModal}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5 stroke-[2]" />
        </button>

        {!isSubmitted ? (
          <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shadow-2xs">
                <KeyRound className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0A192F] font-heading">
                  Reset Password
                </h3>
                <p className="text-xs text-slate-500">
                  EduSure Account Recovery System
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Enter your registered <strong className="text-slate-800">User ID</strong> {' '}
              <strong className="text-slate-800"></strong>. We will dispatch a secure 6-digit verification code to reset your credentials.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="recovery-input"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  User ID 
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                    <Mail className="w-4.5 h-4.5" />
                  </div>
                  <input
                    id="recovery-input"
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Enter your registered ID"
                    className={`w-full py-3 pl-10 pr-4 text-xs font-medium text-slate-900 bg-slate-50 border rounded-xl outline-none transition-all placeholder:text-slate-400 ${
                      error
                        ? 'border-red-400 ring-2 ring-red-500/10'
                        : 'border-slate-200 focus:border-sky-500 focus:bg-white focus:ring-3 focus:ring-sky-500/15'
                    }`}
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1 font-medium">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {error}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetModal}
                  className="w-1/3 py-2.5 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-2/3 py-2.5 px-4 text-xs font-semibold text-white bg-[#0A192F] hover:bg-[#112240] rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending link...</span>
                    </>
                  ) : (
                    <span>Send Recovery Code</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Confirmation Success State */
          <div className="text-center py-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-500 mx-auto flex items-center justify-center mb-3.5 border border-slate-200 shadow-2xs">
              <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
            </div>

            <h3 className="text-base font-bold text-[#0A192F] font-heading mb-1.5">
              Password recovery is not available yet
            </h3>

            <p className="text-xs text-slate-600 mb-5 leading-relaxed max-w-xs mx-auto">
              Reset instructions will be sent for <strong className="text-slate-800 font-semibold">{identifier}</strong> once account recovery is connected. No message was sent.
            </p>

            <button
              type="button"
              onClick={handleResetModal}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#0A192F] hover:bg-[#112240] rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
