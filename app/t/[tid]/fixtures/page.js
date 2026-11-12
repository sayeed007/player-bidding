'use client';
import { use, useState } from 'react';
import { useApi } from '@/lib/client';
import { Button, Card, Empty, PageHeader } from '@/components/ui';
import { arr, byId, Load, MatchCard, FILTER_SELECT, label } from '../ops';

export default function Fixtures({ params }) {
  const { tid } = use(params);
  const r = useApi(`/api/t/${tid}/matches`, { poll: 30000 });
  const teams = arr(useApi(`/api/t/${tid}/teams`).data, 'teams');
  const [team, setTeam] = useState('');
  return (
    <>
      <PageHeader title="Fixtures & results" subtitle="Published schedule and completed scores" />
      <Load r={r}>{(d) => {
        const all = [...arr(d, 'matches')].sort((a, b) => String(a.start).localeCompare(String(b.start)));
        const names = new Map(all.flatMap((m) => [[String(m.homeTeamId), m.homeName], [String(m.awayTeamId), m.awayName]]));
        const list = all.filter((m) => !team || [m.homeTeamId, m.awayTeamId].map(String).includes(team));
        const groups = new Map();
        for (const m of list) {
          const k = m.label || `${label(m.stage)}${m.round ? ` – round ${m.round}` : ''}${m.group ? ` (group ${m.group})` : ''}`;
          groups.set(k, [...(groups.get(k) || []), m]);
        }
        const tm = byId(teams);
        return (
          <>
            <Card className="!my-3 !p-3 sm:flex sm:items-center sm:gap-3">
              <label className="grid flex-1 gap-1 text-xs font-medium text-muted">Show matches for
                <select className={FILTER_SELECT} value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Filter by team">
                  <option value="">All teams</option>
                  {[...names].filter(([, n]) => n).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                </select>
              </label>
              <div className="mt-2 flex min-h-10 items-center justify-between gap-3 text-sm sm:mt-5 sm:w-40">
                <span className="text-muted tabular-nums">{list.length} matches</span>
                {team && <Button size="sm" variant="ghost" onClick={() => setTeam('')}>Clear</Button>}
              </div>
            </Card>
            {!list.length && <div className="mt-3"><Empty>No fixtures published yet.</Empty></div>}
            {[...groups].map(([k, ms]) => (
              <section key={k} className="mt-5">
                <h2 className="mb-3 mt-0 flex items-center justify-between gap-3 font-display text-base tracking-widest text-fg"><span className="flex items-center gap-2"><span aria-hidden className="h-4 w-1.5 rounded-full bg-accent shadow-[0_0_12px_rgb(var(--accent))]" />{k}</span><span className="rounded-full bg-surface2 px-2.5 py-1 font-sans text-xs tabular-nums text-muted">{ms.length}</span></h2>
                <div className="grid gap-3 md:grid-cols-2">{ms.map((m) => <MatchCard key={m._id} tid={tid} m={m} teams={tm} />)}</div>
              </section>
            ))}
          </>
        );
      }}</Load>
    </>
  );
}
