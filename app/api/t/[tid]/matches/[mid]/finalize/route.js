import { api, body, col, fail, need, audit } from '@/lib/server';
import { scoreFromEvents } from '@/lib/standings';
import { advance, getMatch, matchTitle, notifyTeams, squad } from '@/lib/matchapi';
import { oid } from '@/lib/server';

const goals = (s) => s && Number.isInteger(s.home) && Number.isInteger(s.away) && s.home >= 0 && s.away >= 0;

export const POST = api(async (req, { params }) => {
  const { tid, mid } = params;
  const u = await need(['organizer'], tid);
  const b = await body(req);
  const m = await getMatch(tid, mid);
  if (m.resultState === 'final') fail(409, 'already final - use the correction form');
  if (!['completed', 'forfeited'].includes(m.status)) fail(400, 'mark the match completed (or forfeited) first');
  let score = scoreFromEvents(m);
  if (m.status === 'forfeited') {
    score = goals(b.score) ? b.score : goals(m.score) && (m.score.home || m.score.away) ? m.score : fail(400, 'forfeit needs an explicit score, e.g. {home:3,away:0}');
  }
  const set = { score, resultState: 'final', finalizedAt: new Date() };
  if (b.potmPlayerId) {
    if (!(await squad(tid, m)).has(String(b.potmPlayerId))) fail(400, 'player of the match must be from a participating team');
    set.potmPlayerId = oid(b.potmPlayerId);
  }
  if (m.stage === 'knockout' || m.stage === 'playoff') {
    if (score.home === score.away) {
      if (![m.homeTeamId, m.awayTeamId].some((t) => String(t) === String(b.winnerTeamId))) fail(400, 'drawn knockout match: pass winnerTeamId (penalties)');
      set.winnerTeamId = oid(b.winnerTeamId);
    }
  }
  await (await col('matches')).updateOne({ _id: m._id }, { $set: set });
  await audit(tid, u, 'match.finalize', { matchId: mid, score });
  await notifyTeams(tid, m, 'result', 'Result final', `${await matchTitle(tid, m)}: ${score.home}-${score.away}`);
  await advance(tid);
  return { ok: true, score };
});
