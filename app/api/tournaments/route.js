import { api, col, body, need, me, fail, audit } from '@/lib/server';
import { categoryProblems } from '@/lib/rules';
import { pickSettings, defaultTournament } from '@/lib/setup';

export const dynamic = 'force-dynamic';

export const GET = api(async () => {
  const u = await me();
  const q = u?.role === 'super' ? {} : { $or: [{ visibility: { $ne: 'private' }, status: { $ne: 'draft' } }, ...(u?.tournamentId ? [{ _id: u.tournamentId }] : [])] } // drafts are unpublished setup: only super and its own staff see them;
  return { tournaments: await (await col('tournaments')).find(q).sort({ createdAt: -1 }).toArray() };
});

export const POST = api(async (req) => {
  const u = await need(['super']);
  const { patch, errors } = pickSettings(await body(req));
  if (!patch.name) errors.push('name required');
  const doc = { ...defaultTournament(patch), status: 'draft', createdAt: new Date() };
  errors.push(...categoryProblems(doc.squadSize, doc.categories));
  if (errors.length) fail(400, errors.join('; '));
  const { insertedId } = await (await col('tournaments')).insertOne(doc);
  await audit(insertedId, u, 'tournament.create', { name: doc.name });
  return { _id: insertedId };
});
