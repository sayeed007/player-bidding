'use client';
import { use, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useApi } from '@/lib/client';
import { Button, Card, Empty, PageHeader, Segmented } from '@/components/ui';
import { CatChip } from '@/components/cards';
import { Avatar } from '@/components/ui';
import Link from 'next/link';
import { arr, byId, Load, FILTER_SELECT } from '../ops';

const PAGE = 24;

export default function Players({ params }) {
  const { tid } = use(params);
  const r = useApi(`/api/t/${tid}/players`);
  const teams = arr(useApi(`/api/t/${tid}/teams`).data, 'teams');
  const [f, setF] = useState({ q: '', category: '', position: '', teamId: '' });
  const [shown, setShown] = useState(PAGE);
  const set = (k, v) => { setF({ ...f, [k]: v }); setShown(PAGE); };
  const tm = byId(teams);
  return (
    <>
      <PageHeader title="Players" subtitle="Browse registered players" />
      <Load r={r}>{(d) => {
        const all = arr(d, 'players');
        const uniq = (k) => [...new Set(all.map((p) => p[k]).filter(Boolean))].sort();
        const q = f.q.trim().toLowerCase();
        const rows = all.filter((p) => (!q || p.name?.toLowerCase().includes(q)) && (!f.category || p.category === f.category)
          && (!f.position || p.position === f.position) && (!f.teamId || String(p.teamId) === f.teamId));
        return (
          <>
            <Card className="!my-3 !p-3 md:!p-4">
              <label className="relative block">
                <span className="sr-only">Search players</span>
                <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                <input type="search" aria-label="Search players" placeholder="Search by player name" value={f.q} onChange={(e) => set('q', e.target.value)} className="!pl-10" />
              </label>
              <div className="mt-2"><Segmented value={f.category} onChange={(v) => set('category', v)}
                options={[{ value: '', label: 'All categories' }, ...uniq('category').map((c) => ({ value: c, label: `Cat ${c}` }))]} /></div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select className={FILTER_SELECT} aria-label="Position" value={f.position} onChange={(e) => set('position', e.target.value)}>
                  <option value="">All positions</option>{uniq('position').map((c) => <option key={c}>{c}</option>)}</select>
                <select className={FILTER_SELECT} aria-label="Team" value={f.teamId} onChange={(e) => set('teamId', e.target.value)}>
                  <option value="">All teams</option>{teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select>
              </div>
              <div className="mt-3 flex min-h-9 items-center justify-between gap-2 border-t border-line pt-2 text-sm">
                <p className="m-0 text-muted tabular-nums">{rows.length} {rows.length === 1 ? 'player' : 'players'}</p>
                {(f.q || f.category || f.position || f.teamId) && <Button size="sm" variant="ghost" icon={X} onClick={() => { setF({ q: '', category: '', position: '', teamId: '' }); setShown(PAGE); }}>Clear filters</Button>}
              </div>
            </Card>
            {!rows.length ? <Empty>No players match.</Empty> : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {rows.slice(0, shown).map((p) => (
                  <Link key={p._id} href={`/t/${tid}/players/${p._id}`}
                    aria-label={`View ${p.name}${p.teamId && tm[String(p.teamId)] ? `, ${tm[String(p.teamId)].name}` : ''}`} className="group overflow-hidden rounded-2xl border border-line bg-surface text-fg no-underline shadow-card transition hover:border-primary/50 hover:no-underline">
                    <div className="relative aspect-square bg-surface2">
                      {p.photo ? <img src={p.photo} alt={p.name} loading="lazy" className="h-full w-full object-cover object-top" />
                        : <div className="grid h-full place-items-center"><Avatar name={p.name} size={72} /></div>}
                      <CatChip code={p.category} className="absolute left-2 top-2" />
                    </div>
                    <div className="p-2.5">
                      <div className="truncate font-semibold">{p.name}</div>
                      <div className="truncate text-xs text-muted">{p.position || '—'}{tm[String(p.teamId)] && ` · ${tm[String(p.teamId)].name}`}</div>
                      <div className="mt-1 text-xs font-semibold text-primary">Player details <span aria-hidden>→</span></div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {rows.length > shown && <div className="mt-4 flex justify-center"><Button variant="secondary" onClick={() => setShown(shown + PAGE)}>Load more ({rows.length - shown})</Button></div>}
          </>
        );
      }}</Load>
    </>
  );
}
