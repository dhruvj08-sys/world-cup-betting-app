import { DollarSign, TrendingUp } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Standing {
  name: string;
  balance: number;
  betsPlaced: number;
  betsWon: number;
  trend: string;
}

interface PoolStandingsProps {
  standings: Standing[];
  gamesCompleted: number;
  lastUpdated: string;
  myPoolName: string | null | undefined;
}

export default function PoolStandings({ standings, gamesCompleted, lastUpdated, myPoolName }: PoolStandingsProps) {
  if (standings.length === 0) return null;

  return (
    <section className="glass-card overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-surface-border flex items-center justify-between">
        <h2 className="text-base font-extrabold uppercase tracking-wider text-white font-display flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-brand" /> Pool Standings
        </h2>
        <span className="text-[11px] text-slate-400 font-bold bg-white/5 px-2.5 py-1 rounded-full">{gamesCompleted} games · $30/bet</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {standings.map((p, idx) => {
          const isPositive = p.balance > 0;
          const isZero = p.balance === 0;
          const winRate = p.betsPlaced > 0 ? Math.round((p.betsWon / p.betsPlaced) * 100) : 0;
          const isMe = p.name === myPoolName;
          return (
            <div key={p.name} className={cn(
              "flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.02]",
              idx === 0 && "bg-brand/[0.04]",
              isMe && "bg-brand/[0.06] border-l-2 border-l-brand"
            )}>
              <span className={cn(
                "w-7 text-center text-sm font-extrabold font-display",
                idx === 0 ? "text-brand" : idx < 3 ? "text-white" : "text-slate-500"
              )}>
                {idx === 0 ? '👑' : `#${idx + 1}`}
              </span>
              <div className="w-10 h-10 rounded-full bg-surface-base border border-white/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-slate-300">{p.name.substring(0, 2).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm font-bold", isMe ? "text-brand" : "text-white")}>
                  {p.name} {isMe && <span className="text-[10px] text-brand/70">(you)</span>}
                </div>
                <div className="text-[11px] text-slate-500">
                  {p.betsWon}/{p.betsPlaced} won · {winRate}% win rate
                </div>
              </div>
              <div className="flex items-center gap-3">
                {p.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                {p.trend === 'down' && <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />}
                <div className={cn(
                  "text-xl font-extrabold font-display tabular-nums text-right min-w-[90px]",
                  isPositive ? "text-emerald-400" : isZero ? "text-slate-400" : "text-red-400"
                )}>
                  {isPositive ? '+' : isZero ? '' : '-'}${Math.abs(p.balance)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-surface-border bg-white/[0.01]">
        <div className="text-[10px] text-slate-500 font-medium">
          Updated: {new Date(lastUpdated).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium', timeStyle: 'short' })} HKT · Settle at end of tournament
        </div>
      </div>
    </section>
  );
}
