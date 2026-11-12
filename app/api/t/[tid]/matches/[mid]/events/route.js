import { api, body, col, fail, need, audit } from '@/lib/server';
import { scoreFromEvents } from '@/lib/standings';
import { cleanEvent, getMatch, squad } from '@/lib/matchapi';

export const POST = api(async (req, { params }) => {
  const { tid, mid } = params;
  const u = await need(['organizer', 'auctioneer'], tid);
  const m = await getMatch(tid, mid);
  if (m.resultState === 'final') fail(409, 'Result is final - use the correction form');
  if (!m.homeTeamId || !m.awayTeamId) fail(400, 'teams not decided yet');
  if (['cancelled', 'postponed'].includes(m.status)) fail(400, `match is ${m.status}`);
  const e = cleanEvent(await body(req), await squad(tid, m));
  const events = [...(m.events || []), e];
  const set = { events, ...(m.status === 'forfeited' ? {} : { score: scoreFromEvents({ ...m, events }) }) };
  await (await col('matches')).updateOne({ _id: m._id }, { $set: set });
  await audit(tid, u, 'match.event.add', { matchId: mid, event: e });
  return { ok: true, event: e, score: set.score || m.score };
});
