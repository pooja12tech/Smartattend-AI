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
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    localStorage.removeItem('smartattend_current_user');
  };

  // Quick switch role (Helper for live evaluations and demos)
  const handleQuickSwitchRole = async (targetRole) => {
    const creds = {
      student: { roll_no: 'student', password: 'studentpassword' },
      faculty: { roll_no: 'faculty', password: 'facultypassword' },
      admin: { roll_no: 'admin', password: 'adminpassword' }
    };
    const c = creds[targetRole];
    if (c) {
      try {
        const res = await api.login({
          roll_no: c.roll_no,
          password: c.password,
          device_id: getDeviceId()
        });
        if (res.success && res.user) {
          handleLoginSuccess(res.user);
          return;
        }
      } catch (err) {
        console.warn('Quick switch login via API failed, using fallback:', err);
      }
    }

    if (targetRole === 'student') {
      const demoUser = {
        role: 'student',
        roll_no: 'STU01',
        name: 'Aarav Sharma',
        email: 'aarav@smartattend.edu',
        department: 'CSE',
        semester: 6
      };
      setCurrentUser(demoUser);
      localStorage.setItem('smartattend_current_user', JSON.stringify(demoUser));
    } else if (targetRole === 'faculty') {
      const demoUser = {
        role: 'faculty',
        faculty_id: 'FAC01',
        name: 'Prof. Alan Turing',
        email: 'faculty@smartattend.edu',
        department: 'CSE'
      };
      setCurrentUser(demoUser);
      localStorage.setItem('smartattend_current_user', JSON.stringify(demoUser));
    } else if (targetRole === 'admin') {
      const demoUser = {
        role: 'admin',
        admin_id: 'ADM01',
        name: 'System Administrator',
        email: 'admin@smartattend.edu',
        department: 'Administration'
      };
      setCurrentUser(demoUser);
      localStorage.setItem('smartattend_current_user', JSON.stringify(demoUser));
    }
  };

  const isStudent = currentUser?.role === 'student';
  const isFaculty = currentUser?.role === 'faculty';
  const isAdmin = currentUser?.role === 'admin';
  const isDarkPortal = isAdmin || isFaculty;

  // Dynamically sync Android status bar theme-color
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const isMobileWidth = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isAdmin) {
        metaThemeColor.setAttribute('content', '#020617');
      } else if (isFaculty) {
        metaThemeColor.setAttribute('content', isMobileWidth ? '#F8FAF9' : '#020617');
      } else {
        metaThemeColor.setAttribute('content', '#F8FAF9');
      }
    }
  }, [isAdmin, isFaculty]);

  return (
    <div className={`min-h-screen flex flex-col font-sans ${isAdmin ? 'bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white' : isFaculty ? 'bg-[#F8FAF9] md:bg-slate-950 text-[#111827] md:text-slate-100' : 'bg-[#F8FAF9] text-[#111827]'}`}>
      {/* Top Navbar for Admin & Desktop Faculty */}
      {isDarkPortal && (
        <div className={isFaculty ? "hidden md:block" : ""}>
          <Navbar
            currentUser={currentUser}
            onLogout={handleLogout}
            onQuickSwitchRole={handleQuickSwitchRole}
            backendOnline={backendOnline}
          />
        </div>
      )}

      {/* Network Offline Status Banner */}
      <OfflineBanner />

      {/* PWA Update Notification Toast */}
      <PwaUpdateToast />

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
            onQuickSwitchRole={handleQuickSwitchRole}
          />
        ) : currentUser.role === 'faculty' ? (
          <FacultyPortal user={currentUser} onLogout={handleLogout} />
        ) : currentUser.role === 'admin' ? (
          <AdminPortal user={currentUser} />
        ) : (
          <LoginView onLoginSuccess={handleLoginSuccess} />
        )}
      </main>

      {/* Persistent Global Footer (for Admin & Desktop Faculty) */}
      {isDarkPortal && (
        <footer className={`py-4 border-t border-slate-900 text-center text-xs text-slate-500 ${isFaculty ? 'hidden md:block' : ''}`}>
          SmartAttend-AI &copy; 2026 &bull; Production Anti-Proxy, Dynamic QR, Biometric & ML Defaulter Radar
        </footer>
      )}
    </div>
  );
}
