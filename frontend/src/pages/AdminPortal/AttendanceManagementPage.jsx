import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BookOpenCheck, CalendarDays, CheckCircle2,
  ChevronRight, CircleAlert, ClipboardCheck, FileBarChart2, GraduationCap,
  Filter, Search, Users, UserRoundCheck,
} from 'lucide-react';
import { adminEndpoints, adminRequest } from './adminApi';
import './attendance-management.css';

function localDate(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function initialFilters() {
  const today = new Date();
  return {
    startDate: localDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: localDate(today),
    classGrade: '',
    section: '',
    comparison: '',
    percentage: '',
    search: '',
    studentId: '',
  };
}

const reportTabs = [
  { id: 'student', label: 'Student-wise', icon: Users },
  { id: 'class', label: 'Class-wise', icon: BookOpenCheck },
  { id: 'special', label: 'Special filter', icon: Filter },
  { id: 'submission', label: 'Missing attendance', icon: CalendarDays },
];

const portals = [
  {
    id: 'student',
    title: 'Student Portal',
    description: 'Manage attendance marking and access attendance reports.',
    action: 'Explore student tools',
    icon: GraduationCap,
  },
  {
    id: 'faculty',
    title: 'Faculty Portal',
    description: 'Manage student attendance, monitor records, and generate reports.',
    action: 'Explore faculty tools',
    icon: UserRoundCheck,
  },
];

function FeatureCard({ title, description, action, icon: Icon, onClick }) {
  return (
    <button type="button" className="att-feature-card" onClick={onClick}>
      <span className="att-feature-icon"><Icon size={21} strokeWidth={1.8} /></span>
      <span className="att-feature-copy">
        <strong>{title}</strong>
        <small>{description}</small>
        <span>{action}<ArrowRight size={14} /></span>
      </span>
      <ChevronRight className="att-card-chevron" size={18} />
    </button>
  );
}

function PageHeading({ title, description, onBack, backLabel }) {
  return (
    <div className="att-page-heading">
      <div>
        <button type="button" className="att-back-button" onClick={onBack}>
          <ArrowLeft size={15} /> {backLabel}
        </button>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, note }) {
  return (
    <article className="att-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

function EmptyPanel({ title, children }) {
  return (
    <div className="att-empty-panel">
      <span><ClipboardCheck size={20} /></span>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

function AttendanceTable({ columns, rows, emptyMessage }) {
  if (!rows.length) return <EmptyPanel title="No attendance records found.">{emptyMessage}</EmptyPanel>;
  return (
    <div className="att-table-scroll">
      <table className="att-report-table">
        <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : (row[column.key] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Percent({ value }) {
  return value == null ? '—' : `${Number(value).toFixed(1)}%`;
}

export default function AttendanceManagementPage({
  token,
  stats,
  statsLoading,
  statsError,
  previewMode,
  MarkAttendance,
  portalOnly = '',
  onBackToDashboard,
}) {
  const [page, setPage] = useState(portalOnly || 'landing');
  const [portal, setPortal] = useState(portalOnly || 'student');
  const [returnPage, setReturnPage] = useState(portalOnly || 'student');
  const [reportType, setReportType] = useState('student');
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [submissionDate, setSubmissionDate] = useState(() => initialFilters().endDate);
  const [submissionData, setSubmissionData] = useState(null);
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState('');
  const requestRef = useRef(null);
  const submissionRequestRef = useRef(null);

  const classOptions = data?.class_options || [];
  const selectedClass = classOptions.find((item) => item.class_grade === filters.classGrade);
  const sections = selectedClass?.sections || [];

  useEffect(() => () => {
    requestRef.current?.abort();
    submissionRequestRef.current?.abort();
  }, []);

  function loadReport(targetPage, type, queryFilters) {
    if (previewMode || !token) return;
    if (targetPage === 'reports' && type === 'special' && (
      !queryFilters.comparison || queryFilters.percentage === ''
    )) {
      requestRef.current?.abort();
      requestRef.current = null;
      setLoading(false);
      setError('');
      setData(null);
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const reportFilter = targetPage === 'view' ? 'class' : type;
    const params = new URLSearchParams({
      report_type: reportFilter === 'special' ? 'summary' : reportFilter,
      start_date: queryFilters.startDate,
      end_date: queryFilters.endDate,
    });
    if (reportFilter === 'class' && queryFilters.classGrade) params.set('class_grade', queryFilters.classGrade);
    if (reportFilter === 'class' && queryFilters.section) params.set('section', queryFilters.section);
    if (reportFilter === 'special' && queryFilters.comparison) {
      params.set('comparison', queryFilters.comparison);
      params.set('percentage', queryFilters.percentage);
    }
    if (['student', 'view'].includes(reportFilter) && queryFilters.search.trim()) params.set('search', queryFilters.search.trim());
    if (targetPage === 'reports' && reportFilter === 'student' && queryFilters.studentId) {
      params.set('student_id', queryFilters.studentId);
    }

    setLoading(true);
    setError('');
    adminRequest(`${adminEndpoints.attendanceReports}?${params}`, token, { signal: controller.signal })
      .then((result) => {
        if (!Array.isArray(result?.students) || !Array.isArray(result?.class_options)) {
          throw new Error('The server returned an invalid attendance report.');
        }
        setData(result);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setData(null);
          setError(requestError instanceof Error ? requestError.message : 'Attendance reports could not be loaded.');
        }
      })
      .finally(() => {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setLoading(false);
        }
      });
  }

  function loadSubmissionStatus(date) {
    if (previewMode || !token) return;
    submissionRequestRef.current?.abort();
    const controller = new AbortController();
    submissionRequestRef.current = controller;
    setSubmissionLoading(true);
    setSubmissionError('');
    const params = new URLSearchParams({ date });
    adminRequest(`${adminEndpoints.attendanceOverview}?${params}`, token, { signal: controller.signal })
      .then((result) => {
        if (!Array.isArray(result?.class_wise_status)) {
          throw new Error('The server returned an invalid attendance submission report.');
        }
        setSubmissionData(result);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setSubmissionData(null);
          setSubmissionError(requestError instanceof Error ? requestError.message : 'Attendance submission status could not be loaded.');
        }
      })
      .finally(() => {
        if (submissionRequestRef.current === controller) {
          submissionRequestRef.current = null;
          setSubmissionLoading(false);
        }
      });
  }

  const studentColumns = useMemo(() => [
    { key: 'student_id', label: 'Student ID' },
    { key: 'name', label: 'Student' },
    { key: 'class_grade', label: 'Class' },
    { key: 'section', label: 'Section' },
    { key: 'total_days', label: 'Working days' },
    { key: 'present_days', label: 'Present' },
    { key: 'absent_days', label: 'Absent' },
    { key: 'attendance_percentage', label: 'Attendance', render: (row) => <Percent value={row.attendance_percentage} /> },
  ], []);

  function openPortal(portalId) {
    setPortal(portalId);
    setPage(portalId);
  }

  function backToPortals() {
    if (portalOnly && onBackToDashboard) onBackToDashboard();
    else setPage('landing');
  }

  function openAttendance() {
    setReturnPage(page);
    setPage('mark');
  }

  function openReports(type = 'student') {
    setReportType(type);
    setPage('reports');
    loadReport('reports', type, applied);
  }

  function openView() {
    setPage('view');
    loadReport('view', 'class', applied);
  }

  function changeReportType(type) {
    if (type === 'submission') {
      openSubmissionStatus();
      return;
    }
    const next = {
      ...filters,
      studentId: '',
      ...(type !== 'class' ? { classGrade: '', section: '' } : {}),
      ...(type !== 'special' ? { comparison: '', percentage: '' } : {}),
    };
    setReportType(type);
    setPage('reports');
    setFilters(next);
    setApplied(next);
    loadReport('reports', type, next);
  }

  function openSubmissionStatus() {
    if (portalOnly) return;
    setReportType('submission');
    setSubmissionDate(applied.endDate);
    setPage('submission');
    loadSubmissionStatus(applied.endDate);
  }

  function applySubmissionDate(event) {
    event.preventDefault();
    loadSubmissionStatus(submissionDate);
  }

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setFilterError('');
  }

  function applyFilters(event) {
    event.preventDefault();
    if (!filters.startDate || !filters.endDate) {
      setFilterError('Choose both a start date and an end date.');
      return;
    }
    if (filters.startDate > filters.endDate) {
      setFilterError('Start date must be on or before end date.');
      return;
    }
    if (reportType === 'special' && !filters.comparison) {
      setFilterError('Choose less than or greater than for the special filter.');
      return;
    }
    if (reportType === 'special' && (
      filters.percentage === '' || Number(filters.percentage) < 0 || Number(filters.percentage) > 100
    )) {
      setFilterError('Enter an attendance percentage from 0 to 100.');
      return;
    }
    setFilterError('');
    const next = { ...filters, studentId: '' };
    setApplied(next);
    loadReport(page, reportType, next);
  }

  function resetFilters() {
    const defaults = initialFilters();
    setFilters(defaults);
    setApplied(defaults);
    loadReport(page, reportType, defaults);
    setFilterError('');
  }

  function selectStudent(studentId) {
    updateFilter('studentId', studentId);
    setApplied((current) => ({ ...current, studentId }));
    loadReport(page, reportType, { ...applied, studentId });
  }

  const activeReportType = page === 'view' ? 'class' : reportType;
  const isFeaturePage = ['student', 'faculty'].includes(page);
  const submissionRows = submissionData?.class_wise_status || [];
  const submittedCount = submissionRows.filter((item) => item.is_marked).length;
  const missingCount = submissionRows.length - submittedCount;
  const visibleReportTabs = portalOnly
    ? reportTabs.filter((tab) => tab.id !== 'submission')
    : reportTabs;
  const reportDescription = activeReportType === 'student'
    ? 'Search for a student across all classes and review their attendance history.'
    : activeReportType === 'class'
      ? 'Compare attendance across students in the selected class.'
      : activeReportType === 'special'
        ? 'Find students above or below an attendance percentage.'
        : '';

  return (
    <section className="att-module">
      {page === 'landing' && !portalOnly && (
        <>
          <div className="att-module-heading">
            <div><h1>Attendance Management</h1><p>Choose a portal to manage attendance records and reports.</p></div>
          </div>
          <div className="att-portal-grid">
            {portals.map((item) => <FeatureCard key={item.id} {...item} onClick={() => openPortal(item.id)} />)}
          </div>
        </>
      )}

      {isFeaturePage && (
        <>
          <PageHeading
            title={`${page === 'student' ? 'Student' : 'Faculty'} Portal`}
            description={page === 'student'
              ? 'Mark attendance and review attendance reports.'
              : 'Manage class attendance, view records, and review reports.'}
            onBack={backToPortals}
            backLabel={portalOnly ? 'Dashboard' : 'Attendance Management'}
          />
          <div className="att-feature-grid">
            {page === 'student' ? (
              <>
                <FeatureCard title="Mark Attendance" description="Open the existing class attendance register." action="Open attendance" icon={ClipboardCheck} onClick={openAttendance} />
                <FeatureCard title="Attendance Reports" description="Review student records, class attendance, and threshold matches." action="View reports" icon={FileBarChart2} onClick={() => openReports('student')} />
              </>
            ) : (
              <>
                <FeatureCard title="Mark Attendance" description="Load a class roll call and save attendance." action="Mark attendance" icon={ClipboardCheck} onClick={openAttendance} />
                <FeatureCard title="View Attendance" description="Review class attendance records by date range." action="View records" icon={CalendarDays} onClick={openView} />
                <FeatureCard title="Attendance Reports" description="Analyse student records, class attendance, and thresholds." action="View reports" icon={FileBarChart2} onClick={() => openReports('student')} />
              </>
            )}
          </div>
        </>
      )}

      {page === 'mark' && (
        <MarkAttendance
          token={token}
          stats={stats}
          statsLoading={statsLoading}
          statsError={statsError}
          previewMode={previewMode}
          onBack={() => setPage(returnPage)}
        />
      )}

      {['reports', 'view'].includes(page) && (
        <>
          <PageHeading
            title={page === 'view' ? 'View Attendance' : 'Attendance Reports'}
            description={page === 'view' ? 'Review attendance records for classes available to your account.' : reportDescription}
            onBack={() => setPage(portal)}
            backLabel={`${portal === 'student' ? 'Student' : 'Faculty'} Portal`}
          />
          {page === 'reports' && (
            <div className="att-report-tabs" role="tablist" aria-label="Attendance report type">
              {visibleReportTabs.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={reportType === id}
                  className={reportType === id ? 'is-active' : ''}
                  key={id}
                  onClick={() => changeReportType(id)}
                >
                  <Icon size={16} />{label}
                </button>
              ))}
            </div>
          )}

          <form className="att-filter-panel" onSubmit={applyFilters}>
            <div className="att-filter-heading"><div><h2>Filters</h2><p>Choose only the information needed for this report.</p></div><CalendarDays size={18} /></div>
            <div className="att-filter-grid">
              <label><span>Start date</span><input type="date" value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} required /></label>
              <label><span>End date</span><input type="date" value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} required /></label>
              {(activeReportType === 'class' || page === 'view') && (
                <>
                  <label><span>Class</span>
                    <select value={filters.classGrade} onChange={(event) => setFilters((current) => ({ ...current, classGrade: event.target.value, section: '' }))} disabled={loading && !data}>
                      <option value="">All classes</option>
                      {classOptions.map((item) => <option key={item.class_grade} value={item.class_grade}>{item.class_grade}</option>)}
                    </select>
                  </label>
                  <label><span>Section</span>
                    <select value={filters.section} onChange={(event) => updateFilter('section', event.target.value)} disabled={!filters.classGrade}>
                      <option value="">All sections</option>
                      {sections.map((section) => <option key={section} value={section}>{section}</option>)}
                    </select>
                  </label>
                </>
              )}
              {activeReportType === 'student' && (
                <label className="att-search-field"><span>Student (any class)</span><span className="att-search-input"><Search size={16} /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, studentId: '' }))} placeholder="Search by name or student ID" /></span></label>
              )}
              {activeReportType === 'special' && (
                <>
                  <label><span>Attendance comparison</span>
                    <select value={filters.comparison} onChange={(event) => updateFilter('comparison', event.target.value)}>
                      <option value="">Choose comparison</option><option value="lt">Less than (&lt;)</option><option value="gt">Greater than (&gt;)</option>
                    </select>
                  </label>
                  <label><span>Attendance percentage</span><span className="att-percent-input"><input type="number" min="0" max="100" step="0.1" value={filters.percentage} onChange={(event) => updateFilter('percentage', event.target.value)} disabled={!filters.comparison} placeholder="e.g. 75" /><span>%</span></span></label>
                </>
              )}
            </div>
            {filterError && <p className="att-filter-error" role="alert"><CircleAlert size={15} />{filterError}</p>}
            <div className="att-filter-actions">
              <button type="button" className="att-secondary-button" onClick={resetFilters}>Reset</button>
              <button type="submit" className="att-primary-button">Apply filter <ArrowRight size={15} /></button>
            </div>
          </form>

          {previewMode || !token ? (
            <EmptyPanel title="Sign in to load attendance reports.">Reports use attendance records connected to your school; preview mode does not display sample data.</EmptyPanel>
          ) : error ? (
            <div className="att-error-panel" role="alert"><CircleAlert size={18} /><div><strong>Unable to load attendance data</strong><p>{error}</p></div><button type="button" className="att-secondary-button" onClick={() => loadReport(page, reportType, applied)}>Try again</button></div>
          ) : loading ? (
            <div className="att-loading-panel" role="status"><span className="att-spinner" />Loading attendance records…</div>
          ) : activeReportType === 'special' && (!applied.comparison || applied.percentage === '') ? (
            <EmptyPanel title="Choose an attendance threshold.">Select “Less than” or “Greater than”, enter a percentage from 0 to 100, then apply the filter.</EmptyPanel>
          ) : data ? (
            <div className="att-results">
              <div className="att-results-heading"><div><h2>{page === 'view' ? 'Class attendance records' : reportTabs.find((item) => item.id === activeReportType)?.label + ' report'}</h2><p>{data.filters.start_date} – {data.filters.end_date}{data.filters.class_grade ? ` · Class ${data.filters.class_grade}` : ' · All classes'}{data.filters.section ? ` · Section ${data.filters.section}` : ''}</p></div><span className="att-live-badge"><CheckCircle2 size={14} />Live records</span></div>

              {activeReportType === 'student' && (
                <>
                  <section className="att-result-card">
                    <h3>Students matching your search</h3>
                    <AttendanceTable
                      columns={[
                        ...studentColumns.slice(0, 4),
                        { key: 'total_days', label: 'Working days' },
                        { key: 'present_days', label: 'Present' },
                        { key: 'absent_days', label: 'Absent' },
                        { key: 'attendance_percentage', label: 'Attendance', render: (row) => <Percent value={row.attendance_percentage} /> },
                        { key: 'open', label: 'History', render: (row) => <button type="button" className="att-table-link" onClick={() => selectStudent(row.student_id)}>{applied.studentId === row.student_id ? 'Selected' : 'View history'}</button> },
                      ]}
                      rows={data.students.map((row) => ({ ...row, key: row.student_id }))}
                      emptyMessage="Try another student name or ID, or adjust the class and date filters."
                    />
                  </section>
                  {data.selected_student && (
                    <section className="att-result-card">
                      <div className="att-results-heading"><div><h3>{data.selected_student.name} · {data.selected_student.student_id}</h3><p>{data.selected_student.class_grade || 'Class not set'}{data.selected_student.section ? ` · Section ${data.selected_student.section}` : ''} · {data.selected_student.total_days} recorded days · <Percent value={data.selected_student.attendance_percentage} /></p></div></div>
                      <AttendanceTable
                        columns={[
                          { key: 'date', label: 'Date' },
                          { key: 'status', label: 'Status' },
                          { key: 'remarks', label: 'Remarks' },
                        ]}
                        rows={data.student_records.map((record, index) => ({ ...record, key: `${record.date}-${index}` }))}
                        emptyMessage="No attendance records were recorded for this student in the selected date range."
                      />
                    </section>
                  )}
                </>
              )}

              {activeReportType === 'class' && (
                <section className="att-result-card">
                  <h3>Class attendance by student</h3>
                  <AttendanceTable
                    columns={studentColumns}
                    rows={data.students.map((row) => ({ ...row, key: row.student_id }))}
                    emptyMessage="No students or attendance records match the selected class and date range."
                  />
                </section>
              )}

              {activeReportType === 'special' && (
                <section className="att-result-card">
                  <h3>Students matching the attendance threshold</h3>
                  <AttendanceTable
                    columns={studentColumns}
                    rows={data.students.map((row) => ({ ...row, key: row.student_id }))}
                    emptyMessage="No students match this attendance threshold for the selected date range."
                  />
                </section>
              )}

            </div>
          ) : null}
          {statsError && statsLoading && <p className="att-data-note">Refreshing school class data…</p>}
        </>
      )}

      {page === 'submission' && !portalOnly && (
        <>
          <PageHeading
            title="Attendance Submission Status"
            description="Check which classes have or have not marked attendance for a date."
            onBack={() => setPage(portal)}
            backLabel={`${portal === 'student' ? 'Student' : 'Faculty'} Portal`}
          />
          <div className="att-report-tabs" role="tablist" aria-label="Attendance report type">
            {visibleReportTabs.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                role="tab"
                aria-selected={reportType === id}
                className={reportType === id ? 'is-active' : ''}
                key={id}
                onClick={() => changeReportType(id)}
              >
                <Icon size={16} />{label}
              </button>
            ))}
          </div>
          <form className="att-submission-date" onSubmit={applySubmissionDate}>
            <label><span>Attendance date</span><input type="date" value={submissionDate} onChange={(event) => setSubmissionDate(event.target.value)} required /></label>
            <button type="submit" className="att-primary-button">Check status <ArrowRight size={15} /></button>
          </form>
          {previewMode || !token ? (
            <EmptyPanel title="Sign in to check attendance submissions.">Submission status is loaded from the school attendance overview; preview mode does not display sample data.</EmptyPanel>
          ) : submissionError ? (
            <div className="att-error-panel" role="alert"><CircleAlert size={18} /><div><strong>Unable to load submission status</strong><p>{submissionError}</p></div><button type="button" className="att-secondary-button" onClick={() => loadSubmissionStatus(submissionDate)}>Try again</button></div>
          ) : submissionLoading ? (
            <div className="att-loading-panel" role="status"><span className="att-spinner" />Loading class submission status…</div>
          ) : submissionData ? (
            <div className="att-results">
              <div className="att-metrics-grid att-submission-metrics">
                <MetricCard label="Total classes" value={submissionRows.length} />
                <MetricCard label="Marked" value={submittedCount} />
                <MetricCard label="Not marked" value={missingCount} />
                <MetricCard label="Students in classes" value={submissionRows.reduce((total, item) => total + item.total_students, 0)} />
              </div>
              <section className="att-result-card">
                <h3>Class attendance status · {submissionData.date}</h3>
                <p className="att-submission-note">The existing attendance API reports a class as marked when at least one attendance record exists; it does not indicate whether every student has been marked.</p>
                <AttendanceTable
                  columns={[
                    { key: 'class_grade', label: 'Class', render: (row) => row.class_grade || '—' },
                    { key: 'section', label: 'Section', render: (row) => row.section || '—' },
                    { key: 'total_students', label: 'Students' },
                    { key: 'marked_count', label: 'Attendance records' },
                    { key: 'status', label: 'Attendance', render: (row) => <span className={`att-submission-status ${row.is_marked ? 'is-submitted' : 'is-missing'}`}>{row.is_marked ? 'Marked' : 'Not marked'}</span> },
                  ]}
                  rows={submissionRows.map((row, index) => ({ ...row, key: `${row.class_grade}-${row.section}-${index}` }))}
                  emptyMessage="No class or section records are available."
                />
              </section>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
