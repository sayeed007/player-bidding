// npm run seed:testcup           adds ONE separate "Test Cup" tournament: 3 teams, 15 dummy players, 5-a-side, ready for an auction.
// npm run seed:testcup -- --reset   deletes only the previous Test Cup (code TESTCUP) and recreates it.
// npm run seed:testcup -- --delete  deletes only the Test Cup and stops.
// It never touches any other tournament, and (unlike `npm run seed`) never wipes the database.
import { MongoClient } from 'mongodb';
import { mkdirSync, writeFileSync } from 'node:fs';
import { hash, randomPassword } from '../lib/hash.js';

const CODE = 'TESTCUP';
const reset = process.argv.includes('--reset'), del = process.argv.includes('--delete');
const c = await new MongoClient(process.env.MONGODB_URI).connect();
const d = c.db();

const existing = await d.collection('tournaments').findOne({ code: CODE });
if (existing && !reset && !del) {
  console.log(`Test Cup already exists (id ${existing._id}). Use --reset to recreate it, or --delete to remove it.`);
  await c.close(); process.exit(0);
}
if (existing) {
  for (const n of ['players', 'teams', 'auctions', 'auction_events', 'bids', 'sales', 'ledger', 'matches', 'awards', 'notifications', 'audit', 'fixture_params']) {
    await d.collection(n).deleteMany({ tournamentId: existing._id });
  }
  await d.collection('users').deleteMany({ tournamentId: existing._id });
  await d.collection('tournaments').deleteOne({ _id: existing._id });
  console.log(`Removed the previous Test Cup (${existing._id}).`);
}
if (del) { await c.close(); process.exit(0); }

// 5-a-side: every team needs exactly 1 A + 2 B + 2 C. Minimum cost 100 + 2*60 + 2*30 = 280 of a 500 budget (220 to bid with).
const categories = [
  { code: 'A', name: 'Category A', price: 100, min: 1, max: 1, active: true, order: 1 },
  { code: 'B', name: 'Category B', price: 60, min: 2, max: 2, active: true, order: 2 },
  { code: 'C', name: 'Category C', price: 30, min: 2, max: 2, active: true, order: 3 },
];
const { insertedId: tid } = await d.collection('tournaments').insertOne({
  name: 'Test Cup (dummy)', code: CODE, season: 'TEST', description: 'Throwaway tournament for testing the auction. Safe to delete.', visibility: 'private',
  status: 'auction_ready', teamsCount: 3, squadSize: 5, budget: 500, format: 'single', venues: ['Main Ground'],
  matchDuration: 25, breakDuration: 5, pointsRule: { win: 3, draw: 1, loss: 0 }, tiebreak: ['points', 'gd', 'gf', 'h2h'], rules: '',
  dates: {}, categories,
  auction: { increment: 10, timerSec: 90, extendWithinSec: 10, extendToSec: 15, autoClose: false, unsoldPolicy: 'manual', publicPrices: true },
  createdAt: new Date(),
});

const positions = ['GK', 'Defender', 'Midfielder', 'Striker', 'Defender / Mid', 'Forward'];
const players = [];
for (const [code, n] of [['A', 3], ['B', 6], ['C', 6]]) {
  for (let i = 1; i <= n; i++) players.push({ name: `Dummy ${code}${i}`, category: code, position: positions[(players.length) % positions.length] });
}
await d.collection('players').insertMany(players.map((p) => ({
  tournamentId: tid, ...p, basePrice: null, department: '', employeeId: '', status: 'approved', teamId: null, price: null, photo: '', regAt: new Date(),
})));

const out = { tournamentId: String(tid), users: [] };
for (const [name, color] of [['Red', '#ef4444'], ['Blue', '#3b82f6'], ['Green', '#22c55e']]) {
  const { insertedId: teamId } = await d.collection('teams').insertOne({
    tournamentId: tid, name: `Test ${name}`, logo: '', color, ownerName: name, captainName: '', status: 'approved',
    budget: 500, spent: 0, counts: {}, regAt: new Date(),
  });
  const pw = randomPassword(), username = `tc_${name.toLowerCase()}`;
  await d.collection('users').deleteMany({ username }); // a stale login from an older Test Cup
  await d.collection('users').insertOne({ username, hash: hash(pw), role: 'owner', name: `${name} (owner)`, tournamentId: tid, teamId, active: true, createdAt: new Date() });
  out.users.push({ username, password: pw, teamId: String(teamId), team: `Test ${name}` });
}
mkdirSync('.tmp', { recursive: true });
writeFileSync('.tmp/testcup.json', JSON.stringify(out, null, 1)); // git-ignored; credentials for local testing only
console.log(`Test Cup created: ${tid}  (private, status auction_ready, 15 players, 3 teams)`);
for (const u of out.users) console.log(`  ${u.username} / ${u.password}   (${u.team})`);
console.log('Credentials also saved to .tmp/testcup.json. Remove everything later with: npm run seed:testcup -- --delete');
await c.close();
