import assert from 'node:assert';
import { normCategories, pickSettings, defaultTournament, dot, playerDoc, importPlayers, effectivePrice, toCsv, quota, lockedChanges } from './setup.js';

const t = defaultTournament({ name: 'X' });
assert.equal(t.categories.length, 5);
assert.equal(t.code, 'X' + t.season);

// categories
assert.ok(normCategories([{ code: 'A', price: 1, min: 1, max: 1 }, { code: 'a', price: 1, min: 1, max: 1 }]).errors.some((e) => /duplicate/.test(e)));
assert.ok(normCategories([{ code: 'A', price: -1, min: 0, max: 1 }]).errors.length);

// settings
const s = pickSettings({ squadSize: '12', auction: { timerSec: 1 }, tiebreak: 'points,xx', format: 'nope' });
assert.equal(s.patch.squadSize, 12);
assert.equal(s.errors.length, 3);
assert.deepEqual(dot({ auction: { increment: 5 }, name: 'n' }), { 'auction.increment': 5, name: 'n' });

// players
assert.ok(playerDoc({ name: 'A', position: 'Defender', category: 'Z' }, t).errors.length);
assert.equal(playerDoc({ name: 'A', position: 'Defender', category: 'A', basePrice: '150' }, t).doc.basePrice, 150);
assert.ok(playerDoc({ name: 'A', position: 'Defender' }, t, { self: true }).errors.some((e) => /phone/.test(e)));
const p = playerDoc({ name: 'A', position: 'Defender', category: 'B' }, t).doc;
assert.equal(effectivePrice(p, t), 60);
assert.equal(effectivePrice({ ...p, basePrice: 90 }, t), 90);

// import: header aliases, dedupe, bad category
const r = importPlayers([
  { Name: 'Bob', Position: 'Forward', Category: 'A', 'Base Price': '140', Phone: '1' },
  { Name: 'bob', Position: 'Forward', Category: 'A' },
  { Name: 'Eve', Position: 'Forward', Category: 'Q' },
  { Name: 'Old', Position: 'Forward', Category: 'D' },
], t, ['old']);
assert.equal(r.docs.length, 1);
assert.equal(r.docs[0].basePrice, 140);
assert.deepEqual(r.skipped.map((x) => x.row), [2, 3, 4]);

assert.equal(toCsv([{ a: '=1+1', b: 'x"y' }]), 'a,b\n"\'=1+1","x""y"');
assert.deepEqual(quota(t, { counts: { A: 1 } })[0], { code: 'A', name: 'Category A', have: 1, min: 2, max: 2, need: 1, price: 130 });

// bulk photo matching
import { photoKey, matchPhotos } from './setup.js';
assert.equal(photoKey('Rupok_Das (1).JPG'), 'rupokdas');
const ps = [{ _id: 1, name: 'Rupok Das' }, { _id: 2, name: 'Rupok Dey' }, { _id: 3, name: 'Ana Lee' }];
const m = matchPhotos(['rupok das.jpg', 'RUPOK-DEY.png', 'ana lee 2.jpeg', 'zzz.jpg', 'Rupok Das copy.jpg'], ps);
assert.deepEqual(m.map((x) => x.playerId), [1, 2, 3, null, null]); // exact beats fuzzy; each player used once

// --- after the auction starts: only REAL changes to the locked rules are rejected ---
{
  const cur = defaultTournament({ name: 'Locked', budget: 1000, squadSize: 10, teamsCount: 6 });
  // the Settings form resubmits everything it loaded: same values (even as strings from inputs) => no change
  const resubmit = pickSettings({ name: 'Locked', budget: '1000', squadSize: '10', teamsCount: '6', categories: cur.categories, matchDuration: 40 }).patch;
  assert.deepEqual(lockedChanges(cur, resubmit), []);
  // editing an unlocked field alone never trips the lock
  assert.deepEqual(lockedChanges(cur, pickSettings({ name: 'Renamed' }).patch), []);
  // real changes are caught, and named
  assert.deepEqual(lockedChanges(cur, pickSettings({ budget: 1200 }).patch), ['budget']);
  assert.deepEqual(lockedChanges(cur, pickSettings({ squadSize: 11, teamsCount: 8 }).patch).sort(), ['squadSize', 'teamsCount']);
  const priced = cur.categories.map((c) => (c.code === 'A' ? { ...c, price: c.price + 10 } : c));
  assert.deepEqual(lockedChanges(cur, pickSettings({ categories: priced }).patch), ['categories']);
  const less = cur.categories.map((c) => (c.code === 'D' ? { ...c, active: false } : c));
  assert.deepEqual(lockedChanges(cur, pickSettings({ categories: less }).patch), ['categories']);
  // category order does not matter; cosmetic edits (name/description) are allowed
  assert.deepEqual(lockedChanges(cur, pickSettings({ categories: [...cur.categories].reverse() }).patch), []);
  const renamed = cur.categories.map((c) => ({ ...c, name: `${c.name} (renamed)`, description: 'x' }));
  assert.deepEqual(lockedChanges(cur, pickSettings({ categories: renamed }).patch), []);
}
console.log('lock rules ok');
