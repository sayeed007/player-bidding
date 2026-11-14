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
  // Squad-builder payload (optional): positions [{playerId, x, y}] in % of the pitch, plus formation + size. Plain `players` still works.
  const pos = (Array.isArray(b.positions) ? b.positions : []).filter((p) => p && p.playerId);
  const ids = [...new Set((Array.isArray(b.players) ? b.players : pos.map((p) => p.playerId)).map(String))];
  const size = b.size == null ? null : Number(b.size);
  if (size != null && !(Number.isInteger(size) && size >= 1 && size <= 11)) fail(400, 'pitch size must be 1 to 11');
  const t = await tour(tid);
  if (ids.length > (size || t.squadSize || 99)) fail(400, `at most ${size || t.squadSize} players on the pitch`);
  const found = ids.length ? await (await col('players')).countDocuments({ tournamentId: oid(tid), teamId: oid(teamId), _id: { $in: ids.map(oid) } }) : 0;
  if (found !== ids.length) fail(400, 'all players must belong to your squad');
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  const set = { [`lineups.${side}`]: ids.map(oid) };
  if (pos.length || b.formation) {
    set[`lineupMeta.${side}`] = {
      formation: String(b.formation || '').slice(0, 20), size: size || ids.length,
      positions: pos.filter((p) => ids.includes(String(p.playerId))).map((p) => ({ playerId: String(p.playerId), x: clamp(p.x), y: clamp(p.y), gk: !!p.gk })),
    };
  } else set[`lineupMeta.${side}`] = null; // plain list: drop any older formation
  await (await col('matches')).updateOne({ _id: m._id }, { $set: set });
  await audit(tid, u, 'match.lineup', { matchId: mid, side, count: ids.length });
  return { ok: true };
});
