import { api, body, col, fail, me, needTeam, audit, oid, tour } from '@/lib/server';
import { getMatch } from '@/lib/matchapi';

// Captain/owner of that team (or staff passing teamId) sets the lineup for their side.
export const PUT = api(async (req, { params }) => {
  const { tid, mid } = params;
  const b = await body(req);
  const teamId = b.teamId || (await me())?.teamId;
  if (!teamId) fail(400, 'teamId required');
  const u = await needTeam(tid, teamId);
  const m = await getMatch(tid, mid);
  const side = String(m.homeTeamId) === String(teamId) ? 'home' : String(m.awayTeamId) === String(teamId) ? 'away' : fail(403, 'your team is not in this match');
  if (m.resultState === 'final' || ['completed', 'forfeited', 'cancelled'].includes(m.status)) fail(409, 'lineup is locked');
  const ids = [...new Set((Array.isArray(b.players) ? b.players : []).map(String))];
  const t = await tour(tid);
  if (ids.length > (t.squadSize || 99)) fail(400, `at most ${t.squadSize} players`);
  const found = ids.length ? await (await col('players')).countDocuments({ tournamentId: oid(tid), teamId: oid(teamId), _id: { $in: ids.map(oid) } }) : 0;
  if (found !== ids.length) fail(400, 'all players must belong to your squad');
  await (await col('matches')).updateOne({ _id: m._id }, { $set: { [`lineups.${side}`]: ids.map(oid) } });
  await audit(tid, u, 'match.lineup', { matchId: mid, side, count: ids.length });
  return { ok: true };
});
