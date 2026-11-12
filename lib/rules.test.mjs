import assert from 'node:assert';
import { maxBid, checkBid, squadProblems, categoryProblems } from './rules.js';

const mk = (code, price, n) => ({ code, price, min: n, max: n, active: true });
const cfg = { squad: 10, categories: [mk('A', 130, 2), mk('B+', 100, 1), mk('B', 60, 3), mk('C', 40, 2), mk('D', 30, 2)] };
const fresh = { budget: 1000, spent: 0, counts: {} };

assert.equal(maxBid(cfg, fresh, 'A').max, 450); // 1000 - (680-130)
// spec example: 360 spent on A, B+, B → buying last A leaves reserve 260 → 380
const t = { budget: 1000, spent: 360, counts: { A: 1, 'B+': 1, B: 1 } };
assert.equal(maxBid(cfg, t, 'A').max, 380);
assert.ok(maxBid(cfg, { ...t, counts: { ...t.counts, A: 2 } }, 'A').error); // quota full
assert.ok(maxBid(cfg, { budget: 1000, spent: 0, counts: { A: 2, 'B+': 1, B: 3, C: 2, D: 2 } }, 'A').error); // squad full
assert.equal(checkBid(cfg, fresh, 'A', 130, 130, false, 10), null);
assert.match(checkBid(cfg, fresh, 'A', 135, 130, true, 10), /minimum/);
assert.match(checkBid(cfg, fresh, 'A', 500, 130, false, 10), /max/);
assert.deepEqual(squadProblems(cfg, { counts: { A: 2, 'B+': 1, B: 3, C: 2, D: 2 } }), []);
assert.ok(squadProblems(cfg, { counts: { A: 2 } }).length > 0);
assert.deepEqual(categoryProblems(10, cfg.categories), []);
assert.ok(categoryProblems(10, [mk('A', 1, 11)]).length > 0); // 11 required in squad of 10

// flexible config: min 0 / max 10 for one category, remaining slots reserved at cheapest open price
const flex = { squad: 3, categories: [{ code: 'X', price: 50, min: 1, max: 3 }, { code: 'Y', price: 20, min: 0, max: 3 }] };
assert.equal(maxBid(flex, { budget: 200, spent: 0, counts: {} }, 'Y').max, 200 - 50 - 20); // X required + 1 free at Y(20)
console.log('rules ok');
