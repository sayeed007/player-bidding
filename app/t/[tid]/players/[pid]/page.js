'use client';
import Link from 'next/link';
import { use } from 'react';
import { useApi } from '@/lib/client';
import { Avatar, Empty, Stat, StatusBadge } from '@/components/ui';
import { CatChip } from '@/components/cards';
import { arr, Load, SectionTitle, price } from '../../ops';

export default function Player({ params }) {
  const { tid, pid } = use(params);
  const r = useApi(`/api/t/${tid}/players/${pid}`);
  const stats = arr(useApi(`/api/t/${tid}/stats`).data, 'players').find((s) => String(s.playerId) === String(pid));
  const teams = arr(useApi(`/api/t/${tid}/teams`).data, 'teams');
  return (
    <Load r={r}>{(d) => {
      const p = d.player || d, team = teams.find((t) => String(t._id) === String(p.teamId));
      return (
        <div className="pb-4">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:flex">
            <div className="aspect-[4/3] bg-surface2 sm:aspect-square md:aspect-auto md:h-[420px] md:w-72 md:shrink-0">
              {p.photo ? <img src={p.photo} alt={p.name} className="h-full w-full object-cover object-top" />
                : <div className="grid h-full place-items-center"><Avatar name={p.name} size={120} /></div>}
            </div>
            <div className="p-4 md:p-6">
              <h1 className="m-0">{p.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <CatChip code={p.category || '—'} className="!px-2 !py-1 !text-sm" />
                <span className="rounded-full bg-surface2 px-2.5 py-0.5 text-xs font-medium">{p.position || 'No position'}</span>
                {p.status && <StatusBadge status={p.status} />}
              </div>
              <p className="mb-0 mt-3 text-sm">
                {team ? <>Team: <Link href={`/t/${tid}/teams/${team._id}`} className="inline-flex min-h-10 items-center rounded-lg bg-surface2 px-3 font-semibold">{team.name}<span aria-hidden className="ml-2 text-primary">→</span></Link></> : <span className="text-muted">No team yet</span>}
              </p>
              {price(p.price) && <p className="m-0 mt-1 text-sm text-muted">Sold for <span className="font-semibold tabular-nums text-fg">{price(p.price)}</span></p>}
            </div>
          </div>
          <SectionTitle>Statistics</SectionTitle>
          {stats ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
              {[['Played', stats.P], ['Goals', stats.goals], ['Assists', stats.assists], ['Clean sheets', stats.cleanSheets], ['Yellow', stats.yellow], ['Red', stats.red]].map(([l, v]) => <Stat key={l} label={l} value={v} />)}
            </div>
          ) : <Empty>No match statistics yet.</Empty>}
        </div>
      );
    }}</Load>
  );
}
