// Server helpers for the MATCH module's routes.
import { randomUUID } from 'node:crypto';
import { col, oid, fail, me, audit, notify } from './server.js';
import { FINAL, computeStandings } from './standings.js';

export const EVENT_TYPES = ['goal', 'own_goal', 'penalty_goal', 'assist', 'yellow', 'red', 'sub'];
export const STATUSES = ['scheduled', 'upcoming', 'live', 'half_time', 'completed', 'postponed', 'cancelled', 'forfeited'];
const PERIODS = ['1H', '2H', 'ET', 'PEN'];

export async function isStaff(tid) {
  const u = await me();
  return !!u && (u.role === 'super' || (['organizer', 'auctioneer'].includes(u.role) && String(u.tournamentId) === String(tid)));
}

export async function getMatch(tid, mid) {
  return (await (await col('matches')).findOne({ _id: oid(mid), tournamentId: oid(tid) })) || fail(404, 'match not found');
}

export const teamsOf = async (tid, filter = {}) => (await col('teams')).find({ tournamentId: oid(tid), ...filter }).toArray();

/** Add homeName/awayName/colors/logos and player names on events. History only for staff. */
export async function decorate(tid, matches, staff = false) {
  const teams = new Map((await teamsOf(tid)).map((t) => [String(t._id), t]));
  const ids = new Set(matches.flatMap((m) => (m.events || []).flatMap((e) => [e.playerId, e.assistPlayerId, e.inPlayerId].filter(Boolean).map(String))));
  const pl = ids.size ? await (await col('players')).find({ tournamentId: oid(tid), _id: { $in: [...ids].map(oid) } }).project({ name: 1 }).toArray() : [];
  const names = new Map(pl.map((p) => [String(p._id), p.name]));
  return matches.map((m) => {
    const h = teams.get(String(m.homeTeamId)), a = teams.get(String(m.awayTeamId));
    const { history, ...rest } = m;
    return {
      ...(staff ? m : rest),
      homeName: h?.name || m.homeLabel || 'TBD', awayName: a?.name || m.awayLabel || 'TBD',
      homeColor: h?.color, awayColor: a?.color, homeLogo: h?.logo, awayLogo: a?.logo,
      events: (m.events || []).map((e) => ({ ...e, playerName: names.get(String(e.playerId)), assistName: names.get(String(e.assistPlayerId)), inName: names.get(String(e.inPlayerId)) })),
    };
  });
}

/** Players on the two teams of a match: Map(id -> player). */
export async function squad(tid, m) {
  const ps = await (await col('players')).find({ tournamentId: oid(tid), teamId: { $in: [m.homeTeamId, m.awayTeamId].filter(Boolean) } }).toArray();
  return new Map(ps.map((p) => [String(p._id), p]));
}

/** BR-11: validate + normalise one event against the two squads. teamId is derived server-side from the player. */
export function cleanEvent(raw, sq) {
  const type = raw.type;
  if (!EVENT_TYPES.includes(type)) fail(400, 'invalid event type');
  const p = sq.get(String(raw.playerId));
  if (!p) fail(400, 'player does not belong to a participating team');
  const minute = Number(raw.minute ?? 0), period = raw.period || (minute > 45 ? '2H' : '1H');
  if (!Number.isInteger(minute) || minute < 0 || minute > 150) fail(400, 'invalid minute');
  if (!PERIODS.includes(period)) fail(400, 'invalid period');
  const e = { id: raw.id || randomUUID().slice(0, 8), type, minute, period, teamId: p.teamId, playerId: p._id };
  const mate = (id, what) => {
    const q = sq.get(String(id));
    if (!q || String(q.teamId) !== String(p.teamId) || String(q._id) === String(p._id)) fail(400, `${what} must be another player of the same team`);
    return q._id;
  };
  if (raw.assistPlayerId && (type === 'goal' || type === 'penalty_goal')) e.assistPlayerId = mate(raw.assistPlayerId, 'assist player');
  if (type === 'sub') e.inPlayerId = mate(raw.inPlayerId, 'substitute');
  return e;
}

/** Notify both teams of a match (placeholders without a team are skipped). */
export async function notifyTeams(tid, m, type, title, text) {
  for (const t of [m.homeTeamId, m.awayTeamId].filter(Boolean)) await notify(tid, { teamId: t }, type, title, text);
}

export const matchTitle = async (tid, m) => { const d = (await decorate(tid, [m]))[0]; return `${d.homeName} vs ${d.awayName}`; };

/** After a result: fill knockout placeholders with winners and resolve seeded entries (group/league ranks) once their stage is complete. */
export async function advance(tid) {
  const mc = await col('matches'), T = oid(tid);
  const all = await mc.find({ tournamentId: T }).toArray();
  const byKey = new Map(all.filter((m) => m.key).map((m) => [m.key, m]));
  const set = async (m, side, teamId) => {
    if (FINAL(m) || ['live', 'half_time'].includes(m.status) || String(m[`${side}TeamId`]) === String(teamId)) return;
    m[`${side}TeamId`] = teamId;
    await mc.updateOne({ _id: m._id }, { $set: { [`${side}TeamId`]: teamId } });
  };
  for (const m of all) for (const side of ['home', 'away']) {
    const src = byKey.get(m.from?.[side]);
    if (src && FINAL(src)) {
      const { home, away } = src.score;
      const w = home > away ? src.homeTeamId : away > home ? src.awayTeamId : src.winnerTeamId;
      if (w) await set(m, side, w);
    }
  }
  const t = await (await col('tournaments')).findOne({ _id: T });
  const teams = await teamsOf(tid, { status: 'approved' });
  const done = (stage, group) => { const l = all.filter((x) => x.stage === stage && (group == null || x.group === group) && x.status !== 'cancelled'); return l.length > 0 && l.every(FINAL); };
  for (const m of all) for (const side of ['home', 'away']) {
    const s = m.seed?.[side];
    if (!s) continue;
    const stage = s.group ? 'group' : 'league';
    if (!done(stage, s.group)) continue;
    const grp = s.group ? new Set(all.filter((x) => x.stage === 'group' && x.group === s.group).flatMap((x) => [String(x.homeTeamId), String(x.awayTeamId)])) : null;
    const rows = computeStandings(teams.filter((x) => !grp || grp.has(String(x._id))), all, t, { group: s.group });
    const r = rows[s.rank - 1];
    if (r) await set(m, side, oid(r.teamId));
  }
}

export { audit };

/** Load everything computeStats needs. Derived fresh on every call (spec 13.4). */
export async function loadStats(tid) {
  const T = oid(tid);
  const [t, teams, players, matches] = await Promise.all([
    (await col('tournaments')).findOne({ _id: T }), teamsOf(tid, { status: 'approved' }),
    (await col('players')).find({ tournamentId: T, teamId: { $ne: null } }).toArray(),
    (await col('matches')).find({ tournamentId: T }).toArray(),
  ]);
  return { t, teams, players, matches };
}
