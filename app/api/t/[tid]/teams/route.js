import { api, col, body, tour, fail, rateLimit } from '@/lib/server';
import { teamDoc, teamCount } from '@/lib/setup';
import { viewer, shapeTeam, teamNameTaken, approveTeam } from '@/lib/setup-server';

export const dynamic = 'force-dynamic';

/** Public: approved teams only, no contact. Staff with ?all=1: all statuses. */
export const GET = api(async (req, { params }) => {
  const t = await tour(params.tid);
  const v = await viewer(t._id);
  const all = new URL(req.url).searchParams.get('all') === '1';
  if (all && !v.staff) fail(403, 'not allowed');
  const teams = await (await col('teams')).find({ tournamentId: t._id, ...(all ? {} : { status: 'approved' }) }).sort({ name: 1 }).toArray();
  return { teams: teams.map((x) => ({ ...shapeTeam(x, t, v), count: teamCount(x) })) };
});

/** Organizer creates a team (pending, or approved at once with {approve:true}); anyone else submits a pending registration while registration is open. */
export const POST = api(async (req, { params }) => {
  const t = await tour(params.tid);
  const v = await viewer(t._id);
  if (!v.admin) {
    await rateLimit('team-reg', 5, 10 * 60 * 1000);
    if (t.status !== 'registration_open') fail(403, 'team registration is not open');
  }
  const b = await body(req);
  const { doc, errors } = teamDoc(b);
  if (errors.length) fail(400, errors.join('; '));
  if (await teamNameTaken(t._id, doc.name)) fail(409, 'team name already used in this tournament');
  const teams = await col('teams');
  // one team record per owner
  if (await teams.findOne({ tournamentId: t._id, ownerName: doc.ownerName, status: { $ne: 'rejected' } }, { collation: { locale: 'en', strength: 2 } })) fail(409, 'this owner already has a team in the tournament');
  const { insertedId } = await teams.insertOne({ ...doc, tournamentId: t._id, status: 'pending', budget: 0, spent: 0, counts: {}, regAt: new Date() });
  if (v.admin && b.approve) return { _id: insertedId, ...(await approveTeam(t, { ...doc, _id: insertedId, tournamentId: t._id, status: 'pending' }, v.u)) };
  return { _id: insertedId };
});
