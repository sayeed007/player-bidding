// Server-only SETUP helpers (viewer/privacy, users, team approval).
import { col, me, oid, fail, publicPlayer, audit } from './server.js';
import { hash, randomPassword } from './hash.js';
import { slug, effectivePrice, teamCount } from './setup.js';

const isStaffFor = (u, tid, roles) => !!u && (u.role === 'super' || (roles.includes(u.role) && String(u.tournamentId) === String(tid)));
/** Who is looking? staff = organizer/auctioneer/super of tid; admin = organizer/super. */
export async function viewer(tid) {
  const u = await me();
  const staff = isStaffFor(u, tid, ['organizer', 'auctioneer']);
  // categories are visible to staff and to team owners/captains of this tournament only
  const cats = staff || (!!u?.teamId && String(u.tournamentId) === String(tid));
  return { u, staff, admin: isStaffFor(u, tid, ['organizer']), cats };
}
/** Drop the category (and turn it into a plain base price) for viewers who may not see it. */
export function hideCategory(p, t, v) {
  if (v.cats || !p || !('category' in p)) return p;
  const { category, ...o } = p;
  return { ...o, basePrice: effectivePrice(p, t) };
}
const sameId = (a, b) => a && b && String(a) === String(b);
export const ownTeam = (v, teamId) => sameId(v.u?.teamId, teamId);
/** May this viewer see prices/budgets for this team (or any team when teamId omitted)? */
export const showPrices = (t, v, teamId) => v.staff || !!t.auction?.publicPrices || ownTeam(v, teamId);

/** Shape a player for the viewer: staff/self see everything, others the public view without hidden prices. */
export function shapePlayer(p, t, v) {
  if (v.staff || sameId(v.u?.playerId, p._id)) return p;
  const o = hideCategory(publicPlayer(p), t, v);
  if (!v.cats) o.basePrice = effectivePrice(p, t);
  delete o.userId;
  if (!showPrices(t, v, p.teamId)) delete o.price;
  return o;
}
export function shapeTeam(team, t, v) {
  if (v.staff || ownTeam(v, team._id)) return team;
  const { contact, ownerUserId, ...o } = team;
  if (!showPrices(t, v)) { delete o.budget; delete o.spent; }
  if (!v.cats) { o.count = teamCount(team); delete o.counts; } // per-category counts would reveal categories
  return o;
}

/** Create a login. Returns {_id, username, password?} (password only when generated). */
export async function makeUser(b, { tid = null, roles }) {
  const username = String(b.username || '').toLowerCase().trim();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) fail(400, 'username: 3-30 chars, letters/digits . _ -');
  if (!roles.includes(b.role)) fail(400, `role must be one of ${roles.join(', ')}`);
  const generated = !b.password;
  const password = generated ? randomPassword() : String(b.password);
  if (password.length < 6) fail(400, 'password must be at least 6 characters');
  const doc = { username, hash: hash(password), role: b.role, name: String(b.name || '').trim() || username, active: true, createdAt: new Date() };
  const tId = tid || b.tournamentId || null;
  if (tId) doc.tournamentId = oid(tId);
  if (['owner', 'captain'].includes(b.role)) {
    if (!b.teamId) fail(400, 'teamId required');
    const team = await (await col('teams')).findOne({ _id: oid(b.teamId), tournamentId: doc.tournamentId });
    if (!team) fail(400, 'team not in this tournament');
    doc.teamId = team._id;
  }
  if (b.role === 'player') {
    if (!b.playerId) fail(400, 'playerId required');
    const pl = await (await col('players')).findOne({ _id: oid(b.playerId), tournamentId: doc.tournamentId });
    if (!pl) fail(400, 'player not in this tournament');
    doc.playerId = pl._id;
  }
  if (['organizer', 'auctioneer', 'owner', 'captain', 'player'].includes(b.role) && !doc.tournamentId) fail(400, 'tournamentId required');
  try { var r = await (await col('users')).insertOne(doc); } catch (e) {
    if (e.code === 11000) fail(409, 'username already taken');
    throw e;
  }
  if (doc.playerId) await (await col('players')).updateOne({ _id: doc.playerId }, { $set: { userId: r.insertedId } });
  return { _id: r.insertedId, username, ...(generated ? { password } : {}) };
}

const sameName = { collation: { locale: 'en', strength: 2 } };
export const teamNameTaken = async (tid, name, exceptId) =>
  !!(await (await col('teams')).findOne({ tournamentId: tid, name, status: { $ne: 'rejected' }, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }, sameName));

/** Approve a pending team: budget, owner login. Returns {username, password}. */
export async function approveTeam(t, team, by) {
  const teams = await col('teams');
  if (team.status === 'approved') fail(409, 'team already approved');
  if ((await teams.countDocuments({ tournamentId: t._id, status: 'approved' })) >= t.teamsCount) fail(409, `tournament already has ${t.teamsCount} approved teams`);
  if (await teamNameTaken(t._id, team.name, team._id)) fail(409, 'team name already used in this tournament');
  const users = await col('users');
  let cred;
  if (team.ownerUserId) { // re-approval: new password for the existing login
    const password = randomPassword();
    const u = await users.findOneAndUpdate({ _id: team.ownerUserId }, { $set: { hash: hash(password), active: true } });
    cred = { username: u?.username, password };
  } else {
    const base = slug(team.ownerName) || slug(team.name) || 'owner';
    for (let i = 0; ; i++) {
      const username = i ? `${base}${i + 1}` : base;
      if (await users.findOne({ username })) continue;
      cred = await makeUser({ username, role: 'owner', name: `${team.ownerName} (owner)`, teamId: team._id }, { tid: t._id, roles: ['owner'] }).catch((e) => (e.status === 409 ? null : Promise.reject(e)));
      if (cred) break;
    }
  }
  const set = { status: 'approved', budget: t.budget, spent: 0, counts: team.counts || {} };
  if (cred._id) set.ownerUserId = cred._id;
  await teams.updateOne({ _id: team._id }, { $set: set });
  await audit(t._id, by, 'team.approve', { teamId: team._id, name: team.name });
  return { username: cred.username, password: cred.password };
}
