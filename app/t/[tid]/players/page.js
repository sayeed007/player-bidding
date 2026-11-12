'use client';
import { use, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useApi } from '@/lib/client';
import { Button, Card, Empty, PageHeader } from '@/components/ui';
import { PlayerTile, CAT } from '@/components/cards';
import clsx from 'clsx';
import { price } from '../ops';
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
              <div role="group" aria-label="Category" className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[['', 'All'], ...uniq('category').map((c) => [c, `Cat ${c}`])].map(([v, l]) => {
                  const on = f.category === v;
                  return (
                    <button key={v || 'all'} type="button" aria-pressed={on} onClick={() => set('category', v)}
                      className={clsx('!min-h-[44px] shrink-0 !rounded-full !px-4 font-display uppercase tracking-wider', on ? 'glow-primary' : '!bg-surface2 !text-muted !shadow-none hover:!text-fg')}
                      style={on && v ? { background: `linear-gradient(135deg, ${(CAT[v] || CAT.D).from}, ${(CAT[v] || CAT.D).to})`, color: '#fff', boxShadow: `0 0 20px -4px ${(CAT[v] || CAT.D).from}` } : undefined}>{l}</button>
                  );
                })}
              </div>
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
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                {rows.slice(0, shown).map((p) => (
                  <PlayerTile key={p._id} player={p} team={tm[String(p.teamId)]} price={price(p.price)} href={`/t/${tid}/players/${p._id}`} />
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
