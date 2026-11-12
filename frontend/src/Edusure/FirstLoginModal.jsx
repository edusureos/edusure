import React, { useState, useEffect } from 'react';
import { KeyRound, Lock, CheckCircle2, ArrowRight, X } from 'lucide-react';
import InputField from './InputField';
import Button from './Button';
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from '../firebase';

export default function FirstLoginModal({ isOpen, onClose, loginData, onComplete }) {
  const [step, setStep] = useState('otp'); // 'otp' | 'reset'
  const [otp, setOtp] = useState('');
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);

  useEffect(() => {
    if (isOpen && loginData?.phone) {
      sendOtp(loginData.phone);
    }
  }, [isOpen]);

  const sendOtp = async (phone) => {
    try {
      if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });

      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
    } catch (err) {
      setError(err.message || 'Failed to send OTP.');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await confirmationResult.confirm(otp.trim());
      setStep('reset');
    } catch (err) {
      setError('Invalid OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (passwords.newPassword !== passwords.confirmPassword) {
      return setError('Passwords do not match.');
    }
    if (passwords.newPassword.length < 8) {
      return setError('Password must be at least 8 characters long.');
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/first-login-change-password/', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loginData.tokens.access}`
        },
        body: JSON.stringify({ 
          new_password: passwords.newPassword,
          confirm_password: passwords.confirmPassword 
        }),
      });

      if (res.ok) {
        localStorage.setItem('accessToken', loginData.tokens.access);
        localStorage.setItem('refreshToken', loginData.tokens.refresh);
        onComplete(loginData.username);
      } else {
        const data = await res.json();
        // Django validation errors ko properly extract karein
        const errorMsg =
          data.detail ||
          data.non_field_errors?.[0] ||
          data.new_password?.[0] ||
          data.password?.[0] ||
          'Failed to update password.';
        setError(errorMsg);
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div id="recaptcha-container"></div>
      
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-[#0A192F] mb-2">Account Setup</h2>
          <p className="text-sm text-slate-500 mb-6">
            {step === 'otp' 
              ? `First login detected. Enter the OTP sent to ${loginData?.phone}`
              : 'Phone verified! Create a secure password to continue.'}
          </p>

          {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs">{error}</div>}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <InputField
                id="modal-otp"
                label="Verification Code (OTP)"
                name="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                icon={KeyRound}
                required={true}
                maxLength={6}
              />
              <Button type="submit" variant="primary" fullWidth={true} isLoading={isLoading} className="bg-[#2E7D32]">
                Verify OTP
              </Button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <InputField
                id="new-pass"
                label="New Password"
                type="password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                placeholder="••••••••"
                icon={Lock}
                required={true}
              />
              <InputField
                id="confirm-pass"
                label="Confirm Password"
                type="password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                placeholder="••••••••"
                icon={CheckCircle2}
                required={true}
              />
              <Button type="submit" variant="primary" fullWidth={true} isLoading={isLoading} className="bg-[#0A192F]">
                <span>Save & Login</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}