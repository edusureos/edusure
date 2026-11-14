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
  if (options.body && !headers.has('Content-Type')) {
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

export const adminEndpoints = {
  profile: '/me/',
  stats: '/admin/stats/',
  students: '/admin/students/',
  student: (userId) => `/admin/students/${encodeURIComponent(userId)}/`,
  teachers: '/admin/teachers/',
  classAttendance: '/api/users/attendance/class/',
  notices: '/notices/',
};
