const API_BASE = 'http://localhost:8000';

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
    return data;
  },

  async startSession({ subject_name, faculty_id, class_lat, class_lng }) {
    const res = await fetch(`${API_BASE}/api/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_name, faculty_id, class_lat, class_lng })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to start session');
    return data;
  },

  async getSessionQR(sessionId) {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/qr`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch QR');
    return data;
  },

  async markAttendance(payload) {
    const res = await fetch(`${API_BASE}/api/attendance/mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
    const res = await fetch(`${API_BASE}/api/student/${rollNo}/dashboard`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to load student dashboard');
    return data;
  },

  async getFacultyLiveSession(sessionId) {
    const res = await fetch(`${API_BASE}/api/faculty/session/${sessionId}/live`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to load faculty live session');
    return data;
  },

  async facultyApprove({ session_id, roll_no, action, remarks }) {
    const res = await fetch(`${API_BASE}/api/faculty/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id, roll_no, action, remarks })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Approval action failed');
    return data;
  },

  async facultyManualAttendance({ session_id, roll_no, status, faculty_id, reason }) {
    const res = await fetch(`${API_BASE}/api/faculty/manual-attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id, roll_no, status, faculty_id, reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Manual attendance failed');
    return data;
  },

  async getAdminOverview() {
    const res = await fetch(`${API_BASE}/api/admin/overview`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to fetch admin overview');
    return data;
  },

  async adminCreateUser(userData) {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to create user');
    return data;
  },

  async adminResetDevice(rollNo) {
    const res = await fetch(`${API_BASE}/api/admin/reset-device/${rollNo}`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to reset device');
    return data;
  }
};
