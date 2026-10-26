import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LoginView from './components/LoginView';
import StudentPortal from './components/StudentPortal';
import FacultyPortal from './components/FacultyPortal';
import AdminPortal from './components/AdminPortal';
import OfflineBanner from './components/OfflineBanner';
import PwaUpdateToast from './components/PwaUpdateToast';
import IosInstallBanner from './components/IosInstallBanner';
import { api, getDeviceId } from './api';

// Feature flag for new desktop experience (1-line toggle to revert)
export const USE_NEW_DESKTOP_LAYOUT = true;

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('smartattend_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [backendOnline, setBackendOnline] = useState(false);

  // Poll backend health status
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.getHealth();
        if (res.status === 'ONLINE') {
          setBackendOnline(true);
        }
      } catch (err) {
        setBackendOnline(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLoginSuccess = (user, bindingStatus) => {
    setCurrentUser(user);
    localStorage.setItem('smartattend_current_user', JSON.stringify(user));

    // Preserve bookmarkable hash URL if it matches user's role, otherwise route to role default
    const hash = window.location.hash || '';
    const role = user?.role;
    const expectedPrefix = `#/${role}/`;
    if (!hash.startsWith(expectedPrefix)) {
      if (role === 'admin') window.location.hash = '#/admin/overview';
      else if (role === 'faculty') window.location.hash = '#/faculty/home';
      else if (role === 'student') window.location.hash = '#/student/home';
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    localStorage.removeItem('smartattend_current_user');
    window.location.hash = '#/login';
  };

  // Synchronize top-level hash with user session on mount
  useEffect(() => {
    const hash = window.location.hash || '';
    if (!currentUser) {
      if (!hash || hash === '#/') {
        window.location.hash = '#/login';
      }
    } else {
      const role = currentUser.role;
      const expectedPrefix = `#/${role}`;
      if (!hash || hash === '#/' || hash === '#/login' || !hash.startsWith(expectedPrefix)) {
        if (role === 'admin') window.location.hash = '#/admin/overview';
        else if (role === 'faculty') window.location.hash = '#/faculty/home';
        else if (role === 'student') window.location.hash = '#/student/home';
      }
    }
  }, [currentUser]);

  const isStudent = currentUser?.role === 'student';
  const isFaculty = currentUser?.role === 'faculty';
  const isAdmin = currentUser?.role === 'admin';
  const isDarkPortal = !USE_NEW_DESKTOP_LAYOUT && (isAdmin || isFaculty);

  // Dynamically sync Android status bar theme-color
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const isMobileWidth = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isAdmin) {
        metaThemeColor.setAttribute('content', isMobileWidth ? '#F8FAF9' : '#020617');
      } else if (isFaculty) {
        metaThemeColor.setAttribute('content', (isMobileWidth || USE_NEW_DESKTOP_LAYOUT) ? '#F8FAF9' : '#020617');
      } else {
        metaThemeColor.setAttribute('content', '#F8FAF9');
      }
    }
  }, [isAdmin, isFaculty]);

  return (
    <div className={`min-h-screen flex flex-col font-sans ${isDarkPortal ? 'bg-[#F8FAF9] md:bg-slate-950 text-[#111827] md:text-slate-100' : 'bg-[#F8FAF9] text-[#111827]'}`}>
      {/* Top Navbar for Legacy Desktop Faculty/Admin */}
      {isDarkPortal && (
        <div className="hidden md:block">
          <Navbar
            currentUser={currentUser}
            onLogout={handleLogout}
            backendOnline={backendOnline}
          />
        </div>
      )}

      {/* Network Offline Status Banner */}
      <OfflineBanner />

      {/* iOS Safari Add to Home Screen Instructions */}
      <IosInstallBanner />

      {/* Main Portal View */}
      <main className="flex-1">
        {!currentUser ? (
          <LoginView onLoginSuccess={handleLoginSuccess} />
        ) : currentUser.role === 'student' ? (
          <StudentPortal
            user={currentUser}
            onLogout={handleLogout}
          />
        ) : currentUser.role === 'faculty' ? (
          <FacultyPortal user={currentUser} onLogout={handleLogout} />
        ) : currentUser.role === 'admin' ? (
          <AdminPortal user={currentUser} onLogout={handleLogout} />
        ) : (
          <LoginView onLoginSuccess={handleLoginSuccess} />
        )}
      </main>

      {/* Persistent Global Footer (for Desktop Admin & Desktop Faculty) */}
      {isDarkPortal && (
        <footer className="hidden md:block py-4 border-t border-slate-900 text-center text-xs text-slate-500">
          SmartAttend-AI &copy; 2026 &bull; Production Anti-Proxy, Dynamic QR, Biometric & ML Defaulter Radar
        </footer>
      )}
    </div>
  );
}
