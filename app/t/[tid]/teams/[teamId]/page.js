'use client';
import { use } from 'react';
import { useApi } from '@/lib/client';
import { Avatar, Empty, Stat, money } from '@/components/ui';
import { PlayerCard } from '@/components/cards';
import { arr, byId, Load, MatchCard, SectionTitle, price } from '../../ops';

export default function Team({ params }) {
  const { tid, teamId } = use(params);
  const r = useApi(`/api/t/${tid}/teams/${teamId}`);
  const mt = useApi(`/api/t/${tid}/matches`).data;
  const st = useApi(`/api/t/${tid}/standings`).data;
  const teams = arr(useApi(`/api/t/${tid}/teams`).data, 'teams');
  return (
    <Load r={r}>{(d) => {
      const team = d.team || d, squad = d.squad || d.players || team.squad || [];
      const row = arr(st, 'rows').find((x) => String(x.teamId) === String(teamId));
      const matches = arr(mt, 'matches').filter((m) => [m.homeTeamId, m.awayTeamId].map(String).includes(String(teamId))).sort((a, b) => String(a.start).localeCompare(String(b.start)));
      const spend = squad.some((p) => p.price != null) ? squad.reduce((s, p) => s + (p.price || 0), 0) : null;
      const cats = [...new Set(squad.map((p) => p.category || '—'))].sort();
      const color = team.color || 'rgb(var(--primary))';
      return (
        <div className="pb-4">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="h-2" style={{ background: color }} />
            <div className="flex items-center gap-4 p-4 md:p-6">
              <Avatar src={team.logo} name={(team.name || '').replace(/^Team\s+/i, '')} color={team.color} size={72} />
              <div className="min-w-0">
                <h1 className="m-0 truncate">{team.name}</h1>
                <div className="text-sm text-muted">{team.ownerName && `Manager: ${team.ownerName}`}{team.ownerName && team.captainName && ' · '}{team.captainName && `Captain: ${team.captainName}`}</div>
                {spend != null && <div className="mt-1 text-sm text-muted">Auction spend: <span className="tabular-nums">{money(spend)}</span></div>}
              </div>
            </div>
          </div>

          {row && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {[['Rank', row.rank], ['Played', row.P], ['W-D-L', `${row.W}-${row.D}-${row.L}`], ['Goals', `${row.GF}:${row.GA}`], ['Points', row.Pts]].map(([l, v]) => <Stat key={l} label={l} value={v} />)}
            </div>
          )}

          <SectionTitle>{`Squad (${squad.length})`}</SectionTitle>
          {!squad.length ? <Empty>No players yet.</Empty> : cats.map((c) => (
            <div key={c} className="mb-3">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Category {c}</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {squad.filter((p) => (p.category || '—') === c).map((p) => (
                  <PlayerCard key={p._id} player={p} href={`/t/${tid}/players/${p._id}`} price={price(p.price)}
                    right={p.captain ? <span className="rounded-md bg-accent/20 px-1.5 text-xs font-bold text-warning">C</span> : null} />
                ))}
              </div>
            </div>
          ))}

          <SectionTitle href={`/t/${tid}/fixtures`}>Fixtures & results</SectionTitle>
          {matches.length ? <div className="grid gap-3 md:grid-cols-2">{matches.map((m) => <MatchCard key={m._id} tid={tid} m={m} teams={byId(teams)} />)}</div> : <Empty>No fixtures published.</Empty>}
        </div>
      );
    }}</Load>
  );
}
