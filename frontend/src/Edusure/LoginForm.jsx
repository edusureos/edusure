import React, { useState } from 'react';
import { User, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import InputField from './InputField';
import PasswordField from './PasswordField';
import Button from './Button';
import ForgotPasswordModal from './ForgotPasswordModal';
import FirstLoginModal from './FirstLoginModal'; // Naya import

export default function LoginForm({ onLogin }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  
  // Modals State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [isFirstLoginModalOpen, setIsFirstLoginModalOpen] = useState(false);
  
  // First Login Data State
  const [firstLoginData, setFirstLoginData] = useState({ phone: '', tokens: null, username: '' });

  const validateForm = () => {
    const newErrors = {};
    if (!userId.trim()) newErrors.userId = 'Please enter your registered User ID.';
    else if (userId.trim().length < 3) newErrors.userId = 'User ID must be at least 3 characters long.';

    if (!password) newErrors.password = 'Please enter your account password.';
    else if (password.length < 4) newErrors.password = 'Password must be at least 4 characters.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setLoginSuccess(false);
    setErrors({});

    try {
      const response = await fetch('/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userId, password: password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requires_password_change) {
          // FIRST LOGIN DETECTED - Open the OTP Modal
          setIsLoading(false);
          setFirstLoginData({
            phone: data.phone_number,
            tokens: { access: data.access, refresh: data.refresh },
            username: data.username
          });
          setIsFirstLoginModalOpen(true);
          
        } else {
          // REGULAR LOGIN
          localStorage.setItem('accessToken', data.access);
          localStorage.setItem('refreshToken', data.refresh);
          
          setLoginSuccess(true);
          setTimeout(() => {
            setIsLoading(false);
            if (onLogin) onLogin({ userId: data.username });
          }, 600);
        }
      } else {
        setErrors({ password: data.detail || 'Invalid User ID or Password.' });
        setIsLoading(false);
      }
    } catch (error) {
      setErrors({ password: 'Network error. Please make sure the server is running.' });
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[460px] mx-auto px-4 sm:px-0 py-6 sm:py-8 bg-white">
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

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
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

          <div className="flex items-center justify-between mt-2.5">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#2E7D32] focus:ring-[#2E7D32]/20 focus:ring-2 cursor-pointer transition-colors accent-[#2E7D32]"
              />
              <span className="text-xs text-slate-600 group-hover:text-slate-800 transition-colors">
                Remember Me
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

      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        
      </div>

      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
      />

      {/* FIRST LOGIN MODAL */}
      <FirstLoginModal
        isOpen={isFirstLoginModalOpen}
        onClose={() => setIsFirstLoginModalOpen(false)}
        loginData={firstLoginData}
        onComplete={(username) => {
          setIsFirstLoginModalOpen(false);
          if (onLogin) onLogin({ userId: username });
        }}
      />
    </div>
  );
}