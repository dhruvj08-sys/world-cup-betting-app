import React, { useState, useEffect } from 'react';
import { User, Auth } from 'firebase/auth';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { LogOut, Home, Calendar, Trophy, Zap, Database, Settings, Flame, DollarSign, Check, Clock, Target, X, ChevronRight, Users } from 'lucide-react';
import MatchCard from './MatchCard';
import PoolStandings from './PoolStandings';
import RecentResults from './RecentResults';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Match, Pick, DbUser, LeaderboardEntry, Room, AuditLog } from '../types';
import { useMatchPolling } from '../hooks/useMatchPolling';
import { AdminControls } from './AdminControls';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardProps {
  user: User;
  auth: Auth;
}

interface PendingBet {
  matchId: number;
  match: string;
  date: string;
  bets: Array<{ name: string; pick: string }>;
}

interface PoolStandingsData {
  standings: Array<{ name: string; balance: number; betsPlaced: number; betsWon: number; trend: string }>;
  recentResults: Array<{ match: string; date: string; winners: string[]; losers: string[] }>;
  pendingBets: PendingBet[];
  gamesCompleted: number;
  lastUpdated: string;
  claimedUsers: Record<string, { displayName: string | null; avatarUrl: string | null }>;
}

export default function Dashboard({ user, auth }: DashboardProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);

  const ADMIN_EMAILS = ['dhruvjainhk@gmail.com'];
  const isAdminUser = dbUser?.isGlobalAdmin || (user?.email && ADMIN_EMAILS.includes(user.email));

  const { matches, setMatches, lockingMatches, triggerSync: fetchMatches, goalEvent } = useMatchPolling(user);
  const [picks, setPicks] = useState<Pick[]>([]);

  useEffect(() => {
    if (goalEvent) {
      showToast(
        `GOAL! ${goalEvent.teamA} ${goalEvent.newScoreA} - ${goalEvent.newScoreB} ${goalEvent.teamB}`,
        'success'
      );
    }
  }, [goalEvent]);

  useEffect(() => {
    if (lockingMatches.length > 0) {
      showToast(`${lockingMatches.length} match(es) locking in less than 10 minutes! Finalize your picks.`, 'error');
    }
  }, [lockingMatches]);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [pinnedMatches, setPinnedMatches] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('pinnedMatches') || '[]'); } catch { return []; }
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [financeData, setFinanceData] = useState<Array<{ userId: number; displayName: string | null; avatarUrl: string | null; poolName: string | null; hasPaid: boolean; amountPaid: number; joinedAt: string }>>([]);
  const [financeSummary, setFinanceSummary] = useState<{ totalMembers: number; paidCount: number; unpaidCount: number; potTotal: number; defaultBuyIn: number } | null>(null);
  const [poolStandings, setPoolStandings] = useState<PoolStandingsData | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimingName, setClaimingName] = useState<string | null>(null);

  const POOL_MEMBERS = ['Kanav', 'Gaurav', 'Divij', 'Jainam', 'Rohan', 'Darsh', 'Moksh', 'Mir', 'Heet', 'DJ'];

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSession = async () => {
    try {
      setError(null);
      const token = await user.getIdToken();

      const userRes = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } });
      if (!userRes.headers.get('content-type')?.includes('application/json')) throw new Error('Failed to fetch (HTML fallback)');
      const uData = await userRes.json();
      setDbUser(uData);

      const urlParams = new URLSearchParams(window.location.search);
      const inviteCode = urlParams.get('invite');

      const roomRes = await fetch(`/api/room${inviteCode ? `?invite=${inviteCode}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!roomRes.ok) throw new Error('Failed to load room');
      if (!roomRes.headers.get('content-type')?.includes('application/json')) throw new Error('Failed to fetch room (HTML fallback)');
      const rData = await roomRes.json();
      setRoom(rData);

      const pickRes = await fetch(`/api/picks/${rData.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!pickRes.ok) throw new Error('Failed to load picks');
      if (!pickRes.headers.get('content-type')?.includes('application/json')) throw new Error('Failed to fetch picks (HTML fallback)');
      const pData = await pickRes.json();
      setPicks(pData);

      const leadRes = await fetch(`/api/leaderboard/${rData.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!leadRes.ok) throw new Error('Failed to load leaderboard');
      if (!leadRes.headers.get('content-type')?.includes('application/json')) throw new Error('Failed to fetch leaderboard (HTML fallback)');
      const lData = await leadRes.json();
      setLeaderboard(lData);

      if (!uData.poolName) {
        setShowClaimModal(true);
      }
    } catch (e: any) {
      setError(e.message || 'Connection error. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPoolStandings = async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/pool-standings', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPoolStandings(await res.json());
    } catch (e) {}
  };

  const handleClaimName = async (name: string) => {
    setClaimingName(name);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/me/claim-pool-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ poolName: name })
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'Failed to claim name', 'error');
        setClaimingName(null);
        return;
      }
      setDbUser(prev => prev ? { ...prev, poolName: name } : prev);
      setShowClaimModal(false);
      showToast(`You're now ${name}!`, 'success');
    } catch (e) {
      showToast('Failed to claim name', 'error');
    }
    setClaimingName(null);
  };

  useEffect(() => {
    fetchSession();
    fetchPoolStandings();
    const interval = setInterval(fetchSession, 30000);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const fetchAudits = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/audits', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('HTML fallback');
          setAudits(await res.json());
        }
      } catch (e) {}
    };
    if (activeTab === 'admin' && isAdminUser) fetchAudits();
  }, [activeTab, dbUser, user]);

  useEffect(() => {
    localStorage.setItem('pinnedMatches', JSON.stringify(pinnedMatches));
  }, [pinnedMatches]);

  const fetchFinance = async () => {
    if (!room) return;
    try {
      const token = await user.getIdToken();
      const [membersRes, summaryRes] = await Promise.all([
        fetch(`/api/finance/${room.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/finance/${room.id}/summary`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (membersRes.ok) setFinanceData(await membersRes.json());
      if (summaryRes.ok) setFinanceSummary(await summaryRes.json());
    } catch (e) {}
  };

  useEffect(() => {
    if (activeTab === 'money' && room) fetchFinance();
  }, [activeTab, room, user]);

  const togglePin = (matchId: number) => {
    setPinnedMatches(prev => prev.includes(matchId) ? prev.filter(id => id !== matchId) : [matchId, ...prev]);
  };

  const handlePick = async (matchId: number, selection: string) => {
    const previousPicks = [...picks];
    const newPicks = [...picks.filter(p => p.matchId !== matchId), { matchId, selection, roomId: room?.id }];
    setPicks(newPicks);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId, roomId: room!.id, selection })
      });

      if (!res.ok) {
        if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('API request failed');
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save pick');
      }
      showToast('Pick saved', 'success');

      const pRes = await fetch(`/api/picks/${room!.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (pRes.ok) setPicks(await pRes.json());

      const lRes = await fetch(`/api/leaderboard/${room!.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (lRes.ok) setLeaderboard(await lRes.json());
    } catch (e: any) {
      setPicks(previousPicks);
      showToast(e.message || 'Failed to save pick', 'error');
    }
  };

  const handleSeed = async () => {
    const token = await user.getIdToken();
    await fetch('/api/admin/seed', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    fetchSession();
  };

  const stages = Array.from(new Set(matches.map(m => m.stage)));
  const visibleStageMatches = selectedStage === 'all' ? matches : matches.filter(m => m.stage === selectedStage);
  const groupsInStage = Array.from(new Set(visibleStageMatches.map(m => m.groupName).filter(Boolean))).sort();
  const visibleMatches = selectedGroup === 'all' ? visibleStageMatches : visibleStageMatches.filter(m => m.groupName === selectedGroup);

  const safeParseDate = (d: string | Date | null) => {
    if (!d) return new Date();
    if (typeof d === 'string') {
      let clean = d.replace(' ', 'T');
      if (!clean.includes('T') && !clean.includes('Z')) clean += 'Z';
      return new Date(clean);
    }
    return new Date(d);
  };

  const upcomingMatches = visibleMatches.filter(m => !isPast(safeParseDate(m.lockTime)));
  const liveMatches = visibleMatches.filter(m => m.status === 'live');
  const lockedMatches = visibleMatches.filter(m => isPast(safeParseDate(m.lockTime)) && m.status !== 'finished' && m.status !== 'live');
  const finishedMatches = visibleMatches.filter(m => m.status === 'finished');

  // 5 tabs: Home, Matches, Standings, Money, Admin
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'matches', label: 'Matches', icon: Calendar },
    { id: 'standings', label: 'Standings', icon: Trophy },
    { id: 'money', label: 'Money', icon: DollarSign },
  ];
  if (isAdminUser) navItems.push({ id: 'admin', label: 'Admin', icon: Settings });

  const myData = leaderboard.find(l => l.id === dbUser?.id);
  const myRank = leaderboard.findIndex(l => l.id === dbUser?.id) + 1;
  const totalPicks = picks.length;
  const correctPicks = picks.filter(p => {
    const m = matches.find(x => x.id === p.matchId);
    return m && m.status === 'finished' && p.selection === m.result;
  }).length;

  const myPoolStanding = poolStandings?.standings.find(s => s.name === dbUser?.poolName);
  const myPoolRank = poolStandings?.standings.findIndex(s => s.name === dbUser?.poolName);

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex h-screen bg-surface-base text-white flex-col items-center justify-center font-sans relative">
        <div className="ambient-orb orb-lime" />
        <div className="ambient-orb orb-emerald" />
        <div className="w-16 h-16 glass-card flex items-center justify-center mb-6 animate-pulse">
          <svg className="w-8 h-8 text-brand animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80">Syncing Pool Data</h2>
      </div>
    );
  }

  // ─── Error ───
  if (error) {
    return (
      <div className="flex h-screen bg-surface-base text-white flex-col items-center justify-center font-sans p-6 text-center relative">
        <div className="ambient-orb orb-lime" />
        <div className="w-16 h-16 glass-card flex items-center justify-center mb-6">
          <Zap className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-red-400 mb-2">Connection Lost</h2>
        <p className="text-xs text-slate-500 max-w-sm mb-6">{error}</p>
        <button onClick={fetchSession} className="glass-card hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider py-3 px-6 transition-all">
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface-base text-white font-sans overflow-hidden select-none relative">
      {/* Ambient Background */}
      <div className="ambient-orb orb-lime" />
      <div className="ambient-orb orb-emerald" />
      <div className="ambient-orb orb-cyan" />

      {/* Toast */}
      {toast && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-[200] animate-fade-up">
          <div className={cn(
            "px-5 py-2.5 rounded-full text-xs font-bold tracking-widest uppercase shadow-2xl flex items-center gap-2 backdrop-blur-xl",
            toast.type === 'success'
              ? "bg-white/90 text-black shadow-white/10"
              : "bg-red-500/90 text-white shadow-red-500/20"
          )}>
            {toast.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
            {toast.message}
          </div>
        </div>
      )}

      {/* ─── CLAIM MODAL ─── */}
      {showClaimModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <div className="relative w-full max-w-sm glass-card rounded-2xl shadow-2xl overflow-hidden animate-fade-up">
            <div className="p-6 border-b border-surface-border text-center">
              <div className="w-14 h-14 bg-brand/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-brand" />
              </div>
              <h2 className="text-lg font-extrabold text-white font-display">Who are you?</h2>
              <p className="text-sm text-slate-400 mt-2">Link your account to your pool identity</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {POOL_MEMBERS.map(name => {
                const isClaimed = poolStandings?.claimedUsers[name] && name !== dbUser?.poolName;
                return (
                  <button
                    key={name}
                    onClick={() => !isClaimed && handleClaimName(name)}
                    disabled={!!isClaimed || claimingName === name}
                    className={cn(
                      "py-3 px-4 rounded-xl text-sm font-bold transition-all",
                      isClaimed
                        ? "bg-white/[0.03] text-slate-600 cursor-not-allowed"
                        : claimingName === name
                          ? "bg-brand/20 text-brand border border-brand/40 animate-pulse"
                          : "bg-white/[0.06] hover:bg-brand/15 text-white hover:text-brand border border-white/10 hover:border-brand/30 cursor-pointer"
                    )}
                  >
                    {name}
                    {isClaimed && <span className="block text-[10px] text-slate-600 mt-0.5">Taken</span>}
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-surface-border">
              <button
                onClick={() => setShowClaimModal(false)}
                className="w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors py-2"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col border-r border-surface-border bg-surface-card transition-all duration-300 relative z-10",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-surface-border overflow-hidden">
          <div className="flex items-center gap-3">
            <div
              className="min-w-[36px] h-9 w-9 bg-brand rounded-xl flex items-center justify-center cursor-pointer shadow-[0_0_20px_var(--color-brand-muted)]"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            {isSidebarOpen && (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tighter text-white font-display uppercase whitespace-nowrap">THE POOL</h1>
                <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-3 py-3 rounded-xl font-bold text-sm tracking-wide transition-all relative",
                isSidebarOpen ? "w-full px-4" : "w-12 h-12 justify-center mx-auto",
                activeTab === item.id
                  ? "bg-brand/15 text-brand border border-brand/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
              title={item.label}
            >
              {activeTab === item.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-brand rounded-r-full" />
              )}
              <item.icon className="w-5 h-5 min-w-[20px]" />
              {isSidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-surface-border">
          <div className={cn(
            "flex items-center gap-3 rounded-xl glass-card",
            isSidebarOpen ? "p-3" : "justify-center p-2 h-12 w-12 mx-auto"
          )}>
            <div
              className="w-9 h-9 min-w-[36px] rounded-full bg-surface-base overflow-hidden border border-white/10 flex items-center justify-center cursor-pointer"
              onClick={() => !dbUser?.poolName && setShowClaimModal(true)}
            >
              {dbUser?.avatarUrl || user.photoURL ? (
                <img src={dbUser?.avatarUrl || user.photoURL!} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="text-xs text-slate-400 font-bold">{dbUser?.poolName?.substring(0, 2).toUpperCase() || dbUser?.displayName?.substring(0, 2).toUpperCase() || 'G'}</div>
              )}
            </div>
            {isSidebarOpen && (
              <>
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm font-bold text-white truncate">{dbUser?.poolName || dbUser?.displayName || user.displayName || 'Guest'}</div>
                  <div className="text-[11px] text-slate-400 font-medium truncate">
                    {dbUser?.poolName ? (
                      <span className="text-brand">{myPoolStanding ? `$${myPoolStanding.balance > 0 ? '+' : ''}${myPoolStanding.balance}` : room?.name || 'Global Pool'}</span>
                    ) : (
                      <button onClick={() => setShowClaimModal(true)} className="text-brand hover:text-brand-hover transition-colors">Claim identity</button>
                    )}
                  </div>
                </div>
                <button onClick={() => auth.signOut()} className="text-slate-400 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10" title="Log Out">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">

        {/* Mobile Header */}
        <header className="md:hidden flex-none h-14 border-b border-surface-border bg-surface-card/95 backdrop-blur-xl px-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-brand rounded-xl flex items-center justify-center shadow-[0_0_15px_var(--color-brand-muted)]">
              <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <h1 className="text-xl font-extrabold tracking-tighter text-white font-display uppercase">THE POOL</h1>
            <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            {dbUser?.poolName && myPoolStanding && (
              <span className={cn(
                "text-xs font-extrabold font-display px-2.5 py-1 rounded-full",
                myPoolStanding.balance > 0 ? "text-emerald-400 bg-emerald-500/10" : myPoolStanding.balance < 0 ? "text-red-400 bg-red-500/10" : "text-slate-400 bg-white/5"
              )}>
                ${myPoolStanding.balance > 0 ? '+' : ''}{myPoolStanding.balance}
              </span>
            )}
            <button onClick={() => auth.signOut()} className="text-slate-400 hover:text-red-400 transition-colors p-2" title="Log Out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Identity Banner (mobile) */}
        {!dbUser?.poolName && (
          <button
            onClick={() => setShowClaimModal(true)}
            className="md:hidden mx-4 mt-3 flex items-center justify-between gap-3 glass-card px-4 py-3 border-brand/20 bg-brand/5"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand" />
              <span className="text-sm font-bold text-brand">Link your pool identity</span>
            </div>
            <ChevronRight className="w-4 h-4 text-brand" />
          </button>
        )}

        {/* Scrollable Main */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className={cn(
            "mx-auto w-full",
            activeTab === 'dashboard'
              ? "grid grid-cols-1 lg:grid-cols-3 gap-6"
              : "flex flex-col gap-6"
          )}>

            {/* Left / Main Column */}
            <div className={cn(
              "flex flex-col gap-5",
              activeTab === 'dashboard' ? "col-span-1 lg:col-span-2" : ""
            )}>

              {/* ─── HOME TAB ─── */}
              {activeTab === 'dashboard' && (
                <>
                  {/* Live Matches — always on top */}
                  {liveMatches.length > 0 && (
                    <section className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 px-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-display">Live Now</h2>
                        <span className="text-[11px] text-red-400 font-bold bg-red-500/15 px-2.5 py-1 rounded-full border border-red-500/25">{liveMatches.length}</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {liveMatches.map(m => (
                          <MatchCard key={m.id} match={m} pick={picks.find(p => p.matchId === m.id)} onPick={handlePick} onClick={() => setSelectedMatch(m)} isPinned={pinnedMatches.includes(m.id)} onTogglePin={togglePin} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Next Matches with Pending Bets */}
                  <section className="flex flex-col gap-3">
                    <div className="flex justify-between items-center px-1">
                      <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-display">Next Matches</h2>
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider bg-white/5 px-2.5 py-1 rounded-full">{upcomingMatches.length} upcoming</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {upcomingMatches.length === 0 ? (
                        <div className="glass-card p-8 text-center">
                          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No upcoming matches</p>
                        </div>
                      ) : upcomingMatches.slice(0, 6).map(m => {
                        const pendingForMatch = poolStandings?.pendingBets?.find(pb =>
                          pb.matchId === m.id
                        );
                        return (
                          <div key={m.id} className="flex flex-col gap-0">
                            <MatchCard match={m} pick={picks.find(p => p.matchId === m.id)} onPick={handlePick} onClick={() => setSelectedMatch(m)} isPinned={pinnedMatches.includes(m.id)} onTogglePin={togglePin} />
                            {pendingForMatch && (
                              <div className="mx-2 -mt-1 mb-2 glass-card rounded-b-xl rounded-t-none px-4 py-2.5 border-t-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Flame className="w-3 h-3 text-brand" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand">Bets</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {pendingForMatch.bets.map((b, i) => (
                                    <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/[0.06] border border-white/10 px-2.5 py-1 rounded-lg">
                                      <span className="text-white">{b.name}</span>
                                      <span className="text-slate-500">→</span>
                                      <span className="text-brand">{b.pick}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {upcomingMatches.length > 6 && (
                        <button onClick={() => setActiveTab('matches')} className="text-xs font-bold text-brand hover:text-brand-hover transition-colors text-center py-2">
                          View all {upcomingMatches.length} matches →
                        </button>
                      )}
                    </div>
                  </section>

                  {/* Quick Stats Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="glass-card p-4 text-center">
                      <div className="text-2xl font-extrabold font-display text-white">{myData?.points || 0}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Points</div>
                      {myRank > 0 && <div className="text-[10px] text-brand font-bold mt-0.5">#{myRank}</div>}
                    </div>
                    <div className="glass-card p-4 text-center">
                      <div className="text-2xl font-extrabold font-display text-white">{correctPicks}<span className="text-slate-500 text-sm">/{totalPicks}</span></div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Correct</div>
                      <div className="text-[10px] text-emerald-400 font-bold mt-0.5">{totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0}%</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      {myPoolStanding ? (
                        <>
                          <div className={cn(
                            "text-2xl font-extrabold font-display",
                            myPoolStanding.balance > 0 ? "text-emerald-400" : myPoolStanding.balance < 0 ? "text-red-400" : "text-slate-400"
                          )}>
                            ${myPoolStanding.balance > 0 ? '+' : ''}{myPoolStanding.balance}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Pool $</div>
                          <div className="text-[10px] text-slate-500 font-bold mt-0.5">#{(myPoolRank ?? 0) + 1}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-2xl font-extrabold font-display text-white">{finishedMatches.length}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Played</div>
                          <div className="text-[10px] text-slate-500 font-bold mt-0.5">{upcomingMatches.length + lockedMatches.length} left</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Compliance Alert */}
                  {(() => {
                    if (!myData?.compliance?.stages?.length) return null;
                    const stageData = myData.compliance.stages[myData.compliance.stages.length - 1];
                    if (!stageData) return null;
                    const isViolating = stageData.violations > 0;
                    const isSafe = stageData.gamesToMakePick > 1 || stageData.currentStreak === 0;
                    if (isSafe && !isViolating) return null;
                    return (
                      <div className={cn(
                        "flex items-center justify-between gap-3 glass-card px-4 py-3 text-xs font-bold",
                        isViolating ? "border-red-500/20 bg-red-500/5" : "border-yellow-500/20 bg-yellow-500/5"
                      )}>
                        <div className="flex items-center gap-2">
                          <Zap className={cn("w-3.5 h-3.5 shrink-0", isViolating ? "text-red-400" : "text-yellow-400")} />
                          <span className={isViolating ? "text-red-400" : "text-yellow-400"}>
                            {isViolating
                              ? `Compliance violation: missed pick window (1 in ${stageData.windowSize})`
                              : stageData.gamesToMakePick === 0
                                ? `Pick required on your next match (1-in-${stageData.windowSize} rule)`
                                : `Pick needed within ${stageData.gamesToMakePick} games (1-in-${stageData.windowSize} rule)`
                            }
                          </span>
                        </div>
                        <button onClick={() => setActiveTab('matches')} className="shrink-0 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors">
                          View Matches
                        </button>
                      </div>
                    );
                  })()}

                  {/* Recent Results (condensed) */}
                  {poolStandings && (
                    <RecentResults
                      results={poolStandings.recentResults}
                      limit={3}
                      onSeeAll={() => setActiveTab('money')}
                    />
                  )}
                </>
              )}

              {/* ─── MATCHES TAB ─── */}
              {activeTab === 'matches' && (
                <>
                  {stages.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                          onClick={() => { setSelectedStage('all'); setSelectedGroup('all'); }}
                          className={cn(
                            "whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                            selectedStage === 'all' ? "bg-white text-black" : "glass-card text-slate-400 hover:text-white hover:bg-white/10"
                          )}
                        >
                          All Matches
                        </button>
                        {stages.map(stage => (
                          <button
                            key={stage}
                            onClick={() => { setSelectedStage(stage); setSelectedGroup('all'); }}
                            className={cn(
                              "whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                              selectedStage === stage ? "bg-white text-black" : "glass-card text-slate-400 hover:text-white hover:bg-white/10"
                            )}
                          >
                            {stage}
                          </button>
                        ))}
                      </div>

                      {groupsInStage.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                          <button
                            onClick={() => setSelectedGroup('all')}
                            className={cn(
                              "whitespace-nowrap px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                              selectedGroup === 'all' ? "bg-brand text-black" : "glass-card text-slate-400 hover:text-white hover:bg-white/10"
                            )}
                          >
                            All Groups
                          </button>
                          {groupsInStage.map(group => (
                            <button
                              key={group as string}
                              onClick={() => setSelectedGroup(group as string)}
                              className={cn(
                                "whitespace-nowrap px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                                selectedGroup === group ? "bg-brand text-black" : "glass-card text-slate-400 hover:text-white hover:bg-white/10"
                              )}
                            >
                              {group}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Results */}
                  {finishedMatches.length > 0 && (
                    <section className="flex flex-col gap-3">
                      <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-5 bg-emerald-500 rounded-full" />
                          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-display">Results</h2>
                        </div>
                        <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">{finishedMatches.length} played</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {finishedMatches.map(m => (
                          <MatchCard key={m.id} match={m} pick={picks.find(p => p.matchId === m.id)} onPick={handlePick} onClick={() => setSelectedMatch(m)} isPinned={pinnedMatches.includes(m.id)} onTogglePin={togglePin} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Live */}
                  {liveMatches.length > 0 && (
                    <section className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 px-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-display">Live Now</h2>
                        <span className="text-[11px] text-red-400 font-bold bg-red-500/15 px-2.5 py-1 rounded-full border border-red-500/25">{liveMatches.length}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {liveMatches.map(m => (
                          <MatchCard key={m.id} match={m} pick={picks.find(p => p.matchId === m.id)} onPick={handlePick} onClick={() => setSelectedMatch(m)} isPinned={pinnedMatches.includes(m.id)} onTogglePin={togglePin} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Locked */}
                  {lockedMatches.length > 0 && (
                    <section className="flex flex-col gap-3">
                      <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
                          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-display">Awaiting Results</h2>
                        </div>
                        <span className="text-[11px] text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">{lockedMatches.length}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {lockedMatches.map(m => (
                          <MatchCard key={m.id} match={m} pick={picks.find(p => p.matchId === m.id)} onPick={handlePick} onClick={() => setSelectedMatch(m)} isPinned={pinnedMatches.includes(m.id)} onTogglePin={togglePin} />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Upcoming */}
                  <section className="flex flex-col gap-3">
                    {groupsInStage.length > 0 && selectedGroup === 'all' ? (
                      groupsInStage.map(groupName => {
                        const groupMatches = upcomingMatches.filter(m => m.groupName === groupName);
                        if (groupMatches.length === 0) return null;
                        return (
                          <div key={groupName as string} className="mb-4">
                            <div className="flex items-center gap-2 pb-2 mb-3 px-1">
                              <div className="w-1 h-4 bg-brand rounded-full" />
                              <h2 className="text-sm font-bold uppercase tracking-widest text-white">{groupName}</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                              {groupMatches.map(m => (
                                <MatchCard key={m.id} match={m} pick={picks.find(p => p.matchId === m.id)} onPick={handlePick} onClick={() => setSelectedMatch(m)} isPinned={pinnedMatches.includes(m.id)} onTogglePin={togglePin} />
                              ))}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <>
                        <div className="flex justify-between items-center px-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-5 bg-brand rounded-full" />
                            <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-display">Upcoming</h2>
                          </div>
                          <span className="text-[11px] text-slate-300 font-bold bg-white/5 px-2.5 py-1 rounded-full">{upcomingMatches.length} matches</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {upcomingMatches.length === 0 ? (
                            <div className="glass-card p-8 text-center col-span-full">
                              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No upcoming matches</p>
                            </div>
                          ) : upcomingMatches.map(m => (
                            <MatchCard key={m.id} match={m} pick={picks.find(p => p.matchId === m.id)} onPick={handlePick} onClick={() => setSelectedMatch(m)} isPinned={pinnedMatches.includes(m.id)} onTogglePin={togglePin} />
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                </>
              )}

              {/* ─── STANDINGS TAB ─── */}
              {activeTab === 'standings' && (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-extrabold uppercase tracking-tight text-white font-display">Standings</h2>
                    <span className="text-[11px] text-slate-300 font-bold bg-white/5 px-3 py-1 rounded-full">{leaderboard.length} players</span>
                  </div>

                  {leaderboard.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                      <Trophy className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No standings yet</p>
                    </div>
                  ) : (
                    <>
                      {/* Podium */}
                      {leaderboard.length >= 3 && (
                        <div className="grid grid-cols-3 gap-3 mb-2">
                          {[1, 0, 2].map(podiumIdx => {
                            const member = leaderboard[podiumIdx];
                            if (!member) return null;
                            const rank = podiumIdx + 1;
                            const isMe = member.id === dbUser?.id;
                            const accentColors: Record<number, string> = {
                              1: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30',
                              2: 'from-slate-400/20 to-slate-400/5 border-slate-400/30',
                              3: 'from-amber-600/20 to-amber-600/5 border-amber-600/30'
                            };
                            const textColors: Record<number, string> = { 1: 'text-yellow-400', 2: 'text-slate-300', 3: 'text-amber-500' };
                            const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
                            return (
                              <div key={member.id} className={cn(
                                "glass-card p-5 flex flex-col items-center text-center relative overflow-hidden bg-gradient-to-b",
                                accentColors[rank],
                                rank === 1 && "lg:-mt-4 lg:pb-7"
                              )}>
                                <span className="text-2xl mb-2">{medals[rank]}</span>
                                <div className="w-12 h-12 rounded-full bg-surface-base overflow-hidden border-2 border-white/10 flex items-center justify-center mb-2">
                                  {member.avatarUrl ? (
                                    <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="text-sm text-slate-500 font-bold">{member.displayName?.substring(0, 2).toUpperCase() || 'P'}</div>
                                  )}
                                </div>
                                <div className={cn("text-sm font-extrabold truncate w-full", isMe ? "text-brand" : "text-white")}>
                                  {isMe ? 'You' : member.displayName}
                                </div>
                                <div className={cn("text-2xl font-extrabold font-display mt-1", textColors[rank])}>
                                  {member.points}
                                </div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">pts</div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Rest */}
                      <div className="flex flex-col gap-2">
                        {leaderboard.map((member, index) => {
                          if (leaderboard.length >= 3 && index < 3) return null;
                          const isMe = member.id === dbUser?.id;
                          const rank = index + 1;
                          return (
                            <div key={member.id} className={cn(
                              "flex items-center gap-4 p-4 rounded-xl transition-all glass-card",
                              isMe && "border-brand/20 bg-brand/5"
                            )}>
                              <div className="w-8 text-center font-extrabold text-sm text-slate-500">{rank}</div>
                              <div className="w-10 h-10 rounded-full bg-surface-base overflow-hidden border border-white/10 flex items-center justify-center shrink-0">
                                {member.avatarUrl ? (
                                  <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="text-[10px] text-slate-500 font-bold">{member.displayName?.substring(0, 2).toUpperCase() || 'P'}</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={cn("text-sm font-bold tracking-wide", isMe ? "text-brand" : "text-white")}>
                                  {isMe ? 'You' : member.displayName}
                                </div>
                                <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                                  {member.accuracy}% accuracy
                                  {member.trend === 'up' && <span className="text-emerald-400 ml-2">↑</span>}
                                  {member.trend === 'down' && <span className="text-red-400 ml-2">↓</span>}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-extrabold font-display text-white">{member.points}</div>
                                <div className="text-[10px] text-slate-500 font-bold">pts</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* My Pick History */}
                  {picks.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                      <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400 px-1">Your Pick History</h3>
                      {picks.map(p => {
                        const m = matches.find(x => x.id === p.matchId);
                        if (!m) return null;
                        const isCorrectPick = m.status === 'finished' && p.selection === m.result;
                        const isWrongPick = m.status === 'finished' && p.selection !== m.result;
                        return (
                          <div key={p.id || p.matchId} className={cn(
                            "flex items-center justify-between glass-card p-3",
                            isCorrectPick && "border-emerald-500/20 bg-emerald-500/5",
                            isWrongPick && "border-red-500/10 bg-red-500/[0.02]"
                          )}>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{m.teamA} vs {m.teamB}</div>
                              <div className="text-white font-bold text-sm mt-0.5">
                                {p.selection === 'teamA' ? m.teamA : (p.selection === 'teamB' ? m.teamB : 'Draw')}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isCorrectPick && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                              {isWrongPick && <X className="w-3.5 h-3.5 text-red-400" />}
                              <span className={cn(
                                "text-[10px] uppercase font-bold tracking-widest",
                                isCorrectPick ? "text-emerald-400" : isWrongPick ? "text-red-400" : "text-brand"
                              )}>
                                {m.status === 'finished' ? (isCorrectPick ? 'Correct' : 'Wrong') : m.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ─── MONEY TAB ─── */}
              {activeTab === 'money' && (
                <div className="flex flex-col gap-6">
                  {/* Pool Money Standings */}
                  {poolStandings && (
                    <PoolStandings
                      standings={poolStandings.standings}
                      gamesCompleted={poolStandings.gamesCompleted}
                      lastUpdated={poolStandings.lastUpdated}
                      myPoolName={dbUser?.poolName}
                    />
                  )}

                  {/* Match Results & Bets */}
                  {poolStandings && (
                    <RecentResults results={poolStandings.recentResults} />
                  )}

                  {/* App Payment Tracker — pool members only */}
                  {(() => {
                    const poolMembers = financeData.filter(m => m.poolName);
                    const poolPaid = poolMembers.filter(m => m.hasPaid).length;
                    if (poolMembers.length === 0) return null;
                    return (
                      <section className="glass-card overflow-hidden">
                        <div className="px-5 pt-5 pb-4 border-b border-surface-border flex items-center justify-between">
                          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white font-display flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-slate-400" /> Payment Tracker
                          </h2>
                          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-emerald-400">{poolPaid} paid</span>
                            <span className="text-red-400">{poolMembers.length - poolPaid} unpaid</span>
                          </div>
                        </div>
                        <div className="divide-y divide-white/[0.04]">
                          {poolMembers.map(member => {
                            const isMe = member.poolName === dbUser?.poolName;
                            return (
                              <div key={member.userId} className={cn("flex items-center gap-3 px-5 py-3", isMe && "bg-brand/[0.04]")}>
                                <div className="w-8 h-8 rounded-full bg-surface-base border border-white/10 flex items-center justify-center shrink-0">
                                  {member.avatarUrl ? (
                                    <img src={member.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" />
                                  ) : (
                                    <span className="text-[10px] text-slate-500 font-bold">{member.poolName?.substring(0, 2).toUpperCase() || '??'}</span>
                                  )}
                                </div>
                                <span className={cn("text-sm font-bold flex-1 truncate", isMe ? "text-brand" : "text-white")}>
                                  {member.poolName} {isMe && <span className="text-[10px] text-brand/70">(you)</span>}
                                </span>
                                {member.hasPaid ? (
                                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">Paid</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md">Unpaid</span>
                                )}
                                {isAdminUser && (
                                  <button
                                    onClick={async () => {
                                      const token = await user.getIdToken();
                                      const newPaid = !member.hasPaid;
                                      const newAmount = newPaid ? (financeSummary?.defaultBuyIn || 30) : 0;
                                      await fetch('/api/admin/finance', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                        body: JSON.stringify({ userId: member.userId, roomId: room?.id, hasPaid: newPaid, amountPaid: newAmount }),
                                      });
                                      showToast(`${member.poolName} marked as ${newPaid ? 'paid' : 'unpaid'}`, 'success');
                                      fetchFinance();
                                    }}
                                    className="text-[10px] font-bold text-slate-400 hover:text-white glass-card hover:bg-white/10 px-2 py-1 transition-colors uppercase tracking-widest"
                                  >
                                    {member.hasPaid ? 'Undo' : 'Pay'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })()}
                </div>
              )}

              {/* ─── ADMIN TAB ─── */}
              {activeTab === 'admin' && isAdminUser && (
                <div className="flex flex-col gap-6">
                  <section className="glass-card p-5 flex flex-col">
                    <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white mb-4 font-display">Manage Matches</h2>
                    <div className="flex flex-col gap-4">
                      {matches.map(m => (
                        <div key={m.id} className="glass-card overflow-hidden">
                          <div className="bg-white/[0.02] px-4 py-3 border-b border-white/5 flex justify-between items-center">
                            <span className="text-xs font-bold text-white">{m.teamA} vs {m.teamB}</span>
                            <span className="text-[10px] text-slate-500 uppercase font-bold">{m.status}</span>
                          </div>
                          <AdminControls user={user} match={m} onUpdate={fetchMatches} showToast={showToast} />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="glass-card flex flex-col overflow-hidden">
                    <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
                      <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white font-display flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Rule Configuration
                      </h2>
                    </div>
                    <div className="p-5">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Group Stage', pts: '30 PTS', rule: '1 in 5' },
                          { label: 'Round of 32 & 16', pts: '40/50 PTS', rule: '1 in 2' },
                          { label: 'Quarter Finals', pts: '80 PTS', rule: '1 in 2' },
                          { label: 'Semi Finals', pts: '100 PTS', rule: '1 in 2' },
                        ].map(r => (
                          <div key={r.label} className="glass-card p-4">
                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-2">{r.label}</div>
                            <div className="text-xl font-extrabold text-white">{r.pts} <span className="text-slate-500 text-sm ml-1">{r.rule}</span></div>
                          </div>
                        ))}
                        <div className="glass-card p-4 col-span-2">
                          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-2">Final</div>
                          <div className="text-xl font-extrabold text-white">150 PTS <span className="text-slate-500 text-sm ml-1">No rolling cycle</span></div>
                        </div>
                      </div>
                      <div className="mt-3 glass-card p-4">
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Lock Time</p>
                        <p className="text-xs text-slate-300">Bets lock 10 minutes prior to kickoff time.</p>
                      </div>
                    </div>
                  </section>

                  <section className="glass-card flex flex-col overflow-hidden">
                    <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
                      <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white font-display flex items-center gap-2">
                        <Database className="w-4 h-4" /> Audit Logs
                      </h2>
                    </div>
                    <div className="flex flex-col divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                      {audits.length === 0 ? (
                        <div className="text-sm font-medium text-slate-500 p-6 text-center">No audit logs found.</div>
                      ) : (
                        audits.map((log: AuditLog) => (
                          <div key={log.id} className="p-4 flex flex-col gap-1 hover:bg-white/[0.02] transition-colors">
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded glass-card text-slate-400">{log.action}</span>
                              <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">
                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono truncate mt-1">{log.details}</div>
                            <div className="text-[10px] text-slate-500 font-medium mt-1">By: {log.adminName || log.adminEmail} | Target: {log.targetId}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>

            {/* ─── RIGHT SIDEBAR (Home tab only) ─── */}
            {activeTab === 'dashboard' && (
              <div className="col-span-1 flex flex-col gap-5">
                {/* Your Position */}
                {myPoolStanding && (
                  <section className="glass-card overflow-hidden">
                    <div className="px-5 pt-5 pb-3 border-b border-surface-border">
                      <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-display flex items-center gap-2">
                        <Target className="w-4 h-4 text-brand" /> Your Position
                      </h2>
                    </div>
                    <div className="p-5 text-center">
                      <div className={cn(
                        "text-4xl font-extrabold font-display",
                        myPoolStanding.balance > 0 ? "text-emerald-400" : myPoolStanding.balance < 0 ? "text-red-400" : "text-slate-400"
                      )}>
                        {myPoolStanding.balance > 0 ? '+' : ''}{myPoolStanding.balance === 0 ? '0' : myPoolStanding.balance > 0 ? `$${myPoolStanding.balance}` : `-$${Math.abs(myPoolStanding.balance)}`}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                        #{(myPoolRank ?? 0) + 1} of {poolStandings?.standings.length} · {myPoolStanding.betsWon}/{myPoolStanding.betsPlaced} won
                      </div>
                    </div>
                  </section>
                )}

                {/* Pool Quick View */}
                {poolStandings && poolStandings.standings.length > 0 && (
                  <section className="glass-card overflow-hidden">
                    <div className="px-5 pt-5 pb-3 border-b border-surface-border flex items-center justify-between">
                      <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-display flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-accent-gold" /> Leaderboard
                      </h2>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{poolStandings.gamesCompleted}G</span>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {poolStandings.standings.slice(0, 5).map((p, idx) => {
                        const isMe = p.name === dbUser?.poolName;
                        return (
                          <div key={p.name} className={cn("flex items-center gap-3 px-4 py-2.5", isMe && "bg-brand/5")}>
                            <span className={cn("w-5 text-center text-xs font-extrabold", idx === 0 ? "text-brand" : "text-slate-500")}>
                              {idx === 0 ? '👑' : idx + 1}
                            </span>
                            <span className={cn("text-sm font-bold flex-1", isMe ? "text-brand" : "text-white")}>{p.name}</span>
                            <span className={cn(
                              "text-sm font-extrabold font-display tabular-nums",
                              p.balance > 0 ? "text-emerald-400" : p.balance < 0 ? "text-red-400" : "text-slate-400"
                            )}>
                              {p.balance > 0 ? '+' : p.balance < 0 ? '-' : ''}${Math.abs(p.balance)}
                            </span>
                          </div>
                        );
                      })}
                      {poolStandings.standings.length > 5 && (
                        <button onClick={() => setActiveTab('money')} className="w-full text-center py-2.5 text-[11px] font-bold text-brand hover:text-brand-hover transition-colors uppercase tracking-widest">
                          View all {poolStandings.standings.length}
                        </button>
                      )}
                    </div>
                  </section>
                )}

                {/* Quick Intel */}
                <section className="glass-card overflow-hidden">
                  <div className="px-5 pt-5 pb-3 border-b border-surface-border flex items-center gap-2">
                    <Zap className="w-4 h-4 text-brand" />
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-display">Intel</h2>
                  </div>
                  <div className="p-4 flex flex-col gap-2">
                    {(() => {
                      const intel: Array<{ icon: React.ReactNode; title: string; titleColor: string; desc: string }> = [];
                      const now = new Date();

                      liveMatches.slice(0, 2).forEach(m => {
                        intel.push({ icon: <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />, title: "LIVE", titleColor: "text-red-400", desc: `${m.teamA} ${m.scoreA ?? 0}-${m.scoreB ?? 0} ${m.teamB}` });
                      });

                      upcomingMatches.slice(0, 3).forEach(m => {
                        const minsUntilLock = ((typeof m.kickoffTime === 'string' ? new Date(m.kickoffTime.replace(' ', 'T') + (!m.kickoffTime.includes('T') && !m.kickoffTime.includes('Z') ? 'Z' : '')) : new Date(m.kickoffTime)).getTime() - 10 * 60000 - now.getTime()) / 60000;
                        if (minsUntilLock > 0 && minsUntilLock <= 120) {
                          intel.push({ icon: <Clock className="w-4 h-4 text-accent-cyan" />, title: "LOCKS SOON", titleColor: "text-cyan-400", desc: `${m.teamA} vs ${m.teamB} · ${Math.round(minsUntilLock)}m` });
                        }
                      });

                      finishedMatches.slice(0, 3).forEach(m => {
                        intel.push({ icon: <Trophy className="w-4 h-4 text-accent-gold" />, title: "RESULT", titleColor: "text-amber-400", desc: `${m.teamA} ${m.scoreA}-${m.scoreB} ${m.teamB}` });
                      });

                      if (intel.length === 0) {
                        return <div className="text-sm text-slate-500 p-2">No alerts right now.</div>;
                      }

                      return intel.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-2.5 rounded-xl">
                          <div className="w-5 flex justify-center pt-0.5 shrink-0">{item.icon}</div>
                          <div>
                            <div className={cn("text-[10px] uppercase tracking-widest font-bold", item.titleColor)}>{item.title}</div>
                            <div className="text-sm font-semibold text-white mt-0.5">{item.desc}</div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav — 4 items (+ admin) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-[72px] border-t border-surface-border bg-surface-card/95 backdrop-blur-xl px-2 flex items-center justify-around z-50 safe-area-bottom">
        {navItems.slice(0, 4).map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex-1 h-full flex flex-col justify-center items-center gap-1 transition-all",
              activeTab === item.id ? "text-brand" : "text-slate-400 hover:text-white"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeTab === item.id && "scale-110")} />
            <span className="font-bold text-[10px] uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
        {isAdminUser && (
          <button
            onClick={() => setActiveTab('admin')}
            className={cn(
              "flex-1 h-full flex flex-col justify-center items-center gap-1 transition-all",
              activeTab === 'admin' ? "text-brand" : "text-slate-400 hover:text-white"
            )}
          >
            <Settings className={cn("w-5 h-5", activeTab === 'admin' && "scale-110")} />
            <span className="font-bold text-[10px] uppercase tracking-wider">Admin</span>
          </button>
        )}
      </nav>

      {/* Match Details Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6 pb-20 md:pb-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedMatch(null)} />
          <div className="relative w-full max-w-lg glass-card rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden animate-fade-up">
            <div className="flex justify-between items-center p-4 border-b border-white/[0.06]">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Match Details
              </h3>
              <button onClick={() => setSelectedMatch(null)} className="p-2 -mr-2 text-slate-500 hover:text-white transition-colors glass-card rounded-full">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 md:p-8 flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] mb-6 px-3 py-1 glass-card rounded-full">
                {selectedMatch.stage}{selectedMatch.groupName ? ` · ${selectedMatch.groupName}` : ''}
              </span>

              <div className="flex items-center justify-center gap-4 w-full">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-5xl">{selectedMatch.teamAFlag}</span>
                  <span className="text-lg font-extrabold font-display text-white text-center truncate">{selectedMatch.teamA}</span>
                </div>
                <div className="flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase mb-2">VS</span>
                  <div className="text-3xl font-extrabold font-display text-white glass-card px-5 py-3 tabular-nums">
                    {isPast(new Date(selectedMatch.kickoffTime)) ? `${selectedMatch.scoreA ?? '-'} : ${selectedMatch.scoreB ?? '-'}` : format(new Date(selectedMatch.kickoffTime), 'HH:mm')}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-5xl">{selectedMatch.teamBFlag}</span>
                  <span className="text-lg font-extrabold font-display text-white text-center truncate">{selectedMatch.teamB}</span>
                </div>
              </div>

              <div className="w-full mt-8">
                <MatchCard match={selectedMatch} pick={picks.find(p => p.matchId === selectedMatch.id)} onPick={handlePick} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
