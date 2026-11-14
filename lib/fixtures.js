// Pure fixture engine: pairings, brackets, greedy scheduling, validation. No DB, no Date-with-timezone.
// Times are naive local strings 'YYYY-MM-DDTHH:mm' (what <input type=datetime-local> produces).
//
// Knockout approach (simple + correct): ALL rounds are generated up front. Round 1 uses real teams
// (byes go straight to round 2 for the top seeds). Later rounds are placeholder matches with
// homeTeamId/awayTeamId = null, homeLabel 'Winner of Semi-final 1' and `from:{home:key,away:key}`.
// When a match is finalized the server fills the winner into the placeholder (see lib/matchapi.js advance()).
// Group->knockout and league->playoff entries carry `seed:{group?,rank}`, resolved once the stage is complete.

const pad = (n) => String(n).padStart(2, '0');
export const tod = (hhmm) => { const [h, m = 0] = String(hhmm).split(':').map(Number); return h * 60 + m; };
export const toMin = (s) => {
  const [d, t = '00:00'] = String(s).split('T');
  const [y, mo, da] = d.split('-').map(Number);
  return Date.UTC(y, mo - 1, da, ...t.split(':').map(Number)) / 60000;
};
export const fromMin = (n) => new Date(n * 60000).toISOString().slice(0, 16);
const dayOf = (s) => String(s).slice(0, 10);
const weekday = (day) => new Date(`${day}T00:00:00Z`).getUTCDay();
const addDays = (day, n) => fromMin(toMin(day) + n * 1440).slice(0, 10);

/** Circle method. Returns rounds: [[{home,away}]]. Odd team counts get a bye (that team just sits out). */
export function roundRobin(ids, double = false) {
  const t = [...ids];
  if (t.length % 2) t.push(null);
  const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const ms = [];
    for (let i = 0; i < n / 2; i++) {
      let a = t[i], b = t[n - 1 - i];
      if (a == null || b == null) continue;
      if (i === 0 && r % 2) [a, b] = [b, a]; // keep the fixed team's home/away balanced
      ms.push({ home: a, away: b });
    }
    rounds.push(ms);
    t.splice(1, 0, t.pop());
  }
  return double ? [...rounds, ...rounds.map((r) => r.map((m) => ({ home: m.away, away: m.home })))] : rounds;
}

function rrMatches(ids, double, stage, group, prefix) {
  return roundRobin(ids, double).flatMap((ms, r) => ms.map((m, i) => ({
    stage, round: r + 1, ...(group ? { group } : {}), label: group ? `Group ${group} - Round ${r + 1}` : `Round ${r + 1}`,
    key: `${prefix}${r + 1}-${i + 1}`, no: i + 1, phase: 0, homeTeamId: m.home, awayTeamId: m.away,
  })));
}

const seedOrder = (size) => { let o = [1]; while (o.length < size) o = o.flatMap((x) => [x, 2 * o.length + 1 - x]); return o; };
const roundName = (n) => (n === 1 ? 'Final' : n === 2 ? 'Semi-final' : n === 4 ? 'Quarter-final' : `Round of ${n * 2}`);

/** entries: [{teamId}] or [{label, seed}] in seed order. Returns all bracket matches (see header comment). */
export function knockout(entries, stage = 'knockout', prefix = 'K', phase0 = 1) {
  const n = entries.length;
  if (n < 2) return [];
  let size = 1; while (size < n) size *= 2;
  let refs = seedOrder(size).map((s) => (entries[s - 1] ? { e: entries[s - 1] } : null));
  const out = []; let round = 1;
  while (refs.length > 1) {
    const next = [], total = refs.length / 2;
    for (let i = 0; i < refs.length; i += 2) {
      const [a, b] = [refs[i], refs[i + 1]];
      if (!a || !b) { next.push(a || b); continue; } // bye
      const no = i / 2 + 1, key = `${prefix}${round}-${no}`;
      const label = total > 1 ? `${roundName(total)} ${no}` : roundName(total);
      const m = { stage, round, no, key, label, phase: phase0 + round - 1, homeTeamId: null, awayTeamId: null };
      for (const [side, r] of [['home', a], ['away', b]]) {
        if (r.e) {
          m[`${side}TeamId`] = r.e.teamId ?? null;
          if (r.e.label) m[`${side}Label`] = r.e.label;
          if (r.e.seed) (m.seed ??= {})[side] = r.e.seed;
        } else { (m.from ??= {})[side] = r.from; m[`${side}Label`] = `Winner of ${r.name}`; }
      }
      out.push(m);
      next.push({ from: key, name: label });
    }
    refs = next; round++;
  }
  return out;
}

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

/** Pairings only (no dates). p: {format, teamIds, groups, advance, playoffTeams, double} */
export function pairings(p) {
  const ids = p.teamIds || [];
  const f = p.format || 'single';
  if (f === 'single' || f === 'double') return rrMatches(ids, f === 'double', 'league', null, 'L');
  if (f === 'knockout') return knockout(ids.map((teamId) => ({ teamId })));
  if (f === 'league_playoff') {
    const k = Math.max(2, Math.min(Number(p.playoffTeams) || 4, ids.length));
    return [...rrMatches(ids, !!p.double, 'league', null, 'L'),
      ...knockout(Array.from({ length: k }, (_, i) => ({ label: `${ordinal(i + 1)} in league`, seed: { rank: i + 1 } })), 'playoff', 'P')];
  }
  if (f === 'group_knockout') {
    const g = Math.max(2, Math.min(Number(p.groups) || 2, Math.floor(ids.length / 2)));
    const groups = Array.from({ length: g }, () => []);
    ids.forEach((id, i) => groups[Math.floor(i / g) % 2 ? g - 1 - (i % g) : i % g].push(id)); // snake
    const names = groups.map((_, i) => String.fromCharCode(65 + i));
    const adv = Math.max(1, Math.min(Number(p.advance) || 2, Math.min(...groups.map((x) => x.length))));
    const entries = [];
    for (let r = 1; r <= adv; r++) names.forEach((G) => entries.push({ label: `${ordinal(r)} in Group ${G}`, seed: { group: G, rank: r } }));
    return [...groups.flatMap((gt, i) => rrMatches(gt, !!p.double, 'group', names[i], `G${names[i]}`)), ...knockout(entries)];
  }
  throw new Error('unknown format');
}

const WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const days = (v) => (v || []).map((d) => (typeof d === 'number' || /^\d$/.test(d) ? Number(d) : WEEK.indexOf(String(d).slice(0, 3).toLowerCase()))).filter((d) => d >= 0);

/** Fill defaults / coerce numbers. */
export function normalize(p = {}) {
  const dur = Number(p.matchDuration) || 60, brk = Number(p.breakDuration ?? 10) || 0;
  return {
    ...p, matchDuration: dur, breakDuration: brk,
    maxMatchesPerTeamPerDay: Number(p.maxMatchesPerTeamPerDay) || 1,
    minRestMinutes: Number(p.minRestMinutes) || 0,
    venues: (p.venues || []).filter(Boolean).length ? p.venues.filter(Boolean) : ['Main Ground'],
    matchDays: days(p.matchDays), dates: (p.dates || []).filter(Boolean).sort(),
    timeSlots: (p.timeSlots || []).filter(Boolean),
    dayStart: p.dayStart || '16:00', dayEnd: p.dayEnd || '20:00',
  };
}

function* slots(p) {
  const times = p.timeSlots.length ? p.timeSlots.map(tod) : (() => {
    const a = []; for (let t = tod(p.dayStart); t + p.matchDuration <= tod(p.dayEnd); t += p.matchDuration + p.breakDuration) a.push(t); return a;
  })();
  const list = p.dates.length ? p.dates : Array.from({ length: 400 }, (_, i) => addDays(p.startDate, i)).filter((d) => !p.matchDays.length || p.matchDays.includes(weekday(d)));
  for (const day of list) for (const t of times.sort((a, b) => a - b)) for (const venue of p.venues) {
    const s = toMin(day) + t; yield { day, s, e: s + p.matchDuration, venue };
  }
}

/** Greedy: matches in order take the earliest slot where venue is free and each team is free / rested / under the daily cap.
 *  Matches of a later `phase` start only after every earlier phase has ended. Unplaceable matches get start:null. */
export function schedule(matches, params) {
  const p = normalize(params);
  if (!p.startDate && !p.dates.length) throw new Error('startDate required');
  const all = [...slots(p)];
  const teamBusy = new Map(), venueBusy = new Map(), perDay = new Map(), phaseEnd = {};
  const free = (list, s, e, gap) => (list || []).every((x) => s >= x.e + gap || e + gap <= x.s);
  return matches.map((m) => {
    const barrier = Math.max(-Infinity, ...Object.entries(phaseEnd).filter(([ph]) => Number(ph) < m.phase).map(([, e]) => e + p.minRestMinutes));
    const ts = [m.homeTeamId, m.awayTeamId].filter(Boolean).map(String);
    const slot = all.find((x) => x.s >= barrier && free(venueBusy.get(x.venue), x.s, x.e, 0)
      && ts.every((t) => free(teamBusy.get(t), x.s, x.e, p.minRestMinutes) && (perDay.get(`${t}|${x.day}`) || 0) < p.maxMatchesPerTeamPerDay));
    if (!slot) return { ...m, venue: null, start: null, end: null };
    const iv = { s: slot.s, e: slot.e };
    venueBusy.set(slot.venue, [...(venueBusy.get(slot.venue) || []), iv]);
    ts.forEach((t) => { teamBusy.set(t, [...(teamBusy.get(t) || []), iv]); perDay.set(`${t}|${slot.day}`, (perDay.get(`${t}|${slot.day}`) || 0) + 1); });
    phaseEnd[m.phase] = Math.max(phaseEnd[m.phase] ?? -Infinity, slot.e);
    return { ...m, venue: slot.venue, start: fromMin(slot.s), end: fromMin(slot.e) };
  });
}

/** Returns [{type, message, ids:[matchId...]}]. Reused for generated and manually edited schedules. */
export function validateSchedule(matches, params = {}) {
  const p = normalize(params), v = [];
  const id = (m) => String(m._id ?? m.key);
  const add = (type, message, ...ids) => v.push({ type, message, ids });
  const name = (m) => m.label || id(m);
  const live = matches.filter((m) => !['cancelled', 'postponed'].includes(m.status));
  const double = p.format === 'double' || (p.format === 'league_playoff' || p.format === 'group_knockout') && p.double;

  const pairs = new Map();
  for (const m of live) {
    if (m.homeTeamId && String(m.homeTeamId) === String(m.awayTeamId)) add('self_match', `${name(m)}: a team cannot play itself`, id(m));
    if (!['league', 'group'].includes(m.stage) || !m.homeTeamId || !m.awayTeamId) continue;
    const ks = [String(m.homeTeamId), String(m.awayTeamId)];
    const k = `${m.stage}|${m.group || ''}|${[...ks].sort()}`, o = `${k}|${ks}`;
    const e = pairs.get(k) || { n: 0, dir: new Set(), ids: [] };
    e.n++; e.ids.push(id(m));
    if (e.dir.has(o)) e.dupDir = true;
    e.dir.add(o); pairs.set(k, e);
  }
  for (const e of pairs.values()) if (e.n > (double ? 2 : 1) || e.dupDir) add('duplicate_pairing', 'Duplicate pairing', ...e.ids);

  const timed = live.filter((m) => m.start).map((m) => ({ m, s: toMin(m.start), e: m.end ? toMin(m.end) : toMin(m.start) + p.matchDuration }));
  for (let i = 0; i < timed.length; i++) for (let j = i + 1; j < timed.length; j++) {
    const a = timed[i], b = timed[j];
    const overlap = a.s < b.e && b.s < a.e;
    const shared = [a.m.homeTeamId, a.m.awayTeamId].filter((t) => t && [b.m.homeTeamId, b.m.awayTeamId].some((u) => String(u) === String(t)));
    if (shared.length) {
      if (overlap) add('team_overlap', `A team is in overlapping matches (${name(a.m)} / ${name(b.m)})`, id(a.m), id(b.m));
      else if (Math.max(a.s, b.s) - Math.min(a.e, b.e) < p.minRestMinutes) add('rest', `Less than ${p.minRestMinutes} min rest between ${name(a.m)} and ${name(b.m)}`, id(a.m), id(b.m));
    }
    if (overlap && a.m.venue && a.m.venue === b.m.venue) add('venue_conflict', `Venue ${a.m.venue} double-booked (${name(a.m)} / ${name(b.m)})`, id(a.m), id(b.m));
  }
  const cnt = new Map();
  for (const { m } of timed) for (const t of [m.homeTeamId, m.awayTeamId].filter(Boolean)) {
    const k = `${t}|${dayOf(m.start)}`; cnt.set(k, [...(cnt.get(k) || []), id(m)]);
  }
  for (const ids of cnt.values()) if (ids.length > p.maxMatchesPerTeamPerDay) add('max_per_day', `A team has ${ids.length} matches in one day (max ${p.maxMatchesPerTeamPerDay})`, ...ids);

  const windowed = params.timeSlots?.length || params.dayStart || params.dates?.length || params.matchDays?.length;
  if (windowed) for (const { m, s, e } of timed) {
    const day = dayOf(m.start), t = s % 1440;
    if (p.dates.length ? !p.dates.includes(day) : p.matchDays.length && !p.matchDays.includes(weekday(day))) add('outside_days', `${name(m)} is not on an allowed match day`, id(m));
    const ok = p.timeSlots.length ? p.timeSlots.map(tod).includes(t) : t >= tod(p.dayStart) && t + (e - s) <= tod(p.dayEnd);
    if (!ok) add('outside_window', `${name(m)} is outside the allowed time window`, id(m));
  }
  return v;
}

/** Full generation. Returns {matches, violations}. */
export function generateFixtures(params) {
  const p = normalize(params);
  const ms = schedule(pairings(p), p);
  const violations = validateSchedule(ms, p);
  for (const m of ms) if (!m.start) violations.push({ type: 'unscheduled', message: `${m.label} could not be scheduled (not enough slots/days)`, ids: [m.key] });
  return { matches: ms, violations };
}

/** How many matches fit in one match day with these settings (all venues). Overlapping explicit slots can't all be used by one venue. */
export function slotsPerDay(params) {
  const p = normalize(params);
  const starts = p.timeSlots.length ? p.timeSlots.map(tod).sort((a, b) => a - b) : (() => {
    const a = []; for (let t = tod(p.dayStart); t + p.matchDuration <= tod(p.dayEnd); t += p.matchDuration + p.breakDuration) a.push(t); return a;
  })();
  let n = 0, end = -Infinity;
  for (const s of starts) if (s >= end) { n++; end = s + p.matchDuration; }
  return n * p.venues.length;
}

/**
 * Re-schedule around results: matches in `played` stay exactly as they are; every pairing that has not been played
 * is scheduled afresh with the new parameters. Played = same teams in the same stage/group (either direction in a
 * single round-robin); knockout placeholders are matched by their stable key.
 */
export function generateRemaining(params, played = []) {
  const p = normalize(params);
  const double = p.format === 'double' || ((p.format === 'league_playoff' || p.format === 'group_knockout') && !!p.double);
  const key = (m, rev) => `${m.stage}|${m.group || ''}|${rev ? m.awayTeamId : m.homeTeamId}|${rev ? m.homeTeamId : m.awayTeamId}`;
  const done = new Set(played.filter((m) => m.homeTeamId && m.awayTeamId).map((m) => key(m)));
  const keys = new Set(played.map((m) => m.key).filter(Boolean));
  const isPlayed = (m) => (m.homeTeamId && m.awayTeamId ? done.has(key(m)) || (!double && done.has(key(m, true))) : keys.has(m.key));
  const ms = schedule(pairings(p).filter((m) => !isPlayed(m)), p);
  const violations = validateSchedule(ms, p);
  for (const m of ms) if (!m.start) violations.push({ type: 'unscheduled', message: `${m.label} could not be scheduled (not enough slots/days)`, ids: [m.key] });
  return { matches: ms, violations, kept: played.length };
}

/** A match that must never be deleted or rescheduled by a regenerate: it has a result, is live, or has recorded events. */
export const isPlayedMatch = (m) => m.resultState === 'final' || ['completed', 'live', 'half_time', 'forfeited'].includes(m.status) || !!m.events?.length;
