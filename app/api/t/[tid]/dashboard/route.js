import { api, col, need, tour } from '@/lib/server';
import { squadProblems } from '@/lib/rules';

export const dynamic = 'force-dynamic';

export const GET = api(async (_req, { params }) => {
  await need(['organizer', 'auctioneer'], params.tid);
  const t = await tour(params.tid);
  const [players, teams, matches] = await Promise.all([
    (await col('players')).find({ tournamentId: t._id }, { projection: { status: 1, teamId: 1 } }).toArray(),
    (await col('teams')).find({ tournamentId: t._id }).toArray(),
    (await col('matches')).find({ tournamentId: t._id }).toArray(),
  ]);
  const base = `/admin/${t._id}`;
  const n = (f) => players.filter(f).length;
  const approvedTeams = teams.filter((x) => x.status === 'approved');
  const cfg = { squad: t.squadSize, categories: t.categories || [] };
  const live = matches.filter((m) => !['cancelled', 'postponed'].includes(m.status));
  const now = new Date().toISOString();
  const name = Object.fromEntries(teams.map((x) => [String(x._id), x.name]));
  const upcoming = live.filter((m) => m.status !== 'completed' && m.start >= now).sort((a, b) => (a.start < b.start ? -1 : 1)).slice(0, 5)
    .map((m) => ({ _id: m._id, start: m.start, venue: m.venue, home: name[String(m.homeTeamId)], away: name[String(m.awayTeamId)] }));
  const w = (key, label, value, href) => ({ key, label, value, href });
  return {
    status: t.status,
    widgets: [
      w('registered', 'Registered players', players.length, `${base}/players`),
      w('approved', 'Approved players', n((p) => ['approved', 'in_auction', 'sold', 'unsold'].includes(p.status)), `${base}/players?status=approved`),
      w('pending', 'Pending registrations', n((p) => p.status === 'pending'), `${base}/players?status=pending`),
      w('hold', 'Players on hold', n((p) => p.status === 'hold'), `${base}/players?status=hold`),
      w('teams', `Approved teams (of ${t.teamsCount})`, approvedTeams.length, `${base}/teams`),
      w('pendingTeams', 'Pending teams', teams.filter((x) => x.status === 'pending').length, `${base}/teams`),
      w('available', 'Available for auction', n((p) => !p.teamId && ['approved', 'unsold'].includes(p.status)), `${base}/auction`),
      w('sold', 'Sold', n((p) => p.status === 'sold'), `${base}/auction`),
      w('unsold', 'Unsold', n((p) => p.status === 'unsold'), `${base}/players?status=unsold`),
      w('spent', 'Points spent', approvedTeams.reduce((s, x) => s + (x.spent || 0), 0), `${base}/reports`),
      w('squads', 'Completed squads', approvedTeams.filter((x) => !squadProblems(cfg, x).length).length, `${base}/teams`),
      w('scheduled', 'Scheduled matches', live.filter((m) => ['scheduled', 'upcoming'].includes(m.status)).length, `${base}/fixtures`),
      w('completed', 'Completed matches', live.filter((m) => m.status === 'completed').length, `${base}/results`),
      w('pendingResults', 'Pending results', live.filter((m) => m.resultState !== 'final' && (m.start < now || m.status === 'completed')).length, `${base}/results`),
    ],
    upcoming,
  };
});
