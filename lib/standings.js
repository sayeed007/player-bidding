// Pure standings. Derived on every read from FINAL matches only (BR-12) - never stored.
export const FINAL = (m) => m.resultState === 'final' && ['completed', 'forfeited'].includes(m.status);
const S = String;

/** Score implied by events. own_goal.teamId is the team of the player who scored it (credit goes to the opponent). */
export function scoreFromEvents(m) {
  let home = 0, away = 0;
  for (const e of m.events || []) {
    const isHome = S(e.teamId) === S(m.homeTeamId);
    if (e.type === 'goal' || e.type === 'penalty_goal') isHome ? home++ : away++;
    else if (e.type === 'own_goal') isHome ? away++ : home++;
  }
  return { home, away };
}

const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

function rank(rows, order, ms) {
  if (rows.length < 2) return rows;
  const [c, ...rest] = order;
  if (!c) return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  let key;
  if (c === 'h2h') { // mini-table of matches among the tied teams only
    const ids = new Set(rows.map((r) => r.teamId)), mini = new Map(rows.map((r) => [r.teamId, [0, 0, 0]]));
    for (const m of ms) {
      const h = S(m.homeTeamId), a = S(m.awayTeamId);
      if (!ids.has(h) || !ids.has(a)) continue;
      const [hs, as] = [m.score.home, m.score.away];
      const H = mini.get(h), A = mini.get(a);
      H[1] += hs - as; H[2] += hs; A[1] += as - hs; A[2] += as;
      if (hs > as) H[0] += 3; else if (hs < as) A[0] += 3; else { H[0]++; A[0]++; }
    }
    key = (r) => mini.get(r.teamId);
  } else key = (r) => [c === 'points' ? r.Pts : c === 'gd' ? r.GD : c === 'gf' ? r.GF : c === 'fairplay' ? -r.fairplay : 0];
  const sorted = [...rows].sort((a, b) => cmp(key(b), key(a)));
  const out = [];
  for (let i = 0, j; i < sorted.length; i = j) {
    for (j = i + 1; j < sorted.length && cmp(key(sorted[j]), key(sorted[i])) === 0; j++);
    out.push(...rank(sorted.slice(i, j), rest, ms));
  }
  return out;
}

/** teams: [{_id,name,logo,color}], matches: any match docs, t: tournament (pointsRule, tiebreak), opts.group: only that group.
 *  Only league + group stage matches count. fairplay = yellow + 3*red (fewer is better). */
export function computeStandings(teams, matches, t = {}, { group } = {}) {
  const rule = { win: 3, draw: 1, loss: 0, ...t.pointsRule };
  const order = t.tiebreak?.length ? t.tiebreak : ['points', 'gd', 'gf', 'h2h', 'fairplay'];
  const rows = new Map(teams.map((x) => [S(x._id), { teamId: S(x._id), name: x.name, logo: x.logo, color: x.color, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0, fairplay: 0 }]));
  const ms = matches.filter((m) => FINAL(m) && ['league', 'group'].includes(m.stage) && (group == null || m.group === group)
    && rows.has(S(m.homeTeamId)) && rows.has(S(m.awayTeamId)));
  for (const m of ms) {
    const h = rows.get(S(m.homeTeamId)), a = rows.get(S(m.awayTeamId)), { home, away } = m.score;
    for (const [x, f, g] of [[h, home, away], [a, away, home]]) {
      x.P++; x.GF += f; x.GA += g;
      if (f > g) { x.W++; x.Pts += rule.win; } else if (f < g) { x.L++; x.Pts += rule.loss; } else { x.D++; x.Pts += rule.draw; }
    }
    for (const e of m.events || []) {
      const r = rows.get(S(e.teamId));
      if (r) r.fairplay += e.type === 'yellow' ? 1 : e.type === 'red' ? 3 : 0;
    }
  }
  for (const r of rows.values()) r.GD = r.GF - r.GA;
  return rank([...rows.values()], order, ms).map((r, i) => ({ ...r, rank: i + 1 }));
}
