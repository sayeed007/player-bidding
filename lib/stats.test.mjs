import test from 'node:test';
import assert from 'node:assert';
import { computeStats } from './stats.js';

const teams = [{ _id: 'A', name: 'Alpha' }, { _id: 'B', name: 'Beta' }];
const players = [
  { _id: 'a1', name: 'Gk A', teamId: 'A', position: 'GK' },
  { _id: 'a2', name: 'Striker', teamId: 'A', position: 'ST' },
  { _id: 'a3', name: 'Bench', teamId: 'A', position: 'MF' },
  { _id: 'b1', name: 'Keeper B', teamId: 'B', position: 'Goalkeeper' },
  { _id: 'b2', name: 'Def B', teamId: 'B', position: 'DF' },
  { _id: 'x', name: 'Unsold', teamId: null },
];
const m1 = {
  stage: 'league', homeTeamId: 'A', awayTeamId: 'B', status: 'completed', resultState: 'final', score: { home: 2, away: 0 },
  lineups: { home: ['a1', 'a2'], away: ['b1', 'b2'] }, potmPlayerId: 'a2',
  events: [
    { type: 'goal', teamId: 'A', playerId: 'a2', assistPlayerId: 'a3' },
    { type: 'penalty_goal', teamId: 'A', playerId: 'a2' },
    { type: 'yellow', teamId: 'B', playerId: 'b2' },
    { type: 'red', teamId: 'B', playerId: 'b1' },
  ],
};
const m2 = { ...m1, resultState: 'submitted' }; // must be ignored

test('player stats from final matches only', () => {
  const { players: ps } = computeStats(players, teams, [m1, m2], {});
  const g = (id) => ps.find((p) => p.playerId === id);
  assert.equal(ps.length, 5); // unsold excluded
  assert.deepEqual([g('a2').P, g('a2').starts, g('a2').goals, g('a2').penGoals, g('a2').potm], [1, 1, 2, 1, 1]);
  assert.equal(g('a3').assists, 1);
  assert.equal(g('a3').P, 1); // appeared via event, not a starter
  assert.equal(g('a3').starts, 0);
  assert.equal(g('a1').cleanSheets, 1);
  assert.equal(g('b1').cleanSheets, 0);
  assert.equal(g('b1').red, 1);
  assert.equal(g('b2').yellow, 1);
});

test('keeper without lineup gets no clean sheet; corrections recalc', () => {
  const noLineup = { ...m1, lineups: { home: [], away: [] } };
  assert.equal(computeStats(players, teams, [noLineup], {}).players.find((p) => p.playerId === 'a1').cleanSheets, 0);
  const corrected = { ...m1, score: { home: 2, away: 1 } };
  assert.equal(computeStats(players, teams, [corrected], {}).players.find((p) => p.playerId === 'a1').cleanSheets, 0);
});

test('team stats', () => {
  const { teams: ts } = computeStats(players, teams, [m1], {});
  const A = ts.find((x) => x.teamId === 'A'), B = ts.find((x) => x.teamId === 'B');
  assert.deepEqual([A.Pts, A.rank, A.cleanSheets, B.yellow, B.red, B.GA], [3, 1, 1, 1, 1, 2]);
});
