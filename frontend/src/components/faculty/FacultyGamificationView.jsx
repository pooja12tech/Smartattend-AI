import React, { useState, useEffect } from 'react';
import {
  Trophy, Flame, Award, Zap, Coins, Sparkles, Users, Target,
  Plus, CheckCircle2, AlertCircle, RefreshCw, ChevronRight, X
} from 'lucide-react';
import { api } from '../../api';

export default function FacultyGamificationView({ user }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  // Form State for Creating Challenge
  const [challengeForm, setChallengeForm] = useState({
    title: '',
    description: '',
    difficulty: 'MEDIUM',
    target_section: 'ALL',
    target_subject_code: '',
    goal_type: 'ATTEND_CLASSES',
    goal_target: 3,
    xp_reward: 50,
    coin_reward: 5,
    duration_days: 7
  });

  const showNotification = (msg, type = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 4000);
  };

  const loadAnalytics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.getFacultyGamificationAnalytics();
      if (res.success && res.analytics) {
        setAnalytics(res.analytics);
      }
    } catch (err) {
      console.error('Failed to load faculty gamification analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    if (!challengeForm.title.trim()) {
      showNotification('Please enter a challenge title', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: challengeForm.title.trim(),
        description: challengeForm.description.trim(),
        difficulty: challengeForm.difficulty,
        target_section: challengeForm.target_section === 'ALL' ? null : challengeForm.target_section,
        target_subject_code: challengeForm.target_subject_code.trim() || null,
        goal_type: challengeForm.goal_type,
        goal_target: Number(challengeForm.goal_target) || 3,
        xp_reward: Number(challengeForm.xp_reward) || 50,
        coin_reward: Number(challengeForm.coin_reward) || 5,
        duration_days: Number(challengeForm.duration_days) || 7
      };

      const res = await api.createFacultyGamificationChallenge(payload);
      if (res.success) {
        showNotification(`Challenge "${payload.title}" published successfully!`);
        setShowCreateModal(false);
        setChallengeForm({
          title: '',
          description: '',
          difficulty: 'MEDIUM',
          target_section: 'ALL',
          target_subject_code: '',
          goal_type: 'ATTEND_CLASSES',
          goal_target: 3,
          xp_reward: 50,
          coin_reward: 5,
          duration_days: 7
        });
        await loadAnalytics(true);
      } else {
        showNotification(res.error || 'Failed to create challenge', 'error');
      }
    } catch (err) {
      showNotification(err.message || 'Unable to publish challenge', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !analytics) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[500px] text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm font-semibold text-slate-700">Loading Gamification Insights...</p>
      </div>
    );
  }

  const activeStudents = analytics?.active_students_count || 0;
  const totalXp = analytics?.total_xp_awarded || 0;
  const avgLevel = analytics?.avg_student_level || 1;
  const badgesCount = analytics?.badges_unlocked_count || 0;
  const missionsCount = analytics?.missions_completed_count || 0;
  const topStudents = analytics?.top_engaged_students || [];
  const activeChallenges = analytics?.active_challenges || [];

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-7xl mx-auto">
      {/* Toast Notification Alert */}
      {notice && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 animate-slideUp text-sm font-medium ${
            notice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {notice.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          )}
          <span>{notice.msg}</span>
        </div>
      )}

      {/* Faculty Hero Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-[#113022] via-[#1A4731] to-[#0A2016] text-white p-6 sm:p-8 shadow-xl border border-emerald-800/40 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Engagement Engine
              </span>
              <span className="text-xs text-emerald-300 font-mono">Faculty Console</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Student Motivation & Gamification Hub
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
              Track student engagement, launch custom lecture attendance challenges, and reward academic consistency across your cohorts.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => loadAnalytics(true)}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>New Academic Challenge</span>
            </button>
          </div>
        </div>

        {/* 5 KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-emerald-800/60">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-emerald-300 text-[11px] font-bold">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active Students</span>
            </div>
            <p className="text-xl font-black text-white mt-1">{activeStudents}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-amber-300 text-[11px] font-bold">
              <Zap className="w-3.5 h-3.5 fill-amber-300" />
              <span>Total XP Awarded</span>
            </div>
            <p className="text-xl font-black text-white mt-1">{totalXp.toLocaleString()}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-cyan-300 text-[11px] font-bold">
              <Trophy className="w-3.5 h-3.5 text-cyan-400" />
              <span>Average Level</span>
            </div>
            <p className="text-xl font-black text-white mt-1">Lv {avgLevel}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-indigo-300 text-[11px] font-bold">
              <Award className="w-3.5 h-3.5 text-indigo-400" />
              <span>Badges Earned</span>
            </div>
            <p className="text-xl font-black text-white mt-1">{badgesCount}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs col-span-2 sm:col-span-1">
            <div className="flex items-center gap-1.5 text-rose-300 text-[11px] font-bold">
              <Target className="w-3.5 h-3.5 text-rose-400" />
              <span>Missions Done</span>
            </div>
            <p className="text-xl font-black text-white mt-1">{missionsCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Top Engaged Students Roster */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Top Engaged Students
                </h2>
                <p className="text-xs text-slate-500">Students excelling in lecture attendance, streaks, and gamification</p>
              </div>
              <span className="text-xs font-bold text-slate-400">{topStudents.length} Students Listed</span>
            </div>

            <div className="divide-y divide-slate-100 overflow-x-auto">
              <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-400 pb-2 uppercase tracking-wider min-w-[500px]">
                <div className="col-span-1">Rank</div>
                <div className="col-span-5">Student</div>
                <div className="col-span-2 text-center">Level</div>
                <div className="col-span-2 text-center">Streak</div>
                <div className="col-span-2 text-right">Total XP</div>
              </div>

              {topStudents.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No gamification activity recorded yet. Verified lecture attendances will populate this leaderboard!
                </div>
              ) : (
                topStudents.map((stu) => (
                  <div
                    key={stu.roll_no}
                    className="grid grid-cols-12 gap-2 py-3 items-center text-xs hover:bg-slate-50/70 transition-colors min-w-[500px]"
                  >
                    <div className="col-span-1 font-black text-slate-400">
                      {stu.rank === 1 ? '🥇' : stu.rank === 2 ? '🥈' : stu.rank === 3 ? '🥉' : `#${stu.rank}`}
                    </div>
                    <div className="col-span-5 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-xs shrink-0">
                        {stu.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{stu.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {stu.roll_no} &bull; Sec {stu.section || 'A'}
                        </p>
                      </div>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                        Lv {stu.current_level}
                      </span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="font-bold text-rose-600 flex items-center justify-center gap-1">
                        <Flame className="w-3 h-3 fill-rose-500" />
                        {stu.current_streak}
                      </span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="font-black text-emerald-600">{stu.total_xp} XP</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Active Faculty Academic Challenges */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" />
                Active Challenges
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                + Create
              </button>
            </div>

            {activeChallenges.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 text-center text-slate-500 text-xs space-y-2">
                <p>No active faculty challenges published yet.</p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer hover:bg-slate-800"
                >
                  Create First Challenge
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeChallenges.map((ch) => (
                  <div key={ch.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {ch.target_section ? `Section ${ch.target_section}` : 'All Sections'}
                        </span>
                        <h3 className="text-xs font-bold text-slate-900 mt-1">{ch.title}</h3>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                        +{ch.xp_reward} XP
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{ch.description}</p>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 pt-1">
                      <span>Goal: {ch.goal_target} lectures</span>
                      <span>Target: {ch.target_subject_code || 'All Classes'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Challenge Creator Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Publish Academic Challenge</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChallenge} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Challenge Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Web Tech Perfect Consistency Sprint"
                  value={challengeForm.title}
                  onChange={(e) => setChallengeForm({ ...challengeForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Describe the milestone students must achieve..."
                  value={challengeForm.description}
                  onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Section</label>
                  <select
                    value={challengeForm.target_section}
                    onChange={(e) => setChallengeForm({ ...challengeForm, target_section: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ALL">All Cohorts</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lectures Needed</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={challengeForm.goal_target}
                    onChange={(e) => setChallengeForm({ ...challengeForm, goal_target: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">XP Reward</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={challengeForm.xp_reward}
                    onChange={(e) => setChallengeForm({ ...challengeForm, xp_reward: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Coins Reward</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={challengeForm.coin_reward}
                    onChange={(e) => setChallengeForm({ ...challengeForm, coin_reward: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={challengeForm.duration_days}
                    onChange={(e) => setChallengeForm({ ...challengeForm, duration_days: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Publish Challenge</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

