import { api, col, body, need, tour, audit } from '@/lib/server';
import { cloneDoc } from '@/lib/setup';

export const POST = api(async (req, { params }) => {
  const u = await need(['super']);
  const src = await tour(params.tid);
  const b = await body(req);
  const doc = cloneDoc(src, String(b.name || '').trim(), String(b.code || '').trim());
  const { insertedId } = await (await col('tournaments')).insertOne(doc);
  let copied = 0;
  if (b.copyPlayers) { // fresh registrations: no team, price, sale or login carried over
    const codes = new Set((doc.categories || []).map((c) => c.code));
    const old = await (await col('players')).find({ tournamentId: src._id, status: { $nin: ['withdrawn', 'disqualified', 'draft'] } }).toArray();
    const fresh = old.map((p) => ({
      tournamentId: insertedId, name: p.name, photo: p.photo, contact: p.contact, employeeId: p.employeeId, department: p.department,
      position: p.position, position2: p.position2, category: codes.has(p.category) ? p.category : null, basePrice: null,
      status: 'pending', teamId: null, price: null, saleId: null, captain: false, regAt: new Date(),
    }));
    if (fresh.length) await (await col('players')).insertMany(fresh);
    copied = fresh.length;
  }
  await audit(insertedId, u, 'tournament.clone', { from: src._id, copyPlayers: !!b.copyPlayers, copied });
  return { _id: insertedId, copied };
});
