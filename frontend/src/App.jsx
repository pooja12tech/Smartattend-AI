import React, { useState, useEffect } from 'react';
import LoginView from './components/LoginView';
import StudentPortal from './components/StudentPortal';
import FacultyPortal from './components/FacultyPortal';
import AdminPortal from './components/AdminPortal';
import OfflineBanner from './components/OfflineBanner';
import PwaUpdateToast from './components/PwaUpdateToast';
import IosInstallBanner from './components/IosInstallBanner';
import { ToastContainer } from './components/ui/Toast';
import { api, getDeviceId } from './api';

import { getCleanPath, replacePath, parsePath } from './router';
import { useMediaQuery } from './hooks/useMediaQuery';

export default function App() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
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

    // Preserve bookmarkable clean path if it matches user's role, otherwise route to role default
    const { role: pathRole } = parsePath();
    const userRole = user?.role;
    if (pathRole !== userRole) {
      if (userRole === 'admin') replacePath('/admin/overview');
      else if (userRole === 'faculty') replacePath('/faculty/home');
      else if (userRole === 'student') replacePath('/student/home');
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    localStorage.removeItem('smartattend_current_user');
    replacePath('/login');
  };

  // Synchronize clean URL path with user session on mount
  useEffect(() => {
    const { fullPath, role: pathRole } = parsePath();
    if (!currentUser) {
      if (!fullPath || fullPath === '/' || fullPath.startsWith('/student') || fullPath.startsWith('/faculty') || fullPath.startsWith('/admin')) {
        replacePath('/login');
      }
    } else {
      const userRole = currentUser.role;
      if (!fullPath || fullPath === '/' || fullPath === '/login' || pathRole !== userRole) {
        if (userRole === 'admin') replacePath('/admin/overview');
        else if (userRole === 'faculty') replacePath('/faculty/home');
        else if (userRole === 'student') replacePath('/student/home');
      }
    }
  }, [currentUser]);

  // Dynamically sync Android status bar theme-color
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', '#F8FAF9');
    }
  }, [isDesktop]);

  return (
    <div className="min-h-dvh flex flex-col font-sans bg-[#F8FAF9] text-[#111827]">
      {/* In-app Toast Notifications */}
      <ToastContainer />

      {/* Network Offline Status Banner */}
      <OfflineBanner />

      {/* iOS Safari Add to Home Screen Instructions */}
      <IosInstallBanner />

      {/* PWA Update Ready Toast */}
      <PwaUpdateToast />

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
    </div>
  );
}
