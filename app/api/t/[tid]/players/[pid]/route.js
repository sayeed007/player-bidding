import { api, col, body, need, tour, oid, fail, audit } from '@/lib/server';
import { playerDoc, flatPlayer, statusIndex, PLAYER_PUBLIC } from '@/lib/setup';
import { viewer, shapePlayer } from '@/lib/setup-server';

export const dynamic = 'force-dynamic';

async function load(t, pid) {
  const p = await (await col('players')).findOne({ _id: oid(pid), tournamentId: t._id });
  return p || fail(404, 'player not found');
}

export const GET = api(async (_req, { params }) => {
  const t = await tour(params.tid);
  const v = await viewer(t._id);
  const p = await load(t, params.pid);
  const own = v.u?.playerId && String(v.u.playerId) === String(p._id);
  if (!v.staff && !own && !PLAYER_PUBLIC.includes(p.status)) fail(404, 'player not found');
  return shapePlayer(p, t, v);
});

/** Edit profile / per-tournament category, position, base price. After the auction starts a `reason` is required. */
export const PATCH = api(async (req, { params }) => {
  const u = await need(['organizer'], params.tid);
  const t = await tour(params.tid);
  const p = await load(t, params.pid);
  const b = await body(req);
  const r = playerDoc({ ...flatPlayer(p), ...b }, t);
  const { doc } = r, errors = r.errors.filter((e) => !(e === 'category required' && !p.category)); // pending self-registrations have no category yet
  if (errors.length) fail(400, errors.join('; '));
  const changes = {};
  for (const [k, v] of Object.entries(doc)) if (JSON.stringify(v) !== JSON.stringify(p[k] ?? (typeof v === 'string' ? '' : null))) changes[k] = [p[k] ?? null, v];
  if (!Object.keys(changes).length) return { ok: true, changed: 0 };
  const reason = String(b.reason || '').trim();
  if (statusIndex(t.status) >= statusIndex('auction_in_progress') && !reason) fail(400, 'a reason is required to edit a player after the auction has started');
  const locked = p.teamId || ['in_auction', 'sold'].includes(p.status);
  if (locked && ('category' in changes || 'basePrice' in changes)) fail(409, 'category/base price cannot change for a player in auction or already sold; use a sale correction');
  await (await col('players')).updateOne({ _id: p._id }, { $set: doc });
  await audit(t._id, u, 'player.update', { playerId: p._id, name: p.name, changes, reason });
  return { ok: true, changed: Object.keys(changes).length };
});
