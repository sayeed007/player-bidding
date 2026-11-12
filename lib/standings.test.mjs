import test from 'node:test';
import assert from 'node:assert';
import { computeStandings, scoreFromEvents } from './standings.js';

const teams = ['A', 'B', 'C'].map((n) => ({ _id: n, name: n }));
const M = (h, a, hs, as, extra = {}) => ({ stage: 'league', homeTeamId: h, awayTeamId: a, score: { home: hs, away: as }, status: 'completed', resultState: 'final', events: [], ...extra });

test('points, GD and ranking from final matches only', () => {
  const rows = computeStandings(teams, [M('A', 'B', 2, 0), M('B', 'C', 1, 1), M('A', 'C', 0, 0, { resultState: 'submitted' })], {});
  const A = rows.find((r) => r.teamId === 'A');
  assert.deepEqual([A.P, A.W, A.GF, A.GD, A.Pts, A.rank], [1, 1, 2, 2, 3, 1]);
  assert.equal(rows.find((r) => r.teamId === 'C').P, 1); // submitted match ignored
  assert.equal(rows.find((r) => r.teamId === 'B').Pts, 1);
});

test('configurable points rule', () => {
  const rows = computeStandings(teams, [M('A', 'B', 1, 0)], { pointsRule: { win: 2, draw: 1, loss: 0 } });
  assert.equal(rows[0].Pts, 2);
});

test('head-to-head breaks tie before fair play; fair play then name', () => {
  // all on 3 pts, same GD/GF: A beat B 1-0, B beat C 1-0, C beat A 1-0
  const ms = [M('A', 'B', 1, 0), M('B', 'C', 1, 0), M('C', 'A', 1, 0)];
  assert.deepEqual(computeStandings(teams, ms, {}).map((r) => r.name), ['A', 'B', 'C']); // full circle -> name
  // A and B level on 3 pts (and name order favours A) but B beat A directly
  const t4 = ['A', 'B', 'C', 'D'].map((n) => ({ _id: n, name: n }));
  const r = computeStandings(t4, [M('B', 'A', 1, 0), M('A', 'C', 1, 0), M('D', 'B', 1, 0), M('D', 'C', 1, 0)], { tiebreak: ['points', 'h2h'] });
  assert.deepEqual(r.map((x) => x.name), ['D', 'B', 'A', 'C']);
  const fp = computeStandings(teams.slice(0, 2), [M('A', 'B', 1, 1, { events: [{ type: 'red', teamId: 'A' }] })], { tiebreak: ['points', 'fairplay'] });
  assert.equal(fp[0].name, 'B');
});

test('scoreFromEvents handles own goals', () => {
  const m = { homeTeamId: 'A', awayTeamId: 'B', events: [{ type: 'goal', teamId: 'A' }, { type: 'own_goal', teamId: 'A' }, { type: 'penalty_goal', teamId: 'A' }, { type: 'yellow', teamId: 'B' }] };
  assert.deepEqual(scoreFromEvents(m), { home: 2, away: 1 });
});

test('forfeit counts via stored score; cancelled/open do not', () => {
  const rows = computeStandings(teams, [M('A', 'B', 3, 0, { status: 'forfeited' }), M('A', 'C', 1, 0, { status: 'cancelled' })], {});
  assert.equal(rows.find((r) => r.teamId === 'A').Pts, 3);
  assert.equal(rows.find((r) => r.teamId === 'A').P, 1);
});
