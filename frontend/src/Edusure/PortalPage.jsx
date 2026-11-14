import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  User,
  X,
  LogOut,
  UserCheck,
  CalendarDays,
  CreditCard,
  TrendingUp,
  Calendar,
  Bell,
  ShieldCheck,
  Search,
  ArrowRight,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import EduSureLogo from './EduSureLogo';
import ProgressReportGraph from './ProgressReportGraph';
import EmptyState from './EmptyState';

const EMPTY = {
  attendance: 'No attendance recorded yet. Records will appear here once classes are marked.',
  performance: 'No analytics available yet. Data will appear here once activity is recorded.',
  homework: 'No assignments recorded yet. Homework will appear here once it is assigned.',
  fees: 'No fee records available yet. Payments will appear here once they are posted.',
  events: 'No upcoming events yet. Schedules will appear here once they are published.',
  timetable: 'No timetable available yet. Your schedule will appear here once it is published.',
  reports: 'No reports available yet. Reports will appear here once generated.',
  notices: 'No notices available yet. School notices will appear here once they are published.',
  calendar: 'No academic calendar available yet. Dates will appear here once they are published.',
  profile: 'No profile details available yet. Your record will appear here once it is linked to this account.',
  search: 'No records match your search.',
};

export default function PortalPage({ onLogout, userId, profile = {} }) {
  const [profileData, setProfileData] = useState(profile);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const dashboardButtons = [
    { id: 'attendance', label: 'Attendance', icon: UserCheck },
    { id: 'timetable', label: 'Timetable', icon: CalendarDays },
    { id: 'fee-submission', label: 'Fee Submission', icon: CreditCard },
    { id: 'progress-report', label: 'Progress Report', icon: TrendingUp },
    { id: 'academic-calendar', label: 'Academic Calendar', icon: Calendar },
    { id: 'notices', label: 'Notices', icon: Bell },
  ];

  useEffect(() => {
    const fetchUserProfile = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      try {
        const res = await fetch('/api/users/me/', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setProfileData(data);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };

    fetchUserProfile();
  }, []);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    []
  );

  const signedInLabel = profileData.username || userId?.trim() || 'Signed-in account';
  const profileFields = [
    { label: 'Student Name', value: profileData.studentName },
    { label: 'Class', value: profileData.class },
    { label: 'Date of Birth (DOB)', value: profileData.dateOfBirth },
    { label: "Father's Name", value: profileData.fatherName },
    { label: 'Mobile Number', value: profileData.mobileNumber },
  ];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsDashboardOpen(false);
        setIsProfileOpen(false);
        setActiveModal(null);
        setIsNotifOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const modalCopy = {
    attendance: EMPTY.attendance,
    timetable: EMPTY.timetable,
    'fee-submission': EMPTY.fees,
    'fee-record': EMPTY.fees,
    'progress-report': EMPTY.reports,
    homework: EMPTY.homework,
    'academic-calendar': EMPTY.calendar,
    notices: EMPTY.notices,
  };

  return (
    <div className="min-h-screen w-full bg-slate-50/60 flex flex-col text-slate-800 antialiased font-sans relative selection:bg-emerald-500/15 selection:text-emerald-900">
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />

      <header className="w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30 px-3 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-6">
          <EduSureLogo size="sm" showTagline={false} />
          <button
            type="button"
            onClick={() => {
              setIsDashboardOpen((prev) => !prev);
              setIsProfileOpen(false);
            }}
            aria-expanded={isDashboardOpen}
            aria-controls="dashboard-drawer"
            aria-label="Dashboard"
            className={`flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              isDashboardOpen
                ? 'bg-[#0A192F] text-white shadow-sm'
                : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700'
            }`}
          >
            <LayoutDashboard
              className={`w-4 h-4 ${isDashboardOpen ? 'text-emerald-400' : 'text-slate-500'}`}
            />
            <span className="max-[359px]:hidden">Dashboard</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsProfileOpen((prev) => !prev);
              setIsDashboardOpen(false);
            }}
            aria-expanded={isProfileOpen}
            aria-controls="profile-drawer"
            aria-label="Profile"
            className={`flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer text-xs sm:text-sm font-semibold ${
              isProfileOpen
                ? 'border-emerald-200 bg-emerald-50/70 text-slate-900 shadow-xs'
                : 'border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs'
            }`}
          >
            <div className="w-6 h-6 rounded-full border border-slate-200 bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="max-[359px]:hidden">Profile</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="edusure-brand-accent text-[11px] font-bold uppercase tracking-[0.16em]">
              EduSure Student Portal
            </p>
            
          </div>
        </div>

        <div className="relative isolate overflow-hidden w-full bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#2E7D32] to-emerald-300" />
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border border-emerald-100 bg-emerald-50 text-[#2E7D32] flex items-center justify-center shrink-0">
              <User className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Signed-in account
              </p>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#0A192F] font-heading tracking-tight leading-tight break-all">
                {signedInLabel}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                {profileData.studentName
                  ? `${profileData.studentName}${profileData.class ? ` • Class ${profileData.class}` : ''}`
                  : EMPTY.profile}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
            <div className="relative flex items-center min-w-0 flex-1 sm:flex-none">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                aria-label="Search academic records"
                className="w-full sm:w-48 py-2.5 pl-9.5 pr-3 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:bg-white focus:border-[#2E7D32] focus:ring-3 focus:ring-emerald-500/15 outline-none transition-all shadow-2xs"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200/80 px-3 py-2.5 rounded-xl shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-[#2E7D32]" />
              <span>{todayLabel}</span>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifOpen((prev) => !prev)}
                className="relative p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 transition-colors cursor-pointer shadow-2xs"
                title="Notifications"
                aria-label="View notifications"
                aria-expanded={isNotifOpen}
              >
                <Bell className="w-4.5 h-4.5" />
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white rounded-2xl shadow-xl border border-slate-100 p-3.5 z-50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-[#0A192F] uppercase tracking-wider">
                      School Notices
                    </span>
                  </div>
                  <EmptyState compact icon={Bell} message={EMPTY.notices} />
                </div>
              )}
            </div>
          </div>
        </div>

        {searchQuery.trim() && (
          <EmptyState icon={Search} message={EMPTY.search} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            label="Attendance"
            accent="from-[#2E7D32] to-emerald-400"
            onClick={() => setActiveModal('attendance')}
            action="View Attendance Log"
            icon={UserCheck}
            iconClass="text-[#2E7D32]"
            detail={EMPTY.attendance}
          />
          <MetricCard
            label="Performance"
            accent="from-sky-500 to-blue-600"
            onClick={() => setActiveModal('progress-report')}
            action="Inspect Grade Sheet"
            icon={TrendingUp}
            iconClass="text-sky-700"
            detail={EMPTY.performance}
          />
          <MetricCard
            label="Homework"
            accent="from-indigo-500 to-purple-600"
            onClick={() => setActiveModal('homework')}
            action="View Assignment Queue"
            icon={BookOpen}
            iconClass="text-indigo-600"
            detail={EMPTY.homework}
          />
          <MetricCard
            label="Fee Status"
            accent="from-emerald-600 to-teal-500"
            onClick={() => setActiveModal('fee-record')}
            action="View Fee Record"
            icon={CreditCard}
            iconClass="text-emerald-700"
            detail={EMPTY.fees}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col">
            <SectionHeading
              icon={CalendarDays}
              iconWrap="bg-sky-50 text-sky-700 border-sky-100"
              title="Upcoming Events"
              subtitle="Schedules, examinations, holidays & meetings"
              badge="No records"
            />
            <EmptyState icon={CalendarDays} message={EMPTY.events} />
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">Academic calendar</span>
              <button
                type="button"
                onClick={() => setActiveModal('academic-calendar')}
                className="font-bold text-[#0A192F] hover:text-[#2E7D32] inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Full Calendar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col">
            <SectionHeading
              icon={LayoutDashboard}
              iconWrap="bg-emerald-50 text-[#2E7D32] border-emerald-100"
              title="Quick Access"
              subtitle="Direct access to core academic records"
              badge="Quick links"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <QuickCard
                title="My Timetable"
                detail="No schedule recorded yet"
                icon={CalendarDays}
                tone="blue"
                onClick={() => setActiveModal('timetable')}
                action="Open Schedule"
              />
              <QuickCard
                title="My Progress Report"
                detail="No report generated yet"
                icon={TrendingUp}
                tone="emerald"
                onClick={() => setActiveModal('progress-report')}
                action="View Analytics"
              />
              <QuickCard
                title="Fee Record"
                detail="No receipts posted yet"
                icon={CreditCard}
                tone="indigo"
                onClick={() => setActiveModal('fee-record')}
                action="View Record"
              />
              <QuickCard
                title="Academic Calendar"
                detail="No dates published yet"
                icon={Calendar}
                tone="amber"
                onClick={() => setActiveModal('academic-calendar')}
                action="Browse Year"
              />
            </div>
          </div>
        </div>
      </main>

      {(isDashboardOpen || isProfileOpen) && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs z-40 transition-opacity"
          onClick={() => {
            setIsDashboardOpen(false);
            setIsProfileOpen(false);
          }}
        />
      )}

      <aside
        id="dashboard-drawer"
        aria-label="Dashboard navigation"
        className={`fixed top-0 left-0 h-full w-[min(20rem,calc(100vw-2rem))] bg-white border-r border-slate-200/80 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isDashboardOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#2E7D32] flex items-center justify-center border border-emerald-100">
              <LayoutDashboard className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0A192F] font-heading">Menu</h3>
              <p className="text-[11px] text-slate-400">EduSure Portal</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDashboardOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close Dashboard"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
        <nav className="p-4 flex-1 overflow-y-auto space-y-1.5" aria-label="Academic sections">
          {dashboardButtons.map((btn) => {
            const Icon = btn.icon;
            const isActive = activeModal === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => {
                  setActiveModal(btn.id);
                  setIsDashboardOpen(false);
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-colors text-left cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-[#2E7D32]'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4.5 h-4.5 text-slate-400" />
                <span>{btn.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#2E7D32]" />
          <span>EduSure Institutional Portal</span>
        </div>
      </aside>

      <aside
        id="profile-drawer"
        aria-label="My profile"
        className={`fixed top-0 right-0 h-full w-[min(20rem,calc(100vw-2rem))] bg-white border-l border-slate-200/80 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isProfileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-[#0A192F] flex items-center justify-center border border-slate-200">
              <User className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0A192F] font-heading">My Profile</h3>
              <p className="text-[11px] text-slate-400">Account Details</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsProfileOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close Profile"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          <div className="p-4 rounded-2xl bg-gradient-to-b from-emerald-50/70 to-slate-50 border border-slate-100 text-center">
            <div className="w-16 h-16 rounded-full border border-slate-200 bg-white text-slate-400 flex items-center justify-center mx-auto mb-3">
              <User className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-[#0A192F] break-all">{signedInLabel}</h4>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white divide-y divide-slate-100 shadow-sm">
            {profileFields.map(({ label, value }) => (
              <div key={label} className="px-4 py-3">
                <p className="text-[11px] font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700 break-words">
                  {value?.toString().trim() || 'Not available yet'}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="p-5 border-t border-slate-100 mt-auto">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors cursor-pointer shadow-2xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="edusure-modal-backdrop fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setActiveModal(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="academic-modal-title"
            className={`edusure-modal-panel relative w-full ${activeModal === 'progress-report' ? 'max-w-2xl' : 'max-w-lg'} max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-6 z-10`}
          >
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
              <div>
                <h3 id="academic-modal-title" className="text-base font-bold text-[#0A192F] capitalize font-heading">
                  {activeModal.replaceAll('-', ' ')}
                </h3>
                <p className="text-[11px] text-slate-400">EduSure Academic Portal</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeModal === 'progress-report' ? (
              <ProgressReportGraph />
            ) : (
              <EmptyState message={modalCopy[activeModal] || EMPTY.reports} />
            )}

            <div className="pt-3 mt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeading({ icon: Icon, iconWrap, title, subtitle, badge }) {
  return (
    <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-2xs ${iconWrap}`}>
          <Icon className="w-5 h-5 stroke-[2]" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#0A192F] font-heading">{title}</h2>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
      </div>
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200/80 whitespace-nowrap">
        {badge}
      </span>
    </div>
  );
}

function MetricCard({ label, accent, onClick, action, icon: Icon, iconClass, detail }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300 transition-all duration-200 text-left cursor-pointer overflow-hidden flex flex-col justify-between min-h-[188px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
    >
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accent}`} />
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {label}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500 border border-slate-100 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            No records
          </span>
        </div>
        <div className="flex items-start justify-between gap-3 mt-5">
          <p className="text-sm font-medium text-slate-600 leading-relaxed">{detail}</p>
          <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 ${iconClass}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500 group-hover:text-slate-900">
        <span>{action}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  );
}

const QUICK_TONES = {
  blue: {
    icon: 'bg-blue-50 text-blue-700 border-blue-100',
    hover: 'hover:border-blue-300 hover:bg-blue-50/20',
    title: 'group-hover:text-blue-700',
    action: 'group-hover:text-blue-700',
  },
  emerald: {
    icon: 'bg-emerald-50 text-[#2E7D32] border-emerald-100',
    hover: 'hover:border-emerald-300 hover:bg-emerald-50/20',
    title: 'group-hover:text-[#2E7D32]',
    action: 'group-hover:text-[#2E7D32]',
  },
  indigo: {
    icon: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    hover: 'hover:border-indigo-300 hover:bg-indigo-50/20',
    title: 'group-hover:text-indigo-700',
    action: 'group-hover:text-indigo-700',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-700 border-amber-100',
    hover: 'hover:border-amber-300 hover:bg-amber-50/20',
    title: 'group-hover:text-amber-800',
    action: 'group-hover:text-amber-800',
  },
};

function QuickCard({ title, detail, icon: Icon, tone, onClick, action }) {
  const styles = QUICK_TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-4 rounded-2xl border border-slate-200/80 hover:shadow-md hover:-translate-y-0.5 bg-white transition-all duration-200 text-left cursor-pointer group flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 ${styles.hover}`}
    >
      <div>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-2xs mb-3 ${styles.icon}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <h3 className={`text-sm font-bold text-[#0A192F] transition-colors font-heading ${styles.title}`}>
          {title}
        </h3>
        <p className="text-xs text-slate-500 mt-1">{detail}</p>
      </div>
      <div className={`mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600 ${styles.action}`}>
        <span>{action}</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-all" />
      </div>
    </button>
  );
}
