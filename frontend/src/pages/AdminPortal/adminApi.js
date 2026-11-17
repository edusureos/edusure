const API_ROOT = '/api/users';

export class AdminApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.payload = payload;
  }
}

function describePayload(payload) {
  if (typeof payload?.detail === 'string') return payload.detail;
  if (typeof payload?.error === 'string') return payload.error;
  if (payload && typeof payload === 'object') {
    return Object.entries(payload)
      .map(([field, value]) => {
        const messages = Array.isArray(value) ? value.join(' ') : String(value);
        return `${field}: ${messages}`;
      })
      .join(' ');
  }
  return '';
}

export async function adminRequest(path, token, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = path.startsWith('/api/') ? path : `${API_ROOT}${path}`;
  const response = await fetch(url, { ...options, headers });
  let payload;
  try {
    payload = response.status === 204 ? null : await response.json();
  } catch {
    if (response.ok) {
      throw new Error('The server returned an invalid response.');
    }
  }

  if (!response.ok) {
    const message = describePayload(payload) || `Request failed (${response.status}).`;
    throw new AdminApiError(message, response.status, payload);
  }
  return payload;
}

export async function downloadAdminExport(entity, fileFormat, token, filters = {}) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== '' && value != null),
  );
  const queryString = params.toString();
  const query = queryString ? `?${queryString}` : '';
  const response = await fetch(
    `${API_ROOT}/admin/export/${encodeURIComponent(entity)}/${encodeURIComponent(fileFormat)}/${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new AdminApiError(
      describePayload(payload) || `Export failed (${response.status}).`,
      response.status,
      payload,
    );
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `${entity}.${fileFormat}`;
  const url = window.URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
}

export const adminEndpoints = {
  profile: '/me/',
  stats: '/admin/stats/',
  students: '/admin/students/',
  bulkEnroll: '/bulk-enroll/',
  student: (userId) => `/admin/students/${encodeURIComponent(userId)}/`,
  teachers: '/admin/teachers/',
  classAttendance: '/api/users/attendance/class/',
  notices: '/notices/',
};
