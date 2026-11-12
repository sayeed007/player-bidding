import { api, need, col, oid } from '@/lib/server';

export const dynamic = 'force-dynamic';

export const GET = api(async (req, { params }) => {
  const { tid } = params;
  await need(['organizer'], tid);
  const sp = new URL(req.url).searchParams;
  const q = { tournamentId: oid(tid) };
  const action = sp.get('action');
  if (action) q.action = { $regex: action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const page = Math.max(1, +sp.get('page') || 1), size = Math.min(100, +sp.get('size') || 50);
  const c = await col('audit');
  const [rows, total] = await Promise.all([c.find(q).sort({ at: -1 }).skip((page - 1) * size).limit(size).toArray(), c.countDocuments(q)]);
  return { rows, total, page, size };
});
