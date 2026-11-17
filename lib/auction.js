// Auction engine (server only). All validity decisions live here; routes are thin.
// Timers are lazy: lot.endsAt (ms) is compared with the server clock; settle() auto-closes expired lots on any call.
import { randomInt } from 'node:crypto';
import { col, db, client, oid, tour, fail, audit, notify, need, publicPlayer, rateLimit } from './server.js';
import { setStatus, auctionReadiness } from './lifecycle.js';
import { maxBid, checkBid, squadProblems } from './rules.js';
import { nextEnd, timing, eligible, reducedBase, correctionProblems, tieGroup, lotteryView } from './auction-math.js';

const g = globalThis;
const STAFF = ['organizer', 'auctioneer'];
const cfgOf = (t) => ({ squad: t.squadSize, categories: t.categories || [] });
const catOf = (t, code) => (t.categories || []).find((c) => c.code === code);
const baseOf = (t, p) => p.basePrice ?? catOf(t, p.category)?.price ?? 0;

async function ensureIndexes() {
  g._auctionIdx ??= (async () => {
    const d = await db();
    await Promise.all([
      d.collection('auctions').createIndex({ tournamentId: 1 }, { unique: true }),
      d.collection('bids').createIndex({ tournamentId: 1, key: 1 }, { unique: true, sparse: true }),
      d.collection('bids').createIndex({ tournamentId: 1, at: -1 }),
      d.collection('sales').createIndex({ tournamentId: 1, playerId: 1 }),
      d.collection('auction_events').createIndex({ tournamentId: 1, at: -1 }),
      d.collection('ledger').createIndex({ tournamentId: 1, teamId: 1 }),
    ]);
  })().catch((e) => { g._auctionIdx = null; console.error('auction indexes', e); });
  await g._auctionIdx;
}

const event = async (tid, type, u, data = {}, session) =>
  (await col('auction_events')).insertOne({ tournamentId: oid(tid), at: new Date(), type, userId: u?._id ?? null, data }, { session });

/** Load tournament + auction doc, lazily settling an expired lot. */
export async function load(tid) {
  await ensureIndexes();
  const A = await col('auctions');
  // the tournament and its auction doc are independent reads: fetch them together (one database round trip instead of two)
  const [t, a0] = await Promise.all([tour(tid), A.findOne({ tournamentId: oid(tid) })]);
  let a = a0;
  const l = a?.lot;
  if (a?.status === 'live' && l?.open && !l.held && l.endsAt && l.endsAt <= Date.now() && t.auction?.autoClose) {
    try { await finalize(t, l.no, l.leaderTeamId ? 'sold' : 'unsold', null); } catch { /* lost a race with a manual close: fine */ }
    a = await A.findOne({ tournamentId: t._id });
  }
  return { t, a };
}

/** Teams tied at the lot's current price (see tieGroup): the leader plus every team that explicitly matched it. Returns [{_id, name}] or []. */
async function tieFor(t, lot, teams) {
  if (!lot?.leaderTeamId || lot.lottery || !lot.matchers?.length) return [];
  const p = await (await col('players')).findOne({ _id: lot.playerId, tournamentId: t._id });
  if (!p) return [];
  const cfg = cfgOf(t), maxByTeam = {};
  for (const tm of teams) maxByTeam[String(tm._id)] = maxBid(cfg, tm, p.category, p.basePrice ?? null).max ?? -1;
  const ids = tieGroup({ price: lot.bid, increment: t.auction?.increment || 1, leaderId: lot.leaderTeamId, bidders: lot.matchers, maxByTeam });
  return ids.map((id) => ({ _id: id, name: teams.find((x) => String(x._id) === id)?.name }));
}

const needLive = (a) => {
  if (!a) fail(409, 'auction has not started');
  if (a.status !== 'live') fail(409, `auction is ${a.status}; resume first`);
};

// ---------- sale / unsold: ONE transaction, guarded against double close ----------
async function finalize(t, lotNo, outcome, u) {
  const tid = t._id;
  let res;
  const s = (await client()).startSession();
  try {
    await s.withTransaction(async () => {
      const [A, P, T, S, L] = await Promise.all(['auctions', 'players', 'teams', 'sales', 'ledger'].map(col));
      // clearing the lot first is the lock: a second closer finds nothing and aborts
      const before = await A.findOneAndUpdate({ tournamentId: tid, 'lot.no': lotNo }, { $set: { lot: null } }, { returnDocument: 'before', session: s });
      const lot = before?.lot;
      if (!lot) fail(409, 'lot already closed');
      const p = await P.findOne({ _id: lot.playerId, tournamentId: tid }, { session: s });
      if (!p) fail(404, 'player not found');
      if (outcome === 'sold') {
        if (!lot.leaderTeamId) fail(400, 'no bids: mark the player unsold instead');
        const price = lot.bid, at = new Date();
        const tm = await T.updateOne(
          { _id: lot.leaderTeamId, tournamentId: tid, $expr: { $lte: [{ $add: ['$spent', price] }, '$budget'] } },
          { $inc: { spent: price, [`counts.${p.category}`]: 1 } }, { session: s });
        if (!tm.modifiedCount) fail(409, 'team budget would be exceeded');
        const pm = await P.updateOne({ _id: p._id, teamId: null, status: 'in_auction' },
          { $set: { status: 'sold', teamId: lot.leaderTeamId, price } }, { session: s });
        if (!pm.modifiedCount) fail(409, 'player is not available for sale');
        const { insertedId } = await S.insertOne({ tournamentId: tid, lotNo, playerId: p._id, teamId: lot.leaderTeamId, price, at, status: 'confirmed' }, { session: s });
        await P.updateOne({ _id: p._id }, { $set: { saleId: insertedId } }, { session: s });
        await L.insertOne({ tournamentId: tid, teamId: lot.leaderTeamId, delta: -price, reason: `auction sale: ${p.name}`, saleId: insertedId, at }, { session: s });
        await event(tid, 'sold', u, { lotNo, playerId: p._id, teamId: lot.leaderTeamId, price, saleId: insertedId, auto: !u }, s);
        res = { sold: true, price, teamId: lot.leaderTeamId, name: p.name };
      } else {
        const pol = t.auction?.unsoldPolicy || 'manual';
        const set = pol === 'return_to_pool' ? { status: 'approved' }
          : pol === 'reduce_base' ? { status: 'approved', basePrice: reducedBase(baseOf(t, p), t.auction?.unsoldReducePct) }
            : { status: 'unsold' };
        await P.updateOne({ _id: p._id, status: 'in_auction' }, { $set: set }, { session: s });
        await event(tid, 'unsold', u, { lotNo, playerId: p._id, policy: pol, auto: !u }, s);
        res = { sold: false, name: p.name };
      }
    });
  } finally { await s.endSession(); }
  if (res.sold) {
    const tm = await (await col('teams')).findOne({ _id: res.teamId });
    await notify(tid, { all: true }, 'auction', `Sold: ${res.name}`, `${tm?.name} bought ${res.name} for ${res.price}`);
    res.teamName = tm?.name;
  }
  return res;
}

// ---------- actions (each: ctx {t, a, u, b, tid}) ----------
async function start({ t, a, u }) {
  if (a) fail(409, 'auction already started');
  if (t.status !== 'auction_ready') fail(409, `tournament must be auction_ready (is ${t.status})`);
  const r = await auctionReadiness(t);
  if (r.errors.length) fail(400, r.errors.join('; '));
  try {
    await (await col('auctions')).insertOne({ tournamentId: t._id, status: 'live', lotCounter: 0, lot: null, completion: null, startedAt: new Date() });
  } catch (e) { if (e.code === 11000) fail(409, 'auction already started'); throw e; }
  await setStatus(t._id, 'auction_in_progress');
  await event(t._id, 'start', u);
  await audit(t._id, u, 'auction_start');
  await notify(t._id, { all: true }, 'auction', 'Auction started', 'The player auction is now live.');
  return { ok: true };
}

async function randomPick({ t, a, u, b }) {
  needLive(a);
  if (a.lot) fail(409, 'a lot is already active; close or skip it first');
  const active = (t.categories || []).filter((c) => c.active !== false).map((c) => c.code);
  const category = b.category || null;
  if (t.auction?.selection === 'category' && !category) fail(400, 'choose a category to pick from');
  if (category && !active.includes(category)) fail(400, 'category not active');
  const P = await col('players');
  const all = await P.find({ tournamentId: t._id, teamId: null, status: { $in: ['approved', 'unsold'] } }, { projection: { category: 1, status: 1, teamId: 1 } }).toArray();
  const pool = eligible(all, { category, active });
  if (!pool.length) fail(404, 'no eligible players left' + (category ? ` in ${category}` : ''));
  const pick = pool[randomInt(pool.length)];
  const before = await P.findOneAndUpdate({ _id: pick._id, tournamentId: t._id, teamId: null, status: { $in: ['approved', 'unsold'] } }, { $set: { status: 'in_auction' } }, { returnDocument: 'before' });
  if (!before) fail(409, 'player changed while picking, try again');
  const no = (a.lotCounter || 0) + 1;
  const lot = { no, playerId: before._id, bid: baseOf(t, before), leaderTeamId: null, open: false, startedAt: null, endsAt: null, pausedLeftMs: null, held: false, prevStatus: before.status };
  const r = await (await col('auctions')).updateOne({ _id: a._id, status: 'live', lot: null }, { $set: { lot }, $inc: { lotCounter: 1 } });
  if (!r.modifiedCount) {
    await P.updateOne({ _id: before._id, status: 'in_auction' }, { $set: { status: before.status } });
    fail(409, 'another lot was started, try again');
  }
  await event(t._id, 'random_pick', u, { lotNo: no, playerId: before._id, candidates: pool.length, category });
  return { ok: true, lotNo: no, playerId: before._id, name: before.name, candidates: pool.length };
}

/**
 * "Match": a team whose maximum is exactly the current price cannot raise, but may say "I am in at this price". It is allowed only
 * when the leader is capped at that price too (otherwise the leader could simply raise). Matching teams join the leader in the lottery.
 */
async function matchBid({ t, a, u, lot, team, p, key, now, B, inc }) {
  const cfg = cfgOf(t), price = lot.bid;
  const mine = maxBid(cfg, team, p.category, p.basePrice ?? null);
  if (mine.error) fail(400, mine.error);
  if (mine.max < price) fail(400, `your max bid for this player is ${mine.max}, below the current ${price}`);
  if (mine.max >= price + inc) fail(400, `you can still bid higher: the minimum is ${price + inc}`);
  const leader = await (await col('teams')).findOne({ _id: lot.leaderTeamId, tournamentId: t._id });
  const lm = leader ? maxBid(cfg, leader, p.category, p.basePrice ?? null) : { max: -1 };
  if (!(lm.max < price + inc)) fail(400, 'the leader can still raise, so matching is not possible: place a higher bid');
  const r = await (await col('auctions')).updateOne(
    { _id: a._id, status: 'live', 'lot.no': lot.no, 'lot.bid': price, 'lot.leaderTeamId': lot.leaderTeamId, 'lot.held': { $ne: true }, 'lot.lottery': { $exists: false }, 'lot.endsAt': { $gt: now }, 'lot.matchers': { $ne: team._id } },
    { $addToSet: { 'lot.matchers': team._id } });
  if (!r.modifiedCount) fail(409, 'you already matched this price, or the lot changed: check the screen');
  try {
    await B.insertOne({ tournamentId: t._id, lotNo: lot.no, playerId: lot.playerId, teamId: team._id, amount: price, key, match: true, at: new Date() });
  } catch (e) { if (e.code !== 11000) throw e; }
  await event(t._id, 'match', u, { lotNo: lot.no, teamId: team._id, amount: price });
  return { ok: true, matched: true, amount: price, lotNo: lot.no };
}

/** Decide a tie. The winner is stored now but clients only learn it at revealAt (see lotteryView), so the reveal can be staged live. */
async function drawLottery({ t, a, u }) {
  needLive(a);
  const l = a.lot;
  if (!l?.leaderTeamId) fail(409, 'there is no lot with bids');
  if (l.lottery) fail(409, 'the lottery was already drawn for this lot');
  if (l.held) fail(409, 'lot is on hold; release it first');
  const teams = await (await col('teams')).find({ tournamentId: t._id, status: 'approved' }).toArray();
  const tied = await tieFor(t, l, teams);
  if (tied.length < 2) fail(409, 'there is no tie on this lot');
  const winner = tied[randomInt(tied.length)]; // server-side crypto random
  const now = Date.now();
  const lottery = { price: l.bid, candidates: tied.map((x) => ({ _id: oid(x._id), name: x.name })), winnerId: oid(winner._id), drawnAt: now, revealAt: now + 3500, firstBidder: l.leaderTeamId };
  const r = await (await col('auctions')).updateOne(
    { _id: a._id, status: 'live', 'lot.no': l.no, 'lot.bid': l.bid, 'lot.leaderTeamId': l.leaderTeamId, 'lot.lottery': { $exists: false } }, { $set: { 'lot.lottery': lottery } });
  if (!r.modifiedCount) fail(409, 'a bid arrived or the lot changed, check it and try again');
  await event(t._id, 'lottery', u, { lotNo: l.no, price: l.bid, candidates: lottery.candidates.map((x) => x._id), winner: winner._id, firstBidder: l.leaderTeamId });
  return { ok: true, revealAt: lottery.revealAt, candidates: tied.map((x) => x.name) };
}

async function open({ t, a, u }) {
  needLive(a);
  const l = a.lot;
  if (!l) fail(409, 'pick a player first');
  if (l.open) fail(409, 'lot is already open');
  const now = Date.now();
  const r = await (await col('auctions')).updateOne({ _id: a._id, status: 'live', 'lot.no': l.no, 'lot.open': false },
    { $set: { 'lot.open': true, 'lot.startedAt': now, 'lot.endsAt': now + (t.auction?.timerSec || 30) * 1000, 'lot.pausedLeftMs': null } });
  if (!r.modifiedCount) fail(409, 'lot state changed, retry');
  await event(t._id, 'lot_open', u, { lotNo: l.no, playerId: l.playerId });
  return { ok: true };
}

async function bid({ t, a, u, b }) {
  if (u.role !== 'owner' && u.role !== 'super') fail(403, 'only team owners can bid');
  await rateLimit(`bid${u._id}`, 20, 5000);
  const key = String(b.key || '').slice(0, 80);
  if (!key) fail(400, 'idempotency key required');
  const B = await col('bids');
  const replay = async () => {
    const d = await B.findOne({ tournamentId: t._id, key });
    if (!d) return null;
    if (String(d.teamId) !== String(u.teamId)) fail(409, 'duplicate key');
    return { ok: true, replay: true, amount: d.amount, lotNo: d.lotNo };
  };
  const old = await replay();
  if (old) return old;

  if (!a || a.status !== 'live') fail(409, a ? `auction is ${a.status}` : 'auction has not started');
  const lot = a.lot, now = Date.now();
  if (!lot?.open) fail(409, 'no lot is open for bidding');
  if (lot.held) fail(409, 'this lot is on hold');
  if (lot.lottery) fail(409, 'a lottery was drawn for this lot, bidding is over');
  if (!lot.endsAt || lot.endsAt <= now) fail(409, 'bidding has ended for this lot');
  if (b.lotNo != null && Number(b.lotNo) !== lot.no) fail(409, 'stale bid: the lot has changed');
  if (b.seenBid != null && Number(b.seenBid) !== lot.bid) fail(409, `stale bid: price is now ${lot.bid}`);
  const amount = Number(b.amount);
  if (!Number.isInteger(amount)) fail(400, 'invalid amount');

  const team = u.teamId && await (await col('teams')).findOne({ _id: oid(u.teamId), tournamentId: t._id, status: 'approved' });
  if (!team) fail(403, 'your team is not approved for this tournament');
  if (String(lot.leaderTeamId) === String(team._id)) fail(409, 'you already hold the highest bid');
  const p = await (await col('players')).findOne({ _id: lot.playerId, tournamentId: t._id });
  if (!p || p.status !== 'in_auction') fail(409, 'player is not in auction');
  const inc = t.auction?.increment || 1;
  if (lot.leaderTeamId && amount === lot.bid) return matchBid({ t, a, u, lot, team, p, key, now, B, inc });
  const err = checkBid(cfgOf(t), team, p.category, amount, lot.bid, !!lot.leaderTeamId, inc, p.basePrice ?? null);
  if (err) fail(400, err);

  // compare-and-set on lot no / bid / leader: only one of several simultaneous bids can win
  const r = await (await col('auctions')).updateOne(
    { _id: a._id, status: 'live', 'lot.no': lot.no, 'lot.bid': lot.bid, 'lot.leaderTeamId': lot.leaderTeamId, 'lot.held': { $ne: true }, 'lot.lottery': { $exists: false }, 'lot.endsAt': { $gt: now } },
    { $set: { 'lot.bid': amount, 'lot.leaderTeamId': team._id, 'lot.matchers': [], 'lot.endsAt': nextEnd(lot.endsAt, now, t.auction) } });
  if (!r.modifiedCount) {
    const again = await replay();
    if (again) return again;
    fail(409, 'another bid arrived first, check the new price and retry');
  }
  // ponytail: bid log is written after the CAS; a crash between the two loses one log row, not money
  try {
    await B.insertOne({ tournamentId: t._id, lotNo: lot.no, playerId: lot.playerId, teamId: team._id, amount, key, at: new Date() });
  } catch (e) { if (e.code !== 11000) throw e; }
  await event(t._id, 'bid', u, { lotNo: lot.no, teamId: team._id, amount });
  return { ok: true, amount, lotNo: lot.no };
}

async function close({ t, a, u, b }) {
  needLive(a);
  const l = a.lot;
  if (!l) fail(409, 'no active lot');
  if (l.held) fail(409, 'lot is on hold; release it first');
  const outcome = b.outcome === 'unsold' ? 'unsold' : b.outcome === 'sold' ? 'sold' : fail(400, 'outcome must be sold or unsold');
  if (outcome === 'unsold' && l.leaderTeamId && !b.force) fail(409, 'lot has bids; sell it, or send force:true to mark unsold anyway');
  let lottery = null;
  if (outcome === 'sold' && l.leaderTeamId) {
    if (l.lottery) {
      if (Date.now() < l.lottery.revealAt) fail(409, 'the lottery is still being revealed, wait a few seconds');
      if (String(l.lottery.winnerId) !== String(l.leaderTeamId)) {
        // hand the lot to the drawn winner; the compare-and-set also makes any racing bid fail cleanly
        const sw = await (await col('auctions')).updateOne({ _id: a._id, 'lot.no': l.no, 'lot.leaderTeamId': l.leaderTeamId }, { $set: { 'lot.leaderTeamId': l.lottery.winnerId } });
        if (!sw.modifiedCount) fail(409, 'the lot changed, check it and try again');
      }
      const view = lotteryView(l.lottery, Date.now());
      lottery = { price: l.lottery.price, candidates: view.candidates, winner: view.winner, winnerId: view.winnerId };
    } else {
      const teams = await (await col('teams')).find({ tournamentId: t._id, status: 'approved' }).toArray();
      const tied = await tieFor(t, l, teams);
      if (tied.length > 1) fail(409, `Tie at ${l.bid} between ${tied.map((x) => x.name).join(' and ')}: draw the lottery before selling`);
    }
  }
  const r = await finalize(t, l.no, outcome, u);
  if (lottery) {
    await notify(t._id, { all: true }, 'auction', `Lottery: ${lottery.winner} wins the tie`,
      `${lottery.candidates.join(' and ')} were tied at ${lottery.price}. ${lottery.winner} won the draw.`);
  }
  if (outcome === 'unsold' && l.leaderTeamId) await audit(t._id, u, 'auction_unsold_with_bids', { lotNo: l.no, bid: l.bid });
  return { ok: true, ...r, ...(lottery ? { lottery } : {}) };
}

/** Apply a state change with a lock on the fields timing depends on. */
async function mutate(a, set, t, u, type, data = {}) {
  const r = await (await col('auctions')).updateOne(
    { _id: a._id, status: a.status, 'lot.no': a.lot?.no ?? null, 'lot.endsAt': a.lot?.endsAt ?? null }, { $set: set });
  if (!r.modifiedCount) fail(409, 'state changed meanwhile, retry');
  await event(t._id, type, u, data);
  return { ok: true };
}
const lotPatch = (lot, tm) => (tm ? Object.fromEntries(Object.entries(tm).map(([k, v]) => [`lot.${k}`, v])) : {});

async function freezeTo({ t, a, u }, status, type) {
  if (!a || !['live', 'paused', 'suspended'].includes(a.status)) fail(409, 'auction is not running');
  const set = { status, ...lotPatch(a.lot, timing(a.lot, Date.now(), true)) };
  const res = await mutate(a, set, t, u, type);
  await audit(t._id, u, `auction_${type}`);
  if (type === 'suspend') await notify(t._id, { all: true }, 'auction', 'Auction suspended', 'The auction is suspended. Please wait.');
  return res;
}
const pause = (c) => (c.a?.status === 'live' ? freezeTo(c, 'paused', 'pause') : fail(409, 'auction is not live'));
const suspend = (c) => freezeTo(c, 'suspended', 'suspend');

async function resume({ t, a, u }) {
  if (!a || !['paused', 'suspended'].includes(a.status)) fail(409, 'auction is not paused');
  const set = { status: 'live', ...(a.lot?.held ? {} : lotPatch(a.lot, timing(a.lot, Date.now(), false))) };
  return mutate(a, set, t, u, 'resume');
}

async function holdLot({ t, a, u, b }) {
  if (!a?.lot) fail(409, 'no active lot');
  const release = !!b.release;
  if (release === !a.lot.held) fail(409, release ? 'lot is not on hold' : 'lot is already on hold');
  const frozen = !release || a.status !== 'live';
  const set = { 'lot.held': !release, ...lotPatch(a.lot, timing(a.lot, Date.now(), frozen)) };
  return mutate(a, set, t, u, release ? 'lot_release' : 'lot_hold', { lotNo: a.lot.no });
}

/** skip / cancel-lot: player goes back to where it came from, no sale. */
async function dropLot({ t, a, u, b }, type) {
  if (!a?.lot) fail(409, 'no active lot');
  const l = a.lot;
  const r = await (await col('auctions')).updateOne({ _id: a._id, 'lot.no': l.no }, { $set: { lot: null } });
  if (!r.modifiedCount) fail(409, 'lot already closed');
  await (await col('players')).updateOne({ _id: l.playerId, status: 'in_auction', teamId: null }, { $set: { status: l.prevStatus || 'approved' } });
  await event(t._id, type, u, { lotNo: l.no, playerId: l.playerId, bid: l.bid, leaderTeamId: l.leaderTeamId, reason: b.reason || null });
  if (type === 'cancel') await audit(t._id, u, 'auction_cancel_lot', { lotNo: l.no, reason: b.reason });
  return { ok: true };
}

export async function reopen(tid, pid) {
  const u = await need(STAFF, tid);
  const { t } = await load(tid);
  const r = await (await col('players')).updateOne({ _id: oid(pid), tournamentId: t._id, status: 'unsold', teamId: null }, { $set: { status: 'approved' } });
  if (!r.modifiedCount) fail(409, 'player is not an unsold player');
  await event(t._id, 'reopen', u, { playerId: oid(pid) });
  await audit(t._id, u, 'auction_reopen', { playerId: pid });
  return { ok: true };
}

async function correctSale({ t, a, u, b }) {
  if (!['organizer', 'super'].includes(u.role)) fail(403, 'only organizers can correct a sale');
  if (!a) fail(409, 'auction has not started');
  const reason = String(b.reason || '').trim();
  if (reason.length < 3) fail(400, 'a reason is required');
  const voidOnly = b.voidOnly === true;
  const newTeamId = b.newTeamId ? oid(b.newTeamId) : null;
  const newPrice = b.newPrice != null && b.newPrice !== '' ? Number(b.newPrice) : null;
  if (newPrice !== null && !(Number.isInteger(newPrice) && newPrice > 0)) fail(400, 'newPrice must be a positive integer');
  if (!voidOnly && !newTeamId && newPrice === null) fail(400, 'give newTeamId and/or newPrice, or voidOnly:true');
  const saleId = oid(b.saleId);
  let out;
  const s = (await client()).startSession();
  try {
    await s.withTransaction(async () => {
      const [P, T, S, L] = await Promise.all(['players', 'teams', 'sales', 'ledger'].map(col));
      const sale = await S.findOne({ _id: saleId, tournamentId: t._id, status: 'confirmed' }, { session: s });
      if (!sale) fail(404, 'confirmed sale not found');
      const p = await P.findOne({ _id: sale.playerId }, { session: s });
      const oldT = await T.findOne({ _id: sale.teamId }, { session: s });
      const toId = newTeamId || sale.teamId, price = newPrice ?? sale.price;
      const moved = String(toId) !== String(sale.teamId);
      const toT = moved ? await T.findOne({ _id: toId, tournamentId: t._id, status: 'approved' }, { session: s }) : oldT;
      if (!toT) fail(400, 'new team not found or not approved');
      if (!voidOnly) {
        const probs = correctionProblems(cfgOf(t), oldT, moved ? toT : null, p.category, sale.price, price);
        if (probs.length) fail(400, probs.join('; '));
      }
      const at = new Date(), key = `counts.${p.category}`;
      await T.updateOne({ _id: oldT._id }, { $inc: { spent: -sale.price, [key]: -1 } }, { session: s });
      await L.insertOne({ tournamentId: t._id, teamId: oldT._id, delta: sale.price, reason: `correction (void sale): ${reason}`, saleId, at }, { session: s });
      let newSaleId = null;
      if (voidOnly) {
        await P.updateOne({ _id: p._id }, { $set: { status: 'approved', teamId: null, price: null, saleId: null } }, { session: s });
      } else {
        const ins = await S.insertOne({ tournamentId: t._id, lotNo: sale.lotNo, playerId: p._id, teamId: toId, price, at, status: 'confirmed', correctionOf: saleId }, { session: s });
        newSaleId = ins.insertedId;
        const tm = await T.updateOne({ _id: toId, $expr: { $lte: [{ $add: ['$spent', price] }, '$budget'] } }, { $inc: { spent: price, [key]: 1 } }, { session: s });
        if (!tm.modifiedCount) fail(409, 'new team budget would be exceeded');
        await L.insertOne({ tournamentId: t._id, teamId: toId, delta: -price, reason: `correction (new sale): ${reason}`, saleId: newSaleId, at }, { session: s });
        await P.updateOne({ _id: p._id }, { $set: { teamId: toId, price, saleId: newSaleId, status: 'sold' } }, { session: s });
      }
      await S.updateOne({ _id: saleId }, { $set: { status: 'voided', voidReason: reason, voidedBy: u._id, voidedAt: at, supersededBy: newSaleId } }, { session: s });
      await event(t._id, 'correction', u, { saleId, newSaleId, from: { teamId: sale.teamId, price: sale.price }, to: voidOnly ? null : { teamId: toId, price }, reason }, s);
      out = { name: p.name, from: oldT, to: voidOnly ? null : toT, price };
    });
  } finally { await s.endSession(); }
  await audit(t._id, u, 'auction_correct_sale', { saleId: b.saleId, newTeamId: b.newTeamId, newPrice, voidOnly, reason });
  await notify(t._id, { teamId: out.from._id }, 'auction', 'Sale corrected', `${out.name}: ${reason}`);
  if (out.to && String(out.to._id) !== String(out.from._id)) await notify(t._id, { teamId: out.to._id }, 'auction', 'Sale corrected', `${out.name}: ${reason}`);
  return { ok: true };
}

export async function summary(t) {
  const [teams, players] = await Promise.all([
    col('teams').then((c) => c.find({ tournamentId: t._id, status: 'approved' }).sort({ name: 1 }).toArray()),
    col('players').then((c) => c.find({ tournamentId: t._id }).toArray()),
  ]);
  const cfg = cfgOf(t);
  const slim = (p) => ({ _id: p._id, name: p.name, photo: p.photo || '', category: p.category, position: p.position, price: p.price ?? null, basePrice: baseOf(t, p), status: p.status });
  const rows = teams.map((tm) => {
    const count = Object.values(tm.counts || {}).reduce((s, n) => s + n, 0);
    return {
      _id: tm._id, name: tm.name, color: tm.color, budget: tm.budget, spent: tm.spent, remaining: tm.budget - tm.spent,
      counts: tm.counts || {}, count, missing: Math.max(0, t.squadSize - count), problems: squadProblems(cfg, tm),
      squad: players.filter((p) => String(p.teamId) === String(tm._id)).map(slim),
    };
  });
  const unassigned = players.filter((p) => !p.teamId && ['approved', 'unsold', 'in_auction', 'hold'].includes(p.status)).map(slim);
  const warnings = [];
  const un = unassigned.filter((p) => p.status === 'unsold').length, hold = unassigned.filter((p) => p.status === 'hold').length;
  if (rows.length !== t.teamsCount) warnings.push(`approved teams ${rows.length}/${t.teamsCount}`);
  if (un) warnings.push(`${un} unsold player(s)`);
  if (hold) warnings.push(`${hold} player(s) on hold`);
  if (unassigned.some((p) => p.status === 'in_auction')) warnings.push('a lot is still active');
  const pending = unassigned.filter((p) => p.status === 'approved').length;
  if (pending) warnings.push(`${pending} approved player(s) never auctioned`);
  return {
    teams: rows, unassigned, warnings,
    totalSpend: rows.reduce((s, r) => s + r.spent, 0),
    canComplete: rows.length > 0 && rows.every((r) => !r.problems.length),
  };
}

async function complete({ t, a, u, b }) {
  if (!a || a.status === 'completed') fail(409, 'auction is not in progress');
  if (a.lot) fail(409, 'close the active lot first');
  const sm = await summary(t);
  const exception = String(b.exception || '').trim();
  if (!sm.canComplete && !exception) {
    fail(400, 'squads are incomplete (' + sm.teams.filter((r) => r.problems.length).map((r) => `${r.name}: ${r.problems.join(', ')}`).join(' | ') + '); record an exception to complete anyway');
  }
  await (await col('auctions')).updateOne({ _id: a._id }, { $set: { status: 'completed', completion: { exception: exception || null, at: new Date(), by: u._id } } });
  await setStatus(t._id, 'auction_completed');
  await event(t._id, 'complete', u, { exception: exception || null });
  await audit(t._id, u, 'auction_complete', { exception: exception || null });
  await notify(t._id, { all: true }, 'auction', 'Auction completed', 'The player auction has finished.');
  return { ok: true };
}

// ---------- public state (polled) ----------
export async function state(t, a, user) {
  const tid = t._id, cfg = cfgOf(t);
  const staff = !!user && ['super', 'organizer', 'auctioneer'].includes(user.role);
  const pub = !!t.auction?.publicPrices;
  const [P, B, S] = await Promise.all(['players', 'bids', 'sales'].map(col));
  const teams = await (await col('teams')).find({ tournamentId: tid, status: 'approved' }).sort({ name: 1 }).toArray();
  const byTeam = Object.fromEntries(teams.map((x) => [String(x._id), x]));
  const own = (id) => !!user?.teamId && String(user.teamId) === String(id);
  const see = (id) => staff || pub || own(id);

  let lot = null, mine = {};
  if (a?.lot) {
    const p = await P.findOne({ _id: a.lot.playerId, tournamentId: tid });
    const { prevStatus, lottery, ...l } = a.lot;
    lot = { ...l, player: p && { ...publicPlayer(p), basePrice: baseOf(t, p) } };
    const lv = lotteryView(lottery, Date.now());
    if (lv) { lot.lottery = lv; if (lv.revealed) lot.leaderTeamId = lv.winnerId; } // once revealed the winner is the leader on every screen
    if (staff && l.leaderTeamId && !lottery) { const tie = await tieFor(t, a.lot, teams); if (tie.length > 1) lot.tie = { price: l.bid, teams: tie.map((x) => x.name) }; }
    const mt = user?.teamId && byTeam[String(user.teamId)];
    if (mt && p) {
      const m = maxBid(cfg, mt, p.category, p.basePrice ?? null);
      const inc = t.auction?.increment || 1, price = a.lot.bid, ld = a.lot.leaderTeamId && byTeam[String(a.lot.leaderTeamId)];
      const lmax = ld ? (maxBid(cfg, ld, p.category, p.basePrice ?? null).max ?? -1) : -1;
      const matched = (a.lot.matchers || []).some((x) => String(x) === String(mt._id));
      mine = { maxBidForLot: m.max ?? null, bidBlock: m.error ?? null, matched,
        canMatch: !!ld && String(ld._id) !== String(mt._id) && !m.error && !matched && !a.lot.lottery && m.max >= price && m.max < price + inc && lmax < price + inc };
    }
  }
  const [bids, sales, grp] = await Promise.all([
    B.find({ tournamentId: tid }).sort({ at: -1 }).limit(15).toArray(),
    S.find({ tournamentId: tid, status: 'confirmed' }).sort({ at: -1 }).limit(10).toArray(),
    P.aggregate([{ $match: { tournamentId: tid } }, { $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
  ]);
  const ids = [...new Set([...bids.map((x) => x.playerId), ...sales.map((x) => x.playerId)].map(String))];
  const names = Object.fromEntries((await P.find({ _id: { $in: ids.map(oid) } }, { projection: { name: 1, category: 1, photo: 1 } }).toArray()).map((p) => [String(p._id), p]));
  const n = Object.fromEntries(grp.map((x) => [x._id, x.n]));
  const total = (n.approved || 0) + (n.in_auction || 0) + (n.sold || 0) + (n.unsold || 0);
  return {
    now: Date.now(), tournamentStatus: t.status, status: a?.status || 'idle', lot, completion: a?.completion || null,
    config: { increment: t.auction?.increment || 1, timerSec: t.auction?.timerSec || 30, categories: cfg.categories, squad: t.squadSize, publicPrices: pub },
    teams: teams.map((x) => {
      const count = Object.values(x.counts || {}).reduce((s, k) => s + k, 0), v = see(x._id);
      return {
        _id: x._id, name: x.name, logo: x.logo, color: x.color, counts: x.counts || {}, count, slots: cfg.squad - count,
        budget: v ? x.budget : null, spent: v ? x.spent : null, remaining: v ? x.budget - x.spent : null,
        ...(own(x._id) ? mine : {}),
      };
    }),
    recentBids: bids.map((x) => ({ lotNo: x.lotNo, amount: x.amount, match: !!x.match, at: x.at, teamId: x.teamId, teamName: byTeam[String(x.teamId)]?.name, playerName: names[String(x.playerId)]?.name })),
    recentSales: sales.map((x) => ({
      _id: x._id, lotNo: x.lotNo, at: x.at, teamId: x.teamId, teamName: byTeam[String(x.teamId)]?.name, color: byTeam[String(x.teamId)]?.color,
      player: names[String(x.playerId)], price: see(x.teamId) ? x.price : null,
    })),
    progress: { sold: n.sold || 0, total, unsold: n.unsold || 0, available: n.approved ? n.approved : n.unsold || 0 },
  };
}

// ---------- dispatch ----------
const ACTIONS = {
  start: [STAFF, start], 'random-pick': [STAFF, randomPick], open: [STAFF, open], bid: [['owner'], bid], close: [STAFF, close],
  pause: [STAFF, pause], resume: [STAFF, resume], suspend: [STAFF, suspend], skip: [STAFF, (c) => dropLot(c, 'skip')],
  'cancel-lot': [STAFF, (c) => dropLot(c, 'cancel')], 'hold-lot': [STAFF, holdLot], 'correct-sale': [['organizer'], correctSale], complete: [STAFF, complete], 'draw-lottery': [STAFF, drawLottery],
};

export async function runAction(name, tid, req, bodyFn) {
  const spec = ACTIONS[name] || fail(404, 'unknown auction action');
  const u = await need(spec[0], tid);
  const b = await bodyFn(req);
  const { t, a } = await load(tid);
  return spec[1]({ t, a, u, b });
}

