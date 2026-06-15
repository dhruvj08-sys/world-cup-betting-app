import React, { useState, useEffect } from 'react';
import { format, differenceInSeconds, isPast } from 'date-fns';
import { Lock, Clock, Pin, Check, X, Minus } from 'lucide-react';
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
  compact?: boolean;
  isGoalFlash?: boolean;
}

const POINTS_BY_STAGE: Record<string, number> = {
  "Group Stage": 30,
  "Round of 32": 40,
  "Round of 16": 50,
  "Quarter Finals": 80,
  "Semi Finals": 100,
  "Final": 150
};

export default function MatchCard({ match, pick, onPick, onClick, isPinned, onTogglePin, compact, isGoalFlash }: MatchCardProps) {
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
    if (isPast(parseDate(match.lockTime)) && match.status !== 'live') return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [match.lockTime, match.status]);

  const locked = parseDate(match.lockTime) <= now;
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const isCorrect = isFinished && pick && pick.selection === match.result;
  const isWrong = isFinished && pick && pick.selection !== match.result;

  const handlePick = (selection: string) => {
    if (locked) return;
    if (pick && pick.selection === selection) return;
    onPick(match.id, selection);
  };

  const getPickLabel = (selection: string) => {
    if (selection === 'teamA') return match.teamA;
    if (selection === 'teamB') return match.teamB;
    if (selection === 'draw') return 'Draw';
    return '-';
  };

  const lockDate = parseDate(match.lockTime);
  const diffSeconds = differenceInSeconds(lockDate, now);

  const getCountdown = () => {
    if (locked) return null;
    const d = Math.floor(diffSeconds / 86400);
    const h = Math.floor((diffSeconds % 86400) / 3600);
    const m = Math.floor((diffSeconds % 3600) / 60);
    const s = diffSeconds % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const cardStateClass = isLive
    ? "match-live live-pulse"
    : isFinished
      ? "match-finished"
      : locked
        ? "match-locked"
        : "match-upcoming";

  const getBtnStyle = (selection: string) => {
    const isSelected = pick?.selection === selection;
    const base = "relative py-3 px-4 rounded-xl font-bold text-sm transition-all duration-150 text-center";

    if (locked) {
      if (isSelected) {
        const resultClass = isFinished
          ? (isCorrect
            ? "bg-emerald-500/20 text-emerald-300 border-2 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
            : "bg-red-500/15 text-red-300 border-2 border-red-500/30")
          : "bg-brand/15 text-brand border-2 border-brand/40 shadow-[0_0_15px_var(--color-brand-muted)]";
        return cn(base, resultClass);
      }
      return cn(base, "bg-white/[0.03] border-2 border-white/5 text-slate-500 cursor-not-allowed");
    }
    if (pick) {
      return cn(base, isSelected
        ? "bg-brand/20 text-brand border-2 border-brand/50 shadow-[0_0_24px_var(--color-brand-muted)] scale-[1.02]"
        : "bg-white/[0.06] hover:bg-white/10 border-2 border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-200 cursor-pointer hover:scale-[1.02] active:scale-[0.97]"
      );
    }
    return cn(base, "bg-white/[0.06] hover:bg-brand/15 border-2 border-white/10 hover:border-brand/40 text-slate-200 hover:text-brand cursor-pointer hover:scale-[1.02] active:scale-[0.97]");
  };

  // Compute elapsed match minute for live games
  const getMatchMinute = () => {
    if (!isLive) return null;
    const kickoff = parseDate(match.kickoffTime);
    const elapsed = Math.floor((now.getTime() - kickoff.getTime()) / 60000);
    if (elapsed < 0) return null;
    if (elapsed <= 45) return `${elapsed}'`;
    if (elapsed <= 60) return '45+';
    if (elapsed <= 105) return `${elapsed - 15}'`;
    return '90+';
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl relative overflow-hidden flex flex-col transition-all cursor-pointer group border",
        compact ? "p-4 gap-3" : "p-5 md:p-6 gap-4",
        cardStateClass,
        isGoalFlash && "goal-flash"
      )}
    >
      {/* Header Row */}
      <div className="flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {format(parseDate(match.kickoffTime), 'MMM d')} · {match.stage}{match.groupName ? ` · ${match.groupName}` : ''}
          </span>
          {onTogglePin && (
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePin(match.id); }}
              className="hover:text-white transition-colors"
            >
              <Pin className={cn("w-3.5 h-3.5", isPinned ? "text-brand fill-brand" : "text-slate-600")} />
            </button>
          )}
        </div>

        {/* Status Badge */}
        {isLive ? (
          <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-red-400 bg-red-500/20 px-3 py-1.5 rounded-full border border-red-500/30">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> LIVE
          </span>
        ) : isFinished ? (
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-white/5 px-3 py-1.5 rounded-full">
            FT
          </span>
        ) : locked ? (
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
            <Lock className="w-3 h-3" /> Locked
          </span>
        ) : (
          <span className={cn(
            "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider font-mono px-3 py-1.5 rounded-full",
            diffSeconds < 3600
              ? "text-red-400 bg-red-500/15 border border-red-500/25 animate-pulse"
              : diffSeconds < 86400
                ? "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                : "text-brand bg-brand/10 border border-brand/20"
          )}>
            <Clock className="w-3 h-3" />
            {getCountdown()}
          </span>
        )}
      </div>

      {/* Teams + Score */}
      <div className="flex items-center justify-between relative z-10 py-1">
        {/* Team A */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={cn("text-3xl md:text-4xl shrink-0", isFinished && !isLive ? "grayscale-[20%]" : "")}>{match.teamAFlag}</span>
          <span className={cn(
            "font-display font-extrabold text-base md:text-lg leading-tight truncate",
            pick?.selection === 'teamA' && !locked ? "text-brand" :
            isFinished ? "text-slate-300" : "text-white"
          )}>
            {match.teamA}
          </span>
        </div>

        {/* Score / Time */}
        <div className="flex items-center justify-center shrink-0 mx-4">
          <div className={cn(
            "relative px-5 py-3 rounded-2xl font-display font-extrabold tabular-nums flex items-center justify-center min-w-[90px]",
            isLive
              ? "text-3xl md:text-4xl text-white bg-red-500/15 border-2 border-red-500/30"
              : isFinished
                ? "text-2xl md:text-3xl text-white bg-white/[0.06] border border-white/10"
                : "text-lg md:text-xl text-slate-300 bg-white/[0.04] border border-white/8"
          )}>
            {locked && (isFinished || isLive) ? (
              <>
                <span className={cn(isLive && "score-pulse")}>{match.scoreA ?? 0}</span>
                <span className="text-slate-500 mx-2.5">:</span>
                <span className={cn(isLive && "score-pulse")}>{match.scoreB ?? 0}</span>
              </>
            ) : (
              <span className="font-mono text-base text-white">{format(parseDate(match.kickoffTime), 'HH:mm')}</span>
            )}
          {isLive && getMatchMinute() && (
            <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full border border-red-500/25">
              {getMatchMinute()}
            </span>
          )}
          </div>
        </div>

        {/* Team B */}
        <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
          <span className={cn(
            "font-display font-extrabold text-base md:text-lg leading-tight truncate text-right",
            pick?.selection === 'teamB' && !locked ? "text-brand" :
            isFinished ? "text-slate-300" : "text-white"
          )}>
            {match.teamB}
          </span>
          <span className={cn("text-3xl md:text-4xl shrink-0", isFinished && !isLive ? "grayscale-[20%]" : "")}>{match.teamBFlag}</span>
        </div>
      </div>

      {/* Pick Controls */}
      <div className="relative z-10 flex flex-col gap-2.5" onClick={e => e.stopPropagation()}>
        {!locked && !pick && (
          <span className="text-[11px] font-semibold text-slate-400 tracking-wide px-0.5">Pick your winner</span>
        )}
        {!locked && pick && (
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-semibold text-slate-400 tracking-wide">Your pick · <span className="text-brand">tap to change</span></span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => handlePick('teamA')} disabled={locked} className={getBtnStyle('teamA')}>
            {match.teamA}
          </button>
          <button onClick={() => handlePick('draw')} disabled={locked} className={getBtnStyle('draw')}>
            Draw
          </button>
          <button onClick={() => handlePick('teamB')} disabled={locked} className={getBtnStyle('teamB')}>
            {match.teamB}
          </button>
        </div>

        {/* Result Outcome */}
        {isFinished && pick && (
          <div className={cn(
            "flex items-center justify-between rounded-xl px-4 py-3 mt-1",
            isCorrect
              ? "bg-emerald-500/15 border border-emerald-500/30"
              : "bg-red-500/8 border border-red-500/15"
          )}>
            <span className="flex items-center gap-2 text-sm text-slate-300">
              {isCorrect ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <X className="w-4 h-4 text-red-400" />
              )}
              <span>Picked <strong className="text-white">{getPickLabel(pick.selection)}</strong></span>
            </span>
            <span className={cn(
              "text-sm font-extrabold tabular-nums",
              isCorrect ? "text-emerald-400" : "text-slate-600"
            )}>
              {isCorrect ? `+${POINTS_BY_STAGE[match.stage] || 0} pts` : '0 pts'}
            </span>
          </div>
        )}

        {isFinished && !pick && (
          <div className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 mt-1 bg-amber-500/8 border border-amber-500/15">
            <Minus className="w-3.5 h-3.5 text-amber-500/70" />
            <span className="text-[11px] font-bold uppercase text-amber-500/70 tracking-wider">No pick submitted</span>
          </div>
        )}

        {locked && !isFinished && !isLive && !pick && (
          <div className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 mt-1 bg-white/[0.03] border border-white/8">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">No pick submitted</span>
          </div>
        )}
      </div>

      {(match.poolStatus === 'excluded' || match.status === 'cancelled') && (
        <div className="mt-1 border-t border-white/8 pt-3 flex justify-center text-xs w-full relative z-10">
          <span className="text-[11px] font-bold uppercase text-red-500/80 tracking-widest">
            {match.status === 'cancelled' ? 'MATCH CANCELLED' : 'EXCLUDED FROM POOL'}
          </span>
        </div>
      )}
    </div>
  );
}
