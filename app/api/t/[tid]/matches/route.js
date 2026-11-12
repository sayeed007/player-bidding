import { api, col, oid } from '@/lib/server';
import { decorate, isStaff } from '@/lib/matchapi';

export const dynamic = 'force-dynamic';

export const GET = api(async (req, { params }) => {
  const { tid } = params;
  const staff = new URL(req.url).searchParams.get('all') && (await isStaff(tid));
  const ms = await (await col('matches')).find({ tournamentId: oid(tid), ...(staff ? {} : { published: true }) }).toArray();
  ms.sort((a, b) => String(a.start || '9').localeCompare(String(b.start || '9')) || (a.round || 0) - (b.round || 0));
  return { matches: await decorate(tid, ms, staff) };
});
