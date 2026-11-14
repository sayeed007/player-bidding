import { api, body, col, fail, need, oid, tour, audit, json } from '@/lib/server';
import { fromMin, toMin, validateSchedule } from '@/lib/fixtures';
import { STATUSES, decorate, getMatch, isStaff, matchTitle, notifyTeams, squad } from '@/lib/matchapi';

export const dynamic = 'force-dynamic';

// Match + both squads (for pickers). Public only when published.
export const GET = api(async (req, { params }) => {
  const { tid, mid } = params;
  const m = await getMatch(tid, mid);
  const staff = await isStaff(tid);
  if (!m.published && !staff) fail(404, 'match not found');
  const sq = [...(await squad(tid, m)).values()].map((p) => ({ _id: p._id, name: p.name, position: p.position, category: p.category, captain: p.captain, teamId: p.teamId, photo: p.photo }));
  const side = (t) => sq.filter((p) => String(p.teamId) === String(t));
  return { match: (await decorate(tid, [m], staff))[0], squads: { home: side(m.homeTeamId), away: side(m.awayTeamId) } };
});

const SCHEDULE = ['start', 'end', 'venue', 'homeTeamId', 'awayTeamId'];

export const PATCH = api(async (req, { params }) => {
  const { tid, mid } = params;
  const u = await need(['organizer', 'auctioneer'], tid);
  const b = await body(req);
  const m = await getMatch(tid, mid), t = await tour(tid);
  if (m.resultState === 'final') fail(409, 'Result is final - use the correction form');
  if (u.role === 'auctioneer' && SCHEDULE.some((k) => k in b)) fail(403, 'only the organizer can reschedule');

  const set = {};
  if ('status' in b) {
    if (!STATUSES.includes(b.status)) fail(400, 'invalid status');
    set.status = b.status;
  }
  if ('referee' in b) set.referee = String(b.referee || '').slice(0, 100);
  if ('venue' in b) set.venue = String(b.venue || '').slice(0, 100) || null;
  if ('start' in b) {
    if (b.start && !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(b.start)) fail(400, 'start must be YYYY-MM-DDTHH:mm');
    set.start = b.start || null;
    set.end = b.start ? (b.end || fromMin(toMin(b.start) + (t.matchDuration || 60))) : null;
  } else if (b.end) set.end = b.end;
  for (const side of ['homeTeamId', 'awayTeamId']) if (side in b) {
    if (m.resultState !== 'open' || m.events?.length) fail(409, 'cannot change teams once results are recorded');
    if (b[side] && !(await (await col('teams')).findOne({ _id: oid(b[side]), tournamentId: oid(tid) }))) fail(400, 'unknown team');
    set[side] = b[side] ? oid(b[side]) : null;
  }
  if (!Object.keys(set).length) fail(400, 'nothing to change');

  const touchesSchedule = SCHEDULE.some((k) => k in set) || (set.status && !['postponed', 'cancelled'].includes(set.status));
  if (touchesSchedule) {
    const all = await (await col('matches')).find({ tournamentId: oid(tid) }).toArray();
    const saved = (await (await col('fixture_params')).findOne({ tournamentId: oid(tid) }))?.params || {};
    const merged = all.map((x) => (String(x._id) === String(mid) ? { ...x, ...set } : x));
    const bad = validateSchedule(merged, { matchDuration: t.matchDuration, ...saved }).filter((v) => v.ids.includes(String(mid)));
    if (bad.length && !b.force) return json({ error: `Conflicts: ${bad.map((v) => v.message).join('; ')}`, violations: bad }, 409);
  }

  const doc = { $set: set };
  const before = Object.fromEntries(Object.keys(set).map((k) => [k, m[k] ?? null]));
  if (m.published) doc.$push = { history: { at: new Date(), by: u.username, reason: String(b.reason || 'schedule change'), before } };
  await (await col('matches')).updateOne({ _id: m._id }, doc);
  await audit(tid, u, 'match.update', { matchId: mid, before, after: set, reason: b.reason });
  if (m.published && ['start', 'end', 'venue', 'status'].some((k) => k in set)) {
    const n = { ...m, ...set };
    await notifyTeams(tid, n, 'fixture', 'Fixture changed', `${await matchTitle(tid, n)}: ${n.status === 'postponed' ? 'postponed' : `${n.start || 'TBD'} at ${n.venue || 'TBD'}`}${b.reason ? ` (${b.reason})` : ''}`);
  }
  return { ok: true };
});

// Cancel (never hard delete: history and notifications stay meaningful).
export const DELETE = api(async (req, { params }) => {
  const { tid, mid } = params;
  const u = await need(['organizer'], tid);
  const m = await getMatch(tid, mid);
  if (m.resultState === 'final') fail(409, 'Result is final - use the correction form');
  const reason = new URL(req.url).searchParams.get('reason') || 'cancelled';
  await (await col('matches')).updateOne({ _id: m._id }, { $set: { status: 'cancelled' }, ...(m.published ? { $push: { history: { at: new Date(), by: u.username, reason, before: { status: m.status } } } } : {}) });
  await audit(tid, u, 'match.cancel', { matchId: mid, reason });
  if (m.published) await notifyTeams(tid, m, 'fixture', 'Fixture cancelled', await matchTitle(tid, m));
  return { ok: true };
});
