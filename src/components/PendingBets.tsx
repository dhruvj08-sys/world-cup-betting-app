import { Clock, Flame } from 'lucide-react';

interface PendingBet {
  match: string;
  date: string;
  bets: Array<{ name: string; pick: string }>;
}

interface PendingBetsProps {
  bets: PendingBet[];
  variant?: 'full' | 'compact';
}

export default function PendingBets({ bets, variant = 'full' }: PendingBetsProps) {
  if (bets.length === 0) return null;

  if (variant === 'compact') {
    return (
      <section className="glass-card overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-surface-border flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-display">Upcoming Bets</h2>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {bets.map((pb, idx) => (
            <div key={idx} className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-white">{pb.match}</span>
              <div className="flex flex-wrap gap-1">
                {pb.bets.map((b, i) => (
                  <span key={i} className="text-[10px] font-bold bg-white/[0.06] px-2 py-0.5 rounded-md text-slate-300">
                    {b.name} → <span className="text-brand">{b.pick}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="glass-card overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-surface-border flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-display">Pending Bets</h2>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {bets.map((pb, idx) => (
          <div key={idx} className="px-5 py-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-sm font-bold text-white">{pb.match}</span>
              <span className="text-[10px] text-slate-500 font-medium">{new Date(pb.date).toLocaleDateString('en-HK', { month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pb.bets.map((b, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/[0.06] border border-white/10 px-2.5 py-1 rounded-lg">
                  <span className="w-5 h-5 rounded-full bg-surface-base border border-white/10 flex items-center justify-center text-[9px] font-extrabold text-slate-300">
                    {b.name.substring(0, 2).toUpperCase()}
                  </span>
                  <span className="text-white">{b.name}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-brand">{b.pick}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
