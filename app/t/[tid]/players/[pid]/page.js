'use client';
import Link from 'next/link';
import { use } from 'react';
import { useApi } from '@/lib/client';
import { Empty, StatusBadge } from '@/components/ui';
import { CatChip, PlayerPhoto, catOf } from '@/components/cards';
import { arr, Load, SectionTitle, price } from '../../ops';

export default function Player({ params }) {
  const { tid, pid } = use(params);
  const r = useApi(`/api/t/${tid}/players/${pid}`);
  const stats = arr(useApi(`/api/t/${tid}/stats`).data, 'players').find((s) => String(s.playerId) === String(pid));
  const teams = arr(useApi(`/api/t/${tid}/teams`).data, 'teams');
  return (
    <Load r={r}>{(d) => {
      const p = d.player || d, team = teams.find((t) => String(t._id) === String(p.teamId));
      const c = catOf(p.category);
      return (
        <div className="pb-4">
          <PlayerPhoto player={p} size="xl" className="!rounded-3xl md:!aspect-[16/9]">
            <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
              <CatChip code={p.category || '—'} className="!px-3 !py-1 !text-base" />
              {p.status && <StatusBadge status={p.status} />}
            </div>
            {price(p.price) && (
              <div className="absolute right-4 top-4 rounded-xl bg-black/60 px-3 py-1.5 text-right backdrop-blur">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Sold for</div>
                <div className="neon-text font-display text-2xl font-bold tabular-nums">{price(p.price)}</div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
              <h1 className="m-0 break-words font-display text-5xl font-bold uppercase leading-none tracking-wide drop-shadow-lg md:text-7xl">{p.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/90">
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold uppercase tracking-wider backdrop-blur">{p.position || 'No position'}</span>
                {team
                  ? <Link href={`/t/${tid}/teams/${team._id}`} className="inline-flex min-h-[44px] items-center rounded-full bg-black/50 px-4 font-semibold text-white backdrop-blur hover:no-underline" style={{ boxShadow: `0 0 0 2px ${team.color || c.from}` }}>{team.name}<span aria-hidden className="ml-2">→</span></Link>
                  : <span className="text-white/70">No team yet</span>}
              </div>
            </div>
          </PlayerPhoto>
          <SectionTitle>Statistics</SectionTitle>
          {stats ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-6">
              {[['Played', stats.P], ['Goals', stats.goals], ['Assists', stats.assists], ['Clean sheets', stats.cleanSheets], ['Yellow', stats.yellow], ['Red', stats.red]].map(([l, v]) => (
                <div key={l} className="grad-card rounded-2xl p-4 shadow-card">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted">{l}</div>
                  <div className="text-grad mt-1 font-display text-5xl font-bold tabular-nums">{v ?? 0}</div>
                </div>
              ))}
            </div>
          ) : <Empty>No match statistics yet.</Empty>}
        </div>
      );
    }}</Load>
  );
}
