import React, { useState, useEffect } from 'react';
import { format, differenceInSeconds, isPast } from 'date-fns';
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
  onPick: (id: number, sel: string) => void;
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

  useEffect(() => {
    if (isPast(parseDate(match.lockTime))) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [match.lockTime]);

  const locked = parseDate(match.lockTime) <= now;
  const isLive = locked && parseDate(match.kickoffTime) <= now && match.status !== 'finished';
  const isFinished = match.status === 'finished';

  const handlePick = (selection: string) => {
    if (locked || pick) return;
    onPick(match.id, selection);
  };

  const getPickLabel = (selection: string) => {
    if (selection === 'teamA') return match.teamA;
    if (selection === 'teamB') return match.teamB;
    if (selection === 'draw') return 'Draw';
    return '-';
  };

  const getBtnStyle = (selection: string) => {
    const isSelected = pick?.selection === selection;
    if (locked) {
      return cn(
        "py-2.5 px-3 rounded-xl font-bold text-xs transition-colors uppercase tracking-widest text-center",
        isSelected
          ? "bg-brand/10 text-white border border-brand/30 shadow-[0_0_15px_var(--color-brand-muted)]"
          : "bg-surface-base border border-transparent text-slate-500 opacity-40 cursor-not-allowed"
      );
    }
    if (pick) {
      return cn(
        "py-2.5 px-3 rounded-xl font-bold text-xs transition-colors uppercase tracking-widest text-center",
        isSelected
          ? "bg-brand text-black border border-brand shadow-[0_0_15px_var(--color-brand-muted)]"
          : "bg-surface-base border border-transparent text-slate-500 opacity-40 cursor-not-allowed"
      );
    }
    return cn(
      "py-2.5 px-3 rounded-xl font-bold text-xs transition-colors uppercase tracking-widest text-center cursor-pointer",
      "bg-surface-base hover:bg-surface-hover border border-transparent text-slate-300 hover:text-white"
    );
  };

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
    if (d > 0) countdown = `${d}d ${h}h`;
    else if (h > 0) countdown = `${h}h ${m}m`;
    else countdown = `${m}m ${s.toString().padStart(2, '0')}s`;

    return <span className={cn("flex items-center gap-1 font-mono uppercase", diffSeconds < 3600 ? "text-red-400 font-black animate-pulse" : "text-brand/80")}><Clock className="w-3 h-3" /> LOCKS IN {countdown}</span>;
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-surface-card border rounded-2xl p-3 md:p-4 flex flex-col gap-2.5 md:gap-3 group transition-all cursor-pointer backdrop-blur-sm relative overflow-hidden",
        isLive ? "border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)] opacity-100" : (locked ? "border-surface-border opacity-60" : "border-surface-border shadow-xl hover:border-surface-border")
      )}>
      {isLive && <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none"></div>}

      {/* Header */}
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className={cn("text-2xl md:text-3xl", locked ? "opacity-50" : "opacity-100")}>{match.teamAFlag}</span>
            <span className="font-display font-black text-sm sm:text-lg md:text-xl leading-tight line-clamp-2">{match.teamA}</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 w-[24%]">
          <div className="px-3 py-2.5 sm:px-5 bg-surface-base border border-surface-border rounded-xl text-xl md:text-2xl font-black text-white tabular-nums shadow-inner relative overflow-hidden flex items-center justify-center min-w-[80px] sm:min-w-[100px]">
            {locked && (isFinished || isLive) ? (
              `${match.scoreA !== null ? match.scoreA : 0} - ${match.scoreB !== null ? match.scoreB : 0}`
            ) : (
              <span className="font-mono tracking-tighter text-sm sm:text-xl">{format(parseDate(match.kickoffTime), 'HH:mm')}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 w-[38%] text-right">
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-1 sm:gap-3">
            <span className="font-display font-black text-sm sm:text-lg md:text-xl leading-tight line-clamp-2">{match.teamB}</span>
            <span className={cn("text-2xl md:text-3xl", locked ? "opacity-50" : "opacity-100")}>{match.teamBFlag}</span>
          </div>
        </div>
      </div>

      {/* Pick Buttons */}
      <div className="mt-2 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
        {!locked && !pick && (
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.1em] px-1">Pick your winner</span>
        )}
        {!locked && pick && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.1em]">Your pick</span>
            <span className="flex items-center gap-1 text-[10px] font-bold text-brand uppercase tracking-widest bg-brand/10 px-2 py-0.5 rounded-sm">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Locked in
            </span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => handlePick('teamA')} disabled={locked || !!pick} className={getBtnStyle('teamA')}>
            {match.teamA}
          </button>
          <button onClick={() => handlePick('draw')} disabled={locked || !!pick} className={getBtnStyle('draw')}>
            Draw
          </button>
          <button onClick={() => handlePick('teamB')} disabled={locked || !!pick} className={getBtnStyle('teamB')}>
            {match.teamB}
          </button>
        </div>

        {/* Result after match finishes */}
        {locked && pick && isFinished && (
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>You picked: <strong className="text-white">{getPickLabel(pick.selection)}</strong></span>
            <span className="font-semibold">
              {pick.selection === match.result
                ? <span className="text-brand bg-brand-muted px-2.5 py-1 rounded-md border border-brand/20 shadow-[0_0_10px_var(--color-brand-muted)]">+{POINTS_BY_STAGE[match.stage] || 0} pts</span>
                : <span className="text-slate-500 bg-surface-base px-2.5 py-1 rounded-md border border-surface-border">0 pts</span>
              }
            </span>
          </div>
        )}

        {/* No pick submitted */}
        {locked && !pick && (
          <div className="flex flex-col items-center justify-center pt-1 gap-1">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No pick submitted</span>
          </div>
        )}
      </div>

      {(match.poolStatus === 'excluded' || match.status === 'cancelled') && (
        <div className="mt-1 border-t border-surface-border pt-2 flex justify-center text-xs w-full">
          <span className="text-[10px] font-black uppercase text-red-500 tracking-widest">
            {match.status === 'cancelled' ? 'MATCH CANCELLED' : 'EXCLUDED FROM POOL'}
          </span>
        </div>
      )}
    </div>
  );
}

const POINTS_BY_STAGE: Record<string, number> = {
  "Group Stage": 30,
  "Round of 32": 40,
  "Round of 16": 50,
  "Quarter Finals": 80,
  "Semi Finals": 100,
  "Final": 150
};
