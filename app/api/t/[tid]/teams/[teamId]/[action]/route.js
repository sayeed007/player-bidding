import { api, col, need, tour, oid, fail, audit } from '@/lib/server';
import { approveTeam } from '@/lib/setup-server';

/** approve -> sets budget, creates owner login, returns the one-time {username,password}. reject -> deactivates owner login. */
export const POST = api(async (_req, { params }) => {
  const u = await need(['organizer'], params.tid);
  const t = await tour(params.tid);
  const teams = await col('teams');
  const team = (await teams.findOne({ _id: oid(params.teamId), tournamentId: t._id })) || fail(404, 'team not found');
  if (params.action === 'approve') return await approveTeam(t, team, u);
  if (params.action !== 'reject') fail(404, 'unknown action');
  if (await (await col('players')).countDocuments({ tournamentId: t._id, teamId: team._id })) fail(409, 'team already owns players and cannot be rejected');
  await teams.updateOne({ _id: team._id }, { $set: { status: 'rejected' } });
  if (team.ownerUserId) await (await col('users')).updateOne({ _id: team.ownerUserId }, { $set: { active: false } });
  await audit(t._id, u, 'team.reject', { teamId: team._id, name: team.name });
  return { status: 'rejected' };
});
