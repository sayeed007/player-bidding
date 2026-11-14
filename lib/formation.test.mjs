import assert from 'node:assert';
import { SIZES, FORMATIONS, layout, defaultFormation, rolesOf, autoFill, roleAt, freshSlots, putPlayer, swapSlots, moveSlot, clearSlot, placedIds, carry, buildState } from './formation.js';

// every preset: right number of slots, GK first and at the back, all inside the pitch, no stacked duplicates
for (const size of SIZES) {
  assert.ok(FORMATIONS[size]?.length, `presets for ${size}`);
  for (const f of FORMATIONS[size]) {
    const s = layout(f);
    assert.equal(s.length, size, `${f} should have ${size} slots`);
    assert.equal(s[0].role, 'GK');
    assert.ok(s.every((p) => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100));
    assert.equal(new Set(s.map((p) => `${p.x},${p.y}`)).size, size, `${f} has overlapping slots`);
  }
}
assert.equal(defaultFormation(11), '4-4-2');
assert.equal(defaultFormation(99), '2-3-1'); // unknown size falls back to the 7-a-side default
assert.deepEqual(layout('2-3-1').map((p) => p.role), ['GK', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD']);
assert.equal(roleAt(20), 'FWD'); assert.equal(roleAt(50), 'MID'); assert.equal(roleAt(80), 'DEF'); assert.equal(roleAt(10, true), 'GK');

// sheet-style position strings
assert.ok(rolesOf('GK/DEF').has('GK') && rolesOf('GK/DEF').has('DEF'));
assert.ok(rolesOf('Forward / Def').has('FWD') && rolesOf('Forward / Def').has('DEF'));
assert.ok(rolesOf('CMF').has('MID') && rolesOf('RWF').has('FWD') && rolesOf('Striker').has('FWD') && rolesOf('CB / Mid').has('DEF'));
assert.equal(rolesOf('').size, 0);

// auto-fill: keeper in goal, nobody twice, every slot filled when the squad is big enough
const sq = [
  { _id: 'a', position: 'Striker' }, { _id: 'b', position: 'GK' }, { _id: 'c', position: 'Def' }, { _id: 'd', position: 'CMF' },
  { _id: 'e', position: '' }, { _id: 'f', position: 'Mid' }, { _id: 'g', position: 'Forward' }, { _id: 'h', position: 'Defender' },
];
const slots = layout('2-3-1');
const got = autoFill(slots, sq);
assert.equal(got[0], 'b');
assert.equal(new Set(got).size, got.length);
assert.ok(got.every(Boolean));
assert.equal(autoFill(layout('4-4-2'), sq.slice(0, 3)).filter(Boolean).length, 3); // short squad: only as many as exist

// --- squad-builder state ---
let st = freshSlots('2-3-1');
assert.equal(st.length, 7); assert.ok(st[0].gk && st.slice(1).every((x) => !x.gk));
st = putPlayer(st, 0, 'b'); st = putPlayer(st, 1, 'c');
assert.deepEqual(placedIds(st), ['b', 'c']);
st = putPlayer(st, 2, 'c');                       // moving c to slot 2 vacates slot 1, never duplicates
assert.deepEqual(placedIds(st), ['b', 'c']); assert.equal(st[1].pid, null); assert.equal(st[2].pid, 'c');
st = putPlayer(st, 2, 'a');                       // replacing: c goes back to the bench
assert.deepEqual(placedIds(st).sort(), ['a', 'b']);
st = putPlayer(st, 3, 'c'); st = swapSlots(st, 2, 3);
assert.equal(st[2].pid, 'c'); assert.equal(st[3].pid, 'a');
st = swapSlots(st, 2, 4);                         // swap with an empty slot = move
assert.equal(st[2].pid, null); assert.equal(st[4].pid, 'c');
st = moveSlot(st, 4, 500, -20);                   // free drag is clamped inside the pitch
assert.deepEqual([st[4].x, st[4].y], [96, 4]);
assert.equal(clearSlot(st, 4)[4].pid, null);

// switching formation keeps players, keeper stays in goal; shrinking drops extras to the bench
let full = freshSlots('4-4-2').map((s, i) => ({ ...s, pid: `p${i}` }));
let c = carry(full, '2-3-1');
assert.equal(c.length, 7); assert.equal(c[0].pid, 'p0'); assert.equal(placedIds(c).length, 7);
assert.equal(new Set(placedIds(c)).size, 7);
c = carry(c.map((s) => (s.id === 3 ? { ...s, pid: null } : s)), '4-4-2'); // growing: 6 players into 11 slots
assert.equal(placedIds(c).length, 6); assert.equal(c[0].pid, 'p0');

// restoring: exact positions, legacy id lists, unknown ids ignored
const squad = Array.from({ length: 10 }, (_, i) => ({ _id: `p${i}`, position: i === 0 ? 'GK' : i < 4 ? 'Def' : i < 7 ? 'Mid' : 'Striker' }));
const meta = { size: 7, formation: '3-2-1', positions: [{ playerId: 'p0', x: 40, y: 88, gk: true }, { playerId: 'p1', x: 30, y: 60 }, { playerId: 'ghost', x: 1, y: 1 }] };
const r1 = buildState(squad, { meta, ids: ['p0', 'p1', 'ghost'] });
assert.equal(r1.size, 7); assert.equal(r1.formation, '3-2-1');
assert.deepEqual([r1.slots[0].pid, r1.slots[0].x, r1.slots[0].y], ['p0', 40, 88]);
assert.deepEqual([r1.slots[1].pid, r1.slots[1].x], ['p1', 30]);
assert.equal(placedIds(r1.slots).length, 2);
const r2 = buildState(squad, { ids: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] }); // legacy list of 8, no formation saved
assert.equal(r2.size, 8); assert.equal(placedIds(r2.slots).length, 8); assert.equal(r2.slots[0].pid, 'p0');
const r3 = buildState(squad, {});
assert.equal(r3.size, 7); assert.equal(placedIds(r3.slots).length, 0);
console.log('formation ok');
