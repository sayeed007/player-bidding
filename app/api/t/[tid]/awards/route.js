import { api, body, col, fail, need, oid, audit } from '@/lib/server';
import { computeStats, suggest } from '@/lib/stats';
import { loadStats } from '@/lib/matchapi';

// Upsert one award: {type, playerId?, teamId?, note?} or {type, auto:true} (use computed suggestion) or {type, playerId:null} (remove).
export const PUT = api(async (req, { params }) => {
  const { tid } = params;
  const u = await need(['organizer'], tid);
  const b = await body(req);
  const type = String(b.type || '').trim();
  if (!/^[a-z_]{2,30}$/.test(type)) fail(400, 'invalid award type');
  const T = oid(tid), ac = await col('awards');
  let playerId = b.playerId || null;
  if (b.auto) {
    const { t, teams, players, matches } = await loadStats(tid);
    playerId = suggest(computeStats(players, teams, matches, t).players)[type]?.playerId || fail(400, 'no suggestion available for this award');
  }
  if (!playerId && !b.teamId) { await ac.deleteOne({ tournamentId: T, type }); await audit(tid, u, 'award.remove', { type }); return { ok: true }; }
  if (playerId && !(await (await col('players')).findOne({ _id: oid(playerId), tournamentId: T }))) fail(400, 'unknown player');
  const doc = { tournamentId: T, type, playerId: playerId ? oid(playerId) : null, teamId: b.teamId ? oid(b.teamId) : null, note: String(b.note || '').slice(0, 300) };
  await ac.replaceOne({ tournamentId: T, type }, doc, { upsert: true });
  await audit(tid, u, 'award.set', { type, playerId, teamId: b.teamId, auto: !!b.auto });
  return { ok: true };
});
