function parseRecordDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('An attendance record has an invalid date.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('An attendance record has an invalid date.');
  }
  return date;
}

function getErrorMessage(payload, statusCode) {
  if (typeof payload?.detail === 'string') return payload.detail;
  return `Attendance records could not be loaded (HTTP ${statusCode}).`;
}

export async function fetchAttendance(monthDate, signal) {
  const token = window.localStorage.getItem('accessToken');
  if (!token) throw new Error('Your sign-in session is missing. Please sign in again.');

  const params = monthDate
    ? `?${new URLSearchParams({
      month: String(monthDate.getMonth() + 1),
      year: String(monthDate.getFullYear()),
    })}`
    : '';
  const response = await fetch(`/api/users/attendance/summary/${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Attendance records could not be read (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(getErrorMessage(payload, response.status));
  if (!Array.isArray(payload?.records)) throw new Error('The attendance response has an invalid format.');
  if (!Number.isInteger(payload.total_days) || payload.total_days < 0) {
    throw new Error('The attendance response has an invalid working-day total.');
  }

  const records = payload.records.map((record) => {
    if (!record || typeof record.status !== 'string') {
      throw new Error('An attendance record has an invalid status.');
    }
    return { ...record, parsedDate: parseRecordDate(record.date) };
  });

  return { records, totalDays: Number(payload.total_days) };
}
