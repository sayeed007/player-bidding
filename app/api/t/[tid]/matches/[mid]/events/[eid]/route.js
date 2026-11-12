import { api, col, fail, need, audit } from '@/lib/server';
import { scoreFromEvents } from '@/lib/standings';
import { getMatch } from '@/lib/matchapi';

export const DELETE = api(async (req, { params }) => {
  const { tid, mid, eid } = params;
  const u = await need(['organizer', 'auctioneer'], tid);
  const m = await getMatch(tid, mid);
  if (m.resultState === 'final') fail(409, 'Result is final - use the correction form');
  const events = (m.events || []).filter((e) => e.id !== eid);
  if (events.length === (m.events || []).length) fail(404, 'event not found');
  const set = { events, ...(m.status === 'forfeited' ? {} : { score: scoreFromEvents({ ...m, events }) }) };
  await (await col('matches')).updateOne({ _id: m._id }, { $set: set });
  await audit(tid, u, 'match.event.remove', { matchId: mid, eventId: eid });
  return { ok: true, score: set.score || m.score };
});
