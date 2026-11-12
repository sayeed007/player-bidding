'use client';
import { use } from 'react';
import { Goal, HandHelping, Star } from 'lucide-react';
import { useApi } from '@/lib/client';
import { Avatar, Empty, money } from '@/components/ui';
import { PlayerTile, CatChip } from '@/components/cards';
import { arr, byId, LeaderBoard, Load, MatchCard, SectionTitle, price } from '../../ops';

export default function Team({ params }) {
  const { tid, teamId } = use(params);
  const r = useApi(`/api/t/${tid}/teams/${teamId}`);
  const mt = useApi(`/api/t/${tid}/matches`).data;
  const st = useApi(`/api/t/${tid}/standings`).data;
  const ps = arr(useApi(`/api/t/${tid}/stats`).data, 'players').filter((x) => String(x.teamId) === String(teamId));
  const teams = arr(useApi(`/api/t/${tid}/teams`).data, 'teams');
  return (
    <Load r={r}>{(d) => {
      const team = d.team || d, squad = d.squad || d.players || team.squad || [];
      const row = arr(st, 'rows').find((x) => String(x.teamId) === String(teamId));
      const matches = arr(mt, 'matches').filter((m) => [m.homeTeamId, m.awayTeamId].map(String).includes(String(teamId))).sort((a, b) => String(a.start).localeCompare(String(b.start)));
      const spend = squad.some((p) => p.price != null) ? squad.reduce((s, p) => s + (p.price || 0), 0) : null;
      const cats = [...new Set(squad.map((p) => p.category || '—'))].sort();
      const color = team.color || 'rgb(var(--primary))';
      // this team's leaders, from the same derived stats as the tournament page; value > 0 only
      const top = (k) => ps.filter((x) => x[k] > 0).sort((a, b) => b[k] - a[k] || a.name.localeCompare(b.name)).map((x) => ({ ...x, value: x[k] }));
      return (
        <div className="pb-4">
          <div className="relative overflow-hidden rounded-3xl border border-line shadow-card" style={{ background: `linear-gradient(135deg, ${color} -20%, rgb(var(--surface2)) 70%, rgb(var(--surface)) 100%)` }}>
            <div aria-hidden className="absolute -right-8 -top-8 h-40 w-40 rounded-full blur-3xl" style={{ background: color, opacity: 0.45 }} />
            <div className="relative flex items-center gap-4 p-5 md:p-8">
              <Avatar src={team.logo} name={(team.name || '').replace(/^Team\s+/i, '')} color={team.color} size={88} className="ring-2 ring-white/60" />
              <div className="min-w-0">
                <h1 className="m-0 break-words font-display text-4xl font-bold uppercase leading-none tracking-wide drop-shadow md:text-6xl">{team.name}</h1>
                <div className="mt-1.5 text-sm text-white/85">{team.ownerName && `Manager: ${team.ownerName}`}{team.ownerName && team.captainName && ' · '}{team.captainName && `Captain: ${team.captainName}`}</div>
                {spend != null && <div className="mt-1 text-sm text-white/85">Auction spend: <span className="tabular-nums">{money(spend)}</span></div>}
              </div>
            </div>
          </div>

          {row && (
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {[['Rank', row.rank], ['Played', row.P], ['W-D-L', `${row.W}-${row.D}-${row.L}`], ['Goals', `${row.GF}:${row.GA}`], ['Points', row.Pts]].map(([l, v]) => (
                <div key={l} className="grad-card rounded-2xl p-4 shadow-card">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted">{l}</div>
                  <div className="text-grad mt-1 font-display text-4xl font-bold tabular-nums">{v ?? '—'}</div>
                </div>
              ))}
            </div>
          )}

          <SectionTitle>Team leaders</SectionTitle>
          <div className="grid gap-4 md:grid-cols-3 md:gap-6">
            <LeaderBoard tid={tid} hideTeam title="Top scorers" icon={Goal} unit="Goals" rows={top('goals')} empty="No goals yet." />
            <LeaderBoard tid={tid} hideTeam title="Top assists" icon={HandHelping} unit="Assists" rows={top('assists')} empty="No assists yet." />
            <LeaderBoard tid={tid} hideTeam title="Player of the match" icon={Star} unit="Awards" rows={top('potm')} empty="No match awards yet." />
          </div>

          <SectionTitle>{`Squad (${squad.length})`}</SectionTitle>
          {!squad.length ? <Empty>No players yet.</Empty> : cats.map((c) => (
            <div key={c} className="mb-5">
              <div className="mb-2 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-widest text-muted"><CatChip code={c} />Category {c}</div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                {squad.filter((p) => (p.category || '—') === c).map((p) => (
                  <div key={p._id} className="relative">
                    <PlayerTile player={p} href={`/t/${tid}/players/${p._id}`} price={price(p.price)} />
                    {p.captain && <span className="absolute bottom-2 right-2 rounded-md bg-warning px-1.5 text-xs font-extrabold text-black">C</span>}
                  </div>
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
