import { Flame } from 'lucide-react';

interface Result {
  match: string;
  date: string;
  winners: string[];
  losers: string[];
}

interface RecentResultsProps {
  results: Result[];
  limit?: number;
  onSeeAll?: () => void;
}

export default function RecentResults({ results, limit, onSeeAll }: RecentResultsProps) {
  if (results.length === 0) return null;
  const displayed = limit ? results.slice(-limit).reverse() : results.slice().reverse();

  return (
    <section className="glass-card overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className={limit ? "w-4 h-4 text-amber-400" : "w-5 h-5 text-amber-400"} />
          <h2 className={limit ? "text-sm font-extrabold uppercase tracking-wider text-white font-display" : "text-base font-extrabold uppercase tracking-wider text-white font-display"}>
            {limit ? 'Recent Results' : 'Match Results & Bets'}
          </h2>
        </div>
        {onSeeAll && (
          <button onClick={onSeeAll} className="text-[10px] font-bold text-brand hover:text-brand-hover uppercase tracking-widest transition-colors">
            See all →
          </button>
        )}
      </div>
      <div className="divide-y divide-white/[0.04]">
        {displayed.map((r, idx) => (
          <div key={idx} className={limit ? "px-5 py-3" : "px-5 py-4"}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={limit ? "text-sm font-bold text-white" : "text-base font-bold text-white"}>{r.match}</span>
              <span className="text-[10px] text-slate-500 font-medium">
                {new Date(r.date).toLocaleDateString('en-HK', limit ? { month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {r.winners.map((w, i) => (
                <span key={`w${i}`} className={limit
                  ? "text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md"
                  : "text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-1 rounded-lg"
                }>{w}</span>
              ))}
              {r.losers.map((l, i) => (
                <span key={`l${i}`} className={limit
                  ? "text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md"
                  : "text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/15 px-2.5 py-1 rounded-lg"
                }>{l}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
