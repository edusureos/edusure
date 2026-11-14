import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine, ArrowRight, Bell, BookOpen, CalendarDays, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleAlert, ClipboardCheck,
  CreditCard, FileBarChart, FileText, GraduationCap, LayoutDashboard,
  LockKeyhole, LogOut, Menu, Megaphone, Pencil, Plus, Search, Settings, ShieldCheck,
  SlidersHorizontal, UserRound, UserRoundCheck, Users, X,
} from 'lucide-react';
import './admin.css';
import { adminEndpoints, adminRequest } from './adminApi';

const emptyRecords = Object.freeze([]);

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'School' },
  { id: 'students', label: 'Students', icon: Users, group: 'School' },
  { id: 'teachers', label: 'Teachers', icon: UserRoundCheck, group: 'School' },
  { id: 'classes', label: 'Classes & Sections', icon: BookOpen, group: 'School' },
  { id: 'timetable', label: 'Timetable', icon: CalendarDays, group: 'Academics' },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck, group: 'Academics' },
  { id: 'examinations', label: 'Examinations', icon: GraduationCap, group: 'Academics' },
  { id: 'reports', label: 'Results & Reports', icon: FileBarChart, group: 'Academics' },
  { id: 'fees', label: 'Fee Management', icon: CreditCard, group: 'Operations' },
  { id: 'notices', label: 'Notices & Announcements', icon: Megaphone, group: 'Operations' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, group: 'Operations' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'Administration' },
];

const pageCopy = {
  dashboard: ['School overview', 'A clear view of your school workspace and connected records.'],
  students: ['Students', 'Search and manage student records for your school.'],
  teachers: ['Teachers', 'Review the teaching team connected to your school.'],
  classes: ['Classes & Sections', 'Review class and section totals from student records.'],
  timetable: ['Timetable', 'Class schedules will be available when timetable data is connected.'],
  attendance: ['Attendance', 'Attendance records will be available when attendance data is connected.'],
  examinations: ['Examinations', 'Exam schedules will be available when examination data is connected.'],
  reports: ['Results & Reports', 'Academic results will be available when reporting data is connected.'],
  fees: ['Fee Management', 'Fee records will be available when finance data is connected.'],
  notices: ['Notices & Announcements', 'Publish and review school announcements.'],
  calendar: ['Calendar', 'School events will be available when calendar data is connected.'],
  settings: ['Settings', 'Review your authenticated administrator account.'],
};

const searchSections = new Set(['students', 'teachers', 'classes', 'notices']);
const pageSize = 8;
const adminRoles = new Set(['SCHOOL_ADMIN', 'SUPER_ADMIN']);
const todayLabel = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date());

function displayName(record) {
  return [record.first_name, record.last_name].filter(Boolean).join(' ').trim() || 'Name not provided';
}

function displayDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

function IconButton({ label, children, className = '', ...props }) {
  return <button type="button" className={`adm-icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}

function Button({ variant = 'primary', children, className = '', ...props }) {
  return <button className={`adm-button adm-button-${variant} ${className}`} {...props}>{children}</button>;
}

function Brand({ compact = false }) {
  return (
    <div className={`adm-brand${compact ? ' adm-brand-compact' : ''}`}>
      <img src="/edusure-logo.jpg" alt="" />
      {!compact && <div><strong>EduSure</strong><span>ADMIN PORTAL</span></div>}
    </div>
  );
}

function LoadingPanel({ label = 'Loading records…' }) {
  return <div className="adm-state-panel" role="status"><span className="adm-spinner" /><p>{label}</p></div>;
}

function ErrorPanel({ error, onRetry }) {
  return (
    <div className="adm-state-panel adm-state-error" role="alert">
      <span className="adm-state-icon"><CircleAlert size={20} /></span>
      <h3>We couldn’t load this information</h3>
      <p>{error}</p>
      {onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

function EmptyState({ icon: Icon = FileText, title, description, action }) {
  return (
    <div className="adm-empty-state">
      <span className="adm-empty-icon"><Icon size={21} strokeWidth={1.7} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function PageHeading({ title, description, action }) {
  return (
    <div className="adm-page-heading">
      <div><h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder = 'Search records', label = 'Search records' }) {
  return <label className="adm-search"><Search size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} />{value && <IconButton label="Clear search" onClick={() => onChange('')}><X size={15} /></IconButton>}</label>;
}

function Pagination({ count, page, onChange }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const start = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, count);
  return (
    <div className="adm-pagination">
      <span>Showing <strong>{start}–{end}</strong> of <strong>{count}</strong></span>
      <div><IconButton label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></IconButton><span>Page {page} of {pages}</span><IconButton label="Next page" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></IconButton></div>
    </div>
  );
}

function TableCard({ title, count, description, controls, children, footer }) {
  return (
    <section className="adm-card adm-table-card">
      <div className="adm-table-toolbar"><div><h2>{title} <span className="adm-count">{count}</span></h2><p>{description}</p></div><div className="adm-table-controls">{controls}</div></div>
      {children}
      {footer}
    </section>
  );
}

function NoticeRows({ notices }) {
  return <div className="adm-notice-rows">{notices.map((notice) => <article className="adm-notice-row" key={notice.id}><span><Megaphone size={15} /></span><div><strong>{notice.title}</strong><small>{notice.target_role === 'ALL' ? 'Everyone' : notice.target_role === 'STUDENT' ? 'Students' : 'Teachers'}{notice.target_class ? ` · Class ${notice.target_class}` : ''}</small></div><time>{displayDate(notice.created_at)}</time></article>)}</div>;
}

function Avatar({ name }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—';
  return <span className="adm-avatar">{initials}</span>;
}

function StudentForm({ record, busy, onClose, onSubmit }) {
  const fields = [
    ['first_name', 'First name', 'text', true],
    ['last_name', 'Last name', 'text', false],
    ['class_grade', 'Class / grade', 'text', false],
    ['section', 'Section', 'text', false],
    ['roll_number', 'Roll number', 'number', false],
    ['dob', 'Date of birth', 'date', false],
    ['blood_group', 'Blood group', 'text', false],
    ['father_name', 'Guardian name', 'text', false],
    ['registered_phone', 'Contact number', 'tel', false],
    ['address', 'Address', 'textarea', false],
  ];
  return <RecordForm title={record ? 'Edit student details' : 'Add student'} description="Changes are submitted to your school’s student service." fields={fields} initial={record} busy={busy} onClose={onClose} onSubmit={onSubmit} />;
}

function TeacherForm({ busy, onClose, onSubmit }) {
  const fields = [
    ['first_name', 'First name', 'text', true],
    ['last_name', 'Last name', 'text', false],
    ['employee_id', 'Employee ID', 'text', false],
    ['subject', 'Subject', 'text', false],
    ['qualification', 'Qualification', 'text', false],
    ['class_teacher_of', 'Class teacher of', 'text', false],
    ['registered_phone', 'Contact number', 'tel', false],
    ['joining_date', 'Joining date', 'date', false],
  ];
  return <RecordForm title="Add teacher" description="The teacher record will be sent to your school’s teacher service." fields={fields} initial={{}} busy={busy} onClose={onClose} onSubmit={onSubmit} />;
}

function NoticeForm({ busy, onClose, onSubmit }) {
  const fields = [
    ['title', 'Announcement title', 'text', true],
    ['target_role', 'Audience', 'select', true, [['ALL', 'Everyone'], ['STUDENT', 'Students'], ['TEACHER', 'Teachers']]],
    ['target_class', 'Class (optional)', 'text', false],
    ['content', 'Announcement', 'textarea', true],
  ];
  return <RecordForm title="Publish an announcement" description="This announcement will be submitted to the school notice service." fields={fields} initial={{ target_role: 'ALL' }} busy={busy} onClose={onClose} onSubmit={onSubmit} />;
}

function RecordForm({ title, description, fields, initial, busy, onClose, onSubmit }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = {};
    for (const [key, value] of formData.entries()) {
      if (value !== '') values[key] = value;
    }
    if ('roll_number' in values) values.roll_number = Number(values.roll_number);
    setSaving(true);
    setError('');
    try {
      await onSubmit(values);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={title} description={description} onClose={onClose}>
      <form className="adm-form" onSubmit={handleSubmit}>
        <div className="adm-form-grid">{fields.map(([name, label, type, required, options]) => <label className={`adm-field${type === 'textarea' ? ' adm-field-full' : ''}`} key={name}><span>{label}{required && <i> *</i>}</span>{type === 'select' ? <select name={name} defaultValue={initial[name] || ''} required={required}>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select> : type === 'textarea' ? <textarea name={name} rows="4" defaultValue={initial[name] || ''} required={required} /> : <input name={name} type={type} defaultValue={initial[name] || ''} required={required} min={type === 'number' ? '0' : undefined} />}</label>)}</div>
        {error && <div className="adm-form-error" role="alert"><CircleAlert size={15} />{error}</div>}
        <div className="adm-form-note"><LockKeyhole size={14} /> Data is sent only after you submit this form.</div>
        <div className="adm-form-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || busy}>{saving ? 'Submitting…' : 'Submit to server'}</Button></div>
      </form>
    </Modal>
  );
}

function Modal({ title, description, children, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <div className="adm-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="adm-modal" role="dialog" aria-modal="true" aria-label={title}><div className="adm-modal-header"><div><h2>{title}</h2><p>{description}</p></div><IconButton label="Close" onClick={onClose}><X size={18} /></IconButton></div>{children}</section></div>;
}

function ConfirmDialog({ student, busy, error, onCancel, onConfirm }) {
  return <Modal title="Deactivate student?" description="This changes the student’s account status on the server." onClose={onCancel}><div className="adm-confirm-copy"><span><CircleAlert size={19} /></span><p>Deactivate <strong>{displayName(student)}</strong> ({student.user_id})? You can reactivate the account later if needed.</p></div>{error && <div className="adm-form-error" role="alert"><CircleAlert size={15} />{error}</div>}<div className="adm-form-actions"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button variant="danger" disabled={busy} onClick={onConfirm}>{busy ? 'Updating…' : 'Deactivate account'}</Button></div></Modal>;
}

function CredentialsDialog({ credentials, onClose }) {
  return <Modal title="Account created" description="These credentials were returned by the school server. Share them securely." onClose={onClose}><div className="adm-credentials"><div><span>Account ID</span><strong>{credentials.userId}</strong></div><div><span>Temporary password</span><strong>{credentials.password}</strong></div></div><div className="adm-form-note"><ShieldCheck size={14} /> The user will be asked to change their password at first sign-in.</div><div className="adm-form-actions"><Button onClick={onClose}>Done</Button></div></Modal>;
}

function AuthGate({ state, onRetry }) {
  const isSignedOut = state.status === 'signed-out';
  const isDenied = state.status === 'denied';
  const isChecking = state.status === 'checking';
  return <main className="adm-auth-page"><section className="adm-auth-card"><Brand /><span className="adm-auth-icon">{isChecking ? <span className="adm-spinner" /> : <LockKeyhole size={22} />}</span><h1>{isChecking ? 'Checking your account' : isSignedOut ? 'Administrator sign-in required' : isDenied ? 'Admin access required' : 'Unable to verify your account'}</h1><p>{isChecking ? 'Verifying your existing EduSure session.' : isSignedOut ? 'Sign in through the existing EduSure portal with an administrator account to continue.' : isDenied ? 'This account does not have school administrator access.' : getErrorMessage(state.error)}</p><div className="adm-auth-actions">{!isChecking && <a className="adm-button adm-button-primary" href="/">Go to EduSure sign in</a>}{state.status === 'error' && <Button variant="outline" onClick={onRetry}>Try again</Button>}</div><small>Protected by your existing EduSure account and role.</small></section></main>;
}

function DashboardPage({ stats, statsLoading, statsError, notices, noticesLoading, noticesError, onNavigate, onRefresh, profile, previewMode }) {
  const classCount = Array.isArray(stats?.class_breakdown) ? stats.class_breakdown.length : null;
  const value = (key) => statsLoading ? '…' : statsError ? '—' : Number.isFinite(stats?.[key]) ? stats[key] : '—';
  const shortcuts = navigation.filter((item) => item.id !== 'dashboard');
  return (
    <>
      <PageHeading title={`Welcome ${profile.username ? `, ${profile.username}` : ''}`} description={previewMode ? 'Explore the Admin Portal layout in this frontend-only preview.' : 'Here’s an overview of the records connected to your school.'} action={!previewMode && <Button variant="outline" onClick={onRefresh}><ArrowDownToLine size={15} /> Refresh data</Button>} />
      {!previewMode && <div className="adm-connection-note"><span className="adm-connection-dot" />Connected to EduSure school services <span className="adm-note-separator" />All figures below are returned by your authenticated account.</div>}
      <section className="adm-overview-section">
        <div className="adm-section-heading"><div><span className="adm-section-kicker">OVERVIEW</span><h2>School at a glance</h2></div><span className="adm-date-label"><CalendarDays size={15} />{todayLabel}</span></div>
        <div className="adm-metric-grid">
          <MetricCard icon={Users} label="Students" value={value('total_students')} detail={previewMode ? 'No records in preview' : statsError ? 'Unable to load count' : 'Active student accounts'} onClick={() => onNavigate('students')} />
          <MetricCard icon={UserRoundCheck} label="Teachers" value={value('total_teachers')} detail={previewMode ? 'No records in preview' : statsError ? 'Unable to load count' : 'Active teacher accounts'} onClick={() => onNavigate('teachers')} />
          <MetricCard icon={BookOpen} label="Classes & sections" value={statsLoading ? '…' : statsError ? '—' : classCount ?? '—'} detail={previewMode ? 'No records in preview' : statsError ? 'Unable to load count' : 'Sections represented in student records'} onClick={() => onNavigate('classes')} />
        </div>
        {statsError && <div className="adm-inline-error" role="alert"><CircleAlert size={15} /><span>School overview could not be loaded: {statsError}</span><button onClick={onRefresh}>Retry</button></div>}
      </section>
      <section className="adm-overview-section">
        <div className="adm-section-heading"><div><span className="adm-section-kicker">WORKSPACE</span><h2>Administration</h2></div></div>
        <div className="adm-shortcut-grid">{shortcuts.map((item) => <button className="adm-shortcut-card" key={item.id} onClick={() => onNavigate(item.id)}><span className="adm-shortcut-icon"><item.icon size={18} /></span><span><strong>{item.label}</strong><small>{item.id === 'students' ? 'School student records' : item.id === 'teachers' ? 'Faculty directory' : item.id === 'classes' ? 'Class and section totals' : 'Open section'}</small></span><ArrowRight size={16} /></button>)}</div>
      </section>
      <section className="adm-card adm-dashboard-notices"><div className="adm-card-heading"><div><span className="adm-section-kicker">COMMUNICATION</span><h2>Recent announcements</h2></div><button className="adm-link-button" onClick={() => onNavigate('notices')}>View all <ArrowRight size={14} /></button></div>{noticesLoading ? <LoadingPanel label="Loading announcements…" /> : noticesError ? <ErrorPanel error={noticesError} onRetry={() => onNavigate('notices')} /> : notices.length ? <NoticeRows notices={notices.slice(0, 3)} /> : <EmptyState icon={Megaphone} title="No announcements published yet." description="Published school notices will appear here." action={<Button variant="outline" onClick={() => onNavigate('notices')}>Open notices</Button>} />}</section>
      <div className="adm-dashboard-footnote"><ShieldCheck size={15} />{previewMode ? 'This standalone preview does not load or modify school records.' : 'Student, teacher and notice information is loaded from the existing authenticated school services.'}</div>
    </>
  );
}

function MetricCard({ icon: Icon, label, value, detail, onClick }) {
  return <button className="adm-metric-card" onClick={onClick}><span className="adm-metric-icon"><Icon size={18} /></span><span className="adm-metric-label">{label}</span><strong>{value}</strong><span className="adm-metric-detail">{detail}</span><ArrowRight size={15} className="adm-metric-arrow" /></button>;
}

function StudentPage({ resource, query, onQuery, onAdd, onEdit, onDeactivate, onRetry, onRefresh, previewMode }) {
  const [grade, setGrade] = useState('all');
  const [section, setSection] = useState('all');
  const [page, setPage] = useState(1);
  const grades = [...new Set(resource.data.map((record) => record.class_grade).filter(Boolean))].sort();
  const sections = [...new Set(resource.data.map((record) => record.section).filter(Boolean))].sort();
  const rows = resource.data.filter((record) => {
    const search = `${displayName(record)} ${record.user_id || ''} ${record.admission_number || ''}`.toLowerCase();
    return search.includes(query.toLowerCase()) && (grade === 'all' || record.class_grade === grade) && (section === 'all' || record.section === section);
  });
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  return (
    <>
      <PageHeading title="Student directory" description={previewMode ? 'Student records are not connected in this frontend-only preview.' : 'Manage school student records. Changes are saved through the existing school API.'} action={!previewMode && <Button onClick={onAdd}><Plus size={16} /> Add student</Button>} />
      <TableCard title="Students" count={resource.loading ? '…' : resource.data.length} description="Student profile records" controls={<><SearchBox value={query} onChange={(value) => { onQuery(value); setPage(1); }} placeholder="Search students" /><FilterSelect label="Filter by class" value={grade} onChange={(value) => { setGrade(value); setPage(1); }} options={[{ value: 'all', label: 'All classes' }, ...grades.map((value) => ({ value, label: value }))]} /><FilterSelect label="Filter by section" value={section} onChange={(value) => { setSection(value); setPage(1); }} options={[{ value: 'all', label: 'All sections' }, ...sections.map((value) => ({ value, label: value }))]} />{!previewMode && <IconButton label="Refresh students" onClick={onRefresh}><ArrowDownToLine size={16} /></IconButton>}</>}>
        {resource.loading ? <LoadingPanel /> : resource.error ? <ErrorPanel error={resource.error} onRetry={onRetry} /> : rows.length === 0 ? <EmptyState icon={Users} title={resource.data.length ? 'No matching student records.' : 'No student records available yet.'} description={resource.data.length ? 'Try another search or filter.' : previewMode ? 'This read-only preview does not load student records.' : 'When student records are available for this school, they will appear here.'} action={!previewMode && !resource.data.length && <Button variant="outline" onClick={onAdd}><Plus size={15} /> Add student</Button>} /> : <><div className="adm-table-scroll"><table><thead><tr><th>Student</th><th>Student ID</th><th>Class</th><th>Admission no.</th><th>Contact</th><th>Account</th><th>Actions</th></tr></thead><tbody>{visible.map((student) => <tr key={student.user_id}><td><div className="adm-person"><Avatar name={displayName(student)} /><strong>{displayName(student)}</strong></div></td><td className="adm-id">{student.user_id}</td><td>{[student.class_grade, student.section].filter(Boolean).join(' · ') || 'Not assigned'}</td><td>{student.admission_number || '—'}</td><td>{student.registered_phone || '—'}</td><td><Status active={student.is_active}>{student.is_active ? 'Active' : 'Inactive'}</Status></td><td><div className="adm-row-actions"><IconButton label={`Edit ${displayName(student)}`} onClick={() => onEdit(student)}><Pencil size={15} /></IconButton><IconButton label={student.is_active ? `Deactivate ${displayName(student)}` : `Reactivate ${displayName(student)}`} onClick={() => onDeactivate(student)}><UserRound size={15} /></IconButton></div></td></tr>)}</tbody></table></div><Pagination count={rows.length} page={page} onChange={setPage} /></>}
      </TableCard>
    </>
  );
}

function TeacherPage({ resource, query, onQuery, onAdd, onRetry, onRefresh, previewMode }) {
  const [subject, setSubject] = useState('all');
  const [page, setPage] = useState(1);
  const subjects = [...new Set(resource.data.map((record) => record.subject).filter(Boolean))].sort();
  const rows = resource.data.filter((record) => `${displayName(record)} ${record.user_id || ''} ${record.employee_id || ''} ${record.subject || ''}`.toLowerCase().includes(query.toLowerCase()) && (subject === 'all' || record.subject === subject));
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  return (
    <>
      <PageHeading title="Teachers" description={previewMode ? 'Teacher records are not connected in this frontend-only preview.' : 'Review the teaching team connected to your school.'} action={!previewMode && <Button onClick={onAdd}><Plus size={16} /> Add teacher</Button>} />
      <TableCard title="Teaching team" count={resource.loading ? '…' : resource.data.length} description="Teacher profile records" controls={<><SearchBox value={query} onChange={(value) => { onQuery(value); setPage(1); }} placeholder="Search teachers" /><FilterSelect label="Filter by subject" value={subject} onChange={(value) => { setSubject(value); setPage(1); }} options={[{ value: 'all', label: 'All subjects' }, ...subjects.map((value) => ({ value, label: value }))]} />{!previewMode && <IconButton label="Refresh teachers" onClick={onRefresh}><ArrowDownToLine size={16} /></IconButton>}</>}>
        {resource.loading ? <LoadingPanel /> : resource.error ? <ErrorPanel error={resource.error} onRetry={onRetry} /> : rows.length === 0 ? <EmptyState icon={UserRoundCheck} title={resource.data.length ? 'No matching teacher records.' : 'No teacher records available yet.'} description={resource.data.length ? 'Try another search or filter.' : previewMode ? 'This read-only preview does not load teacher records.' : 'When teacher records are available for this school, they will appear here.'} action={!previewMode && !resource.data.length && <Button variant="outline" onClick={onAdd}><Plus size={15} /> Add teacher</Button>} /> : <><div className="adm-table-scroll"><table><thead><tr><th>Teacher</th><th>Staff ID</th><th>Subject</th><th>Class assignment</th><th>Contact</th><th>Account</th></tr></thead><tbody>{visible.map((teacher) => <tr key={teacher.user_id}><td><div className="adm-person"><Avatar name={displayName(teacher)} /><strong>{displayName(teacher)}</strong></div></td><td className="adm-id">{teacher.employee_id || teacher.user_id}</td><td>{teacher.subject || '—'}</td><td>{teacher.class_teacher_of || '—'}</td><td>{teacher.registered_phone || '—'}</td><td><Status active={teacher.is_active}>{teacher.is_active ? 'Active' : 'Inactive'}</Status></td></tr>)}</tbody></table></div><Pagination count={rows.length} page={page} onChange={setPage} /></>}
      </TableCard>
    </>
  );
}

function ClassesPage({ stats, statsLoading, statsError, onRetry, query, onQuery, previewMode }) {
  const [page, setPage] = useState(1);
  const classes = Array.isArray(stats?.class_breakdown) ? stats.class_breakdown : emptyRecords;
  const rows = classes.filter((item) => `${item.class_grade || ''} ${item.section || ''}`.toLowerCase().includes(query.toLowerCase()));
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  return (
    <>
      <PageHeading title="Classes & Sections" description={previewMode ? 'Class and section records are not loaded in this frontend-only preview.' : 'Class and section totals are calculated from current student records.'} />
      <TableCard title="Class sections" count={statsLoading ? '…' : statsError ? '—' : classes.length} description="Summary returned by the school overview service" controls={<><SearchBox value={query} onChange={(value) => { onQuery(value); setPage(1); }} placeholder="Search classes" />{!previewMode && <IconButton label="Refresh class summary" onClick={onRetry}><ArrowDownToLine size={16} /></IconButton>}</>}>
        {statsLoading ? <LoadingPanel /> : statsError ? <ErrorPanel error={statsError} onRetry={onRetry} /> : rows.length ? <><div className="adm-table-scroll"><table><thead><tr><th>Class</th><th>Section</th><th>Student records</th></tr></thead><tbody>{visible.map((item, index) => <tr key={`${item.class_grade}-${item.section}-${index}`}><td>{item.class_grade || 'Not specified'}</td><td>{item.section || 'Not specified'}</td><td>{item.count}</td></tr>)}</tbody></table></div><Pagination count={rows.length} page={page} onChange={setPage} /></> : <EmptyState icon={BookOpen} title={classes.length ? 'No matching class sections.' : 'No class and section records available yet.'} description={classes.length ? 'Try a different search.' : 'Class sections appear here when included in student records.'} />}
      </TableCard>
    </>
  );
}

function NoticesPage({ resource, query, onQuery, onAdd, onRetry, onRefresh, previewMode }) {
  const [audience, setAudience] = useState('all');
  const [page, setPage] = useState(1);
  const rows = resource.data.filter((notice) => `${notice.title || ''} ${notice.content || ''}`.toLowerCase().includes(query.toLowerCase()) && (audience === 'all' || notice.target_role === audience));
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  return (
    <>
      <PageHeading title="Notices & Announcements" description={previewMode ? 'Announcements are not connected in this frontend-only preview.' : 'Publish a school announcement through the existing notice service.'} action={!previewMode && <Button onClick={onAdd}><Plus size={16} /> Publish notice</Button>} />
      <TableCard title="School announcements" count={resource.loading ? '…' : resource.data.length} description="Published notices returned by the school service" controls={<><SearchBox value={query} onChange={(value) => { onQuery(value); setPage(1); }} placeholder="Search notices" /><FilterSelect label="Filter notices by audience" value={audience} onChange={(value) => { setAudience(value); setPage(1); }} options={[{ value: 'all', label: 'All audiences' }, { value: 'ALL', label: 'Everyone' }, { value: 'STUDENT', label: 'Students' }, { value: 'TEACHER', label: 'Teachers' }]} />{!previewMode && <IconButton label="Refresh notices" onClick={onRefresh}><ArrowDownToLine size={16} /></IconButton>}</>}>
        {resource.loading ? <LoadingPanel label="Loading announcements…" /> : resource.error ? <ErrorPanel error={resource.error} onRetry={onRetry} /> : rows.length ? <><div className="adm-table-scroll"><table><thead><tr><th>Announcement</th><th>Audience</th><th>Class</th><th>Posted by</th><th>Published</th></tr></thead><tbody>{visible.map((notice) => <tr key={notice.id}><td><div className="adm-notice-title"><strong>{notice.title}</strong><small>{notice.content}</small></div></td><td>{notice.target_role === 'ALL' ? 'Everyone' : notice.target_role === 'STUDENT' ? 'Students' : 'Teachers'}</td><td>{notice.target_class || 'All classes'}</td><td>{notice.posted_by || '—'}</td><td>{displayDate(notice.created_at)}</td></tr>)}</tbody></table></div><Pagination count={rows.length} page={page} onChange={setPage} /></> : <EmptyState icon={Megaphone} title={resource.data.length ? 'No matching announcements.' : 'No announcements published yet.'} description={resource.data.length ? 'Try another search or audience filter.' : previewMode ? 'This read-only preview does not load announcements.' : 'Published school notices will appear here.'} action={!previewMode && !resource.data.length && <Button variant="outline" onClick={onAdd}><Plus size={15} /> Publish notice</Button>} />}
      </TableCard>
      <p className="adm-capability-note"><ShieldCheck size={14} /> The current notice service supports publishing and viewing. Editing or deleting notices is not connected.</p>
    </>
  );
}

function NotConnectedPage({ active }) {
  const copy = {
    timetable: ['No timetable data available.', 'Timetable records are not exposed by the current school API.'],
    attendance: ['No attendance data available.', 'Attendance records are not exposed by the current school API.'],
    examinations: ['No examination data available.', 'Exam scheduling is not connected to the current school API.'],
    reports: ['No results or reports available.', 'Academic results are not exposed by the current school API.'],
    fees: ['No fee records found.', 'Fee collection and receipts are not connected to the current school API.'],
    calendar: ['No calendar events available.', 'Calendar events are not exposed by the current school API.'],
  }[active];
  const Icon = navigation.find((item) => item.id === active)?.icon || FileText;
  return <><PageHeading title={pageCopy[0].replace(/^No /, '').replace(/\.$/, '')} description="This section is ready for a verified school data integration." /><section className="adm-card adm-disconnected-card"><EmptyState icon={Icon} title={copy[0]} description={copy[1]} /><div className="adm-unavailable-label"><CircleAlert size={14} /> Not connected</div></section></>;
}

function SettingsPage({ profile, previewMode }) {
  return (
    <>
      <PageHeading title="Settings" description={previewMode ? 'No account is connected to this frontend-only preview.' : 'Account and access details from the authenticated EduSure session.'} />
      <section className="adm-card adm-settings-card"><div className="adm-card-heading"><div><span className="adm-section-kicker">ACCOUNT</span><h2>Administrator profile</h2><p>{previewMode ? 'Preview mode does not authenticate or load account details.' : 'Identity is provided by EduSure authentication.'}</p></div><span className="adm-settings-mark"><ShieldCheck size={18} /></span></div><div className="adm-account-list"><div><span>Account ID</span><strong>{previewMode ? 'Not connected' : profile.username || 'Not available'}</strong></div><div><span>Role</span><strong>{previewMode ? 'Preview only' : profile.role}</strong></div><div><span>School ID</span><strong>{previewMode ? 'Not connected' : profile.school_id ?? 'Not available'}</strong></div><div><span>Authentication</span><strong className="adm-auth-status">{previewMode ? 'No sign-in in preview' : <><i /> Verified session</>}</strong></div></div><div className="adm-unavailable-label"><CircleAlert size={14} />{previewMode ? 'This preview is read-only and uses no school data.' : 'School preferences are not connected to an API.'}</div></section>
    </>
  );
}

function FilterSelect({ value, onChange, options, label }) {
  return <label className="adm-filter"><SlidersHorizontal size={14} /><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><ChevronDown size={14} /></label>;
}

function Status({ active, children }) {
  return <span className={`adm-status${active ? ' is-active' : ''}`}><i />{children}</span>;
}

function Header({ active, profile, query, onQuery, onMenu, onNavigate, onLogout, previewMode }) {
  const current = navigation.find((item) => item.id === active);
  return (
    <header className="adm-topbar"><div className="adm-topbar-start"><IconButton label="Open navigation" className="adm-menu-button" onClick={onMenu}><Menu size={19} /></IconButton><div className="adm-breadcrumb"><span>EduSure</span><ChevronRight size={14} /><strong>{current.label}</strong></div></div><div className="adm-topbar-actions">{searchSections.has(active) && <SearchBox value={query} onChange={onQuery} placeholder={`Search ${current.label.toLowerCase()}`} label={`Search ${current.label.toLowerCase()}`} />}<IconButton label="Open notices" onClick={() => onNavigate('notices')}><Bell size={18} /></IconButton><span className="adm-topbar-divider" /><div className="adm-account-chip"><span><UserRound size={15} /></span><div><strong>{previewMode ? 'Preview account' : profile.username}</strong><small>{previewMode ? '' : profile.role === 'SUPER_ADMIN' ? 'Super admin' : 'School admin'}</small></div></div>{onLogout && <IconButton label="Sign out" onClick={onLogout}><LogOut size={17} /></IconButton>}</div></header>
  );
}

export default function AdminDashboard({ onLogout, previewMode = false }) {
  const [auth, setAuth] = useState(() => previewMode
    ? { status: 'ready', profile: { username: '', role: '', school_id: null }, token: null, error: null }
    : { status: 'checking', profile: null, token: null, error: null });
  const [authAttempt, setAuthAttempt] = useState(0);
  const [active, setActive] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [resources, setResources] = useState({
    students: { data: emptyRecords, loading: false, error: null },
    teachers: { data: emptyRecords, loading: false, error: null },
    notices: { data: emptyRecords, loading: false, error: null },
  });
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [dashboardNotices, setDashboardNotices] = useState(emptyRecords);
  const [dashboardNoticesLoading, setDashboardNoticesLoading] = useState(false);
  const [dashboardNoticesError, setDashboardNoticesError] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [mutating, setMutating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [confirmStudent, setConfirmStudent] = useState(null);
  const [confirmError, setConfirmError] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [notice, setNotice] = useState(null);

  const loadDashboardData = useCallback((token, isActive = () => true) => {
    if (previewMode) return;
    setStatsLoading(true);
    setStatsError(null);
    adminRequest(adminEndpoints.stats, token)
      .then((data) => {
        if (isActive()) setStats(data);
      })
      .catch((error) => {
        if (isActive()) setStatsError(getErrorMessage(error));
      })
      .finally(() => {
        if (isActive()) setStatsLoading(false);
      });

    setDashboardNoticesLoading(true);
    setDashboardNoticesError(null);
    adminRequest(adminEndpoints.notices, token)
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('The server returned an invalid notices response.');
        if (isActive()) setDashboardNotices(data);
      })
      .catch((error) => {
        if (isActive()) setDashboardNoticesError(getErrorMessage(error));
      })
      .finally(() => {
        if (isActive()) setDashboardNoticesLoading(false);
      });
  }, [previewMode]);

  function loadResource(key, token = auth.token) {
    if (previewMode) return;
    setResources((current) => ({ ...current, [key]: { ...current[key], loading: true, error: null } }));
    adminRequest(adminEndpoints[key], token)
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('The server returned an invalid records response.');
        setResources((current) => ({ ...current, [key]: { data, loading: false, error: null } }));
      })
      .catch((error) => {
        setResources((current) => ({ ...current, [key]: { ...current[key], loading: false, error: getErrorMessage(error) } }));
      });
  }

  useEffect(() => {
    if (previewMode) return undefined;
    let activeRequest = true;
    const token = window.localStorage.getItem('accessToken');
    Promise.resolve()
      .then(() => {
        if (!token) {
          if (activeRequest) setAuth({ status: 'signed-out', profile: null, token: null, error: null });
          return null;
        }
        return adminRequest(adminEndpoints.profile, token);
      })
      .then((profile) => {
        if (!activeRequest || !profile) return;
        if (!adminRoles.has(profile?.role)) {
          setAuth({ status: 'denied', profile, token: null, error: null });
          return;
        }
        setAuth({ status: 'ready', profile, token, error: null });
        loadDashboardData(token, () => activeRequest);
      })
      .catch((error) => {
        if (!activeRequest) return;
        setAuth({ status: 'error', profile: null, token: null, error });
      });
    return () => { activeRequest = false; };
  }, [authAttempt, loadDashboardData, previewMode]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const groups = useMemo(() => [...new Set(navigation.map((item) => item.group))], []);
  const navTo = (id) => {
    setActive(id);
    setQuery('');
    setMobileOpen(false);
    if (auth.status === 'ready' && ['students', 'teachers', 'notices'].includes(id)) {
      loadResource(id);
    }
  };
  const refreshDashboard = () => loadDashboardData(auth.token);
  const replaceResource = (key, transform) => setResources((current) => ({ ...current, [key]: { ...current[key], ...transform(current[key]) } }));
  const updateDashboardNotices = (next) => setDashboardNotices(next);

  async function submitStudent(values) {
    setMutating(true);
    try {
      if (dialog.record) {
        const updated = await adminRequest(adminEndpoints.student(dialog.record.user_id), auth.token, { method: 'PATCH', body: JSON.stringify(values) });
        replaceResource('students', (current) => ({ data: current.data.map((item) => item.user_id === dialog.record.user_id ? updated : item) }));
        setNotice('Student record updated.');
      } else {
        const created = await adminRequest(adminEndpoints.students, auth.token, { method: 'POST', body: JSON.stringify(values) });
        if (!created?.generated_user_id || !created?.temporary_password) throw new Error('The server response did not include the new account credentials. Refresh the student list before retrying.');
        replaceResource('students', (current) => ({ data: [{ ...created, user_id: created.generated_user_id, is_active: true }, ...current.data] }));
        setCredentials({ userId: created.generated_user_id, password: created.temporary_password });
        setNotice('Student account created by the server.');
      }
      setDialog(null);
      refreshDashboard();
    } finally {
      setMutating(false);
    }
  }

  async function submitTeacher(values) {
    setMutating(true);
    try {
      const created = await adminRequest(adminEndpoints.teachers, auth.token, { method: 'POST', body: JSON.stringify(values) });
      if (!created?.user_id || !created?.temporary_password) throw new Error('The server response did not include the new account credentials. Refresh the teacher list before retrying.');
      replaceResource('teachers', (current) => ({ data: [created, ...current.data] }));
      setDialog(null);
      setCredentials({ userId: created.user_id, password: created.temporary_password });
      setNotice('Teacher account created by the server.');
      refreshDashboard();
    } finally {
      setMutating(false);
    }
  }

  async function submitNotice(values) {
    setMutating(true);
    try {
      const created = await adminRequest(adminEndpoints.notices, auth.token, { method: 'POST', body: JSON.stringify(values) });
      replaceResource('notices', (current) => ({ data: [created, ...current.data] }));
      updateDashboardNotices((current) => [created, ...current]);
      setDialog(null);
      setNotice('Announcement published by the server.');
    } finally {
      setMutating(false);
    }
  }

  async function changeStudentStatus(student) {
    setDeactivating(true);
    setConfirmError('');
    try {
      const updated = await adminRequest(adminEndpoints.student(student.user_id), auth.token, { method: 'PATCH', body: JSON.stringify({ is_active: !student.is_active }) });
      replaceResource('students', (current) => ({ data: current.data.map((item) => item.user_id === student.user_id ? { ...item, ...updated, is_active: updated.is_active ?? !student.is_active } : item) }));
      setConfirmStudent(null);
      setNotice(`Student account ${student.is_active ? 'deactivated' : 'reactivated'}.`);
      refreshDashboard();
    } catch (error) {
      setConfirmError(getErrorMessage(error));
    } finally {
      setDeactivating(false);
    }
  }

  if (auth.status !== 'ready') return <AuthGate state={auth} onRetry={() => setAuthAttempt((attempt) => attempt + 1)} />;

  const current = pageCopy[active] || pageCopy.dashboard;
  return (
    <div className="adm-app">
      <aside className={`adm-sidebar${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-mobile-open' : ''}`}>
        <div className="adm-sidebar-brand"><Brand compact={collapsed} /><IconButton className="adm-collapse-button" label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((value) => !value)}><ChevronDown size={16} /></IconButton><IconButton className="adm-mobile-close" label="Close menu" onClick={() => setMobileOpen(false)}><X size={18} /></IconButton></div>
        <div className="adm-workspace"><span className="adm-workspace-mark"><ShieldCheck size={16} /></span><div><strong>{previewMode ? '' : 'School workspace'}</strong><small>{previewMode ? 'No school data connected' : auth.profile.school_id ? `School ID ${auth.profile.school_id}` : 'Administrator access'}</small></div><ChevronDown size={14} /></div>
        <nav className="adm-navigation" aria-label="Admin navigation">{groups.map((group) => <div className="adm-nav-group" key={group}><span className="adm-nav-label">{group}</span>{navigation.filter((item) => item.group === group).map((item) => <button type="button" key={item.id} className={`adm-nav-item${active === item.id ? ' active' : ''}`} onClick={() => navTo(item.id)} aria-current={active === item.id ? 'page' : undefined} title={collapsed ? item.label : undefined}><item.icon size={18} /><span>{item.label}</span></button>)}</div>)}</nav>
        <div className="adm-sidebar-footer"><div className="adm-admin-profile"><span className="adm-admin-avatar"><UserRound size={16} /></span><div><strong>{previewMode ? 'Preview account' : auth.profile.username}</strong><small>{previewMode ? '' : auth.profile.role === 'SUPER_ADMIN' ? 'Super admin' : 'School admin'}</small></div></div><p><ShieldCheck size={14} />{previewMode ? 'Read-only preview' : 'Secure EduSure workspace'}</p></div>
      </aside>
      {mobileOpen && <button className="adm-mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <main className={`adm-main${collapsed ? ' is-collapsed' : ''}`}>
        <Header active={active} profile={auth.profile} query={query} onQuery={setQuery} onMenu={() => window.innerWidth <= 760 ? setMobileOpen(true) : setCollapsed((value) => !value)} onNavigate={navTo} onLogout={onLogout} previewMode={previewMode} />
        <div className="adm-content">
          {previewMode && <div className="adm-connection-note adm-preview-banner"><span className="adm-connection-dot" />Standalone  <span className="adm-note-separator" />No real school data is loaded or changed.</div>}
          <div className="adm-content-heading"><span className="adm-breadcrumb-dot" />{current[0]}</div>
          {notice && <div className="adm-toast" role="status"><Check size={15} />{notice}<IconButton label="Dismiss" onClick={() => setNotice(null)}><X size={15} /></IconButton></div>}
          {active === 'dashboard' && <DashboardPage stats={stats} statsLoading={statsLoading} statsError={statsError} notices={dashboardNotices} noticesLoading={dashboardNoticesLoading} noticesError={dashboardNoticesError} onNavigate={navTo} onRefresh={refreshDashboard} profile={auth.profile} previewMode={previewMode} />}
          {active === 'students' && <StudentPage resource={resources.students} query={query} onQuery={setQuery} onAdd={() => setDialog({ kind: 'student', record: null })} onEdit={(record) => setDialog({ kind: 'student', record })} onDeactivate={(record) => { setConfirmError(''); setConfirmStudent(record); }} onRetry={() => loadResource('students')} onRefresh={() => loadResource('students')} previewMode={previewMode} />}
          {active === 'teachers' && <TeacherPage resource={resources.teachers} query={query} onQuery={setQuery} onAdd={() => setDialog({ kind: 'teacher' })} onRetry={() => loadResource('teachers')} onRefresh={() => loadResource('teachers')} previewMode={previewMode} />}
          {active === 'classes' && <ClassesPage stats={stats} statsLoading={statsLoading} statsError={statsError} onRetry={refreshDashboard} query={query} onQuery={setQuery} previewMode={previewMode} />}
          {active === 'notices' && <NoticesPage resource={resources.notices} query={query} onQuery={setQuery} onAdd={() => setDialog({ kind: 'notice' })} onRetry={() => loadResource('notices')} onRefresh={() => loadResource('notices')} previewMode={previewMode} />}
          {['timetable', 'attendance', 'examinations', 'reports', 'fees', 'calendar'].includes(active) && <NotConnectedPage active={active} />}
          {active === 'settings' && <SettingsPage profile={auth.profile} previewMode={previewMode} />}
          <footer className="adm-footer">EduSure <span>·</span> Admin workspace</footer>
        </div>
      </main>
      {dialog?.kind === 'student' && <StudentForm record={dialog.record} busy={mutating} onClose={() => setDialog(null)} onSubmit={submitStudent} />}
      {dialog?.kind === 'teacher' && <TeacherForm busy={mutating} onClose={() => setDialog(null)} onSubmit={submitTeacher} />}
      {dialog?.kind === 'notice' && <NoticeForm busy={mutating} onClose={() => setDialog(null)} onSubmit={submitNotice} />}
      {confirmStudent && <ConfirmDialog student={confirmStudent} busy={deactivating} error={confirmError} onCancel={() => setConfirmStudent(null)} onConfirm={() => changeStudentStatus(confirmStudent)} />}
      {credentials && <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />}
    </div>
  );
}
