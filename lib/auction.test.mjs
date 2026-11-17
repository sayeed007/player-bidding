import assert from 'node:assert';
import { nextEnd, timing, eligible, reducedBase, correctionProblems, tieGroup, lotteryView } from './auction-math.js';

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

// --- tie at the cap -> lottery ---
{
  const base = { increment: 10, bidders: ['red', 'blue'] };
  // the reported case: both teams max out at 320, Red got there first
  assert.deepEqual(tieGroup({ ...base, price: 320, leaderId: 'red', maxByTeam: { red: 320, blue: 320 } }), ['red', 'blue']);
  // Blue could still have raised -> normal auction, no tie
  assert.deepEqual(tieGroup({ ...base, price: 320, leaderId: 'red', maxByTeam: { red: 320, blue: 400 } }), []);
  // the leader could still raise itself (max 400): not stuck on arrival order, no tie
  assert.deepEqual(tieGroup({ ...base, price: 320, leaderId: 'red', maxByTeam: { red: 400, blue: 320 } }), []);
  // Blue cannot even match the price -> not part of it
  assert.deepEqual(tieGroup({ ...base, price: 320, leaderId: 'red', maxByTeam: { red: 320, blue: 310 } }), []);
  // a team that never bid is not in the lottery, even with the same cap
  assert.deepEqual(tieGroup({ price: 320, increment: 10, leaderId: 'red', bidders: ['red'], maxByTeam: { red: 320, blue: 320 } }), []);
  // "same cap" is judged by the next legal bid: max 325 cannot reach 330, so it ties with 320
  assert.deepEqual(tieGroup({ ...base, price: 320, leaderId: 'red', maxByTeam: { red: 320, blue: 325 } }), ['red', 'blue']);
  // three-way tie, leader listed first, no duplicates even if a team bid many times
  assert.deepEqual(tieGroup({ price: 300, increment: 10, leaderId: 'g', bidders: ['r', 'b', 'g', 'r', 'b'], maxByTeam: { r: 300, b: 305, g: 300 } }), ['g', 'r', 'b']);
  // no leader / no bids
  assert.deepEqual(tieGroup({ ...base, price: 100, leaderId: null, maxByTeam: {} }), []);
  // missing max info is treated as "cannot bid" -> not a tie
  assert.deepEqual(tieGroup({ ...base, price: 320, leaderId: 'red', maxByTeam: { red: 320 } }), []);
}
console.log('tie group ok');

// --- lottery reveal: the winner stays hidden until revealAt ---
{
  const stored = { candidates: [{ _id: 'r1', name: 'Red' }, { _id: 'b1', name: 'Blue' }], winnerId: 'b1', drawnAt: 1000, revealAt: 4500, price: 320 };
  assert.equal(lotteryView(null, 5000), null);
  const before = lotteryView(stored, 2000);
  assert.deepEqual(before.candidates, ['Red', 'Blue']);
  assert.equal(before.revealed, false);
  assert.ok(!('winner' in before) && !('winnerId' in before), 'winner must not leak before the reveal');
  assert.ok(!JSON.stringify(before).includes('b1'), 'no id of the winner anywhere in the pre-reveal payload');
  const after = lotteryView(stored, 4500);
  assert.equal(after.revealed, true);
  assert.equal(after.winner, 'Blue');
  assert.equal(after.winnerId, 'b1');
}
console.log('lottery view ok');
