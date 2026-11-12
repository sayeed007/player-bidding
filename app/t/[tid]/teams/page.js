'use client';
import Link from 'next/link';
import { use } from 'react';
import { useApi } from '@/lib/client';
import { Empty, PageHeader } from '@/components/ui';
import { TeamBadge } from '@/components/cards';
import { arr, Load } from '../ops';

export default function Teams({ params }) {
  const { tid } = use(params);
  const r = useApi(`/api/t/${tid}/teams`);
  return (
    <>
      <PageHeader title="Teams" subtitle={r.data ? `${arr(r.data, 'teams').length} participating` : 'Browse team squads'} />
      <Load r={r}>{(d) => {
        const teams = arr(d, 'teams');
        if (!teams.length) return <Empty>No teams yet.</Empty>;
        return (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => {
              const size = t.squadSize ?? t.playerCount ?? t.players?.length ?? t.squad?.length;
              const max = t.maxSquad ?? t.squadMax ?? t.squadLimit;
              return (
                <Link key={t._id} href={`/t/${tid}/teams/${t._id}`}
                  aria-label={`View ${t.name} squad`} className="group overflow-hidden rounded-2xl border border-line text-fg no-underline shadow-card transition hover:-translate-y-0.5 hover:border-primary/60 hover:no-underline"
                  style={{ background: `linear-gradient(135deg, ${t.color || 'rgb(var(--violet))'} -40%, rgb(var(--surface2)) 55%, rgb(var(--surface)) 100%)` }}>
                  <div className="p-4">
                    <TeamBadge team={t} size={64} nameClass="!overflow-visible !whitespace-normal break-words font-display text-2xl font-bold uppercase tracking-wide" className="items-center" />
                    {t.captainName && <div className="mt-2 text-sm text-white/80">Captain: {t.captainName}</div>}
                    {size != null && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted"><span>Squad</span><span className="tabular-nums">{size}{max ? ` / ${max}` : ''}</span></div>
                        {max > 0 && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full bg-primary shadow-[0_0_10px_rgb(var(--primary))]" style={{ width: `${Math.min(100, (size / max) * 100)}%` }} /></div>}
                      </div>
                    )}
                    <div className="mt-3 flex min-h-10 items-center justify-between border-t border-white/10 pt-2 text-sm font-semibold text-primary">
                      <span>View squad</span><span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        );
      }}</Load>
    </>
  );
}
