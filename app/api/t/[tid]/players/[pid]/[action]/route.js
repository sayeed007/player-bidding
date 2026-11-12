import { api, col, body, need, tour, oid, fail, audit } from '@/lib/server';

// Soft state changes only: players are never hard-deleted (sales/match history stays intact).
const ACTIONS = {
  approve: { from: ['pending', 'draft', 'hold', 'withdrawn'], to: 'approved' },
  reject: { from: ['pending', 'draft'], to: 'withdrawn' },
  hold: { from: ['approved', 'unsold'], to: 'hold' },
  release: { from: ['hold'], to: 'approved' },
  withdraw: { from: ['pending', 'draft', 'approved', 'hold', 'unsold'], to: 'withdrawn' },
};

export const POST = api(async (req, { params }) => {
  const u = await need(['organizer'], params.tid);
  const t = await tour(params.tid);
  const a = ACTIONS[params.action] || fail(404, 'unknown action');
  const players = await col('players');
  const p = (await players.findOne({ _id: oid(params.pid), tournamentId: t._id })) || fail(404, 'player not found');
  if (p.teamId || !a.from.includes(p.status)) fail(409, `cannot ${params.action} a player who is ${p.status}${p.teamId ? ' and assigned to a team' : ''}`);
  const b = await body(req);
  const $set = { status: a.to };
  if (params.action === 'approve') {
    const category = String(b.category || p.category || '');
    if (!(t.categories || []).some((c) => c.code === category && c.active !== false)) fail(400, 'choose an active category before approving');
    $set.category = category;
  }
  if (params.action === 'reject') $set.rejected = true;
  await players.updateOne({ _id: p._id }, { $set, ...(params.action === 'approve' ? { $unset: { rejected: '' } } : {}) });
  await audit(t._id, u, `player.${params.action}`, { playerId: p._id, name: p.name, from: p.status, reason: String(b.reason || '') });
  return { status: a.to };
});
