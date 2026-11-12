import assert from 'node:assert';
import { nextEnd, timing, eligible, reducedBase, correctionProblems } from './auction-math.js';

// extension
const cfg = { extendWithinSec: 10, extendToSec: 15 };
assert.equal(nextEnd(100_000, 85_000, cfg), 100_000); // 15s left: outside window
assert.equal(nextEnd(100_000, 95_000, cfg), 110_000); // 5s left: extend to now+15s
assert.equal(nextEnd(100_000, 95_000, {}), 100_000);  // not configured
assert.equal(nextEnd(100_000, 99_000, { extendWithinSec: 10, extendToSec: 1 }), 100_000); // never shortens

// pause / resume
const lot = { open: true, endsAt: 50_000 };
const p = timing(lot, 20_000, true);
assert.deepEqual(p, { endsAt: null, pausedLeftMs: 30_000 });
assert.equal(timing({ ...lot, ...p }, 20_000, true), null);
assert.deepEqual(timing({ ...lot, ...p }, 90_000, false), { endsAt: 120_000, pausedLeftMs: null });
assert.equal(timing({ open: false, endsAt: null }, 0, true), null);

// pick eligibility
const pl = [
  { _id: 1, status: 'approved', category: 'A' }, { _id: 2, status: 'hold', category: 'A' },
  { _id: 3, status: 'sold', teamId: 'x', category: 'A' }, { _id: 4, status: 'unsold', category: 'B' },
  { _id: 5, status: 'withdrawn', category: 'B' }, { _id: 6, status: 'approved', category: 'Z' },
];
assert.deepEqual(eligible(pl, { active: ['A', 'B'] }).map((x) => x._id), [1]);
assert.deepEqual(eligible(pl, { category: 'B', active: ['A', 'B'] }).map((x) => x._id), [4]); // pool empty -> unsold re-enter
assert.deepEqual(eligible(pl.filter((x) => x._id > 4), { active: ['A'] }), []);
assert.equal(reducedBase(100, 20), 80);
assert.equal(reducedBase(1, 90), 1);

// correction math
const cc = { squad: 3, categories: [{ code: 'A', min: 1, max: 2 }, { code: 'B', min: 1, max: 2 }] };
const t1 = { name: 'T1', budget: 100, spent: 60, counts: { A: 2, B: 0 } };
const t2 = { name: 'T2', budget: 100, spent: 90, counts: { A: 0, B: 1 } };
assert.deepEqual(correctionProblems(cc, t1, null, 'A', 30, 40), []);                 // same team, +10
assert.match(correctionProblems(cc, t1, null, 'A', 30, 80)[0], /budget/);            // 60-30+80=110
assert.match(correctionProblems(cc, t1, t2, 'A', 30, 15).join(), /T2: budget/);      // T2 90+15=105
assert.deepEqual(correctionProblems(cc, t1, t2, 'A', 30, 10), []);
assert.match(correctionProblems(cc, { ...t2, counts: { A: 1, B: 1 } }, t1, 'A', 10, 10).join(), /T1: A quota exceeded/);
