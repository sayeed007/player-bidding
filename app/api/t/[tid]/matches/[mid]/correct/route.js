import { api, body, col, fail, need, audit, oid } from '@/lib/server';
import { scoreFromEvents } from '@/lib/standings';
import { advance, cleanEvent, getMatch, matchTitle, notifyTeams, squad } from '@/lib/matchapi';

export const POST = api(async (req, { params }) => {
  const { tid, mid } = params;
  const u = await need(['organizer'], tid);
  const b = await body(req);
  const reason = String(b.reason || '').trim();
  if (reason.length < 3) fail(400, 'a reason is required for corrections');
  const m = await getMatch(tid, mid);
  if (m.resultState !== 'final') fail(400, 'only finalized results are corrected here; edit normally first');
  const sq = await squad(tid, m);
  const set = {};
  if (b.status) {
    if (!['completed', 'forfeited'].includes(b.status)) fail(400, 'status must be completed or forfeited');
    set.status = b.status;
  }
  if (Array.isArray(b.events)) set.events = b.events.map((e) => cleanEvent(e, sq));
  const status = set.status || m.status;
  if (status !== 'forfeited') set.score = scoreFromEvents({ ...m, events: set.events || m.events });
  if (b.score) {
    const { home, away } = b.score;
    if (![home, away].every((x) => Number.isInteger(x) && x >= 0)) fail(400, 'invalid score');
    if (status !== 'forfeited' && (home !== set.score.home || away !== set.score.away)) fail(400, 'score must match the events (or mark as forfeited)');
    set.score = { home, away };
  }
  if ('potmPlayerId' in b) {
    if (b.potmPlayerId && !sq.has(String(b.potmPlayerId))) fail(400, 'player of the match must be from a participating team');
    set.potmPlayerId = b.potmPlayerId ? oid(b.potmPlayerId) : null;
  }
  if (b.winnerTeamId) set.winnerTeamId = oid(b.winnerTeamId);
  if (!Object.keys(set).length) fail(400, 'nothing to correct');
  const before = { status: m.status, score: m.score, events: m.events, potmPlayerId: m.potmPlayerId, winnerTeamId: m.winnerTeamId ?? null };
  await (await col('matches')).updateOne({ _id: m._id }, { $set: set, $push: { history: { at: new Date(), by: u.username, reason, before } } });
  await audit(tid, u, 'match.correct', { matchId: mid, reason, before, after: set });
  await notifyTeams(tid, m, 'result', 'Result corrected', `${await matchTitle(tid, m)}: ${(set.score || m.score).home}-${(set.score || m.score).away} (${reason})`);
  await advance(tid);
  return { ok: true, score: set.score || m.score };
});
