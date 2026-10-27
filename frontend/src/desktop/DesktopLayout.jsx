import React, { useState, useEffect, useCallback } from 'react';
import DesktopSidebar from './DesktopSidebar';
import DesktopTopBar from './DesktopTopBar';
import DesktopFacultyClasses from './faculty/DesktopFacultyClasses';
import DesktopFacultyStudents from './faculty/DesktopFacultyStudents';
import DesktopFacultyReports from './faculty/DesktopFacultyReports';
import DesktopFacultyProfile from './faculty/DesktopFacultyProfile';

import { navigateToPath, replacePath, parsePath } from '../router';

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
  // Clean Path Synchronization for bookmarkable desktop URLs (e.g. /faculty/home, /faculty/classes)
  const getInitialTab = () => {
    const { role, tab } = parsePath();
    if (role === 'faculty' && tab) {
      const cleanTab = tab.toLowerCase();
      if (['home', 'classes', 'students', 'reports', 'profile'].includes(cleanTab)) {
        return cleanTab;
      }
      if (cleanTab === 'timetable') return 'classes';
      if (cleanTab === 'roster') return 'students';
      if (['live', 'setup'].includes(cleanTab)) return 'home';
    }
    return 'home';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync path state with activeTab
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    navigateToPath(`/faculty/${tabId}`);
  }, []);

  // Listen for browser forward/backward navigation
  useEffect(() => {
    const handlePopState = () => {
      const newTab = getInitialTab();
      setActiveTab(newTab);
    };

    window.addEventListener('popstate', handlePopState);
    const { role, tab } = parsePath();
    if (role !== 'faculty' || !tab) {
      replacePath(`/faculty/${getInitialTab()}`);
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="min-h-dvh bg-[#F8FAF9] text-[#111827] flex font-sans selection:bg-[#1A4731] selection:text-white antialiased">
      {/* 1. Left Sidebar Navigation */}
      <DesktopSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        user={user}
        onLogout={onLogout}
      />

      {/* 2. Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
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
        <main className="flex-1 w-full">
          <div className="max-w-[1600px] mx-auto p-6 lg:p-8 space-y-6">
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
          </div>
        </main>
      </div>
    </div>
  );
}
