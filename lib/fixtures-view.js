// How a match list is shown (pure; used by the admin fixtures page and tested in fixtures-view.test.mjs).
// start is a naive local ISO string "YYYY-MM-DDTHH:mm", so plain text comparison orders it correctly.
export const roundKey = (m) => `${m.stage}${m.group ? ' ' + m.group : ''} · ${m.label || 'R' + m.round}`;
export const dayKey = (m) => (m.start ? String(m.start).slice(0, 10) : '');
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Earliest first; unscheduled ('~' sorts after any digit) last; ties by round. */
export const byStart = (a, b) => {
  const x = String(a.start || '~'), y = String(b.start || '~'); // code-unit compare: localeCompare would rank '~' before digits
  return x < y ? -1 : x > y ? 1 : (a.round || 0) - (b.round || 0);
};

/** "Today · Tuesday, 1 December 2026" / "Tomorrow · ..." / plain date / "Unscheduled". `now` is injectable for tests. */
export function dayLabel(k, now = new Date()) {
  if (!k) return 'Unscheduled';
  const base = new Date(`${k}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return k === iso(now) ? `Today · ${base}` : k === iso(new Date(now.getTime() + 864e5)) ? `Tomorrow · ${base}` : base;
}

/**
 * by 'date'  -> one group per calendar day, matches by time.
 * by 'round' -> one group per round, matches by date/time inside it. Groups are ordered by their EARLIEST date,
 *               not by round number: a playoff "Semi-final 1" and a league "R1" both have round 1, so numbers alone mix stages.
 *               Groups with no date go last (then by round number).
 * Returns [[key, matches[]], ...]. Re-run on every render, so an edited match moves to its new place by itself.
 */
export function groupMatches(matches, by = 'round') {
  const sorted = [...matches].sort(byStart);
  const groups = [], idx = {};
  for (const m of sorted) {
    const k = by === 'date' ? dayKey(m) : roundKey(m);
    if (!(k in idx)) { idx[k] = groups.length; groups.push([k, []]); }
    groups[idx[k]][1].push(m);
  }
  if (by === 'round') {
    const first = ([, ms]) => ms[0]; // matches are already date-sorted, so [0] is the group's earliest
    groups.sort((a, b) => byStart(first(a), first(b)));
  }
  return groups;
}
