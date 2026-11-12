import assert from 'node:assert';
import { test } from 'node:test';
import { standingsRows, tally, buildReport } from './reports.js';

const teams = [{ _id: 'a', name: 'Alpha', status: 'approved', budget: 100, spent: 40 }, { _id: 'b', name: 'Beta', status: 'approved', budget: 100, spent: 0 }];
const fin = (h, a, hs, as, events = []) => ({ homeTeamId: h, awayTeamId: a, score: { home: hs, away: as }, status: 'completed', resultState: 'final', events, lineups: { home: ['p1'], away: ['p2'] } });

test('standings count final matches only', () => {
  const rows = standingsRows(teams, [fin('a', 'b', 2, 1), { ...fin('b', 'a', 5, 0), resultState: 'open' }]);
  assert.deepEqual([rows[0].name, rows[0].Pts, rows[0].GD, rows[1].Pts], ['Alpha', 3, 1, 0]);
});

test('tally goals, assists, clean sheets', () => {
  const { pl, tm } = tally([fin('a', 'b', 1, 0, [{ type: 'goal', playerId: 'p1', assistPlayerId: 'p3', teamId: 'a' }, { type: 'yellow', playerId: 'p2', teamId: 'b' }])]);
  assert.equal(pl.get('p1').goals, 1);
  assert.equal(pl.get('p3').assists, 1);
  assert.equal(tm.get('a').cleanSheets, 1);
  assert.equal(tm.get('b').yellow, 1);
});

test('reports: budgets, unknown, no contact leaks', () => {
  const players = [{ _id: 'p1', name: 'P', teamId: 'a', status: 'sold', contact: { phone: '1' }, employeeId: 'E1', department: 'X' }];
  const b = buildReport('budgets', { teams, players });
  assert.equal(b.rows[0].remaining, 60);
  assert.equal(buildReport('nope', {}), null);
  const all = JSON.stringify(['registration', 'squads', 'performance', 'sales'].map((n) => buildReport(n, { teams, players })));
  assert.ok(!/E1|department|phone/.test(all));
});
