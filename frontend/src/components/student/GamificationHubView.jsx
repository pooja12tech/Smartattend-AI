import React, { useState, useEffect } from 'react';
import {
  Trophy, Flame, Award, Zap, Coins, Sparkles, Shield, Target,
  CheckCircle2, ChevronRight, Lock, Unlock, ShoppingBag, Users,
  ArrowUpRight, AlertCircle, RefreshCw, Star, Info, Crown, Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../../api';

export default function GamificationHubView({ user, onBack }) {
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'missions' | 'badges' | 'leaderboard' | 'store' | 'championship'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [missionsData, setMissionsData] = useState([]);
  const [badgesData, setBadgesData] = useState({ total_badges: 10, unlocked_count: 0, badges: [] });
  const [rewardsData, setRewardsData] = useState({ attend_coins: 0, rewards: [] });
  const [leaderboardData, setLeaderboardData] = useState({ leaderboard: [], my_rank: null, category: 'xp' });
  const [championshipData, setChampionshipData] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [xpHistory, setXpHistory] = useState([]);

  // Filters & Sub-states
  const [badgeFilter, setBadgeFilter] = useState('ALL'); // 'ALL' | 'UNLOCKED' | 'LOCKED'
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [leaderboardCategory, setLeaderboardCategory] = useState('xp'); // 'xp' | 'streak' | 'section'
  const [storeCategory, setStoreCategory] = useState('ALL'); // 'ALL' | 'AVATAR' | 'FRAME' | 'TITLE' | 'THEME'
  const [actionNotice, setActionNotice] = useState(null);
  const [claimingMissionId, setClaimingMissionId] = useState(null);
  const [redeemingRewardId, setRedeemingRewardId] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setActionNotice({ msg, type });
    setTimeout(() => setActionNotice(null), 4500);
  };

  const loadAllGamificationData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        profRes,
        missRes,
        badgeRes,
        storeRes,
        leadRes,
        champRes,
        recomRes,
        histRes
      ] = await Promise.allSettled([
        api.getGamificationProfile(),
        api.getGamificationMissions(),
        api.getGamificationBadges(),
        api.getGamificationRewards(),
        api.getGamificationLeaderboards({ category: leaderboardCategory }),
        api.getGamificationCompetitions(user?.semester || 6),
        api.getGamificationRecommendations(),
        api.getGamificationXpHistory(15)
      ]);

      if (profRes.status === 'fulfilled' && profRes.value) {
        setProfileData(profRes.value);
      }
      if (missRes.status === 'fulfilled' && missRes.value?.missions) {
        setMissionsData(missRes.value.missions);
      }
      if (badgeRes.status === 'fulfilled' && badgeRes.value) {
        setBadgesData(badgeRes.value);
      }
      if (storeRes.status === 'fulfilled' && storeRes.value) {
        setRewardsData(storeRes.value);
      }
      if (leadRes.status === 'fulfilled' && leadRes.value) {
        setLeaderboardData(leadRes.value);
      }
      if (champRes.status === 'fulfilled' && champRes.value) {
        setChampionshipData(champRes.value);
      }
      if (recomRes.status === 'fulfilled' && recomRes.value?.recommendations) {
        setRecommendations(recomRes.value.recommendations);
      }
      if (histRes.status === 'fulfilled' && histRes.value?.transactions) {
        setXpHistory(histRes.value.transactions);
      }
    } catch (err) {
      console.error('Gamification loading error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllGamificationData();
  }, []);

  // Reload leaderboard when category changes
  const handleLeaderboardCategoryChange = async (cat) => {
    setLeaderboardCategory(cat);
    try {
      const data = await api.getGamificationLeaderboards({ category: cat });
      setLeaderboardData(data);
    } catch (err) {
      console.error('Failed to change leaderboard category:', err);
    }
  };

  // Claim Mission Reward
  const handleClaimMission = async (missionId, title) => {
    setClaimingMissionId(missionId);
    try {
      const res = await api.claimGamificationMission(missionId);
      if (res.success) {
        try {
          confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
        } catch (_) {}
        showNotification(`🎉 Claimed reward for "${title}"! +${res.xp_awarded} XP, +${res.coins_awarded} AttendCoins!`);
        await loadAllGamificationData(true);
      } else {
        showNotification(res.error || 'Failed to claim reward', 'error');
      }
    } catch (err) {
      showNotification(err.message || 'Unable to claim mission', 'error');
    } finally {
      setClaimingMissionId(null);
    }
  };

  // Redeem Store Reward
  const handleRedeemReward = async (reward) => {
    setRedeemingRewardId(reward.id);
    try {
      const res = await api.redeemGamificationReward(reward.id);
      if (res.success) {
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        } catch (_) {}
        showNotification(`🪙 Unlocked "${reward.name}"! Now equipped to your profile.`);
        await loadAllGamificationData(true);
      } else {
        showNotification(res.error || 'Redemption failed', 'error');
      }
    } catch (err) {
      showNotification(err.message || 'Transaction failed', 'error');
    } finally {
      setRedeemingRewardId(null);
    }
  };

  // Equip Cosmetic Item
  const handleEquipItem = async (reward) => {
    try {
      const res = await api.equipGamificationCosmetic(reward.category.toLowerCase(), reward.id);
      if (res.success) {
        showNotification(`✨ Equipped "${reward.name}"!`);
        await loadAllGamificationData(true);
      } else {
        showNotification(res.error || 'Failed to equip item', 'error');
      }
    } catch (err) {
      showNotification(err.message || 'Failed to equip item', 'error');
    }
  };

  if (loading && !profileData) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[500px] text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-sm font-semibold text-slate-700">Loading Gamification Hub...</p>
        <p className="text-xs text-slate-400">Syncing XP, streaks, badges and achievements...</p>
      </div>
    );
  }

  const profile = profileData?.profile || {};
  const levelInfo = profileData?.level_info || {};
  const totalXp = profile.total_xp || 0;
  const currentLevel = levelInfo.current_level || 1;
  const levelName = levelInfo.level_name || 'Beginner';
  const progressPct = levelInfo.progress_pct || 0;
  const xpNeeded = levelInfo.xp_needed || 0;
  const currentStreak = profile.current_streak || 0;
  const longestStreak = profile.longest_streak || 0;
  const attendCoins = profile.attend_coins || 0;
  const unlockedBadgesCount = profileData?.unlocked_badges_count || 0;
  const completedMissionsCount = profileData?.completed_missions_count || 0;
  const attendancePct = profileData?.attendance_pct || 100.0;

  // Filter badges
  const filteredBadges = (badgesData.badges || []).filter((b) => {
    if (badgeFilter === 'UNLOCKED') return b.is_unlocked;
    if (badgeFilter === 'LOCKED') return !b.is_unlocked;
    return true;
  });

  // Filter store items
  const filteredStoreRewards = (rewardsData.rewards || []).filter((r) => {
    if (storeCategory === 'ALL') return true;
    return r.category === storeCategory;
  });

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-7xl mx-auto">
      {/* Toast Notification Alert */}
      {actionNotice && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 animate-slideUp text-sm font-medium ${
            actionNotice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {actionNotice.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
          )}
          <span>{actionNotice.msg}</span>
        </div>
      )}

      {/* Gamification Header & Student Status Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#113022] via-[#1A4731] to-[#0A2016] text-white p-6 sm:p-8 shadow-xl border border-emerald-800/40">
        {/* Decorative background glow accents */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left Avatar & Level Details */}
          <div className="flex items-center gap-5">
            {/* Custom Avatar with Frame */}
            <div className="relative shrink-0">
              <div
                className={`w-20 h-20 rounded-2xl flex items-center justify-center font-black text-2xl shadow-inner border-2 ${
                  profile.active_frame_id === 'frame_gold'
                    ? 'border-amber-400 bg-gradient-to-tr from-amber-600 to-yellow-300 text-amber-950 ring-4 ring-amber-400/30'
                    : profile.active_frame_id === 'frame_cyber'
                    ? 'border-cyan-400 bg-gradient-to-tr from-cyan-600 to-indigo-700 text-cyan-100 ring-4 ring-cyan-400/30'
                    : profile.active_frame_id === 'frame_emerald'
                    ? 'border-emerald-400 bg-gradient-to-tr from-emerald-600 to-teal-400 text-white ring-4 ring-emerald-400/30'
                    : 'border-emerald-500/50 bg-emerald-800/60 text-emerald-200'
                }`}
              >
                {profile.active_avatar_id === 'avatar_scholar'
                  ? '🎓'
                  : profile.active_avatar_id === 'avatar_streak_master'
                  ? '🔥'
                  : profile.active_avatar_id === 'avatar_tech_wizard'
                  ? '⚡'
                  : profile.active_avatar_id === 'avatar_cyber_samurai'
                  ? '⚔️'
                  : (user?.name || 'S')[0]}
              </div>
              <div className="absolute -bottom-2 -right-2 bg-amber-400 text-amber-950 font-black text-[11px] px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border border-amber-300">
                <Crown className="w-3 h-3 fill-amber-950" />
                <span>Lv {currentLevel}</span>
              </div>
            </div>

            {/* Student Info & Level Progress */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white truncate">
                  {user?.name || profileData?.name || 'Student'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {profile.active_title || levelInfo.badge_title || 'Freshman Scholar'}
                </span>
              </div>
              <p className="text-xs font-mono text-emerald-200/80">
                {profileData?.roll_no || user?.roll_no} &bull; Section {user?.section || 'A'} &bull; Sem {user?.semester || 6}
              </p>

              {/* Level Progress Bar */}
              <div className="pt-1.5 w-full max-w-md">
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-200 mb-1">
                  <span>
                    Level {currentLevel}: {levelName}
                  </span>
                  <span>
                    {totalXp} XP {xpNeeded > 0 ? `(${xpNeeded} XP to Lv ${currentLevel + 1})` : '(MAX)'}
                  </span>
                </div>
                <div className="w-full h-3 bg-emerald-950/70 rounded-full overflow-hidden border border-emerald-700/50 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${Math.min(100, Math.max(5, progressPct))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadAllGamificationData(true)}
              disabled={refreshing}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black">
              <Coins className="w-4 h-4 fill-amber-400 text-amber-950" />
              <span>{attendCoins} Coins</span>
            </div>
          </div>
        </div>

        {/* 6 Grid KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-emerald-800/60">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-amber-300 text-[11px] font-bold">
              <Zap className="w-3.5 h-3.5 fill-amber-300" />
              <span>Total XP</span>
            </div>
            <p className="text-xl font-black text-white mt-1">{totalXp}</p>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-amber-300 text-[11px] font-bold">
              <Coins className="w-3.5 h-3.5 fill-amber-300" />
              <span>AttendCoins</span>
            </div>
            <p className="text-xl font-black text-white mt-1">{attendCoins}</p>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-rose-300 text-[11px] font-bold">
              <Flame className="w-3.5 h-3.5 fill-rose-400 text-rose-500" />
              <span>Streak</span>
            </div>
            <p className="text-xl font-black text-white mt-1">
              {currentStreak} <span className="text-[11px] text-slate-300 font-medium">classes</span>
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-cyan-300 text-[11px] font-bold">
              <Trophy className="w-3.5 h-3.5 text-cyan-400" />
              <span>Best Streak</span>
            </div>
            <p className="text-xl font-black text-white mt-1">
              {longestStreak} <span className="text-[11px] text-slate-300 font-medium">classes</span>
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-emerald-300 text-[11px] font-bold">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Badges</span>
            </div>
            <p className="text-xl font-black text-white mt-1">
              {unlockedBadgesCount} <span className="text-[11px] text-slate-300 font-medium">/ 10</span>
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-xs">
            <div className="flex items-center gap-1.5 text-indigo-300 text-[11px] font-bold">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              <span>Missions</span>
            </div>
            <p className="text-xl font-black text-white mt-1">{completedMissionsCount}</p>
          </div>
        </div>
      </div>

      {/* Gamification Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
        {[
          { id: 'overview', label: 'Overview & AI', icon: Sparkles },
          { id: 'missions', label: 'Missions & Quests', icon: Target },
          { id: 'badges', label: 'Badge Showcase', icon: Award },
          { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
          { id: 'store', label: 'Reward Store', icon: ShoppingBag },
          { id: 'championship', label: 'Section Arena', icon: Users }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#1A4731] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* 1. OVERVIEW & AI RECOMMENDATIONS TAB */}
      {/* ==================================================================== */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: AI Smart Recommendations */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">AI Engagement Intelligence</h2>
                    <p className="text-xs text-slate-500">Personalized motivation based on your real attendance trajectory</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                  Adaptive AI
                </span>
              </div>

              {recommendations.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 text-center text-slate-500 text-xs">
                  No active warnings! You are maintaining outstanding consistency. Keep attending lectures to unlock high-tier badges!
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-2xl border transition-all ${
                        rec.type === 'ATTENDANCE_DEFICIT_RECOVERY'
                          ? 'bg-rose-50/60 border-rose-200'
                          : rec.type === 'HIGH_ACHIEVER_MILESTONE'
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-emerald-50/60 border-emerald-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span
                            className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                              rec.type === 'ATTENDANCE_DEFICIT_RECOVERY'
                                ? 'bg-rose-200/60 text-rose-800'
                                : 'bg-emerald-200/60 text-emerald-800'
                            }`}
                          >
                            {rec.type.replace(/_/g, ' ')}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900">{rec.title}</h3>
                          <p className="text-xs text-slate-600 leading-relaxed">{rec.description}</p>
                          <div className="flex items-center gap-3 pt-1 text-[11px] font-bold text-slate-700">
                            <span className="flex items-center gap-1 text-emerald-700">
                              <Zap className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                              +{rec.xp_reward} XP
                            </span>
                            <span className="flex items-center gap-1 text-amber-700">
                              <Coins className="w-3.5 h-3.5 fill-amber-600 text-amber-600" />
                              +{rec.coin_reward} Coins
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveSubTab('missions')}
                          className="px-3 py-1.5 rounded-xl bg-white text-slate-700 hover:text-slate-900 text-xs font-bold border border-slate-200 shadow-2xs hover:shadow-xs transition-all shrink-0 cursor-pointer"
                        >
                          View Mission
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent XP Transactions Ledger */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Zap className="w-4 h-4 fill-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Experience Points Ledger</h2>
                    <p className="text-xs text-slate-500">Persistent, immutable log of your earned rewards</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  {totalXp} XP Total
                </span>
              </div>

              {xpHistory.length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 text-center text-slate-500 text-xs">
                  No XP recorded yet. Attend your next verified class to earn your first 10 XP!
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {xpHistory.map((tx) => (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-3">
                        <p className="font-bold text-slate-800 truncate">{tx.description || tx.source}</p>
                        <p className="text-[11px] text-slate-400">
                          {tx.created_at ? new Date(tx.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recently'}
                        </p>
                      </div>
                      <span className="font-black text-emerald-600 text-sm whitespace-nowrap">
                        +{tx.amount} XP
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Badges & Next Milestones Preview */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" />
                  Badges Showcase
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('badges')}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                >
                  View All ({unlockedBadgesCount}/10) <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {(badgesData.badges || []).slice(0, 4).map((b) => (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBadge(b)}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      b.is_unlocked
                        ? 'bg-emerald-50/60 border-emerald-200 shadow-2xs hover:scale-102'
                        : 'bg-slate-50/60 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="text-2xl mb-1">{b.icon || '🏅'}</div>
                    <p className="font-bold text-xs text-slate-800 truncate">{b.name}</p>
                    <span
                      className={`text-[10px] font-bold block mt-0.5 ${
                        b.is_unlocked ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {b.is_unlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Streak Motivation */}
            <div className="rounded-3xl p-6 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-100 flex items-center gap-1">
                  <Flame className="w-4 h-4 fill-white" /> Streak Engine
                </span>
                <span className="text-xs font-black bg-white/20 px-2 py-0.5 rounded-full">
                  {currentStreak} Classes
                </span>
              </div>
              <h4 className="text-base font-extrabold text-white">
                {currentStreak >= 7
                  ? "You're on Fire! 🔥"
                  : currentStreak >= 3
                  ? 'Consistency Building Up!'
                  : 'Start Your Streak Today'}
              </h4>
              <p className="text-xs text-amber-100 leading-relaxed">
                Attend each scheduled eligible lecture consecutively without unexcused absences to level up streak multipliers!
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('missions')}
                  className="w-full py-2 rounded-xl bg-white text-amber-900 font-extrabold text-xs shadow-xs hover:bg-amber-50 transition-all cursor-pointer"
                >
                  View Streak Missions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. MISSIONS & QUESTS TAB */}
      {/* ==================================================================== */}
      {activeSubTab === 'missions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Missions & Quests</h2>
              <p className="text-xs text-slate-500">
                Complete daily, weekly, and monthly attendance milestones to earn XP and AttendCoins.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              {missionsData.filter((m) => m.is_completed && !m.is_claimed).length} Claimable
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {missionsData.map((m) => {
              const pct = Math.min(100, Math.round((m.current_progress / Math.max(1, m.goal_target)) * 100));
              const canClaim = m.is_completed && !m.is_claimed;
              const isClaiming = claimingMissionId === m.id;

              return (
                <div
                  key={m.id}
                  className={`p-5 rounded-3xl border transition-all bg-white shadow-2xs space-y-3 ${
                    canClaim
                      ? 'border-amber-300 ring-2 ring-amber-400/30'
                      : m.is_claimed
                      ? 'border-slate-200 opacity-75'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                            m.type === 'DAILY'
                              ? 'bg-blue-100 text-blue-800'
                              : m.type === 'WEEKLY'
                              ? 'bg-purple-100 text-purple-800'
                              : m.type === 'MONTHLY'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {m.type}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{m.difficulty}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">{m.title}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">{m.description}</p>
                    </div>

                    {/* Rewards Pill */}
                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <Zap className="w-3 h-3 fill-emerald-600" /> +{m.xp_reward} XP
                      </span>
                      {m.coin_reward > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 ml-1">
                          <Coins className="w-3 h-3 fill-amber-600" /> +{m.coin_reward}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span>Progress</span>
                      <span>
                        {m.current_progress} / {m.goal_target} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          m.is_completed ? 'bg-emerald-500' : 'bg-[#1A4731]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {m.is_claimed
                        ? 'Reward Claimed'
                        : m.is_completed
                        ? 'Goal Met! Claim Ready'
                        : `${m.goal_target - m.current_progress} remaining`}
                    </span>

                    {canClaim ? (
                      <button
                        type="button"
                        onClick={() => handleClaimMission(m.id, m.title)}
                        disabled={isClaiming}
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-black shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        {isClaiming ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3 fill-white" />
                        )}
                        <span>Claim Reward</span>
                      </button>
                    ) : m.is_claimed ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl">
                        <Check className="w-3.5 h-3.5" /> Completed
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-xl">
                        In Progress
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. BADGE SHOWCASE TAB */}
      {/* ==================================================================== */}
      {activeSubTab === 'badges' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Achievement Badges</h2>
              <p className="text-xs text-slate-500">
                Unlock prestigious university accolades by hitting attendance, streak, and improvement milestones.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              {['ALL', 'UNLOCKED', 'LOCKED'].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setBadgeFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    badgeFilter === filter ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredBadges.map((badge) => (
              <div
                key={badge.id}
                onClick={() => setSelectedBadge(badge)}
                className={`p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  badge.is_unlocked
                    ? 'bg-white border-emerald-200/90 shadow-2xs hover:shadow-md hover:scale-101'
                    : 'bg-slate-50/70 border-slate-200 opacity-65 hover:opacity-90'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        badge.rarity === 'LEGENDARY'
                          ? 'bg-amber-100 text-amber-800'
                          : badge.rarity === 'EPIC'
                          ? 'bg-purple-100 text-purple-800'
                          : badge.rarity === 'RARE'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {badge.rarity}
                    </span>
                    {badge.is_unlocked ? (
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs">
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <div className="text-3xl text-center my-3">{badge.icon || '🏅'}</div>
                  <h3 className="text-sm font-bold text-slate-900 text-center">{badge.name}</h3>
                  <p className="text-xs text-slate-500 text-center mt-1 leading-relaxed line-clamp-2">
                    {badge.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                  <span className="text-emerald-700">+{badge.xp_reward} XP</span>
                  <span className="text-amber-700">+{badge.coin_reward} Coins</span>
                </div>
              </div>
            ))}
          </div>

          {/* Badge Detail Modal */}
          {selectedBadge && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 animate-scaleUp text-center">
                <div className="text-5xl my-2">{selectedBadge.icon || '🏅'}</div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {selectedBadge.rarity}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-2">{selectedBadge.name}</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{selectedBadge.description}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Criteria:</span>
                    <span className="font-bold text-slate-800">{selectedBadge.criteria_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Threshold:</span>
                    <span className="font-bold text-slate-800">{selectedBadge.criteria_threshold}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Rewards:</span>
                    <span className="font-bold text-emerald-700">
                      +{selectedBadge.xp_reward} XP, +{selectedBadge.coin_reward} Coins
                    </span>
                  </div>
                  {selectedBadge.is_unlocked && selectedBadge.unlocked_at && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Unlocked on:</span>
                      <span className="font-bold text-slate-800">
                        {new Date(selectedBadge.unlocked_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedBadge(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. LEADERBOARDS TAB */}
      {/* ==================================================================== */}
      {activeSubTab === 'leaderboard' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">University Leaderboard</h2>
              <p className="text-xs text-slate-500">
                Celebrate top performers across the campus. Privacy safe — personal rank is always visible.
              </p>
            </div>

            {/* Category Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'xp', label: 'XP Champions' },
                { id: 'streak', label: 'Streak Masters' },
                { id: 'section', label: 'My Section' }
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleLeaderboardCategoryChange(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    leaderboardCategory === c.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pinned "My Rank" Card */}
          {leaderboardData.my_rank && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-sm">
                  #{leaderboardData.my_rank.rank}
                </div>
                <div>
                  <span className="text-[11px] font-bold text-emerald-100 block">Your Current Standing</span>
                  <span className="font-extrabold text-sm text-white">
                    {leaderboardData.my_rank.name} ({leaderboardData.my_rank.roll_no})
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-white">
                  {leaderboardCategory === 'streak'
                    ? `${leaderboardData.my_rank.current_streak} Classes`
                    : `${leaderboardData.my_rank.total_xp} XP`}
                </span>
                <span className="text-[11px] text-emerald-100 block">
                  Level {leaderboardData.my_rank.current_level}
                </span>
              </div>
            </div>
          )}

          {/* Main Roster Leaderboard Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-100">
              {(leaderboardData.leaderboard || []).map((entry) => {
                const isMe = entry.is_current_student;
                return (
                  <div
                    key={entry.rank}
                    className={`p-4 flex items-center justify-between transition-colors ${
                      isMe ? 'bg-emerald-50/70 font-bold' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                          entry.rank === 1
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : entry.rank === 2
                            ? 'bg-slate-200 text-slate-700'
                            : entry.rank === 3
                            ? 'bg-amber-700/20 text-amber-900'
                            : 'text-slate-400'
                        }`}
                      >
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 truncate">{entry.name}</span>
                          {isMe && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-600 text-white">
                              YOU
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {entry.title || `Level ${entry.current_level}`} &bull; Section {entry.section || 'A'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-slate-900 block">
                        {leaderboardCategory === 'streak'
                          ? `${entry.current_streak} Classes`
                          : `${entry.total_xp} XP`}
                      </span>
                      <span className="text-[11px] text-emerald-600 font-bold">
                        {entry.unlocked_badges_count} Badges
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. REWARD STORE & CUSTOMIZATION TAB */}
      {/* ==================================================================== */}
      {activeSubTab === 'store' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">AttendCoins Virtual Store</h2>
              <p className="text-xs text-slate-500">
                Redeem your earned AttendCoins for exclusive profile avatars, borders, and student badges.
              </p>
            </div>

            {/* Current Balance */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 font-extrabold text-sm self-start">
              <Coins className="w-5 h-5 fill-amber-500 text-amber-700" />
              <span>{attendCoins} AttendCoins Available</span>
            </div>
          </div>

          {/* Store Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {['ALL', 'AVATAR', 'FRAME', 'TITLE', 'THEME'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setStoreCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  storeCategory === cat ? 'bg-slate-900 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredStoreRewards.map((reward) => {
              const isRedeeming = redeemingRewardId === reward.id;
              const canAfford = attendCoins >= reward.price_coins;

              return (
                <div
                  key={reward.id}
                  className={`p-5 rounded-3xl border transition-all bg-white shadow-2xs flex flex-col justify-between ${
                    reward.is_equipped
                      ? 'border-emerald-400 ring-2 ring-emerald-400/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {reward.category}
                      </span>
                      {reward.is_equipped ? (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          EQUIPPED
                        </span>
                      ) : reward.is_purchased ? (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                          OWNED
                        </span>
                      ) : null}
                    </div>

                    <div className="text-4xl text-center my-3">{reward.icon_preview || '✨'}</div>
                    <h3 className="text-sm font-bold text-slate-900 text-center">{reward.name}</h3>
                    <p className="text-xs text-slate-500 text-center mt-1 leading-relaxed">
                      {reward.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100">
                    {reward.is_equipped ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200"
                      >
                        Active on Profile
                      </button>
                    ) : reward.is_purchased ? (
                      <button
                        type="button"
                        onClick={() => handleEquipItem(reward)}
                        className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                      >
                        Equip Cosmetic
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRedeemReward(reward)}
                        disabled={!canAfford || isRedeeming}
                        className={`w-full py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          canAfford
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isRedeeming ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Coins className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>{reward.price_coins} AttendCoins</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. SECTION CHAMPIONSHIP ARENA TAB */}
      {/* ==================================================================== */}
      {activeSubTab === 'championship' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-700/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                  <Crown className="w-4 h-4 text-amber-300 fill-amber-300" /> Campus Arena
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Semester {championshipData?.semester || 6} Section Championship
                </h2>
                <p className="text-xs text-indigo-200 leading-relaxed max-w-xl">
                  {championshipData?.scoring_formula ||
                    'Fair normalized ranking based on 60% attendance rate and 40% student engagement XP.'}
                </p>
              </div>

              {championshipData?.standings?.[0] && (
                <div className="p-4 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-xs text-center shrink-0">
                  <span className="text-[10px] font-bold text-amber-300 uppercase block">Leading Cohort</span>
                  <p className="text-lg font-black text-white">Section {championshipData.standings[0].section}</p>
                  <span className="text-xs text-indigo-200">
                    {championshipData.standings[0].score} Pts
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Standings List */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(championshipData?.standings || []).map((sec, idx) => (
              <div
                key={sec.section}
                className={`p-6 rounded-3xl border transition-all bg-white shadow-2xs space-y-4 ${
                  idx === 0
                    ? 'border-amber-400 ring-2 ring-amber-400/20'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-900'
                          : idx === 1
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {idx === 0 ? '🏆' : `#${idx + 1}`}
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Section {sec.section}</h3>
                      <p className="text-xs text-slate-400">{sec.student_count} Enrolled</p>
                    </div>
                  </div>
                  <span className="text-base font-black text-indigo-600">{sec.score} pts</span>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Avg Attendance:</span>
                    <span className="font-bold text-slate-800">{sec.avg_attendance_pct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Average XP:</span>
                    <span className="font-bold text-emerald-700">{sec.avg_xp} XP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Participation:</span>
                    <span className="font-bold text-purple-700">{sec.active_students} Students</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

