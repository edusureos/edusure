import React, { useState } from 'react';
import { User, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import InputField from './InputField';
import PasswordField from './PasswordField';
import Button from './Button';
import ForgotPasswordModal from './ForgotPasswordModal';

/**
 * LoginForm Component
 * Clean, minimalistic login form on a pure white background.
 * Features the prominent headline: "Teachers Teach. EduSure Ensures."
 * (Right-side logo removed as requested).
 */
export default function LoginForm({ onLogin }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  // Validate fields on submit
  const validateForm = () => {
    const newErrors = {};
    if (!userId.trim()) {
      newErrors.userId = 'Please enter your registered User ID.';
    } else if (userId.trim().length < 3) {
      newErrors.userId = 'User ID must be at least 3 characters long.';
    }

    if (!password) {
      newErrors.password = 'Please enter your account password.';
    } else if (password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setLoginSuccess(false);

    setTimeout(() => {
      setIsLoading(false);
      setLoginSuccess(true);
      if (onLogin) {
        onLogin({ userId });
      }
    }, 600);
  };

  return (
    <div className="w-full max-w-[460px] mx-auto px-4 sm:px-0 py-6 sm:py-8 bg-white">
      {/* Main Headline: Teachers Teach. EduSure Ensures. */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl xl:text-[2.6rem] font-extrabold text-[#0A192F] tracking-tight font-heading leading-tight">
          Teachers Teach. <br />
          <span className="text-[#2E7D32]">EduSure Ensures.</span>
        </h1>
        <p className="text-sm text-slate-500 mt-3 font-normal leading-relaxed">
           Sign in to continue to your EduSure account.
        </p>
      </div>

      {loginSuccess && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-emerald-900">Opening your portal</p>
            <p className="text-emerald-700 mt-0.5">
              Signed in as <span className="font-semibold">{userId}</span>.
            </p>
          </div>
        </div>
      )}

      {/* Main Login Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* User ID Field */}
        <InputField
          id="edusure-user-id"
          label="User ID"
          name="userId"
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value);
            if (errors.userId) setErrors((prev) => ({ ...prev, userId: '' }));
          }}
          placeholder="Enter your registered ID"
          icon={User}
          error={errors.userId}
          hint="Student, Faculty, or Admin"
          required={true}
          autoComplete="username"
        />

        {/* Password Field */}
        <div>
          <PasswordField
            id="edusure-password"
            label="Password"
            name="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
            }}
            placeholder="Enter your password"
            error={errors.password}
            required={true}
            autoComplete="current-password"
          />

          {/* Remember Me & Forgot Password Link */}
          <div className="flex items-center justify-between mt-2.5">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#2E7D32] focus:ring-[#2E7D32]/20 focus:ring-2 cursor-pointer transition-colors accent-[#2E7D32]"
              />
              <span className="text-xs text-slate-600 group-hover:text-slate-800 transition-colors">
                Remember ID
              </span>
            </label>

            <button
              type="button"
              onClick={() => setIsForgotModalOpen(true)}
              className="text-xs font-semibold text-[#2E7D32] hover:text-[#1B5E20] hover:underline transition-colors focus:outline-none cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>
        </div>

        {/* Prominent Full-Width Login Button */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth={true}
            isLoading={isLoading}
            className="group py-3.5 bg-[#0A192F] hover:bg-[#112240] text-white shadow-md shadow-slate-900/10 hover:shadow-xl hover:shadow-slate-900/15 transition-all duration-200"
          >
            <span>Sign In</span>
            <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-200 group-hover:translate-x-1" />
          </Button>
        </div>
      </form>

      {/* Trust & Security Footnote */}
      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-[#2E7D32] flex-shrink-0" />
          <span>Protected by EduSure Guard™ • 256-Bit SSL Encryption</span>
        </div>
        <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400 mt-2">
          <span className="hover:text-slate-600 cursor-pointer transition-colors">
            FERPA & GDPR Compliant
          </span>
          <span>•</span>
          <span className="hover:text-slate-600 cursor-pointer transition-colors">
            Privacy Policy
          </span>
          <span>•</span>
          <span className="hover:text-slate-600 cursor-pointer transition-colors">
            Help & Support
          </span>
        </div>
      </div>

      {/* Forgot Password Modal Dialog */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
      />
    </div>
  );
}
