import React, { useState } from 'react';
import LoginForm from './Edusure/LoginForm';
import IllustrationSide from './Edusure/IllustrationSide';
import PortalPage from './Edusure/PortalPage';
import AdminDashboard from './pages/AdminPortal/AdminDashboard';

const adminRoles = new Set(['SCHOOL_ADMIN', 'SUPER_ADMIN']);

export default function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [signedInUserId, setSignedInUserId] = useState('');
  const [roleError, setRoleError] = useState('');

  async function handleLogin(user) {
    setCurrentPage('checking-role');
    setRoleError('');

    try {
      const token = window.localStorage.getItem('accessToken');
      if (!token) throw new Error('Your sign-in session is missing. Please sign in again.');

      const response = await fetch('/api/users/me/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      let profile;
      try {
        profile = await response.json();
      } catch {
        throw new Error('EduSure returned an invalid account response.');
      }

      if (!response.ok) {
        throw new Error(profile?.detail || `Unable to verify your account (${response.status}).`);
      }
      if (!profile?.role) throw new Error('Your account role could not be verified.');

      setSignedInUserId(profile.username || user?.userId || '');
      setCurrentPage(adminRoles.has(profile.role) ? 'admin' : 'portal');
    } catch (error) {
      setRoleError(error instanceof Error ? error.message : 'Unable to verify your account.');
      setCurrentPage('login');
    }
  }

  function logoutAdmin() {
    window.localStorage.removeItem('accessToken');
    window.localStorage.removeItem('refreshToken');
    setSignedInUserId('');
    setRoleError('');
    setCurrentPage('login');
  }

  if (currentPage === 'admin') {
    return <AdminDashboard onLogout={logoutAdmin} />;
  }

  if (currentPage === 'portal') {
    return (
      <PortalPage
        userId={signedInUserId}
        onLogout={() => {
          setSignedInUserId('');
          setCurrentPage('login');
        }}
      />
    );
  }

  if (currentPage === 'checking-role') {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 px-6">
        <p className="text-sm font-medium text-slate-600" role="status">Verifying your EduSure account…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-white flex items-stretch">
      <div className="w-full flex flex-col lg:flex-row min-h-screen bg-white">
        <IllustrationSide className="w-full lg:w-1/2" />
        <section
          aria-label="EduSure Login"
          className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 sm:px-12 py-10 bg-white overflow-y-auto"
        >
          <div className="w-full max-w-md">
            {roleError && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{roleError}</p>}
            <LoginForm onLogin={handleLogin} />
          </div>
        </section>
      </div>
    </main>
  );
}
