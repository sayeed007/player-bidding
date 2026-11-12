import { api, col, body, need, oid, audit } from '@/lib/server';
import { makeUser } from '@/lib/setup-server';

export const dynamic = 'force-dynamic';

export const GET = api(async (_req, { params }) => {
  await need(['organizer'], params.tid);
  return { users: await (await col('users')).find({ tournamentId: oid(params.tid) }, { projection: { hash: 0 } }).toArray() };
});

/** Organizer creates a tournament-bound login. Returns the generated password once. */
export const POST = api(async (req, { params }) => {
  const u = await need(['organizer'], params.tid);
  const r = await makeUser(await body(req), { tid: params.tid, roles: ['captain', 'auctioneer', 'owner', 'player'] });
  await audit(params.tid, u, 'user.create', { username: r.username });
  return r;
});
