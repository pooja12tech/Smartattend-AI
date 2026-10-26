import React, { useState, useEffect, useCallback } from 'react';
import DesktopSidebar from './DesktopSidebar';
import DesktopTopBar from './DesktopTopBar';
import DesktopFacultyClasses from './faculty/DesktopFacultyClasses';
import DesktopFacultyStudents from './faculty/DesktopFacultyStudents';
import DesktopFacultyReports from './faculty/DesktopFacultyReports';
import DesktopFacultyProfile from './faculty/DesktopFacultyProfile';

export default function DesktopLayout({
  user,
  todayFormattedDate,
  isSessionActive,
  alertsCount = 0,
  onStartSessionClick,
  onOpenProjector,
  onLogout,
  onStartSession,
  children
}) {
  // Hash URL Synchronization for bookmarkable desktop URLs (e.g. #/faculty/home, #/faculty/classes)
  const getInitialTab = () => {
    if (typeof window === 'undefined') return 'home';
    const hash = window.location.hash || '';
    const match = hash.match(/^#\/faculty(?:\/([a-zA-Z0-9_-]+))?(?:\?.*)?$/);
    if (match && match[1]) {
      const tab = match[1].toLowerCase();
      if (['home', 'classes', 'students', 'reports', 'profile'].includes(tab)) {
        return tab;
      }
    }
    return 'home';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync hash state with activeTab
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined') {
      window.location.hash = `#/faculty/${tabId}`;
    }
  }, []);

  // Listen for browser forward/backward hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const newTab = getInitialTab();
      setActiveTab(newTab);
    };

    window.addEventListener('hashchange', handleHashChange);
    // Initialize initial hash if empty or pointing outside faculty
    const hash = window.location.hash || '';
    if (!hash.startsWith('#/faculty/')) {
      const tab = getInitialTab();
      window.location.hash = `#/faculty/${tab}`;
    }

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-[#111827] flex font-sans selection:bg-[#1A4731] selection:text-white antialiased">
      {/* 1. Left Sidebar Navigation */}
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* 2. Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top App Bar */}
        <DesktopTopBar
          user={user}
          todayFormattedDate={todayFormattedDate}
          isSessionActive={isSessionActive}
          alertsCount={alertsCount}
          onStartSessionClick={onStartSessionClick}
          onOpenProjector={onOpenProjector}
          onLogout={onLogout}
          onOpenProfile={() => handleTabChange('profile')}
        />

        {/* Content Outlet: Route to Real Desktop Modules */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'home' && children}

          {activeTab === 'classes' && (
            <DesktopFacultyClasses
              user={user}
              onStartSession={(slot) => {
                handleTabChange('home');
                if (onStartSession) onStartSession(slot);
              }}
              onGoHome={() => handleTabChange('home')}
            />
          )}

          {activeTab === 'students' && (
            <DesktopFacultyStudents
              user={user}
              onGoHome={() => handleTabChange('home')}
            />
          )}

          {activeTab === 'reports' && (
            <DesktopFacultyReports
              user={user}
              onGoHome={() => handleTabChange('home')}
            />
          )}

          {activeTab === 'profile' && (
            <DesktopFacultyProfile
              user={user}
              onLogout={onLogout}
              onGoHome={() => handleTabChange('home')}
            />
          )}
        </main>
      </div>
    </div>
  );
}
