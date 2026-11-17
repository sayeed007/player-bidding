// node --env-file=.env.local scripts/reset-data.mjs
// Cleans the database but KEEPS the main tournament's settings and the super admin login:
//  - every other tournament (and all its data) is deleted
//  - in the kept tournament: players, teams, owner logins, fixtures, auction, history, notifications are deleted
//  - then players (data/players.json), 6 teams (captains) and their owner logins are rebuilt; status -> registration_closed
// A JSON backup of the kept tournament's data is written to .tmp/backup-<date>.json first.
import { MongoClient } from 'mongodb';
import { readFileSync, writeFileSync } from 'node:fs';
import { hash, randomPassword } from '../lib/hash.js';

const KEEP_CODE = process.env.KEEP_CODE || 'NFT2026';
const TEAMS = [['Shafin', 'Shafin Hossain'], ['Noman', 'Ariful Haque Noman'], ['Shohan', 'Shohan'],
  ['Tanmoy', 'Sheikh Shoaib Md Tanmoy'], ['Roman', 'Roman Hossain'], ['Salah', 'Salah']];
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];
const PER_TOURNAMENT = ['players', 'teams', 'auctions', 'auction_events', 'bids', 'sales', 'ledger', 'matches', 'awards', 'notifications', 'audit', 'fixture_params'];

const players = JSON.parse(readFileSync('data/players.json', 'utf8'));
const c = await new MongoClient(process.env.MONGODB_URI).connect(), d = c.db();
const keep = await d.collection('tournaments').findOne({ code: KEEP_CODE });
if (!keep) throw new Error(`tournament ${KEEP_CODE} not found`);

// backup
const backup = { tournament: keep };
for (const n of [...PER_TOURNAMENT, 'users']) backup[n] = await d.collection(n).find({ tournamentId: keep._id }).toArray();
const file = `.tmp/backup-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(file, JSON.stringify(backup));
console.log('backup ->', file);

// 1. every other tournament, with everything that belongs to it
const others = (await d.collection('tournaments').find({ _id: { $ne: keep._id } }).toArray()).map((t) => t._id);
for (const n of [...PER_TOURNAMENT, 'users']) {
  const r = await d.collection(n).deleteMany({ tournamentId: { $in: others } });
  console.log(`other tournaments: ${n} -${r.deletedCount}`);
}
console.log('tournaments -', (await d.collection('tournaments').deleteMany({ _id: { $in: others } })).deletedCount);

// 2. the kept tournament: wipe data, keep settings
for (const n of PER_TOURNAMENT) console.log(`${keep.code}: ${n} -${(await d.collection(n).deleteMany({ tournamentId: keep._id })).deletedCount}`);
console.log(`${keep.code}: users -${(await d.collection('users').deleteMany({ tournamentId: keep._id, role: { $in: ['owner', 'captain', 'player'] } })).deletedCount}`);
const categories = (keep.categories || []).map((x) => ({ ...x, unsoldBump: x.unsoldBump ?? (['C', 'D'].includes(x.code) ? 10 : 0) }));
await d.collection('tournaments').updateOne({ _id: keep._id }, { $set: { status: 'registration_closed', categories, 'auction.allocation': keep.auction?.allocation || 'admin' } });

// 3. rebuild
const tid = keep._id;
const { insertedIds } = await d.collection('players').insertMany(players.map((p) => ({
  tournamentId: tid, name: p.name, position: p.position, category: p.category, basePrice: null,
  department: p.department || '', employeeId: p.employeeId || '',
  status: 'approved', teamId: null, price: null, photo: p.photo || '', regAt: new Date(),
})));
const ids = Object.values(insertedIds);
console.log('\nLogins (owners):');
for (const [i, [name, captain]] of TEAMS.entries()) {
  const k = players.findIndex((p) => (p.sheetName || p.name) === captain);
  if (k < 0) console.log('!! captain not found in players:', captain);
  const { insertedId: teamId } = await d.collection('teams').insertOne({
    tournamentId: tid, name: `Team ${name}`, logo: '', color: COLORS[i], ownerName: name, captainName: captain,
    status: 'approved', budget: keep.budget, spent: k >= 0 ? categories.find((x) => x.code === players[k].category)?.price || 0 : 0, counts: k >= 0 ? { [players[k].category]: 1 } : {}, regAt: new Date(),
  });
  if (k >= 0) { // a captain costs his category's base price, like any other player
    const price = categories.find((x) => x.code === players[k].category)?.price || 0, at = new Date();
    const { insertedId: saleId } = await d.collection('sales').insertOne({ tournamentId: tid, lotNo: 0, playerId: ids[k], teamId, price, at, status: 'confirmed' });
    await d.collection('players').updateOne({ _id: ids[k] }, { $set: { teamId, price, saleId, status: 'sold', captain: true } });
    await d.collection('ledger').insertOne({ tournamentId: tid, teamId, delta: -price, reason: `captain base price: ${players[k].name}`, saleId, at });
  }
  const pw = randomPassword(), username = name.toLowerCase();
  const u = await d.collection('users').insertOne({ username, hash: hash(pw), role: 'owner', name: `${name} (owner)`, tournamentId: tid, teamId, active: true, createdAt: new Date() });
  await d.collection('teams').updateOne({ _id: teamId }, { $set: { ownerUserId: u.insertedId } });
  console.log(`${username} / ${pw}   (Team ${name})`);
}
const n = {}; for (const p of players) n[p.category] = (n[p.category] || 0) + 1;
console.log('\nplayers', players.length, n, 'with photo', players.filter((p) => p.photo).length);
console.log('tournament', String(tid));
await c.close();
