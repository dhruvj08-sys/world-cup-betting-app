import React, { useState, useEffect } from 'react';
import { User, Auth } from 'firebase/auth';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { LogOut, Home, Calendar, Trophy, Zap, Menu, X, ArrowUpRight, ArrowDownRight, Scale, User as UserIcon, Database, Settings, Pin, Flame, MessageSquare, DollarSign, Check, XCircle } from 'lucide-react';
import MatchCard from './MatchCard';
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

export default function Dashboard({ user, auth }: DashboardProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);

  const ADMIN_EMAILS = ['dhruvjainhk@gmail.com'];
  const isAdminUser = dbUser?.isGlobalAdmin || (user?.email && ADMIN_EMAILS.includes(user.email));

  const { matches, setMatches, lockingMatches, triggerSync: fetchMatches, goalEvent } = useMatchPolling(user);
  const [picks, setPicks] = useState<Pick[]>([]);
  
  useEffect(() => {
    if (goalEvent) {
      // Show dynamic live goal toast
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
  const [feedEvents, setFeedEvents] = useState<any[]>([]);
  const [pinnedMatches, setPinnedMatches] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('pinnedMatches') || '[]'); } catch { return []; }
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [financeData, setFinanceData] = useState<Array<{ userId: number; displayName: string | null; avatarUrl: string | null; hasPaid: boolean; amountPaid: number; joinedAt: string }>>([]);
  const [financeSummary, setFinanceSummary] = useState<{ totalMembers: number; paidCount: number; unpaidCount: number; potTotal: number; defaultBuyIn: number } | null>(null);

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
    } catch (e: any) {
      setError(e.message || 'Connection error. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 30000);
    
    // Auto-close sidebar on smaller desktop screens
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
    
    return () => {
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    const fetchAudits = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/audits', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('HTML fallback');
          const data = await res.json();
          setAudits(data);
        }
      } catch (e) {
        // fail silently
      }
    };
    if (activeTab === 'admin' && isAdminUser) {
      fetchAudits();
    }
  }, [activeTab, dbUser, user]);

  useEffect(() => {
    localStorage.setItem('pinnedMatches', JSON.stringify(pinnedMatches));
  }, [pinnedMatches]);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/feed/${room?.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setFeedEvents(data);
        }
      } catch (e) {}
    };
    if (activeTab === 'feed' && room) {
      fetchFeed();
    }
  }, [activeTab, room, user]);

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
    if (activeTab === 'finance' && room) {
      fetchFinance();
    }
  }, [activeTab, room, user]);

  const handlePayment = async () => {
    setPaying(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/payment/mock-stripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ roomId: room?.id })
      });
      if (res.ok) {
        setRoom(prev => prev ? { ...prev, hasPaid: true } : prev);
        showToast('Payment successful! Welcome to the pool.', 'success');
      } else {
        throw new Error('Payment failed');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setPaying(false);
    }
  };

  const togglePin = (matchId: number) => {
    setPinnedMatches(prev => prev.includes(matchId) ? prev.filter(id => id !== matchId) : [matchId, ...prev]);
  };

  const handlePick = async (matchId: number, selection: string, predictedScoreA?: number, predictedScoreB?: number) => {
    // Optimistic update
    const previousPicks = [...picks];
    const newPicks = [...picks.filter(p => p.matchId !== matchId), { matchId, selection, predictedScoreA, predictedScoreB, roomId: room?.id }];
    setPicks(newPicks);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ matchId, roomId: room.id, selection, predictedScoreA, predictedScoreB })
      });
      
      if (!res.ok) {
        if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('API request failed');
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save pick');
      }
      showToast('Pick saved', 'success');
      
      const pRes = await fetch(`/api/picks/${room.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (pRes.ok) setPicks(await pRes.json());
      
      const lRes = await fetch(`/api/leaderboard/${room.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (lRes.ok) setLeaderboard(await lRes.json());
    } catch (e: any) {
      setPicks(previousPicks); // Rollback
      showToast(e.message || 'Failed to save pick', 'error');
    }
  };

  const handleSeed = async () => {
    const token = await user.getIdToken();
    await fetch('/api/admin/seed', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
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
  const liveMatches = visibleMatches.filter(m => isPast(safeParseDate(m.lockTime)) && m.status !== 'finished');
  const finishedMatches = visibleMatches.filter(m => m.status === 'finished');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'matches', label: 'Fixtures', icon: Calendar },
    { id: 'standings', label: 'Standings', icon: Trophy },
    { id: 'feed', label: 'Timeline', icon: Flame },
    { id: 'finance', label: 'Finance', icon: DollarSign },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ];

  if (isAdminUser) {
    navItems.push({ id: 'admin', label: 'Admin', icon: Settings });
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white flex-col items-center justify-center font-sans">
         <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border border-surface-border0 mb-6 animate-pulse">
            <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
         </div>
         <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Syncing Pool Data</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-black text-white flex-col items-center justify-center font-sans p-6 text-center">
         <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 mb-6">
            <Zap className="w-8 h-8 text-red-500" />
         </div>
         <h2 className="text-sm font-black uppercase tracking-[0.2em] text-red-400 mb-2">Connection Lost</h2>
         <p className="text-xs text-slate-500 max-w-sm mb-6">{error}</p>
         <button onClick={fetchSession} className="bg-surface-hover hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider py-3 px-6 rounded-xl transition-all">
           Retry Connection
         </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden select-none relative">
      
      {/* Toast Notification */}
      {toast && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={cn(
            "px-6 py-3 rounded-full text-xs font-bold tracking-widest uppercase shadow-xl flex items-center gap-2",
            toast.type === 'success' ? "bg-white text-black shadow-white/20" : "bg-red-500 text-white shadow-red-500/20"
          )}>
            {toast.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {toast.message}
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col border-r border-surface-border bg-surface-card transition-all duration-300",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-surface-border overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-[32px] h-8 w-8 bg-brand rounded-xl flex items-center justify-center cursor-pointer shadow-[0_0_15px_var(--color-brand-muted)]" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            {isSidebarOpen && (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tighter text-white font-display uppercase whitespace-nowrap">THE POOL</h1>
                <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto overflow-x-hidden">
          {navItems.filter(item => !(window.innerWidth < 768 && (item.id === 'standings' || item.id === 'admin'))).map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-3 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
                isSidebarOpen ? "w-full px-4" : "w-12 h-12 justify-center mx-auto",
                activeTab === item.id 
                  ? "bg-brand/10 text-brand border border-brand/20 shadow-[0_0_10px_var(--color-brand-muted)]" 
                  : "text-slate-400 hover:text-white hover:bg-surface-hover border border-transparent"
              )}
              title={item.label}
            >
              <item.icon className="w-4 h-4 min-w-[16px]" />
              {isSidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          ))}
          

        </div>

        <div className="p-4 border-t border-surface-border">
          <div className={cn(
             "flex items-center gap-3 rounded-xl bg-surface-hover border border-surface-border",
             isSidebarOpen ? "p-3" : "justify-center p-2 h-12 w-12 mx-auto"
          )}>
            <div className="w-10 h-10 min-w-[40px] rounded-full bg-black overflow-hidden border border-surface-border flex items-center justify-center">
              {dbUser?.avatarUrl || user.photoURL ? (
                <img src={dbUser?.avatarUrl || user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="text-xs text-slate-500 font-bold">{dbUser?.displayName?.substring(0, 2).toUpperCase() || 'G'}</div>
              )}
            </div>
            {isSidebarOpen && (
              <>
                <div className="flex-1 overflow-hidden">
                  <div className="text-xs font-bold text-white truncate">{dbUser?.displayName || user.displayName || 'Guest'}</div>
                  <div className="text-[10px] text-slate-500 font-medium truncate">{room?.name || 'Global Pool'}</div>
                </div>
                <button onClick={() => auth.signOut()} className="text-slate-500 hover:text-[#f87171] transition-colors p-2" title="Log Out">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Onboarding Modal */}
        {room && room.hasPaid === false && !loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
            <div className="relative bg-surface-card border border-brand/30 shadow-[0_0_40px_var(--color-brand-muted)] rounded-3xl p-8 max-w-sm w-full flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
               <div className="w-16 h-16 bg-brand/20 text-brand rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                  <Trophy className="w-8 h-8" />
               </div>
               <h2 className="text-2xl font-black font-display uppercase tracking-tighter text-white mb-2">Join The Premium Pool</h2>
               <p className="text-sm text-slate-400 font-medium mb-8">Pay the $10 entry fee to unlock the dashboard, make predictions, and compete for the prize pool.</p>
               <button 
                 onClick={handlePayment} 
                 disabled={paying}
                 className="w-full bg-brand text-black font-black uppercase tracking-widest text-sm py-4 rounded-xl hover:shadow-[0_0_20px_var(--color-brand-muted)] transition-all flex items-center justify-center gap-2"
               >
                 {paying ? (
                   <span className="animate-pulse">Processing...</span>
                 ) : (
                   <>Pay $10 with Stripe <ArrowUpRight className="w-4 h-4" /></>
                 )}
               </button>
               <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-4 font-bold">Secure mock payment</div>
            </div>
          </div>
        )}
        
        {/* Mobile Header */}
        <header className="md:hidden flex-none h-16 border-b border-surface-border bg-surface-base px-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-brand rounded-xl flex items-center justify-center shadow-[0_0_15px_var(--color-brand-muted)]">
              <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tighter text-white font-display uppercase">THE POOL</h1>
              <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></div>
            </div>
          </div>
          <button onClick={() => auth.signOut()} className="text-slate-500 hover:text-[#f87171] transition-colors p-2" title="Log Out">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        {/* Scrollable Main Section */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left/Main Column */}
            <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
              
              
              {(activeTab === 'dashboard') && leaderboard.length <= 1 && picks.length === 0 && (
                 <section className="bg-brand text-black rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 shadow-[0_0_30px_var(--color-brand-muted)] mb-6">
                    <div className="flex-1 text-center md:text-left">
                       <h2 className="text-2xl font-black font-display uppercase tracking-tight mb-2">Welcome to your Pool</h2>
                       <p className="text-black/80 font-bold mb-4">You have 0 points because you haven't made any picks yet! Get started by predicting the upcoming matches below.</p>
                       <button onClick={() => setActiveTab('matches')} className="bg-black text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-black/80 transition-colors">Start Picking</button>
                    </div>
                    <div className="w-full md:w-auto md:max-w-[50%] p-4 bg-black/10 rounded-xl relative overflow-hidden backdrop-blur-sm shrink-0">
                       <div className="text-[10px] font-black uppercase tracking-widest text-black mb-1 text-center">Share Invite Link</div>
                       <div className="px-4 py-2 bg-white rounded-lg text-xs font-mono font-bold text-center select-all break-all">{window.location.host}/?invite={room?.inviteCode || 'CODE'}</div>
                    </div>
                 </section>
              )}

              {(activeTab === 'dashboard') && leaderboard && dbUser && (() => {
                const myData = leaderboard.find(l => l.id === dbUser.id);
                if (!myData || !myData.compliance) return null;
                const complianceStages = myData.compliance.stages;
                const stageData = complianceStages[complianceStages.length - 1];
                if (!stageData) return null;

                const isViolating = stageData.violations > 0;
                const isSafe = stageData.gamesToMakePick > 1 || stageData.currentStreak === 0;

                if (isSafe && !isViolating) return null;

                return (
                  <div className={cn(
                    "flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-xs font-bold",
                    isViolating
                      ? "bg-red-500/10 border border-red-500/20 text-red-400"
                      : "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
                  )}>
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isViolating
                          ? `Compliance violation: missed pick window (1 in ${stageData.windowSize})`
                          : stageData.gamesToMakePick === 0
                            ? "Must bet on the next game"
                            : `Pick needed within ${stageData.gamesToMakePick} games`
                        }
                      </span>
                    </div>
                    <button onClick={() => setActiveTab('matches')} className="shrink-0 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">
                      View Matches
                    </button>
                  </div>
                );
              })()}

              {activeTab === 'matches' && stages.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                     <button 
                       onClick={() => { setSelectedStage('all'); setSelectedGroup('all'); }}
                       className={cn("whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", selectedStage === 'all' ? "bg-white text-black" : "bg-surface-card text-slate-400 hover:text-white border border-surface-border hover:bg-surface-hover")}
                     >
                       All Matches
                     </button>
                     {stages.map(stage => (
                       <button
                         key={stage}
                         onClick={() => { setSelectedStage(stage); setSelectedGroup('all'); }}
                         className={cn("whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", selectedStage === stage ? "bg-white text-black" : "bg-surface-card text-slate-400 hover:text-white border border-surface-border hover:bg-surface-hover")}
                       >
                         {stage}
                       </button>
                     ))}
                  </div>
                  
                  {groupsInStage.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                       <button 
                         onClick={() => setSelectedGroup('all')}
                         className={cn("whitespace-nowrap px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all", selectedGroup === 'all' ? "bg-brand text-black shadow-[0_0_10px_var(--color-brand-muted)]" : "bg-surface-card text-slate-400 hover:text-white border border-surface-border hover:bg-surface-hover")}
                       >
                         All Groups
                       </button>
                       {groupsInStage.map(group => (
                         <button
                           key={group as string}
                           onClick={() => setSelectedGroup(group as string)}
                           className={cn("whitespace-nowrap px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all", selectedGroup === group ? "bg-brand text-black shadow-[0_0_10px_var(--color-brand-muted)]" : "bg-surface-card text-slate-400 hover:text-white border border-surface-border hover:bg-surface-hover")}
                         >
                           {group}
                         </button>
                       ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pinned Matches */}
              {(activeTab === 'dashboard' || activeTab === 'matches') && pinnedMatches.length > 0 && (
                <section className="bg-surface-card border border-surface-border rounded-2xl p-5 md:p-6 flex flex-col shadow-lg border-l-4 border-l-white">
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white font-display flex items-center gap-2">
                      <Pin className="w-3.5 h-3.5 fill-white" />
                      Pinned Matches
                    </h2>
                  </div>
                  <div className="flex flex-col gap-4">
                    {matches.filter((m: Match) => pinnedMatches.includes(m.id)).map((m: Match) => (
                      <MatchCard 
                        key={m.id} 
                        match={m} 
                        pick={picks.find((p: Pick) => p.matchId === m.id)}
                        onPick={handlePick}
                        onClick={() => setSelectedMatch(m)}
                        isPinned={true}
                        onTogglePin={togglePin}
                      />
                    ))}
                  </div>
                </section>
              )}

              {(activeTab === 'dashboard' || activeTab === 'matches') && liveMatches.length > 0 && (
                <section className="bg-surface-card border border-surface-border rounded-2xl p-5 md:p-6 flex flex-col shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500/0 via-red-500 to-red-500/0 opacity-20"></div>
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white font-display">Live Now</h2>
                  </div>
                  <div className="flex flex-col gap-4">
                    {liveMatches.map(m => (
                      <MatchCard 
                        key={m.id} 
                        match={m} 
                        pick={picks.find(p => p.matchId === m.id)}
                        onPick={handlePick}
                        onClick={() => setSelectedMatch(m)}
                        isPinned={pinnedMatches.includes(m.id)}
                        onTogglePin={togglePin}
                      />
                    ))}
                  </div>
                </section>
              )}

              {(activeTab === 'dashboard' || activeTab === 'matches') && (
                <section className="flex flex-col gap-4">
                  {groupsInStage.length > 0 && selectedGroup === 'all' ? (
                    // Group View for Forza layout
                    groupsInStage.map(groupName => {
                      const groupMatches = upcomingMatches.filter(m => m.groupName === groupName);
                      if (groupMatches.length === 0) return null;
                      return (
                        <div key={groupName as string} className="mb-6">
                           <div className="flex border-b border-surface-border pb-2 mb-3 items-center px-1">
                             <div className="w-1.5 h-4 bg-brand rounded-full mr-2"></div>
                             <h2 className="text-sm font-black uppercase tracking-widest text-white">{groupName}</h2>
                           </div>
                           <div className="flex flex-col gap-3">
                             {groupMatches.map(m => (
                                <MatchCard 
                                  key={m.id} 
                                  match={m} 
                                  pick={picks.find(p => p.matchId === m.id)}
                                  onPick={handlePick}
                                  onClick={() => setSelectedMatch(m)}
                                  isPinned={pinnedMatches.includes(m.id)}
                                  onTogglePin={togglePin}
                                />
                             ))}
                           </div>
                        </div>
                      )
                    })
                  ) : (
                    <>
                      <div className="flex justify-between items-center px-1">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 font-display">Next Matches</h2>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Showing {upcomingMatches.length} Matches</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {upcomingMatches.length === 0 ? (
                          <div className="bg-surface-card border border-surface-border rounded-xl p-8 text-center shadow-lg">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No upcoming matches available.</p>
                          </div>
                        ) : upcomingMatches.map(m => (
                          <MatchCard 
                            key={m.id} 
                            match={m} 
                            pick={picks.find(p => p.matchId === m.id)}
                            onPick={handlePick}
                            onClick={() => setSelectedMatch(m)}
                            isPinned={pinnedMatches.includes(m.id)}
                            onTogglePin={togglePin}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}

              {activeTab === 'matches' && finishedMatches.length > 0 && (
                <section className="flex flex-col gap-4 mt-4">
                  {groupsInStage.length > 0 && selectedGroup === 'all' ? (
                    groupsInStage.map(groupName => {
                      const groupMatches = finishedMatches.filter(m => m.groupName === groupName);
                      if (groupMatches.length === 0) return null;
                      return (
                        <div key={`finished-${groupName as string}`} className="mb-6 opacity-70">
                           <div className="flex border-b border-surface-border pb-2 mb-3 items-center px-1">
                             <div className="w-1.5 h-4 bg-slate-500 rounded-full mr-2"></div>
                             <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">{groupName} (Completed)</h2>
                           </div>
                           <div className="flex flex-col gap-3">
                             {groupMatches.map(m => (
                                <MatchCard 
                                  key={m.id} 
                                  match={m} 
                                  pick={picks.find(p => p.matchId === m.id)}
                                  onPick={handlePick}
                                  onClick={() => setSelectedMatch(m)}
                                  isPinned={pinnedMatches.includes(m.id)}
                                  onTogglePin={togglePin}
                                />
                             ))}
                           </div>
                        </div>
                      )
                    })
                  ) : (
                    <>
                      <div className="flex justify-between items-center px-1">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 font-display">Completed</h2>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{finishedMatches.length} Matches</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {finishedMatches.map(m => (
                          <MatchCard 
                            key={m.id} 
                            match={m} 
                            pick={picks.find(p => p.matchId === m.id)}
                            onPick={handlePick}
                            onClick={() => setSelectedMatch(m)}
                            isPinned={pinnedMatches.includes(m.id)}
                            onTogglePin={togglePin}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}
              
              {activeTab === 'standings' && (
                <section className="bg-surface-card border border-surface-border rounded-2xl flex flex-col shadow-xl overflow-hidden w-full lg:col-span-12">
                   <div className="px-6 py-6 border-b border-surface-border bg-black/50">
                     <h2 className="text-xl font-black uppercase tracking-[0.1em] text-white font-display">Global Rankings</h2>
                     <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Full participation breakdown</p>
                   </div>
                   <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse">
                       <thead>
                         <tr className="border-b border-surface-border text-[10px] uppercase font-black tracking-widest text-slate-500 bg-surface-base">
                           <th className="p-4 pl-6 font-medium">Rank</th>
                           <th className="p-4 font-medium">Player</th>
                           <th className="p-4 font-medium text-center">Accuracy</th>
                           <th className="p-4 font-medium text-center">Trend</th>
                           <th className="p-4 pr-6 font-medium text-right">Points</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-surface-border/50">
                         {leaderboard.map((member, index) => {
                            const isMe = member.id === dbUser?.id;
                            return (
                              <tr key={member.id} className={isMe ? "bg-brand/5" : "hover:bg-surface-hover/50 transition-colors"}>
                                <td className="p-4 pl-6">
                                  <span className={isMe ? "text-brand font-black" : "text-white font-bold"}>#{index + 1}</span>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-black overflow-hidden border border-surface-border flex items-center justify-center">
                                      {member.avatarUrl ? (
                                        <img src={member.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="text-[10px] text-slate-500 font-bold">{member.displayName?.substring(0, 2).toUpperCase() || 'P'}</div>
                                      )}
                                    </div>
                                    <span className={isMe ? "text-brand font-black" : "text-white font-bold uppercase tracking-wide"}>{isMe ? "YOU" : member.displayName}</span>
                                  </div>
                                </td>
                                <td className="p-4 text-center">
                                  <div className="inline-block px-2 py-1 bg-surface-base border border-surface-border rounded text-[10px] font-mono font-bold text-white">
                                    {member.accuracy}% 
                                  </div>
                                </td>
                                <td className="p-4 text-center">
                                  <span className={member.trend === 'up' ? "text-emerald-400 font-black text-[10px] tracking-widest uppercase" : (member.trend === 'down' ? "text-red-400 font-black text-[10px] tracking-widest uppercase" : "text-slate-500 font-black text-[10px] tracking-widest uppercase")}>
                                    {member.trend === 'up' ? 'UP' : (member.trend === 'down' ? 'DOWN' : 'SAME')}
                                  </span>
                                </td>
                                <td className="p-4 pr-6 text-right">
                                  <span className="text-xl font-black font-display text-white">{member.points}</span>
                                </td>
                              </tr>
                            );
                         })}
                       </tbody>
                     </table>
                   </div>
                </section>
              )}

              {activeTab === 'profile' && (
                <section className="bg-surface-card border border-surface-border rounded-2xl p-6 md:p-8 flex flex-col shadow-xl">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white font-display mb-8">User Profile</h2>
                  
                  <div className="flex flex-col md:flex-row items-center gap-8 mb-10">
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white/20 bg-black overflow-hidden flex items-center justify-center shrink-0 relative group shadow-2xl">
                      {dbUser?.avatarUrl || user.photoURL ? (
                        <img src={dbUser?.avatarUrl || user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl text-slate-500 font-black">{dbUser?.displayName?.substring(0, 2).toUpperCase() || 'P'}</span>
                      )}
                      
                      <button 
                        onClick={async () => {
                          const randomSeed = Math.random().toString(36).substring(7);
                          const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}`;
                          try {
                            const token = await user.getIdToken();
                            await fetch('/api/me/avatar', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ avatarUrl: url })
                            });
                            // @ts-ignore
                            setDbUser(prev => ({...prev, avatarUrl: url}));
                            showToast('Avatar generated!', 'success');
                          } catch (e) {
                            showToast('Failed to update avatar', 'error');
                          }
                        }}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold text-[10px] uppercase tracking-widest text-white backdrop-blur-sm"
                      >
                         Change
                      </button>
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="text-3xl font-black text-white tracking-tighter mb-1">{dbUser?.displayName || user.displayName || 'Guest Player'}</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{user.email}</p>
                      
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-6">
                        <div className="bg-surface-hover border border-surface-border px-4 py-2 rounded-xl">
                           <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Total Points</div>
                           <div className="text-xl font-black text-white">{leaderboard.find(l => l.id === dbUser?.id)?.points || 0}</div>
                        </div>
                        <div className="bg-surface-hover border border-surface-border px-4 py-2 rounded-xl">
                           <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Accuracy</div>
                           <div className="text-xl font-black text-white">{leaderboard.find(l => l.id === dbUser?.id)?.accuracy || 0}%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 border-t border-surface-border pt-8 mb-6">
                     <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 font-display mb-4">Pick History</h3>
                     <div className="flex flex-col gap-3">
                        {picks.length === 0 ? (
                           <div className="text-xs text-slate-500 font-bold uppercase tracking-widest text-center py-6">No picks made yet</div>
                        ) : picks.map(p => {
                           const m = matches.find(x => x.id === p.matchId);
                           if(!m) return null;
                           return (
                             <div key={p.id} className="flex justify-between items-center bg-black border border-surface-border p-4 rounded-xl">
                               <div className="flex flex-col gap-1">
                                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-none">{m.teamA} vs {m.teamB}</span>
                                  <span className="text-white font-bold text-sm">
                                    {p.predictedScoreA != null && p.predictedScoreB != null && p.predictedScoreA >= 0
                                      ? `Predicted: ${m.teamA} ${p.predictedScoreA} - ${p.predictedScoreB} ${m.teamB}`
                                      : `Pick: ${p.selection === 'teamA' ? m.teamA : (p.selection === 'teamB' ? m.teamB : (p.selection === 'draw' ? 'Draw' : p.selection))}`}
                                  </span>
                               </div>
                               <div className="text-right">
                                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">{m.status}</span>
                               </div>
                             </div>
                           );
                        })}
                     </div>
                  </div>
                  
                  <div className="mt-auto border-t border-surface-border pt-6 flex justify-end">
                    <button onClick={() => auth.signOut()} className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-red-500/20">
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </section>
              )}
              {activeTab === 'feed' && (
                <div className="flex flex-col gap-6">
                  {/* Social Highlights */}
                  <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-lg flex flex-col justify-center transition-all hover:bg-surface-card">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Most Backed Team</span>
                      </div>
                      <div className="text-xl font-black text-white">Brazil</div>
                      <div className="text-xs text-slate-400 mt-1 font-medium">14 out of 19 players picked Brazil vs France</div>
                    </div>
                    <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-lg flex flex-col justify-center transition-all hover:bg-surface-card">
                      <div className="flex items-center gap-2 mb-2">
                        <Scale className="w-4 h-4 text-blue-400" />
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Most Divided Match</span>
                      </div>
                      <div className="text-md font-bold text-white mb-2">Argentina <span className="text-slate-500 font-medium">vs</span> Spain</div>
                      <div className="flex items-center gap-1 w-full h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full" style={{ width: '40%' }}></div>
                        <div className="bg-slate-600 h-full" style={{ width: '20%' }}></div>
                        <div className="bg-red-500 h-full" style={{ width: '40%' }}></div>
                      </div>
                    </div>
                    <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-lg flex flex-col justify-center transition-all hover:bg-surface-card">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowDownRight className="w-4 h-4 text-purple-400" />
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Biggest Contrarian</span>
                      </div>
                      <div className="text-xl font-black text-white">@Gaurav</div>
                      <div className="text-xs text-slate-400 mt-1 font-medium">Only player to back Germany</div>
                    </div>
                    <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-lg flex flex-col justify-center transition-all hover:bg-surface-card">
                      <div className="flex items-center gap-2 mb-2">
                        <Flame className="w-4 h-4 text-orange-400" />
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Biggest Mover</span>
                      </div>
                      <div className="text-xl font-black text-white">@Heet</div>
                      <div className="text-xs text-slate-400 mt-1 font-medium">Jumped 4 spots this week</div>
                    </div>
                  </section>

                  {/* Curated Feed (Mock) */}
                  <section className="flex flex-col gap-4">
                    <div className="flex items-center justify-between pb-2 bg-black sticky top-0 z-10 pt-4">
                       <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white font-display flex items-center gap-2">
                         <MessageSquare className="w-4 h-4" />
                         Recent Activity
                       </h2>
                    </div>
                    
                    {feedEvents.length === 0 ? (
                       <div className="bg-surface-card border border-surface-border rounded-2xl p-8 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">
                         No activity yet.
                       </div>
                    ) : (
                       feedEvents.map((event, idx) => (
                         <div key={idx} className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-lg flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-black overflow-hidden border border-surface-border flex items-center justify-center shrink-0">
                               {event.userAvatar ? (
                                 <img src={event.userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                               ) : (
                                 <div className="text-xs text-slate-500 font-bold">{event.userDisplayName?.substring(0, 2).toUpperCase() || 'P'}</div>
                               )}
                            </div>
                            <div className="flex-1">
                               <div className="flex justify-between items-start mb-1">
                                  <span className="text-sm font-bold text-white">{event.userDisplayName}</span>
                                  <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}</span>
                               </div>
                               <p className="text-sm text-slate-400">
                                 Scored <span className="text-brand font-black">+{event.points} pts</span> for {event.teamA} {event.scoreA} - {event.scoreB} {event.teamB}
                               </p>
                            </div>
                         </div>
                       ))
                    )}
                  </section>
                </div>
              )}
              {activeTab === 'finance' && (
                <div className="flex flex-col gap-6">
                  {/* Pot Summary Banner */}
                  {financeSummary && (
                    <div className="bg-surface-card border border-surface-border rounded-2xl p-5 shadow-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white font-display flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Pool Pot
                        </h2>
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                          ${financeSummary.defaultBuyIn} buy-in
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-3xl font-black font-display text-white">${financeSummary.potTotal}</span>
                        <span className="text-sm text-slate-500 font-bold">/ ${financeSummary.totalMembers * financeSummary.defaultBuyIn}</span>
                      </div>
                      <div className="w-full h-2 bg-surface-base rounded-full overflow-hidden mb-3">
                        <div
                          className="h-full bg-brand rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (financeSummary.potTotal / (financeSummary.totalMembers * financeSummary.defaultBuyIn)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-emerald-400">{financeSummary.paidCount} paid</span>
                        <span className="text-red-400">{financeSummary.unpaidCount} unpaid</span>
                      </div>
                    </div>
                  )}

                  {/* Member Payment Table */}
                  <section className="bg-surface-card border border-surface-border rounded-2xl shadow-lg overflow-hidden">
                    <div className="px-5 pt-5 pb-4 border-b border-surface-border">
                      <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white font-display">Payment Status</h2>
                    </div>
                    <div className="flex flex-col divide-y divide-surface-border">
                      {financeData.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-xs font-bold uppercase tracking-widest">No members found.</div>
                      ) : (
                        financeData.map(member => (
                          <div key={member.userId} className="flex items-center gap-3 px-5 py-3">
                            <div className="w-9 h-9 rounded-full bg-black overflow-hidden border border-surface-border flex items-center justify-center shrink-0">
                              {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-[10px] text-slate-500 font-bold">{member.displayName?.substring(0, 2).toUpperCase() || '??'}</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-black text-white uppercase tracking-wide truncate">{member.displayName || 'Unknown'}</div>
                              <div className="text-[10px] text-slate-500 font-bold">${member.amountPaid} paid</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {member.hasPaid ? (
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                                  <Check className="w-3 h-3" /> Paid
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
                                  <XCircle className="w-3 h-3" /> Unpaid
                                </span>
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
                                    showToast(`${member.displayName} marked as ${newPaid ? 'paid' : 'unpaid'}`, 'success');
                                    fetchFinance();
                                  }}
                                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white bg-surface-base hover:bg-surface-hover border border-surface-border px-2.5 py-1 rounded-lg transition-colors"
                                >
                                  {member.hasPaid ? 'Undo' : 'Mark Paid'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>

            {/* Right Column / Sidebar info */}
            <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
              
              {(activeTab === 'dashboard') && (
                <section className="bg-surface-card border border-surface-border rounded-2xl p-5 flex flex-col shadow-lg">
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-4 font-display">Leaderboard</h2>
                  <div className="flex flex-col gap-2">
                    {leaderboard.map((member, index) => {
                      const isMe = member.id === dbUser?.id;
                      return (
                        <div key={member.id} className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border transition-all",
                          isMe ? "bg-surface-hover border-white/30" : "bg-black border-surface-border"
                        )}>
                          <span className={cn("w-4 text-xs font-black", isMe ? "text-white" : "text-slate-500")}>{index + 1}</span>
                          <div className="w-9 h-9 rounded-full bg-black overflow-hidden border border-surface-border flex items-center justify-center shadow-inner">
                            {member.avatarUrl ? (
                              <img src={member.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-[10px] text-slate-500 font-bold">{member.displayName?.substring(0, 2).toUpperCase() || 'P'}</div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className={cn("text-xs font-black tracking-wide uppercase", isMe ? "text-white" : "text-white")}>{isMe ? "YOU" : member.displayName}</div>
                            <div className="text-[9px] text-slate-300 font-bold tracking-widest uppercase mt-0.5">{member.accuracy}% Acc</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black font-display">{member.points}</div>
                            <div className={cn("text-[8px] font-black tracking-widest uppercase mt-0.5", member.trend === 'up' ? "text-white" : (member.trend === 'down' ? "text-red-400" : "text-slate-400"))}>
                              {member.trend === 'up' ? '↑ Rising' : (member.trend === 'down' ? '↓ Falling' : 'Stable')}
                            </div>
                          </div>
                          {isAdminUser && !isMe && (
                            <button className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                              onClick={() => {
                                 setLeaderboard(leaderboard.filter(m => m.id !== member.id));
                                 showToast(`Kicked ${member.displayName}`, 'success');
                              }}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {leaderboard.length === 0 && (
                      <div className="text-center py-6 border border-dashed border-surface-border rounded-xl">
                        <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest">No players found</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              
              {activeTab === 'admin' && isAdminUser && (
                <div className="flex flex-col gap-6">
                  <section className="bg-surface-card border border-surface-border rounded-2xl p-5 flex flex-col shadow-lg">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white mb-4 font-display">Manage Matches</h2>
                    <div className="flex flex-col gap-4">
                      {matches.map(m => (
                        <div key={m.id} className="border border-surface-border rounded-xl overflow-hidden">
                           <div className="bg-black px-4 py-3 border-b border-surface-border flex justify-between items-center">
                              <span className="text-xs font-black text-white">{m.teamA} vs {m.teamB}</span>
                              <span className="text-[10px] text-slate-500 uppercase font-black">{m.status}</span>
                           </div>
                           <AdminControls 
                             user={user} 
                             match={m} 
                             onUpdate={fetchMatches} 
                             showToast={showToast} 
                           />
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'admin' && isAdminUser && (
                <div className="flex flex-col gap-6">
                  {/* Admin Rules & Settings */}
                  <section className="bg-surface-card border border-surface-border rounded-2xl flex flex-col shadow-lg overflow-hidden">
                    <div className="px-5 pt-5 pb-4 border-b border-surface-border">
                      <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white font-display flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Rule Configuration
                      </h2>
                    </div>
                    <div className="p-6 text-sm text-slate-300 font-medium">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black border border-surface-border p-4 rounded-xl">
                           <div className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Group Stage</div>
                           <div className="text-xl font-black text-white">30 PTS <span className="text-slate-500 text-sm ml-2">1 in 5</span></div>
                        </div>
                        <div className="bg-black border border-surface-border p-4 rounded-xl">
                           <div className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Round of 32 & 16</div>
                           <div className="text-xl font-black text-white">40/50 PTS <span className="text-slate-500 text-sm ml-2">1 in 2</span></div>
                        </div>
                        <div className="bg-black border border-surface-border p-4 rounded-xl">
                           <div className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Quarter Finals</div>
                           <div className="text-xl font-black text-white">80 PTS <span className="text-slate-500 text-sm ml-2">1 in 2</span></div>
                        </div>
                        <div className="bg-black border border-surface-border p-4 rounded-xl">
                           <div className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Semi Finals</div>
                           <div className="text-xl font-black text-white">100 PTS <span className="text-slate-500 text-sm ml-2">1 in 2</span></div>
                        </div>
                        <div className="bg-black border border-surface-border p-4 rounded-xl col-span-2">
                           <div className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-2">Final</div>
                           <div className="text-xl font-black text-white">150 PTS <span className="text-slate-500 text-sm ml-2">No rolling cycle</span></div>
                        </div>
                      </div>
                      <div className="mt-4 p-4 border border-surface-border rounded-xl bg-surface-card">
                         <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Lock Time</p>
                         <p className="text-xs text-slate-300">Bets lock 10 minutes prior to kickoff time.</p>
                      </div>
                    </div>
                  </section>

                  <section className="bg-surface-card border border-surface-border rounded-2xl flex flex-col shadow-lg overflow-hidden">
                    <div className="px-5 pt-5 pb-4 border-b border-surface-border">
                      <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white font-display flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        Audit Logs
                      </h2>
                    </div>
                    <div className="flex flex-col divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                      {audits.length === 0 ? (
                        <div className="text-sm font-medium text-slate-500 p-6 text-center">No audit logs found.</div>
                      ) : (
                        audits.map((log: AuditLog) => (
                          <div key={log.id} className="p-4 flex flex-col gap-1 hover:bg-white-[0.02] transition-colors">
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded bg-surface-hover text-slate-400">
                                {log.action}
                              </span>
                              <span className="text-[10px] text-slate-600 font-bold tracking-widest uppercase">
                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono truncate mt-1">
                              {log.details}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium mt-1">
                              By: {log.adminName || log.adminEmail} | Target: {log.targetId}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              )}

              {/* Dynamic Action Items & Intel */}
              {(activeTab === 'dashboard') && (
                <section className="bg-surface-card border border-surface-border rounded-2xl flex flex-col shadow-lg overflow-hidden">
                  <div className="px-5 pt-5 pb-4 border-b border-surface-border flex items-center justify-between">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 font-display flex items-center gap-2">
                       <Zap className="w-3.5 h-3.5 text-white" />
                       Recent & Upcoming
                    </h2>
                  </div>
                  <div className="flex-1 p-4 gap-4 flex flex-col space-y-1">
                    {(() => {
                      const intel = [];
                      const now = new Date();
                      
                      // 1. Compliance Alerts
                      if (dbUser) {
                        const myData = leaderboard.find(l => l.id === dbUser.id);
                        if (myData?.compliance?.stages?.length > 0) {
                          const cStatus = myData.compliance.stages[myData.compliance.stages.length - 1];
                          if (cStatus.gamesToMakePick === 1) {
                            intel.push({
                              icon: <Zap className="w-4 h-4 text-red-400" />,
                              title: "CRITICAL COMPLIANCE",
                              desc: `You MUST place a bet on the next game to avoid a violation.`,
                            });
                          } else if (cStatus.gamesToMakePick === 2 && cStatus.currentStreak > 0) {
                            intel.push({
                              icon: <Scale className="w-4 h-4 text-yellow-400" />,
                              title: "COMPLIANCE WARNING",
                              desc: `A pick is required within the next 2 games.`,
                            });
                          }
                        }
                      }

                      // 2. Imminent Locks
                      upcomingMatches.slice(0, 2).forEach(m => {
                        const minsUntilLock = ((typeof m.kickoffTime === 'string' ? new Date(m.kickoffTime.replace(' ', 'T') + (!m.kickoffTime.includes('T') && !m.kickoffTime.includes('Z') ? 'Z' : '')) : new Date(m.kickoffTime)).getTime() - 10 * 60000 - now.getTime()) / 60000;
                        if (minsUntilLock > 0 && minsUntilLock <= 60) {
                          intel.push({
                            icon: <Calendar className="w-4 h-4 text-blue-400" />,
                            title: "LOCKING SOON",
                            desc: `${m.teamA} vs ${m.teamB} locks in ${Math.round(minsUntilLock)} mins.`,
                          });
                        }
                      });
                      
                      // 3. Live Matches
                      liveMatches.slice(0, 2).forEach(m => {
                        intel.push({
                            icon: <Zap className="w-4 h-4 text-red-500 animate-pulse" />,
                            title: "IN PROGRESS",
                            desc: `${m.teamA} vs ${m.teamB} is playing now.`,
                        });
                      });

                      // 4. Recently Settled
                      finishedMatches.slice(0, 3).forEach(m => {
                        intel.push({
                          icon: <Trophy className="w-4 h-4 text-white" />,
                          title: "MATCH SETTLED",
                          desc: `${m.teamA} ${m.scoreA} - ${m.scoreB} ${m.teamB}`,
                        });
                      });

                      if (intel.length === 0) {
                        return <div className="text-sm font-medium text-slate-500 p-2">No recent activity.</div>;
                      }

                      return intel.slice(0, 5).map((item, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <div className="w-full h-px bg-surface-hover my-2"></div>}
                          <div className="flex items-start gap-4">
                            <div className="w-8 flex justify-center pt-1">
                              {item.icon}
                            </div>
                            <div className="flex-1">
                              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1">{item.title}</div>
                              <div className="text-sm font-bold text-white">{item.desc}</div>
                            </div>
                          </div>
                        </React.Fragment>
                      ));
                    })()}
                  </div>
                </section>
              )}

            </div>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 border-t border-surface-border bg-surface-card/95 backdrop-blur-xl px-2 flex items-center justify-around z-50">
        {navItems.map(item => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id)} 
            className={cn(
              "flex-1 h-full flex flex-col justify-center items-center gap-1.5 transition-all border-t-2", 
              activeTab === item.id 
                ? "text-brand border-brand" 
                : "text-slate-500 hover:text-white border-transparent"
            )}
          >
            <item.icon className={cn("w-4 h-4", activeTab === item.id ? "scale-110" : "scale-100")} />
            <span className="font-black text-[9px] uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Match Details Modal/Drawer */}
      {selectedMatch && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6 pb-20 md:pb-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedMatch(null)}></div>
          <div className="relative w-full max-w-lg bg-surface-card border border-surface-border rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 md:slide-in-from-bottom-0 md:zoom-in-95 duration-300">
             
             <div className="flex justify-between items-center p-4 border-b border-surface-border bg-surface-card">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none flex items-center gap-2">
                 Match Selection
               </h3>
               <button onClick={() => setSelectedMatch(null)} className="p-2 -mr-2 text-slate-500 hover:text-white transition-colors bg-surface-hover rounded-full">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
               </button>
             </div>

             <div className="p-6 md:p-8 flex flex-col items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-6 px-3 py-1 bg-surface-hover rounded-md border border-surface-border">{selectedMatch.stage} {selectedMatch.groupName ? `- ${selectedMatch.groupName}` : ''}</span>
                

                
                <div className="flex items-center justify-center gap-4 w-full">
                   <div className="flex flex-col items-center gap-2 flex-1">
                      <span className="text-6xl drop-shadow-2xl">{selectedMatch.teamAFlag}</span>
                      <span className="text-lg font-black font-display text-white text-center truncate">{selectedMatch.teamA}</span>
                   </div>
                   
                   <div className="flex flex-col items-center justify-center w-auto shrink-0">
                      <span className="text-[10px] font-black text-slate-600 tracking-widest uppercase mb-2">VS</span>
                      <div className="text-4xl font-black font-display text-white bg-black px-6 py-4 rounded-xl border border-surface-border shadow-inner tabular-nums">
                        {isPast(new Date(selectedMatch.kickoffTime)) ? `${selectedMatch.scoreA ?? '-'} : ${selectedMatch.scoreB ?? '-'}` : format(new Date(selectedMatch.kickoffTime), 'HH:mm')}
                      </div>
                   </div>

                   <div className="flex flex-col items-center gap-2 flex-1">
                      <span className="text-6xl drop-shadow-2xl">{selectedMatch.teamBFlag}</span>
                      <span className="text-lg font-black font-display text-white text-center truncate">{selectedMatch.teamB}</span>
                   </div>
                </div>

                <div className="w-full mt-10">
                   {/* We wrap MatchCard here to show the locking and quick-pick in a larger context */}
                   <MatchCard
                      match={selectedMatch}
                      pick={picks.find(p => p.matchId === selectedMatch.id)}
                      onPick={handlePick}
                   />
                </div>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

