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
      if (res.status === 500 && (!text.trim() || text.includes('ECONNREFUSED'))) {
        throw new Error('Backend server is unreachable. Please ensure the backend server is running on http://127.0.0.1:8000.');
      }
      throw new Error(`Server error (${res.status}): ${text.slice(0, 150) || fallbackMsg}`);
    }
    throw new Error(`Invalid server response: ${text.slice(0, 150)}`);
  }
  if (!res.ok) {
    const msg = typeof data.detail === 'object'
      ? (data.detail.message || data.detail.reason || fallbackMsg)
      : (data.detail || fallbackMsg);
    const err = new Error(msg);
    err.status = res.status;
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

  async startSession({ subject_name, class_lat, class_lng, geofence_radius_meters = 150 }) {
    const res = await fetch(`${API_BASE}/api/sessions/start`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ subject_name, class_lat, class_lng, geofence_radius_meters })
    });
    return safeParse(res, 'Failed to start session');
  },

  async getSessionQR(sessionId, lat, lng) {
    let url = `${API_BASE}/api/sessions/${sessionId}/qr`;
    const params = new URLSearchParams();
    if (lat !== undefined && lat !== null) params.append('lat', lat);
    if (lng !== undefined && lng !== null) params.append('lng', lng);
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const res = await fetch(url, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch QR');
  },

  async updateSessionLocation(sessionId, { class_lat, class_lng, geofence_radius_meters = 150 }) {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/location`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ class_lat, class_lng, geofence_radius_meters })
    });
    return safeParse(res, 'Failed to update session location');
  },

  async getSessionInfo(sessionId) {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/info`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch session information');
  },

  async requestLivenessChallenge(sessionId) {
    const res = await fetch(`${API_BASE}/api/liveness/challenge`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ session_id: sessionId })
    });
    return safeParse(res, 'Failed to obtain liveness challenge');
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

  async processPanoramicAttendance(sessionId, imageBase64, autoMark = true) {
    const res = await fetch(`${API_BASE}/api/faculty/session/${sessionId}/panoramic-attendance`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ image_base64: imageBase64, auto_mark: autoMark })
    });
    return safeParse(res, 'Panoramic face analysis failed');
  },

  async getFraudSyndicate(sessionId) {
    const res = await fetch(`${API_BASE}/api/faculty/session/${sessionId}/fraud-syndicate`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch fraud syndicate intel');
  },


  async getAdminOverview() {
    const res = await fetch(`${API_BASE}/api/admin/overview`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch admin overview');
  },

  async getAdminUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/api/admin/users${query ? '?' + query : ''}`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch users');
  },

  async adminCreateUser(userData) {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });
    return safeParse(res, 'Failed to create user');
  },

  async adminDeleteUser(rollOrId) {
    const res = await fetch(`${API_BASE}/api/admin/users/${rollOrId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to delete user');
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

  async adminEnrollFace(rollNo, photoBase64, notes = 'Official face reference captured at registrar desk') {
    const res = await fetch(`${API_BASE}/api/admin/enroll-face/${rollNo}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ photo_base64: photoBase64, notes })
    });
    return safeParse(res, 'Failed to enroll student biometric face');
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
  },

  async simulateAttendance({ rollNo, subjectCode, plannedBunks = 0, plannedAttends = 0, targetThreshold = 75.0, futureEvents = [] }) {
    const res = await fetch(`${API_BASE}/api/student/${rollNo}/simulate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        subject_code: subjectCode,
        planned_bunks: plannedBunks,
        planned_attends: plannedAttends,
        target_threshold: targetThreshold,
        future_events: futureEvents
      })
    });
    return safeParse(res, 'Failed to simulate attendance scenario');
  },

  async getStudentNotifications(rollNo, unreadOnly = false) {
    const res = await fetch(`${API_BASE}/api/student/${rollNo}/notifications${unreadOnly ? '?unread_only=true' : ''}`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch student notifications');
  },

  async markNotificationRead(rollNo, notificationId) {
    const res = await fetch(`${API_BASE}/api/student/${rollNo}/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to mark notification as read');
  },

  async markAllNotificationsRead(rollNo) {
    const res = await fetch(`${API_BASE}/api/student/${rollNo}/notifications/mark-all-read`, {
      method: 'POST',
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to mark all notifications as read');
  },

  async dismissNotification(rollNo, notificationId) {
    const res = await fetch(`${API_BASE}/api/student/${rollNo}/notifications/${notificationId}/dismiss`, {
      method: 'POST',
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to dismiss notification');
  },

  async triggerTestWarningAlert(rollNo) {
    const res = await fetch(`${API_BASE}/api/student/${rollNo}/test-warning-alert`, {
      method: 'POST',
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to trigger test warning alert');
  },

  // Timetable APIs
  async getAdminTimetable(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '' && val !== 'ALL') {
        params.append(key, val);
      }
    });
    const qs = params.toString();
    const res = await fetch(`${API_BASE}/api/admin/timetable${qs ? '?' + qs : ''}`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch timetable entries');
  },

  async createTimetableEntry(entryData) {
    const res = await fetch(`${API_BASE}/api/admin/timetable`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(entryData)
    });
    return safeParse(res, 'Failed to create timetable slot');
  },

  async updateTimetableEntry(entryId, entryData) {
    const res = await fetch(`${API_BASE}/api/admin/timetable/${entryId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(entryData)
    });
    return safeParse(res, 'Failed to update timetable slot');
  },

  async deleteTimetableEntry(entryId) {
    const res = await fetch(`${API_BASE}/api/admin/timetable/${entryId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to delete timetable slot');
  },

  async setTimetablePublishStatus(entryId, isPublished) {
    const res = await fetch(`${API_BASE}/api/admin/timetable/${entryId}/publish`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ is_published: isPublished })
    });
    return safeParse(res, 'Failed to update publish status');
  },

  async batchPublishTimetable({ department, semester, section, is_published }) {
    const body = { is_published };
    if (department && department !== 'ALL') body.department = department;
    if (semester && semester !== 'ALL') body.semester = parseInt(semester);
    if (section && section !== 'ALL') body.section = section;

    const res = await fetch(`${API_BASE}/api/admin/timetable/batch-publish`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    return safeParse(res, 'Failed to batch update publication status');
  },

  async getClassTimetable({ department, semester, section }) {
    const params = new URLSearchParams();
    if (department) params.append('department', department);
    if (semester) params.append('semester', semester);
    if (section) params.append('section', section);
    const res = await fetch(`${API_BASE}/api/timetable/class?${params.toString()}`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch class timetable');
  },

  async getMyTimetable() {
    const res = await fetch(`${API_BASE}/api/timetable/my`, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch personal timetable');
  },

  async getFacultyTimetableToday(dayOfWeek = null) {
    let url = `${API_BASE}/api/faculty/timetable/today`;
    if (dayOfWeek) {
      url += `?day_of_week=${encodeURIComponent(dayOfWeek)}`;
    }
    const res = await fetch(url, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch today faculty timetable');
  },

  async getStudentTimetableToday(dayOfWeek = null) {
    let url = `${API_BASE}/api/student/timetable/today`;
    if (dayOfWeek) {
      url += `?day_of_week=${encodeURIComponent(dayOfWeek)}`;
    }
    const res = await fetch(url, {
      headers: getHeaders()
    });
    return safeParse(res, 'Failed to fetch today student timetable');
  }
};
