// Tournament lifecycle + pre-auction readiness. Server-side only.
import { col, oid } from './server.js';
import { categoryProblems } from './rules.js';

export const STATUSES = [
  'draft', 'registration_open', 'registration_closed', 'auction_ready', 'auction_in_progress',
  'auction_completed', 'tournament_in_progress', 'tournament_completed', 'archived',
];

/** Supply vs demand per category + config/team problems. errors block auction_ready; warnings don't. */
export async function auctionReadiness(t) {
  const errors = [], warnings = [];
  errors.push(...categoryProblems(t.squadSize, t.categories || []));
  const teams = await (await col('teams')).find({ tournamentId: t._id }).toArray();
  const approved = teams.filter((x) => x.status === 'approved');
  if (approved.length !== t.teamsCount) errors.push(`approved teams ${approved.length}/${t.teamsCount}`);
  const pending = teams.filter((x) => x.status === 'pending').length;
  if (pending) warnings.push(`${pending} team registration(s) still pending`);

  const players = await (await col('players')).find({ tournamentId: t._id, status: { $in: ['approved', 'hold', 'in_auction', 'sold', 'unsold'] } }).toArray();
  const supply = {};
  for (const c of t.categories || []) {
    if (c.active === false) continue;
    const need = c.min * t.teamsCount;
    const have = players.filter((p) => p.category === c.code).length;
    supply[c.code] = { need, have };
    if (have < need) errors.push(`category ${c.code}: shortage of ${need - have} (have ${have}, need ${need})`);
    else if (have > need) warnings.push(`category ${c.code}: surplus of ${have - need}`);
  }
  const held = players.filter((p) => p.status === 'hold').length;
  if (held) warnings.push(`${held} player(s) on hold are excluded from the auction`);
  const pend = await (await col('players')).countDocuments({ tournamentId: t._id, status: 'pending' });
  if (pend) warnings.push(`${pend} player registration(s) pending approval`);
  return { errors, warnings, supply };
}

/** Problems preventing a move to `to` (empty array = allowed). */
export async function checkTransition(t, to) {
  const i = STATUSES.indexOf(t.status), j = STATUSES.indexOf(to);
  if (j < 0) return [`unknown status ${to}`];
  if (j !== i + 1 && !(to === 'registration_open' && t.status === 'registration_closed')) {
    return [`cannot go from ${t.status} to ${to}`];
  }
  const errors = [];
  if (to === 'registration_open') {
    if (!t.name) errors.push('name required');
    errors.push(...categoryProblems(t.squadSize, t.categories || []));
  }
  if (to === 'auction_ready') errors.push(...(await auctionReadiness(t)).errors);
  if (to === 'tournament_in_progress') {
    const n = await (await col('matches')).countDocuments({ tournamentId: t._id, published: true });
    if (!n) errors.push('no published fixtures');
  }
  if (to === 'tournament_completed') {
    const open = await (await col('matches')).countDocuments({
      tournamentId: t._id, status: { $nin: ['cancelled', 'postponed'] }, resultState: { $ne: 'final' },
    });
    if (open) errors.push(`${open} match(es) without a finalized result`);
  }
  // auction_in_progress / auction_completed are driven by the auction module (it validates itself).
  return errors;
}

export async function setStatus(tid, to) {
  await (await col('tournaments')).updateOne({ _id: oid(tid) }, { $set: { status: to } });
}
