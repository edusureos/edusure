import React, { useState } from 'react';
import LoginForm from './Edusure/LoginForm';
import IllustrationSide from './Edusure/IllustrationSide';
import PortalPage from './Edusure/PortalPage';

/**
 * App Component
 * EduSure Application Root
 * - Login View: Clean white split-screen with the official EduSure logo on the left and login form on the right.
 * - Portal View: An extra clean, blank page featuring ONLY the options: Dashboard, Attendance, and Timetable.
 */
export default function App() {
  const [currentPage, setCurrentPage] = useState('login'); // 'login' | 'portal'
  const [signedInUserId, setSignedInUserId] = useState('');

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

  return (
    <main className="min-h-screen w-full bg-white flex items-stretch">
      <div className="w-full flex flex-col lg:flex-row min-h-screen bg-white">
        {/* Left Side: Clean Minimalist Showcase with Official EduSure Logo */}
        <IllustrationSide className="w-full lg:w-1/2" />

        {/* Right Side: Clean Minimalist Login Form */}
        <section
          aria-label="EduSure Login"
          className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 sm:px-12 py-10 bg-white overflow-y-auto"
        >
          <div className="w-full max-w-md">
            <LoginForm
              onLogin={(user) => {
                setSignedInUserId(user?.userId || '');
                setCurrentPage('portal');
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
