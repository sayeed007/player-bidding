import { api, col, body, need, tour, fail, audit, oid } from '@/lib/server';
import { categoryProblems } from '@/lib/rules';
import { pickSettings, dot, statusIndex } from '@/lib/setup';
import { viewer } from '@/lib/setup-server';

export const dynamic = 'force-dynamic';

export const GET = api(async (_req, { params }) => {
  const t = await tour(params.tid);
  if (t.visibility === 'private') {
    const v = await viewer(t._id);
    if (!v.staff && String(v.u?.tournamentId) !== String(t._id)) fail(404, 'tournament not found');
  }
  return t;
});

export const PATCH = api(async (req, { params }) => {
  const u = await need(['organizer'], params.tid);
  const t = await tour(params.tid);
  const b = await body(req);
  const { patch, errors } = pickSettings(b);
  const locked = statusIndex(t.status) >= statusIndex('auction_in_progress');
  if (locked) for (const k of ['categories', 'squadSize', 'teamsCount', 'budget']) if (k in patch) fail(409, `${k} cannot change once the auction has started`);
  const next = { ...t, ...patch };
  if ('categories' in patch || 'squadSize' in patch) errors.push(...categoryProblems(next.squadSize, next.categories || []));
  if (patch.teamsCount) {
    const n = await (await col('teams')).countDocuments({ tournamentId: t._id, status: 'approved' });
    if (n > patch.teamsCount) errors.push(`${n} teams already approved`);
  }
  if (errors.length) fail(400, errors.join('; '));
  if (!Object.keys(patch).length) fail(400, 'nothing to change');
  await (await col('tournaments')).updateOne({ _id: t._id }, { $set: dot(patch) });
  await audit(t._id, u, 'tournament.update', { fields: Object.keys(patch) });
  return await tour(params.tid);
});
