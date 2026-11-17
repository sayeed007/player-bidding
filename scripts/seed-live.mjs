// npm run seed:live              "Live Demo": auction already running (3 lots sold, one lot open with bids). Timer is 1 hour so it never expires while you review.
// npm run seed:live -- --before  same tournament, but the auction has NOT started yet (status auction_ready).
// npm run seed:live -- --delete  removes only the Live Demo.
// Needs the dev server running (it drives the real auction API so the state is genuine). Never touches other tournaments.
import { MongoClient } from 'mongodb';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hash, randomPassword } from '../lib/hash.js';

const CODE = 'LIVEDEMO', B = process.env.BASE || 'http://localhost:3000/api';
const before = process.argv.includes('--before'), del = process.argv.includes('--delete');
const c = await new MongoClient(process.env.MONGODB_URI).connect();
const d = c.db();

const old = await d.collection('tournaments').findOne({ code: CODE });
if (old) {
  for (const n of ['players', 'teams', 'auctions', 'auction_events', 'bids', 'sales', 'ledger', 'matches', 'awards', 'notifications', 'audit', 'fixture_params', 'users']) {
    await d.collection(n).deleteMany({ tournamentId: old._id });
  }
  await d.collection('tournaments').deleteOne({ _id: old._id });
  console.log('Removed the previous Live Demo.');
}
if (del) { await c.close(); process.exit(0); }

// 5-a-side, budget 500: each team needs 1 A + 2 B + 2 C (minimum 280, so 220 to bid with).
const categories = [
  { code: 'A', name: 'Category A', price: 100, min: 1, max: 1, active: true, order: 1 },
  { code: 'B', name: 'Category B', price: 60, min: 2, max: 2, active: true, order: 2 },
  { code: 'C', name: 'Category C', price: 30, min: 2, max: 2, active: true, order: 3 },
];
const { insertedId: tid } = await d.collection('tournaments').insertOne({
  name: 'Live Demo', code: CODE, season: 'DEMO', description: 'Demo tournament for reviewing the auction screens.', visibility: 'private',
  status: 'auction_ready', teamsCount: 3, squadSize: 5, budget: 500, format: 'single', venues: ['Main Ground'],
  matchDuration: 25, breakDuration: 5, pointsRule: { win: 3, draw: 1, loss: 0 }, tiebreak: ['points', 'gd', 'gf', 'h2h'], rules: '',
  dates: {}, categories,
  auction: { increment: 10, timerSec: 3600, extendWithinSec: 0, extendToSec: 0, autoClose: false, unsoldPolicy: 'manual', publicPrices: true },
  createdAt: new Date(),
});

// real photos and names from the roster already in the repo (3 A, 6 B, 6 C)
const roster = JSON.parse(readFileSync('data/players.json', 'utf8')).filter((p) => p.photo);
const take = (cat, n) => roster.filter((p) => p.category === cat).slice(0, n);
const chosen = [...take('A', 3), ...take('B', 6), ...take('C', 6)];
if (chosen.length !== 15) throw new Error(`need 15 players with photos, found ${chosen.length}`);
await d.collection('players').insertMany(chosen.map((p) => ({
  tournamentId: tid, name: p.name, position: p.position, category: p.category, basePrice: null, department: '', employeeId: '',
  status: 'approved', teamId: null, price: null, photo: p.photo, regAt: new Date(),
})));

const users = [];
for (const [name, color] of [['Red', '#ef4444'], ['Blue', '#3b82f6'], ['Green', '#22c55e']]) {
  const { insertedId: teamId } = await d.collection('teams').insertOne({
    tournamentId: tid, name: `Demo ${name}`, logo: '', color, ownerName: name, captainName: '', status: 'approved', budget: 500, spent: 0, counts: {}, regAt: new Date(),
  });
  const password = randomPassword(), username = `demo_${name.toLowerCase()}`;
  await d.collection('users').deleteMany({ username });
  await d.collection('users').insertOne({ username, hash: hash(password), role: 'owner', name: `${name} (owner)`, tournamentId: tid, teamId, active: true, createdAt: new Date() });
  users.push({ username, password, teamId: String(teamId), team: `Demo ${name}` });
}
await c.close();

// ---- drive the real engine so the state is genuine ----
const login = async (u, p) => {
  const r = await fetch(`${B}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
  if (!r.ok) throw new Error(`login failed for ${u} (is the dev server running on ${B}?)`);
  return r.headers.getSetCookie().map((x) => x.split(';')[0]).join('; ');
};
const api = (cookie) => async (path, body) => {
  const r = await fetch(`${B}/t/${tid}/${path}`, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const admin = api(await login('admin', process.env.ADMIN_PASSWORD || '12345678'));
const team = await Promise.all(users.map(async (u) => ({ ...u, call: api(await login(u.username, u.password)) })));
let n = 0;
const bid = async (t, amount) => { const r = await t.call('auction/bid', { amount, key: `seed-${++n}` }); if (r.s !== 200) throw new Error(`bid ${t.team} ${amount}: ${r.j.error}`); };

if (!before) {
  await admin('auction/start', {});
  // 3 finished lots: Red buys an A, Blue a B, Green a C. Bidders alternate, the buyer always ends up leading.
  for (const [cat, buyer] of [['A', 0], ['B', 1], ['C', 2]]) {
    const p = await admin('auction/random-pick', { category: cat });
    if (p.s !== 200) throw new Error(`pick ${cat}: ${p.j.error}`);
    await admin('auction/open', {});
    const base = (await admin('auction/state')).j.lot.bid, o1 = team[(buyer + 1) % 3], o2 = team[(buyer + 2) % 3], me = team[buyer];
    for (const [t, step] of [[o1, 0], [o2, 1], [me, 2], [o1, 3], [me, 4]]) await bid(t, base + step * 10);
    const sold = await admin('auction/close', { outcome: 'sold' });
    if (sold.s !== 200) throw new Error(`close: ${sold.j.error}`);
  }
  // a lot that is open right now, with a bidding war in progress
  const p = await admin('auction/random-pick', { category: 'B' });
  if (p.s !== 200) throw new Error(`pick B: ${p.j.error}`);
  await admin('auction/open', {});
  const base = (await admin('auction/state')).j.lot.bid;
  await bid(team[0], base); await bid(team[1], base + 10); await bid(team[2], base + 20); await bid(team[0], base + 30);
}

mkdirSync('.tmp', { recursive: true });
writeFileSync('.tmp/livedemo.json', JSON.stringify({ tournamentId: String(tid), users }, null, 1));
const root = 'http://localhost:3000';
console.log(`\nLive Demo ready (${before ? 'auction NOT started' : 'auction LIVE, lot open with bids'}). Tournament id ${tid}\n`);
console.log('Screens:');
console.log(`  1. Admin     ${root}/admin/${tid}/auction        login: admin / <your ADMIN_PASSWORD>`);
for (const u of users) console.log(`  2. Bidder    ${root}/team/${tid}/auction        login: ${u.username} / ${u.password}   (${u.team})`);
console.log(`  3. Projector ${root}/t/${tid}/auction/live       (public, no login; spectator page: /t/${tid}/auction)`);
console.log('\nCredentials saved in .tmp/livedemo.json (git-ignored). Remove later: npm run seed:live -- --delete');
