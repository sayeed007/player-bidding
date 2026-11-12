import { api, col, fail, need, audit } from '@/lib/server';
import { getMatch } from '@/lib/matchapi';

export const POST = api(async (req, { params }) => {
  const { tid, mid } = params;
  const u = await need(['organizer', 'auctioneer'], tid);
  const m = await getMatch(tid, mid);
  if (m.resultState === 'final') fail(409, 'already final');
  if (!['completed', 'forfeited'].includes(m.status)) fail(400, 'mark the match completed (or forfeited) first');
  await (await col('matches')).updateOne({ _id: m._id }, { $set: { resultState: 'submitted' } });
  await audit(tid, u, 'match.submit', { matchId: mid });
  return { ok: true };
});
