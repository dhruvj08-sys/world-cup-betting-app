import React from 'react';
import { User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { dbFirestore } from '../App';
import { Match } from '../types';
import { cn } from '../lib/utils.ts';

interface AdminControlsProps {
  user: User;
  match: Match;
  onUpdate: (updatedMatch: Match) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function AdminControls({ user, match, onUpdate, showToast }: AdminControlsProps) {

  const logToFirestore = async (payload: any) => {
    try {
      await addDoc(collection(dbFirestore, 'audit_logs'), {
        adminId: user.uid,
        adminEmail: user.email,
        adminName: user.displayName,
        action: 'MATCH_OVERRIDE',
        targetMatchId: match.id,
        details: payload,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to log to Firestore', err);
    }
  };

  const handleUpdate = async (payload: any) => {
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/matches/${match.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('API Error');
      onUpdate({ ...match, ...payload });
      await logToFirestore(payload);
      showToast(`Match successfully updated`, 'success');
    } catch (e) {
      showToast('Failed to update match', 'error');
    }
  };

  return (
    <div className="w-full mb-6 p-4 bg-red-500/5 border border-red-500/10 rounded-xl flex items-center justify-between">
      <div>
        <div className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Admin Controls</div>
        <div className="text-xs text-slate-400">Toggle pool status or cancel match.</div>
      </div>
      <div className="flex gap-2">
        <button 
          onClick={() => handleUpdate({ poolStatus: match.poolStatus === 'excluded' ? 'eligible' : 'excluded' })}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
             match.poolStatus === 'excluded' ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {match.poolStatus === 'excluded' ? 'Excluded' : 'Exclude'}
        </button>
        
        <button 
          onClick={() => handleUpdate({ status: match.status === 'cancelled' ? 'scheduled' : 'cancelled' })}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
             match.status === 'cancelled' ? "bg-red-500 text-white" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {match.status === 'cancelled' ? 'Cancelled' : 'Cancel'}
        </button>
        
        {match.status !== 'finished' && (
          <div className="flex bg-black/40 border border-white/20 rounded-lg overflow-hidden items-center">
            {match.status === 'scheduled' && (
              <button 
                onClick={() => handleUpdate({ status: 'live' })}
                className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors text-brand hover:bg-white/10 border-r border-white/20"
              >
                Go Live
              </button>
            )}
            <input type="number" id={`settleScoreA-${match.id}`} placeholder="A" defaultValue={match.scoreA ?? ''} min="0" className="w-10 bg-transparent text-white font-black text-center focus:outline-none focus:bg-white/10 text-xs" />
            <div className="w-px bg-white/20"></div>
            <input type="number" id={`settleScoreB-${match.id}`} placeholder="B" defaultValue={match.scoreB ?? ''} min="0" className="w-10 bg-transparent text-white font-black text-center focus:outline-none focus:bg-white/10 text-xs" />
            {match.status === 'live' && (
              <button 
                onClick={() => {
                  const scoreAInput = document.getElementById(`settleScoreA-${match.id}`) as HTMLInputElement;
                  const scoreBInput = document.getElementById(`settleScoreB-${match.id}`) as HTMLInputElement;
                  if (!scoreAInput || !scoreBInput) return;
                  const scoreA = parseInt(scoreAInput.value);
                  const scoreB = parseInt(scoreBInput.value);
                  if (!isNaN(scoreA) && !isNaN(scoreB)) {
                    handleUpdate({ scoreA, scoreB });
                  } else {
                    showToast('Please enter both scores to update.', 'error');
                  }
                }}
                className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors bg-white/10 text-white hover:bg-white/20 border-l border-white/20"
              >
                Update
              </button>
            )}
            <button 
              onClick={() => {
                const scoreAInput = document.getElementById(`settleScoreA-${match.id}`) as HTMLInputElement;
                const scoreBInput = document.getElementById(`settleScoreB-${match.id}`) as HTMLInputElement;
                if (!scoreAInput || !scoreBInput) return;
                const scoreA = parseInt(scoreAInput.value);
                const scoreB = parseInt(scoreBInput.value);
                if (!isNaN(scoreA) && !isNaN(scoreB)) {
                  handleUpdate({ status: 'finished', scoreA, scoreB });
                } else {
                  showToast('Please enter both scores to settle.', 'error');
                }
              }}
              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors bg-white/10 text-white hover:bg-white"
            >
              Settle
            </button>
          </div>
        )}

        {match.status === 'finished' && (
          <button 
            onClick={() => handleUpdate({ status: 'scheduled', scoreA: null, scoreB: null })}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors bg-white/10 text-white hover:bg-white/20"
          >
            Revert
          </button>
        )}
      </div>
    </div>
  );
}
