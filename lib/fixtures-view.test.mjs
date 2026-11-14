import assert from 'node:assert';
import { groupMatches, dayLabel, byStart } from './fixtures-view.js';

const m = (id, round, start) => ({ _id: id, stage: 'league', round, start });
const list = [
  m('r1a', 1, '2026-12-01T16:00'), m('r1b', 1, '2026-12-01T17:00'), m('r1c', 1, '2026-12-01T18:00'),
  m('r2a', 2, '2026-12-03T16:00'), m('r2b', 2, '2026-12-03T17:00'),
  m('r3a', 3, '2026-12-08T16:00'), m('r3b', 3, '2026-12-08T17:00'),
];
const ids = (g) => g.map(([k, ms]) => [k, ms.map((x) => x._id)]);

// BEFORE the edit: days in order
assert.deepEqual(ids(groupMatches(list, 'date')).map(([k]) => k), ['2026-12-01', '2026-12-03', '2026-12-08']);

// the reported case: a Round 2 match is moved to Dec 16, after all of Round 3
const edited = list.map((x) => (x._id === 'r2b' ? { ...x, start: '2026-12-16T18:00' } : x));
const byDate = ids(groupMatches(edited, 'date'));
assert.deepEqual(byDate.map(([k]) => k), ['2026-12-01', '2026-12-03', '2026-12-08', '2026-12-16'], 'a new day appears in date order');
assert.deepEqual(byDate.at(-1), ['2026-12-16', ['r2b']]);                      // it moved to its new place
assert.deepEqual(byDate.find(([k]) => k === '2026-12-03')[1], ['r2a']);        // and left the old day
assert.deepEqual(byDate.find(([k]) => k === '2026-12-08')[1], ['r3a', 'r3b']);

// by round: the match stays in its round, but rounds are ordered and matches sorted by time inside
const rounds = ids(groupMatches(edited, 'round'));
assert.deepEqual(rounds.map(([k]) => k), ['league · R1', 'league · R2', 'league · R3']);
assert.deepEqual(rounds[1][1], ['r2a', 'r2b']);
const shuffled = ids(groupMatches([edited[4], edited[3], edited[0]], 'round'));
assert.deepEqual(shuffled[1][1], ['r2a', 'r2b'], 'time-ordered within a round regardless of input order');

// same day: ordered by time; unscheduled matches go last
const mixed = [m('late', 1, '2026-12-01T19:00'), m('none', 1, ''), m('early', 1, '2026-12-01T09:30')];
const g = ids(groupMatches(mixed, 'date'));
assert.deepEqual(g[0], ['2026-12-01', ['early', 'late']]);
assert.deepEqual(g.at(-1), ['', ['none']]);
assert.equal(byStart({ start: '' }, { start: '2026-01-01T00:00' }) > 0, true);

// labels
const now = new Date(2026, 11, 1, 12, 0);
assert.match(dayLabel('2026-12-01', now), /^Today · /);
assert.match(dayLabel('2026-12-02', now), /^Tomorrow · /);
assert.match(dayLabel('2026-12-16', now), /^Wednesday, 16 December 2026$/);
assert.equal(dayLabel('', now), 'Unscheduled');

// the reported preview: league R2 (Dec 2) must come BEFORE the playoffs (Dec 21-23), even though playoff rounds are numbered 1-2
const pv = [
  { _id: 'sf1', stage: 'playoff', round: 1, label: 'Semi-final 1', start: '2026-12-21T18:00' },
  { _id: 'sf2', stage: 'playoff', round: 1, label: 'Semi-final 2', start: '2026-12-21T18:40' },
  { _id: 'l2', stage: 'league', round: 2, start: '2026-12-02T18:00' },
  { _id: 'fin', stage: 'playoff', round: 2, label: 'Final', start: '2026-12-23T18:00' },
  { _id: 'l3a', stage: 'league', round: 3, start: '2026-12-05T16:00' },
  { _id: 'l3b', stage: 'league', round: 3, start: '2026-12-05T17:00' },
  { _id: 'l1', stage: 'league', round: 1, start: '2026-12-01T16:00' },
];
assert.deepEqual(groupMatches(pv, 'round').map(([k]) => k), ['league · R1', 'league · R2', 'league · R3', 'playoff · Semi-final 1', 'playoff · Semi-final 2', 'playoff · Final']);
assert.deepEqual(groupMatches(pv, 'date').map(([k]) => k), ['2026-12-01', '2026-12-02', '2026-12-05', '2026-12-21', '2026-12-23']);
// undated groups go last in round view too
const und = [{ _id: 'u', stage: 'league', round: 1, start: '' }, { _id: 'd', stage: 'league', round: 5, start: '2027-01-01T10:00' }];
assert.deepEqual(groupMatches(und, 'round').map(([k]) => k), ['league · R5', 'league · R1']);
console.log('fixtures view ok');
