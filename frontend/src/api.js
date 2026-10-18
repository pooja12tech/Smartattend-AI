const API_BASE = import.meta.env.VITE_API_URL || '';

export const getDeviceId = () => {
  let devId = localStorage.getItem('smartattend_device_id');
  if (!devId) {
    // Generate a persistent, realistic browser device fingerprint
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    devId = `DEV-${navigator.platform.includes('Win') ? 'WIN' : 'MOB'}-${rand}`;
    localStorage.setItem('smartattend_device_id', devId);
  }
  return devId;
};

export const setCustomDeviceId = (newId) => {
  localStorage.setItem('smartattend_device_id', newId);
};

export const getAuthToken = () => {
  return localStorage.getItem('smartattend_jwt_token');
};

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('smartattend_jwt_token', token);
  } else {
    localStorage.removeItem('smartattend_jwt_token');
  }
};

const getHeaders = (extraHeaders = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const safeParse = async (res, fallbackMsg = 'Request failed') => {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    if (!res.ok) {
      throw new Error(`Server error (${res.status}): ${text.slice(0, 150) || fallbackMsg}`);
    }
    throw new Error(`Invalid server response: ${text.slice(0, 150)}`);
  }
  if (!res.ok) {
    const msg = typeof data.detail === 'object' ? data.detail.reason : data.detail || fallbackMsg;
    const err = new Error(msg);
    err.detail = data.detail;
    throw err;
  }
  return data;
};

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/api/health`);
    return safeParse(res, 'Health check failed');
  },

  async login({ roll_no, password, device_id }) {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roll_no, password, device_id })
    });
    const data = await safeParse(res, 'Login failed');
    if (data.access_token) {
      setAuthToken(data.access_token);
    }
    return data;
  },

  logout() {
    setAuthToken(null);
  },

  async enrollFace({ live_selfie_base64, consent_given = true }) {
    const res = await fetch(`${API_BASE}/api/student/enroll-face`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ live_selfie_base64, consent_given })
    });
    return safeParse(res, 'Face enrollment failed');
  },

  async startSession({ subject_name, class_lat, class_lng }) {
    const res = await fetch(`${API_BASE}/api/sessions/start`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ subject_name, class_lat, class_lng })
    });
    return safeParse(res, 'Failed to start session');
  },

  async getSessionQR(sessionId) {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/qr`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch QR');
  },

  async endSession(sessionId) {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to end session');
  },

  async markAttendance(payload) {
    const { roll_no, ...cleanPayload } = payload;
    const res = await fetch(`${API_BASE}/api/attendance/mark`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(cleanPayload)
    });
    return safeParse(res, 'Attendance failed');
  },

  async requestDeviceException({ session_id, device_id, reason, live_selfie_base64 }) {
    const res = await fetch(`${API_BASE}/api/attendance/request-exception`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ session_id, device_id, reason, live_selfie_base64 })
    });
    return safeParse(res, 'Exception request failed');
  },

  async getStudentDashboard(rollNo) {
    const res = await fetch(`${API_BASE}/api/student/${rollNo}/dashboard`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to load student dashboard');
  },

  async getFacultyLiveSession(sessionId) {
    const res = await fetch(`${API_BASE}/api/faculty/session/${sessionId}/live`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to load faculty live session');
  },

  async getSessionRoster(sessionId) {
    const res = await fetch(`${API_BASE}/api/faculty/session/${sessionId}/roster`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch session roster');
  },

  async facultyApprove({ session_id, roll_no, action, remarks }) {
    const res = await fetch(`${API_BASE}/api/faculty/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ session_id, roll_no, action, remarks })
    });
    return safeParse(res, 'Approval action failed');
  },

  async facultyManualAttendance({ session_id, roll_no, status, reason }) {
    const res = await fetch(`${API_BASE}/api/faculty/manual-attendance`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ session_id, roll_no, status, reason })
    });
    return safeParse(res, 'Manual attendance failed');
  },

  async getAdminOverview() {
    const res = await fetch(`${API_BASE}/api/admin/overview`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch admin overview');
  },

  async adminCreateUser(userData) {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });
    return safeParse(res, 'Failed to create user');
  },

  async adminResetDevice(rollNo, reason = 'Hardware device lock reset by administrator') {
    const res = await fetch(`${API_BASE}/api/admin/reset-device/${rollNo}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason })
    });
    return safeParse(res, 'Failed to reset device');
  },

  async adminResetFace(rollNo, reason = 'Biometric reference reset by administrator') {
    const res = await fetch(`${API_BASE}/api/admin/reset-face/${rollNo}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason })
    });
    return safeParse(res, 'Failed to reset biometric template');
  },

  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/api/admin/audit-logs${query ? '?' + query : ''}`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch audit logs');
  },

  async getSubjects() {
    const res = await fetch(`${API_BASE}/api/subjects`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch subjects');
  },

  async adminCreateSubject(subjectData) {
    const res = await fetch(`${API_BASE}/api/admin/subjects`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(subjectData)
    });
    return safeParse(res, 'Failed to create subject');
  },

  async getStudentSubjects(rollNo) {
    const res = await fetch(`${API_BASE}/api/student/${rollNo}/subjects`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch student subjects');
  }
};
