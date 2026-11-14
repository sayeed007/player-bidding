import { api, body, col, fail, need, oid, tour, audit, json } from '@/lib/server';
import { generateFixtures, generateRemaining, isPlayedMatch } from '@/lib/fixtures';
import { decorate, teamsOf } from '@/lib/matchapi';

// Preview by default. {save:true} stores as unpublished drafts. Replacing existing matches needs {replace:true}.
// {keepPlayed:true}: matches with a final result are left untouched and only the rest is re-scheduled.
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
  delete p.save; delete p.replace; delete p.force; delete p.keepPlayed;
  const mc = await col('matches'), T = oid(tid);
  const existing = await mc.find({ tournamentId: T }).toArray();
  // anything with a result, a live status or recorded events is 'played': never deleted or rescheduled
  const played = existing.filter(isPlayedMatch);
  let r;
  try { r = b.keepPlayed ? generateRemaining(p, played) : generateFixtures(p); } catch (e) { fail(400, e.message); }
  const toId = (x) => (x ? oid(x) : null);
  const docs = r.matches.map(({ phase, ...m }) => ({
    ...m, tournamentId: oid(tid), homeTeamId: toId(m.homeTeamId), awayTeamId: toId(m.awayTeamId), status: 'scheduled', published: false,
    score: { home: 0, away: 0 }, resultState: 'open', events: [], lineups: { home: [], away: [] }, referee: '', potmPlayerId: null, history: [],
  }));
  if (!b.save) return { matches: await decorate(tid, docs), violations: r.violations, count: docs.length, kept: r.kept || 0 };

  if (r.violations.length && !b.force) fail(400, `Schedule has ${r.violations.length} problem(s): ${r.violations.slice(0, 3).map((v) => v.message).join('; ')}. Fix the parameters or pass force.`);
  const keep = new Set(played.map((m) => String(m._id)));
  const replaceable = existing.filter((m) => !keep.has(String(m._id)));
  if (!b.keepPlayed && played.length) fail(409, `${played.length} match(es) already have results or live data, so the fixtures cannot be regenerated from scratch. Turn on "Keep played matches" to re-schedule only the unplayed ones.`);
  if (replaceable.length && !b.replace) fail(409, replaceable.some((m) => m.published) ? 'Published fixtures exist. Pass replace:true to overwrite them.' : 'Draft fixtures exist. Pass replace:true to overwrite them.');
  if (replaceable.length) await mc.deleteMany({ tournamentId: T, _id: { $in: replaceable.map((m) => m._id) } });
  await mc.insertMany(docs);
  await (await col('fixture_params')).replaceOne({ tournamentId: T }, { tournamentId: T, params: p }, { upsert: true });
  await audit(tid, u, 'fixtures.generate', { format: p.format, count: docs.length, replaced: replaceable.length, kept: played.length });
  return { ok: true, count: docs.length, violations: r.violations, kept: played.length };
});
