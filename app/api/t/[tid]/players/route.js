import { api, col, body, need, tour, fail, audit } from '@/lib/server';
import { playerDoc, PLAYER_PUBLIC, escRe } from '@/lib/setup';
import { viewer, shapePlayer } from '@/lib/setup-server';

export const dynamic = 'force-dynamic';
const ci = { collation: { locale: 'en', strength: 2 } };

/** Public: approved/in_auction/sold/unsold, no private fields. Staff with ?all=1: everything. */
export const GET = api(async (req, { params }) => {
  const t = await tour(params.tid);
  const v = await viewer(t._id);
  const sp = new URL(req.url).searchParams;
  const all = sp.get('all') === '1';
  if (all && !v.staff) fail(403, 'not allowed');
  const q = { tournamentId: t._id };
  const status = sp.get('status');
  if (status) q.status = all || PLAYER_PUBLIC.includes(status) ? status : '-';
  else if (!all) q.status = { $in: PLAYER_PUBLIC };
  for (const k of v.cats ? ['category', 'position'] : ['position']) if (sp.get(k)) q[k] = sp.get(k);
  const s = sp.get('q')?.trim().slice(0, 60);
  if (s) q.$or = [{ name: { $regex: escRe(s), $options: 'i' } }, ...(all ? [{ employeeId: { $regex: escRe(s), $options: 'i' } }] : [])];
  const players = await (await col('players')).find(q).sort({ name: 1 }).limit(2000).toArray();
  return { players: players.map((p) => shapePlayer(p, t, v)) };
});

/** Organizer creates a player (default status approved). */
export const POST = api(async (req, { params }) => {
  const u = await need(['organizer'], params.tid);
  const t = await tour(params.tid);
  const b = await body(req);
  const { doc, errors } = playerDoc(b, t);
  if (errors.length) fail(400, errors.join('; '));
  const players = await col('players');
  if (await players.findOne({ tournamentId: t._id, name: doc.name }, ci)) fail(409, 'a player with this name already exists');
  const status = ['draft', 'pending', 'approved'].includes(b.status) ? b.status : 'approved';
  const { insertedId } = await players.insertOne({ ...doc, tournamentId: t._id, status, teamId: null, price: null, captain: false, regAt: new Date() });
  await audit(t._id, u, 'player.create', { playerId: insertedId, name: doc.name });
  return { _id: insertedId };
});
