import { api, col, body, need, tour, fail, audit } from '@/lib/server';
import { importPlayers } from '@/lib/setup';

/** {rows:[{name,position,category,basePrice,phone,email,employeeId,department,position2}], status?} -> created + skipped (with reasons). */
export const POST = api(async (req, { params }) => {
  const u = await need(['organizer'], params.tid);
  const t = await tour(params.tid);
  const b = await body(req);
  if (!Array.isArray(b.rows) || !b.rows.length) fail(400, 'rows required');
  if (b.rows.length > 1000) fail(400, 'max 1000 rows per import');
  const players = await col('players');
  const existing = (await players.find({ tournamentId: t._id }, { projection: { name: 1 } }).toArray()).map((p) => p.name);
  const { docs, skipped } = importPlayers(b.rows, t, existing);
  const status = b.status === 'pending' ? 'pending' : 'approved';
  if (docs.length) await players.insertMany(docs.map((d) => ({ ...d, tournamentId: t._id, status, teamId: null, price: null, captain: false, regAt: new Date() })));
  await audit(t._id, u, 'player.import', { created: docs.length, skipped: skipped.length });
  return { created: docs.length, skipped };
});
