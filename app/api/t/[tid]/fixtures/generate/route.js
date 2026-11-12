import { api, body, col, fail, need, oid, tour, audit, json } from '@/lib/server';
import { generateFixtures } from '@/lib/fixtures';
import { decorate, teamsOf } from '@/lib/matchapi';

// Preview by default. {save:true} stores as unpublished drafts. Replacing existing matches needs {replace:true}.
export const POST = api(async (req, { params }) => {
  const { tid } = params;
  const u = await need(['organizer'], tid);
  const b = await body(req);
  const t = await tour(tid);
  const teams = await teamsOf(tid, { status: 'approved' });
  const ids = (b.teamIds?.length ? b.teamIds : teams.map((x) => String(x._id))).map(String);
  if (ids.length < 2) fail(400, 'need at least 2 approved teams');
  if (ids.some((i) => !teams.some((x) => String(x._id) === i))) fail(400, 'unknown team in teamIds');
  const p = {
    venues: t.venues, matchDuration: t.matchDuration, breakDuration: t.breakDuration, format: t.format, ...b,
    teamIds: ids, startDate: b.startDate || (b.dates?.[0] ? undefined : fail(400, 'startDate required')),
  };
  delete p.save; delete p.replace; delete p.force;
  let r;
  try { r = generateFixtures(p); } catch (e) { fail(400, e.message); }
  const toId = (x) => (x ? oid(x) : null);
  const docs = r.matches.map(({ phase, ...m }) => ({
    ...m, tournamentId: oid(tid), homeTeamId: toId(m.homeTeamId), awayTeamId: toId(m.awayTeamId), status: 'scheduled', published: false,
    score: { home: 0, away: 0 }, resultState: 'open', events: [], lineups: { home: [], away: [] }, referee: '', potmPlayerId: null, history: [],
  }));
  if (!b.save) return { matches: await decorate(tid, docs), violations: r.violations, count: docs.length };

  if (r.violations.length && !b.force) fail(400, `Schedule has ${r.violations.length} problem(s): ${r.violations.slice(0, 3).map((v) => v.message).join('; ')}. Fix the parameters or pass force.`);
  const mc = await col('matches'), T = oid(tid);
  const existing = await mc.find({ tournamentId: T }).toArray();
  if (existing.length) {
    if (existing.some((m) => m.resultState === 'final')) fail(409, 'Results already finalized - cannot regenerate. Cancel matches individually.');
    if (!b.replace) fail(409, existing.some((m) => m.published) ? 'Published fixtures exist. Pass replace:true to overwrite them.' : 'Draft fixtures exist. Pass replace:true to overwrite them.');
    await mc.deleteMany({ tournamentId: T });
  }
  await mc.insertMany(docs);
  await (await col('fixture_params')).replaceOne({ tournamentId: T }, { tournamentId: T, params: p }, { upsert: true });
  await audit(tid, u, 'fixtures.generate', { format: p.format, count: docs.length, replaced: existing.length });
  return { ok: true, count: docs.length, violations: r.violations };
});
