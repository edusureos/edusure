import React, { useState } from 'react';
import { Lock, CheckCircle2, ArrowRight, X, ShieldCheck } from 'lucide-react';
import InputField from './InputField';
import Button from './Button';

export default function FirstLoginModal({ isOpen, onClose, loginData, onComplete }) {
  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
          'Authorization': `Bearer ${loginData.tokens.access}`,
        },
        body: JSON.stringify({
          new_password: passwords.newPassword,
          confirm_password: passwords.confirmPassword,
        }),
      });

      if (res.ok) {
        localStorage.setItem('accessToken', loginData.tokens.access);
        localStorage.setItem('refreshToken', loginData.tokens.refresh);
        onComplete(loginData.username);
      } else {
        const data = await res.json();
        const errorMsg =
          data.detail ||
          data.non_field_errors?.[0] ||
          data.new_password?.[0] ||
          data.password?.[0] ||
          'Failed to update password.';
        setError(errorMsg);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2.5 mb-2">
            <ShieldCheck className="w-6 h-6 text-[#2E7D32]" />
            <h2 className="text-2xl font-bold text-[#0A192F]">Create New Password</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Welcome <strong className="text-slate-700">{loginData?.username}</strong>! Set your own strong password that you can easily remember.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            <InputField
              id="new-pass"
              label="New Password"
              type="password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              placeholder="Min 8 chars (A-Z, a-z, 0-9, @#$)"
              icon={Lock}
              required={true}
            />

            <InputField
              id="confirm-pass"
              label="Confirm Password"
              type="password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              placeholder="Re-enter your new password"
              icon={CheckCircle2}
              required={true}
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth={true}
              isLoading={isLoading}
              className="bg-[#0A192F] mt-2"
            >
              <span>Save Password & Login</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}