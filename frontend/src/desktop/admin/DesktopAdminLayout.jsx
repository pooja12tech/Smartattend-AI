import React, { useState, useEffect, useCallback } from 'react';
import DesktopAdminSidebar from './DesktopAdminSidebar';
import DesktopAdminTopBar from './DesktopAdminTopBar';
import DesktopAdminOverview from './DesktopAdminOverview';
import DesktopAdminSessions from './DesktopAdminSessions';
import DesktopAdminStudents from './DesktopAdminStudents';
import DesktopAdminFaculty from './DesktopAdminFaculty';
import DesktopAdminSubjects from './DesktopAdminSubjects';
import DesktopAdminAudit from './DesktopAdminAudit';
import AdminTimetableManagement from '../../components/AdminTimetableManagement';
import { navigateToPath, replacePath, parsePath } from '../../router';

export default function DesktopAdminLayout({
  user,
  todayFormattedDate,
  backendOnline,
  overview,
  usersList,
  subjectsList,
  auditLogs,
  pendingReviews,
  loading,
  onResetDevice,
  onResetFace,
  onOpenFaceCapture,
  onDeleteUser,
  onOpenAddStudent,
  onOpenAddFaculty,
  onOpenAddSubject,
  onApproveReview,
  onRejectReview,
  onRefreshAll,
  onLogout
}) {
  const getInitialTab = () => {
    const { role, tab } = parsePath();
    if (role === 'admin' && tab) {
      const cleanTab = tab.toLowerCase();
      if (['overview', 'sessions', 'students', 'faculty', 'subjects', 'timetable', 'audit'].includes(cleanTab)) {
        return cleanTab;
      }
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    navigateToPath(`/admin/${tabId}`);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const newTab = getInitialTab();
      setActiveTab(newTab);
    };

    window.addEventListener('popstate', handlePopState);
    const { role, tab } = parsePath();
    if (role !== 'admin' || !tab) {
      replacePath(`/admin/${getInitialTab()}`);
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const activeSessionsCount = (overview?.sessions || []).filter(s => s.status === 'ACTIVE').length;

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-[#111827] flex font-sans selection:bg-[#1A4731] selection:text-white antialiased">
      {/* 1. Left Sidebar */}
      <DesktopAdminSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeSessionsCount={activeSessionsCount}
        pendingReviewsCount={pendingReviews?.length || 0}
      />

      {/* 2. Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top App Bar */}
        <DesktopAdminTopBar
          user={user}
          todayFormattedDate={todayFormattedDate}
          backendOnline={backendOnline}
          onOpenAddStudent={onOpenAddStudent}
          onOpenAddFaculty={onOpenAddFaculty}
          onRefreshAll={onRefreshAll}
          onLogout={onLogout}
        />

        {/* Content Views */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && (
            <DesktopAdminOverview
              overview={overview}
              usersList={usersList}
              pendingReviews={pendingReviews}
              onApproveReview={onApproveReview}
              onRejectReview={onRejectReview}
              onSelectTab={handleTabChange}
            />
          )}

          {activeTab === 'sessions' && (
            <DesktopAdminSessions
              overview={overview}
              onRefresh={onRefreshAll}
            />
          )}

          {activeTab === 'students' && (
            <DesktopAdminStudents
              usersList={usersList}
              loading={loading}
              onResetDevice={onResetDevice}
              onResetFace={onResetFace}
              onOpenFaceCapture={onOpenFaceCapture}
              onDeleteStudent={onDeleteUser}
              onOpenAddStudent={onOpenAddStudent}
              onRefresh={onRefreshAll}
            />
          )}

          {activeTab === 'faculty' && (
            <DesktopAdminFaculty
              usersList={usersList}
              loading={loading}
              onOpenAddFaculty={onOpenAddFaculty}
              onDeleteFaculty={onDeleteUser}
              onRefresh={onRefreshAll}
            />
          )}

          {activeTab === 'subjects' && (
            <DesktopAdminSubjects
              subjectsList={subjectsList}
              loading={loading}
              onOpenAddSubject={onOpenAddSubject}
              onRefresh={onRefreshAll}
            />
          )}

          {activeTab === 'timetable' && (
            <div className="p-6">
              <AdminTimetableManagement
                user={user}
                facultyList={(usersList || []).filter(u => u.role === 'faculty')}
                subjectsList={subjectsList || []}
                allDepartments={Array.from(new Set((usersList || []).map(u => u.department || 'Computer Science & Engineering')))}
                onTimetableUpdated={onRefreshAll}
              />
            </div>
          )}

          {activeTab === 'audit' && (
            <DesktopAdminAudit
              auditLogs={auditLogs}
              loading={loading}
              onRefresh={onRefreshAll}
            />
          )}
        </main>
      </div>
    </div>
  );
}
