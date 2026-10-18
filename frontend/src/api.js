const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/`);
    return res.json();
  },

  async login({ roll_no, password, device_id, is_exception_mode = false }) {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roll_no, password, device_id, is_exception_mode })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Login failed');
    }
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Face enrollment failed');
    return data;
  },

  async startSession({ subject_name, class_lat, class_lng }) {
    const res = await fetch(`${API_BASE}/api/sessions/start`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ subject_name, class_lat, class_lng })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to start session');
    return data;
  },

  async getSessionQR(sessionId) {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/qr`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch QR');
    return data;
  },

  async markAttendance(payload) {
    const { roll_no, ...cleanPayload } = payload;
    const res = await fetch(`${API_BASE}/api/attendance/mark`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(cleanPayload)
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(typeof data.detail === 'object' ? data.detail.reason : data.detail || 'Attendance failed');
      err.detail = data.detail;
      throw err;
    }
    return data;
  },

  async getStudentDashboard(rollNo) {
    const res = await fetch(`${API_BASE}/api/student/${rollNo}/dashboard`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to load student dashboard');
    return data;
  },

  async getFacultyLiveSession(sessionId) {
    const res = await fetch(`${API_BASE}/api/faculty/session/${sessionId}/live`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to load faculty live session');
    return data;
  },

  async facultyApprove({ session_id, roll_no, action, remarks }) {
    const res = await fetch(`${API_BASE}/api/faculty/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ session_id, roll_no, action, remarks })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Approval action failed');
    return data;
  },

  async facultyManualAttendance({ session_id, roll_no, status, reason }) {
    const res = await fetch(`${API_BASE}/api/faculty/manual-attendance`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ session_id, roll_no, status, reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Manual attendance failed');
    return data;
  },

  async getAdminOverview() {
    const res = await fetch(`${API_BASE}/api/admin/overview`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch admin overview');
    return data;
  },

  async adminCreateUser(userData) {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to create user');
    return data;
  },

  async adminResetDevice(rollNo, reason = 'Hardware device lock reset by administrator') {
    const res = await fetch(`${API_BASE}/api/admin/reset-device/${rollNo}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to reset device');
    return data;
  },

  async adminResetFace(rollNo, reason = 'Biometric reference reset by administrator') {
    const res = await fetch(`${API_BASE}/api/admin/reset-face/${rollNo}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to reset biometric template');
    return data;
  },

  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/api/admin/audit-logs${query ? '?' + query : ''}`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch audit logs');
    return data;
  },

  async getSubjects() {
    const res = await fetch(`${API_BASE}/api/subjects`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch subjects');
    return data;
  },

  async adminCreateSubject(subjectData) {
    const res = await fetch(`${API_BASE}/api/admin/subjects`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(subjectData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to create subject');
    return data;
  },

  async getStudentSubjects(rollNo) {
    const res = await fetch(`${API_BASE}/api/student/${rollNo}/subjects`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch student subjects');
    return data;
  }
};
