import { api, col, oid } from '@/lib/server';
import { computeStats, top, suggest } from '@/lib/stats';
import { loadStats } from '@/lib/matchapi';

export const dynamic = 'force-dynamic';

export const GET = api(async (req, { params }) => {
  const { tid } = params;
  const { t, teams, players, matches } = await loadStats(tid);
  const { players: ps } = computeStats(players, teams, matches, t);
  const names = new Map(ps.map((p) => [p.playerId, p]));
  const aw = await (await col('awards')).find({ tournamentId: oid(tid) }).toArray();
  return {
    scorers: top(ps, 'goals'), assists: top(ps, 'assists'), cleanSheets: top(ps, 'cleanSheets'), potm: top(ps, 'potm'),
    awards: aw.map((a) => ({ type: a.type, playerId: a.playerId && String(a.playerId), teamId: a.teamId && String(a.teamId), name: names.get(String(a.playerId))?.name || teams.find((x) => String(x._id) === String(a.teamId))?.name, teamName: names.get(String(a.playerId))?.teamName, note: a.note })),
    suggestions: suggest(ps),
  };
});
