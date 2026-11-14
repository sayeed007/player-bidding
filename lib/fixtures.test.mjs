import test from 'node:test';
import assert from 'node:assert';
import { roundRobin, knockout, generateFixtures, validateSchedule, pairings, slotsPerDay, generateRemaining } from './fixtures.js';

const ids = (n) => Array.from({ length: n }, (_, i) => `t${i + 1}`);
const base = { startDate: '2026-03-02', matchDays: [1, 3, 5], venues: ['A', 'B'], dayStart: '16:00', dayEnd: '20:00', matchDuration: 50, breakDuration: 10, maxMatchesPerTeamPerDay: 1, minRestMinutes: 30 };
const pairKey = (m) => [m.homeTeamId, m.awayTeamId].sort().join('-');

test('6 teams single round-robin = 15 unique matches, 5 each (AC-12)', () => {
  const { matches, violations } = generateFixtures({ ...base, format: 'single', teamIds: ids(6) });
  assert.equal(matches.length, 15);
  assert.equal(new Set(matches.map(pairKey)).size, 15);
  for (const t of ids(6)) assert.equal(matches.filter((m) => m.homeTeamId === t || m.awayTeamId === t).length, 5);
  assert.deepEqual(violations, []);
  assert.ok(matches.every((m) => m.start && m.venue));
});

test('odd teams get byes; double doubles the matches', () => {
  assert.equal(roundRobin(ids(5)).flat().length, 10);
  assert.equal(roundRobin(ids(5), true).flat().length, 20);
  const { matches, violations } = generateFixtures({ ...base, format: 'double', teamIds: ids(4) });
  assert.equal(matches.length, 12);
  assert.deepEqual(violations, []);
});

test('knockout with byes: 6 teams -> 5 matches, top seeds skip round 1', () => {
  const ms = knockout(ids(6).map((teamId) => ({ teamId })));
  assert.equal(ms.length, 5);
  assert.equal(ms.filter((m) => m.round === 1).length, 2);
  const r1 = ms.filter((m) => m.round === 1).flatMap((m) => [m.homeTeamId, m.awayTeamId]);
  assert.ok(!r1.includes('t1') && !r1.includes('t2'));
  assert.equal(ms.at(-1).label, 'Final');
  assert.ok(ms.at(-1).from.home && ms.at(-1).from.away);
});

test('group + knockout and league + playoffs', () => {
  const g = pairings({ format: 'group_knockout', teamIds: ids(8), groups: 2, advance: 2 });
  assert.equal(g.filter((m) => m.stage === 'group').length, 12);
  assert.equal(g.filter((m) => m.stage === 'knockout').length, 3);
  const lp = pairings({ format: 'league_playoff', teamIds: ids(6) });
  assert.equal(lp.filter((m) => m.stage === 'league').length, 15);
  assert.equal(lp.filter((m) => m.stage === 'playoff').length, 3);
  const { matches, violations } = generateFixtures({ ...base, format: 'league_playoff', teamIds: ids(6) });
  assert.deepEqual(violations, []);
  const lastLeague = matches.filter((m) => m.stage === 'league').map((m) => m.end).sort().at(-1);
  assert.ok(matches.filter((m) => m.stage === 'playoff').every((m) => m.start > lastLeague));
});

test('validateSchedule catches conflicts', () => {
  const m = (key, h, a, start, venue) => ({ key, stage: 'league', homeTeamId: h, awayTeamId: a, start, end: start.slice(0, 11) + String(Number(start.slice(11, 13)) + 1).padStart(2, '0') + ':00', venue });
  const types = (ms, p) => validateSchedule(ms, p).map((x) => x.type);
  const d = '2026-03-02T';
  assert.ok(types([m('a', 't1', 't2', d + '16:00', 'A'), m('b', 't1', 't3', d + '16:30', 'B')]).includes('team_overlap'));
  assert.ok(types([m('a', 't1', 't2', d + '16:00', 'A'), m('b', 't3', 't4', d + '16:30', 'A')]).includes('venue_conflict'));
  assert.ok(types([m('a', 't1', 't2', d + '16:00', 'A'), m('b', 't2', 't1', d + '18:00', 'A')]).includes('duplicate_pairing'));
  assert.deepEqual(types([m('a', 't1', 't2', d + '16:00', 'A'), m('b', 't2', 't1', d + '18:00', 'A')], { format: 'double', maxMatchesPerTeamPerDay: 2 }), []);
  assert.ok(types([m('a', 't1', 't2', d + '16:00', 'A'), m('b', 't1', 't3', d + '17:10', 'B')], { minRestMinutes: 30 }).includes('rest'));
  assert.ok(types([m('a', 't1', 't2', d + '16:00', 'A'), m('b', 't1', 't3', d + '18:00', 'B')], { maxMatchesPerTeamPerDay: 1 }).includes('max_per_day'));
  assert.ok(types([m('a', 't1', 't2', d + '10:00', 'A')], { dayStart: '16:00', dayEnd: '20:00' }).includes('outside_window'));
  assert.ok(types([m('a', 't1', 't2', '2026-03-03T16:00', 'A')], { matchDays: [1] }).includes('outside_days'));
  assert.deepEqual(types([{ ...m('a', 't1', 't2', d + '16:00', 'A'), status: 'cancelled' }, m('b', 't1', 't3', d + '16:00', 'A')]), []);
});

test('not enough slots is reported', () => {
  const { violations } = generateFixtures({ ...base, dates: ['2026-03-02'], venues: ['A'], format: 'single', teamIds: ids(6) });
  assert.ok(violations.some((v) => v.type === 'unscheduled'));
});

test('slotsPerDay: a 90-minute match fits twice in 16:00-20:00, not three times', () => {
  const w = { dayStart: '16:00', dayEnd: '20:00', breakDuration: 10, venues: ['A'] };
  assert.equal(slotsPerDay({ ...w, matchDuration: 90 }), 2);                      // 16:00-17:30, 17:40-19:10
  assert.equal(slotsPerDay({ ...w, matchDuration: 50 }), 4);                      // 16:00 16:60 17:... 19:00-19:50
  assert.equal(slotsPerDay({ ...w, matchDuration: 90, venues: ['A', 'B'] }), 4);  // every venue repeats the slots
  assert.equal(slotsPerDay({ ...w, matchDuration: 90, dayEnd: '17:30' }), 1);     // a 90-minute window = one match
  assert.equal(slotsPerDay({ ...w, matchDuration: 90, dayEnd: '17:00' }), 0);     // too short for even one
  assert.equal(slotsPerDay({ ...w, matchDuration: 90, timeSlots: ['16:00', '17:00', '18:00'] }), 2); // 17:00 overlaps 16:00
  assert.equal(slotsPerDay({ ...w, matchDuration: 40, timeSlots: ['16:00', '17:00', '18:00'] }), 3);
});

test('generateRemaining keeps played matches and only schedules the rest', () => {
  const params = { ...base, format: 'single', teamIds: ids(6), matchDuration: 90 };
  const first = generateFixtures({ ...base, format: 'single', teamIds: ids(6) }).matches;
  const played = first.slice(0, 5).map((m, i) => (i === 4 ? { ...m, homeTeamId: m.awayTeamId, awayTeamId: m.homeTeamId } : m)); // one played the other way round
  const r = generateRemaining(params, played);
  assert.equal(r.matches.length, 10);
  assert.equal(r.kept, 5);
  const playedPairs = new Set(played.map(pairKey));
  assert.ok(r.matches.every((m) => !playedPairs.has(pairKey(m))), 'no played pairing is scheduled again');
  assert.equal(new Set([...played, ...r.matches].map(pairKey)).size, 15, 'played + remaining = the full round-robin');
  assert.ok(r.matches.every((m) => m.start), 'everything left gets a slot');
  assert.equal(r.violations.length, 0);
  // new duration is really used
  const m0 = r.matches[0];
  assert.equal((new Date(m0.end) - new Date(m0.start)) / 60000, 90);
  // nothing played = same as generating from scratch
  assert.equal(generateRemaining(params, []).matches.length, 15);
});
