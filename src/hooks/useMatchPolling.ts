import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Match } from '../types';

export function useMatchPolling(user: User, initialMatches: Match[] = []) {
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [lockingMatches, setLockingMatches] = useState<number[]>([]); // Array of match IDs that are locking soon
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [goalEvent, setGoalEvent] = useState<{ matchId: number, teamA: string, teamB: string, newScoreA: number, newScoreB: number } | null>(null);
  const prevMatchesRef = useRef<Match[]>([]);
  
  const fetchMatches = async () => {
    try {
      const token = await user.getIdToken();
      const matchRes = await fetch('/api/matches', { headers: { Authorization: `Bearer ${token}` } });
      if (!matchRes.ok) return;
      
      const contentType = matchRes.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return;
      }
      
      let mData = await matchRes.json();
      
      if (mData.length === 0) {
        await fetch('/api/admin/seed', { method: 'POST', headers: { Authorization: `Bearer ${token}` }});
        const refetch = await fetch('/api/matches', { headers: { Authorization: `Bearer ${token}` } });
        const refetchContentType = refetch.headers.get('content-type');
        if (!refetchContentType || !refetchContentType.includes('application/json')) {
          return;
        }
        mData = await refetch.json();
      }
      
      let foundGoal = false;
      mData.forEach((m: Match) => {
        const prev = prevMatchesRef.current.find(p => p.id === m.id);
        if (prev && m.status === 'live') {
          if (m.scoreA !== prev.scoreA || m.scoreB !== prev.scoreB) {
            setGoalEvent({
              matchId: m.id,
              teamA: m.teamA,
              teamB: m.teamB,
              newScoreA: m.scoreA || 0,
              newScoreB: m.scoreB || 0
            });
            foundGoal = true;
          }
        }
      });
      if (foundGoal) {
        setTimeout(() => setGoalEvent(null), 8000); // clear after 8s
      }
      
      prevMatchesRef.current = mData;
      setMatches(mData);
      setLastSync(new Date());
      
      // Check for impending lock deadlines (10 mins before lock time, which is 20 before kickoff)
      const now = new Date();
      const impendingLocks: number[] = [];
      
      mData.forEach((m: Match) => {
        const lockDate = new Date(m.lockTime);
        const diffMs = lockDate.getTime() - now.getTime();
        // If it's less than 10 minutes until lock, mark as impending
        if (diffMs > 0 && diffMs <= 10 * 60 * 1000) {
          impendingLocks.push(m.id);
        }
      });
      
      if (JSON.stringify(impendingLocks) !== JSON.stringify(lockingMatches)) {
        setLockingMatches(impendingLocks);
      }
    } catch (e) {
      // fail silently for polling, avoids console spam on network errors or transient restart errors
    }
  };

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 5000); // 5 sec live sync
    return () => clearInterval(interval);
  }, [user]);

  return { matches, setMatches, lockingMatches, lastSync, triggerSync: fetchMatches, goalEvent };
}
