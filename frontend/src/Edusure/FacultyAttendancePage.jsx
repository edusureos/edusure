import { useEffect, useMemo, useState } from 'react';
import { AdminAttendancePage } from '../pages/AdminPortal/AdminDashboard';
import AttendanceManagementPage from '../pages/AdminPortal/AttendanceManagementPage';
import { adminEndpoints, adminRequest } from '../pages/AdminPortal/adminApi';

function localDate(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function reportDateRange() {
  const today = new Date();
  return {
    start_date: localDate(new Date(today.getFullYear(), today.getMonth(), 1)),
    end_date: localDate(today),
  };
}

export default function FacultyAttendancePage({ onBack, token }) {
  const [resource, setResource] = useState({ loading: true, classOptions: [], error: '' });

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ report_type: 'summary', ...reportDateRange() });
    adminRequest(`${adminEndpoints.attendanceReports}?${params}`, token, { signal: controller.signal })
      .then((result) => {
        if (!Array.isArray(result?.class_options)) {
          throw new Error('The server returned an invalid faculty class list.');
        }
        setResource({ loading: false, classOptions: result.class_options, error: '' });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setResource({
            loading: false,
            classOptions: [],
            error: error instanceof Error ? error.message : 'Assigned classes could not be loaded.',
          });
        }
      });

    return () => controller.abort();
  }, [token]);

  const stats = useMemo(() => ({
    class_breakdown: resource.classOptions.flatMap(({ class_grade, sections }) => (
      sections.length
        ? sections.map((section) => ({ class_grade, section }))
        : [{ class_grade, section: '' }]
    )),
  }), [resource.classOptions]);

  return (
    <AttendanceManagementPage
      token={token}
      stats={stats}
      statsLoading={resource.loading}
      statsError={resource.error}
      previewMode={false}
      MarkAttendance={AdminAttendancePage}
      portalOnly="faculty"
      onBackToDashboard={onBack}
    />
  );
}
