import { api, col, needTeam, tour, oid, fail } from '@/lib/server';
import { quota, teamCount } from '@/lib/setup';

export const dynamic = 'force-dynamic';

/** Budget, ledger and category quota for a team. [own team | staff] */
export const GET = api(async (_req, { params }) => {
  await needTeam(params.tid, params.teamId);
  const t = await tour(params.tid);
  const team = (await (await col('teams')).findOne({ _id: oid(params.teamId), tournamentId: t._id })) || fail(404, 'team not found');
  const ledger = await (await col('ledger')).find({ tournamentId: t._id, teamId: team._id }).sort({ at: -1 }).limit(200).toArray();
  const count = teamCount(team);
  return {
    budget: team.budget, spent: team.spent || 0, remaining: team.budget - (team.spent || 0),
    count, slots: Math.max(0, t.squadSize - count), squad: t.squadSize, quota: quota(t, team), ledger,
  };
});
