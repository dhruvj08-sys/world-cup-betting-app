import React, { useState, useEffect } from 'react';
import { format, formatDistanceToNow, isPast, differenceInSeconds } from 'date-fns';
import { Lock, Clock, Pin } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Match, Pick } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MatchCardProps {
  key?: React.Key;
  match: Match;
  pick: Pick | undefined;
  onPick: (id: number, sel: string, scoreA?: number, scoreB?: number) => void;
  onClick?: () => void;
  isPinned?: boolean;
  onTogglePin?: (id: number) => void;
}

export default function MatchCard({ match, pick, onPick, onClick, isPinned, onTogglePin }: MatchCardProps) {
  const parseDate = (d: any) => {
    if (typeof d === 'string') {
      let clean = d.replace(' ', 'T');
      if (!clean.includes('T') && !clean.includes('Z')) clean += 'Z';
      return new Date(clean);
    }
    return new Date(d);
  };
  const [now, setNow] = useState(new Date());
  
  // Local state for score inputs
  const [scoreA, setScoreA] = useState<string>(pick?.predictedScoreA?.toString() || '');
  const [scoreB, setScoreB] = useState<string>(pick?.predictedScoreB?.toString() || '');
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    // Only update every second if the match is not locked yet
    if (isPast(parseDate(match.lockTime))) return;
    
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [match.lockTime]);

  const locked = parseDate(match.lockTime) <= now;
  const isLive = locked && parseDate(match.kickoffTime) <= now && match.status !== 'finished';
  const isFinished = match.status === 'finished';
  
  const handleScoreSubmit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (locked) return;
    
    const sA = parseInt(scoreA);
    const sB = parseInt(scoreB);
    
    if (isNaN(sA) || isNaN(sB)) return;
    
    let selection = 'draw';
    if (sA > sB) selection = 'teamA';
    if (sB > sA) selection = 'teamB';
    
    onPick(match.id, selection, sA, sB);
    
    // Subtle saved animation
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const getBtnStyle = (selection: string) => {
    const isSelected = pick?.selection === selection;
    if (locked) {
      return cn(
        "py-2 rounded font-bold text-[10px] md:text-xs transition-colors uppercase tracking-widest relative overflow-hidden",
        isSelected 
          ? "bg-brand/10 text-white border border-brand/30 shadow-[0_0_15px_var(--color-brand-muted)]" 
          : "bg-surface-base border border-transparent text-slate-500 opacity-40 cursor-not-allowed"
      );
    }

    return cn(
      "py-2 rounded font-bold text-[10px] md:text-xs transition-colors uppercase tracking-widest relative overflow-hidden flex flex-col justify-center items-center gap-0.5",
      isSelected 
        ? "bg-brand text-black border border-brand shadow-[0_0_15px_var(--color-brand-muted)]" 
        : "bg-surface-base hover:bg-surface-hover border border-transparent text-slate-300"
    );
  };

  // Convert selection enum back to user-readable (team names) or 'Draw'
  const getPickLabel = (selection: string) => {
    if (selection === 'teamA') return match.teamA;
    if (selection === 'teamB') return match.teamB;
    if (selection === 'draw') return 'Draw';
    return '-';
  }
  
  // Generating deterministic mock odds based on match.id so they remain constant for a match
  const oddA = `+${(match.id * 13 % 150) + 110}`;
  const oddB = `-${(match.id * 7 % 150) + 110}`;
  
  // Calculate canonical formatted lock time
  const getLockTimeDisplay = () => {
    const lockDate = parseDate(match.lockTime);
    const diffSeconds = differenceInSeconds(lockDate, now);
    
    if (locked) {
      if (isFinished) return <span className="flex items-center gap-1.5 text-slate-500"><Lock className="w-3 h-3" /> FT</span>;
      if (isLive) return <span className="flex items-center gap-1.5 text-red-500 animate-pulse"><Clock className="w-3 h-3" /> LIVE</span>;
      return <span className="flex items-center gap-1.5 text-slate-500"><Lock className="w-3 h-3" /> Locked</span>;
    }

    const d = Math.floor(diffSeconds / 86400);
    const h = Math.floor((diffSeconds % 86400) / 3600);
    const m = Math.floor((diffSeconds % 3600) / 60);
    const s = diffSeconds % 60;
    
    let countdown = "";
    if (d > 0) {
      countdown = `${d}d ${h}h`;
    } else if (h > 0) {
      countdown = `${h}h ${m}m`;
    } else {
      countdown = `${m}m ${s.toString().padStart(2, '0')}s`;
    }

    return <span className={cn("flex items-center gap-1 font-mono uppercase", diffSeconds < 3600 ? "text-red-400 font-black animate-pulse" : "text-brand/80")}><Clock className="w-3 h-3" /> LOCKS IN {countdown}</span>;
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
      "bg-surface-card border rounded-2xl p-5 flex flex-col gap-4 group transition-all cursor-pointer hover:border-surface-border backdrop-blur-sm",
      locked ? "border-surface-border opacity-60" : "border-surface-border shadow-xl"
    )}>
      {/* Header tags */}
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <div className="flex items-center gap-2">
          <span>{match.stage} {match.groupName ? `- ${match.groupName}` : ''}</span>
          {onTogglePin && (
            <button 
              onClick={(e) => { e.stopPropagation(); onTogglePin(match.id); }}
              className="hover:text-white transition-colors"
            >
              <Pin className={cn("w-3 h-3", isPinned ? "text-white fill-white" : "")} />
            </button>
          )}
        </div>
        {getLockTimeDisplay()}
      </div>

      {/* Matchup */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex flex-col gap-1 w-[38%]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className={cn("text-3xl", locked ? "opacity-50" : "opacity-100")}>{match.teamAFlag}</span>
            <span className="font-display font-black text-base sm:text-lg md:text-xl leading-tight line-clamp-2">{match.teamA}</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-500 sm:pl-11">{oddA}</span>
        </div>
        
        <div className="flex flex-col items-center gap-1 w-[24%]">
          <div className="px-3 py-2.5 sm:px-5 bg-surface-base border border-surface-border rounded-xl text-xl md:text-2xl font-black text-white tabular-nums shadow-inner relative overflow-hidden flex items-center justify-center min-w-[80px] sm:min-w-[100px]">
             {locked && (isFinished || isLive) ? (
               match.status === 'live' ? (
                 <div className="flex flex-col items-center">
                   <span className="text-[10px] text-brand animate-pulse uppercase tracking-widest leading-none mb-1">LIVE</span>
                   <span className="leading-none">{match.scoreA || 0} - {match.scoreB || 0}</span>
                 </div>
               ) : `${match.scoreA !== null ? match.scoreA : 0} - ${match.scoreB !== null ? match.scoreB : 0}`
             ) : (
               <span className="font-mono tracking-tighter text-sm sm:text-xl">{format(parseDate(match.kickoffTime), 'HH:mm')}</span>
             )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1 w-[38%] text-right">
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 sm:gap-3">
            <span className="font-display font-black text-base sm:text-lg md:text-xl leading-tight line-clamp-2">{match.teamB}</span>
            <span className={cn("text-3xl", locked ? "opacity-50" : "opacity-100")}>{match.teamBFlag}</span>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-500 sm:pr-11">{oddB}</span>
        </div>
      </div>

      {/* Action Area */}
      {!locked ? (
        <div className="mt-3 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center px-1">
             <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.1em]">Predict Final Score</span>
             {pick && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-brand uppercase tracking-widest bg-brand/10 px-2 py-0.5 rounded-sm">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Picked
                </span>
             )}
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("flex flex-1 items-center border rounded-xl overflow-hidden transition-all", pick ? "bg-surface-base/50 border-surface-border/50" : "bg-surface-base border-surface-border focus-within:border-brand/50 focus-within:ring-1 focus-within:ring-brand/50")}>
              <input 
                type="number" 
                min="0"
                max="99"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                disabled={!!pick}
                className="w-full bg-transparent text-center text-sm md:text-base font-black text-white p-3 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="0"
              />
              <div className="w-px h-8 bg-surface-border shrink-0"></div>
              <input 
                type="number" 
                min="0"
                max="99"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                disabled={!!pick}
                className="w-full bg-transparent text-center text-sm md:text-base font-black text-white p-3 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="0"
              />
            </div>
            {!pick && (
              <button 
                onClick={handleScoreSubmit} 
                disabled={!scoreA || !scoreB}
                className="h-[52px] px-6 bg-brand hover:bg-brand-hover text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden flex items-center justify-center shrink-0"
              >
                {showSaved ? (
                  <span className="animate-in zoom-in duration-200">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </span>
                ) : (
                  <span>LOCK IN</span>
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {pick ? (
            <div className="mt-4 border-t border-surface-border pt-4 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 w-full gap-2">
               <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand"></span> Your prediction: <strong className="text-white ml-1 font-mono">{pick.predictedScoreA ?? '-'} : {pick.predictedScoreB ?? '-'}</strong>
               </div>
               {match.status === 'finished' && 
                 <div className="font-semibold text-right">
                   {(pick.predictedScoreA === match.scoreA && pick.predictedScoreB === match.scoreB) ? <span className="text-brand bg-brand-muted px-2.5 py-1 rounded-md border border-brand/20 shadow-[0_0_10px_var(--color-brand-muted)]">+5 pts</span> : (pick.selection === match.result ? <span className="text-brand/80 bg-brand-muted px-2.5 py-1 rounded-md border border-brand/10">+2 pts</span> : <span className="text-slate-500 bg-surface-base px-2.5 py-1 rounded-md border border-surface-border">0 pts</span>)}
                 </div>
               }
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center mt-3 border-t border-surface-border pt-3 gap-1">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Pick Window Closed</span>
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">No pick was submitted</span>
            </div>
          )}
          
          {(match.poolStatus === 'excluded' || match.status === 'cancelled') && (
            <div className="mt-3 border-t border-surface-border pt-3 flex justify-center text-xs w-full">
              <span className="text-[10px] font-black uppercase text-red-500 tracking-widest">
                {match.status === 'cancelled' ? 'MATCH CANCELLED' : 'EXCLUDED FROM POOL'}
              </span>
            </div>
          )}

          {(isFinished || isLive) && (
            <div className="mt-4 pt-3 border-t border-surface-border grid grid-cols-3 gap-2 text-center text-[10px] font-medium text-slate-500">
               <div>
                  <div className="font-mono text-white mb-0.5">{40 + (match.id * 17 % 20)}% <span className="opacity-40">-</span> {60 - (match.id * 17 % 20)}%</div>
                  <div className="uppercase tracking-widest text-[8px]">Possession</div>
               </div>
               <div>
                  <div className="font-mono text-white mb-0.5">{(match.scoreA || 0) + (match.id % 3)} <span className="opacity-40">-</span> {(match.scoreB || 0) + (match.id % 4)}</div>
                  <div className="uppercase tracking-widest text-[8px]">Shots on Target</div>
               </div>
               <div>
                  <div className="font-mono text-white mb-0.5">{(match.id * 2 % 5) + 1} <span className="opacity-40">-</span> {(match.id * 3 % 4) + 1}</div>
                  <div className="uppercase tracking-widest text-[8px]">Corners</div>
               </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
