// npm run seed  — WIPES everything, then creates: super admin + the Neural demo tournament
// (6 teams, players from the sheet, captains pre-assigned, one owner login per team).
import { MongoClient } from 'mongodb';
import { readFileSync } from 'node:fs';
import { hash, randomPassword } from '../lib/hash.js';

const players = JSON.parse(readFileSync('data/players.json', 'utf8'));
const categories = [
  { code: 'A', name: 'Category A', price: 130, min: 2, max: 2, active: true, order: 1 },
  { code: 'B+', name: 'Category B+', price: 100, min: 1, max: 1, active: true, order: 2 },
  { code: 'B', name: 'Category B', price: 60, min: 3, max: 3, active: true, order: 3 },
  { code: 'C', name: 'Category C', price: 40, min: 2, max: 2, active: true, order: 4, unsoldBump: 10 },
  { code: 'D', name: 'Category D', price: 30, min: 2, max: 2, active: true, order: 5, unsoldBump: 10 },
];
// Captains are B players pre-assigned at price 0 (they use one of their team's 3 B slots).
const teams = [['Shafin', 'Shafin Hossain'], ['Noman', 'Ariful Haque Noman'], ['Shohan', 'Shohan'],
  ['Tanmoy', 'Sheikh Shoaib Md Tanmoy'], ['Rifayat', 'Rifayat Abbasi'], ['Masum', 'Abrarul Haque Masum']];
const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];

const c = await new MongoClient(process.env.MONGODB_URI).connect();
const d = c.db();
for (const n of ['users', 'tournaments', 'players', 'teams', 'auctions', 'auction_events', 'bids', 'sales', 'ledger', 'matches', 'awards', 'notifications', 'audit']) {
  await d.collection(n).deleteMany({});
}
await d.collection('users').createIndex({ username: 1 }, { unique: true });
await d.collection('bids').createIndex({ tournamentId: 1, key: 1 }, { unique: true, sparse: true });

const adminPw = process.env.ADMIN_PASSWORD || randomPassword();
await d.collection('users').insertOne({ username: 'admin', hash: hash(adminPw), role: 'super', name: 'Super Admin', active: true, createdAt: new Date() });
console.log(`admin / ${adminPw}`);

const { insertedId: tid } = await d.collection('tournaments').insertOne({
  name: 'Neural Football Tournament', code: 'NFT2026', season: '2026', description: '', visibility: 'public',
  status: 'registration_closed', teamsCount: 6, squadSize: 10, budget: 1000, format: 'single', venues: ['Main Ground'],
  matchDuration: 40, breakDuration: 10, pointsRule: { win: 3, draw: 1, loss: 0 },
  tiebreak: ['points', 'gd', 'gf', 'h2h'], rules: '',
  dates: {}, categories,
  auction: { increment: 10, timerSec: 120, extendWithinSec: 0, extendToSec: 0, autoClose: false, unsoldPolicy: 'manual', allocation: 'admin', publicPrices: true },
  createdAt: new Date(),
});
const { insertedIds } = await d.collection('players').insertMany(players.map((p) => ({
  tournamentId: tid, name: p.name, position: p.position, category: p.category, basePrice: null,
  department: p.department || '', employeeId: p.employeeId || '',
  status: 'approved', teamId: null, price: null, photo: p.photo || '', regAt: new Date(),
})));
const ids = Object.values(insertedIds);
for (const [i, [name, captain]] of teams.entries()) {
  const k = players.findIndex((p) => (p.sheetName || p.name) === captain);
  const { insertedId: teamId } = await d.collection('teams').insertOne({
    tournamentId: tid, name: `Team ${name}`, logo: '', color: colors[i], ownerName: name, captainName: captain,
    status: 'approved', budget: 1000, spent: 0, counts: k >= 0 ? { [players[k].category]: 1 } : {}, regAt: new Date(),
  });
  if (k >= 0) await d.collection('players').updateOne({ _id: ids[k] }, { $set: { teamId, price: 0, status: 'sold', captain: true } });
  const pw = randomPassword(), username = name.toLowerCase();
  await d.collection('users').insertOne({ username, hash: hash(pw), role: 'owner', name: `${name} (owner)`, tournamentId: tid, teamId, active: true, createdAt: new Date() });
  console.log(`${username} / ${pw}   (Team ${name})`);
}
const n = {}; for (const p of players) n[p.category] = (n[p.category] || 0) + 1;
console.log('tournament', String(tid), 'players by category', n, '(need A12 B+6 B18 C12 D12 — add the missing D in Admin → Players)');
await c.close();
