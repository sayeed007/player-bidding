import { api } from '@/lib/server';
import { computeStandings } from '@/lib/standings';
import { loadStats } from '@/lib/matchapi';

export const dynamic = 'force-dynamic';

// {rows:[...]}; with a group stage, rows are per group (each row has `group`, rank is within the group).
export const GET = api(async (req, { params }) => {
  const { t, teams, matches } = await loadStats(params.tid);
  const groups = new Map();
  for (const m of matches.filter((x) => x.stage === 'group' && x.homeTeamId))
    groups.set(m.group, new Set([...(groups.get(m.group) || []), String(m.homeTeamId), String(m.awayTeamId)]));
  if (!groups.size) return { rows: computeStandings(teams, matches, t) };
  const rows = [...groups.keys()].sort().flatMap((g) =>
    computeStandings(teams.filter((x) => groups.get(g).has(String(x._id))), matches, t, { group: g }).map((r) => ({ ...r, group: g })));
  return { rows, groups: [...groups.keys()].sort() };
});
