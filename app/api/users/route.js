import { api, col, body, need, oid, audit } from '@/lib/server';
import { makeUser } from '@/lib/setup-server';

export const dynamic = 'force-dynamic';
const ROLES = ['super', 'organizer', 'auctioneer', 'owner', 'captain', 'player'];

export const GET = api(async (req) => {
  await need(['super']);
  const tid = new URL(req.url).searchParams.get('tournamentId');
  const users = await (await col('users')).find(tid ? { tournamentId: oid(tid) } : {}, { projection: { hash: 0 } }).sort({ createdAt: -1 }).limit(500).toArray();
  return { users };
});

export const POST = api(async (req) => {
  const u = await need(['super']);
  const r = await makeUser(await body(req), { roles: ROLES });
  await audit(null, u, 'user.create', { username: r.username });
  return r;
});
