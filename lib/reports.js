// Report row builders (pure) + a Mongo loader. Rows never include contact/employeeId/department.
export const REPORTS = ['registration', 'categories', 'teams', 'sales', 'unsold', 'budgets', 'squads', 'fixtures', 'results', 'standings', 'performance', 'team-performance', 'summary', 'audit'];

const when = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '');
const sid = (x) => (x == null ? '' : String(x));
const isFinal = (m) => m.resultState === 'final' && ['completed', 'forfeited'].includes(m.status);

/** Standings from final matches. ponytail: tie-break is Pts, GD, GF, name (no h2h/fairplay); use lib/standings.js for full rules. */
export function standingsRows(teams, matches, rule = {}) {
  const pts = { win: 3, draw: 1, loss: 0, ...rule };
  const r = new Map(teams.map((t) => [sid(t._id), { teamId: sid(t._id), name: t.name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 }]));
  for (const m of matches.filter(isFinal)) {
    const h = r.get(sid(m.homeTeamId)), a = r.get(sid(m.awayTeamId));
    if (!h || !a) continue;
    const hs = m.score?.home ?? 0, as = m.score?.away ?? 0;
    for (const [x, f, g] of [[h, hs, as], [a, as, hs]]) {
      x.P++; x.GF += f; x.GA += g;
      if (f > g) { x.W++; x.Pts += pts.win; } else if (f === g) { x.D++; x.Pts += pts.draw; } else { x.L++; x.Pts += pts.loss; }
    }
  }
  const rows = [...r.values()].map((x) => ({ ...x, GD: x.GF - x.GA }));
  rows.sort((p, q) => q.Pts - p.Pts || q.GD - p.GD || q.GF - p.GF || p.name.localeCompare(q.name));
  return rows.map((x, i) => ({ rank: i + 1, ...x }));
}

/** Per-player and per-team tallies from final matches. */
export function tally(matches) {
  const pl = new Map(), tm = new Map();
  const P = (id) => pl.get(sid(id)) || pl.set(sid(id), { P: 0, goals: 0, assists: 0, yellow: 0, red: 0, og: 0 }).get(sid(id));
  const T = (id) => tm.get(sid(id)) || tm.set(sid(id), { cleanSheets: 0, yellow: 0, red: 0 }).get(sid(id));
  for (const m of matches.filter(isFinal)) {
    const ev = m.events || [], hasA = ev.some((e) => e.type === 'assist');
    for (const id of [...(m.lineups?.home || []), ...(m.lineups?.away || [])]) P(id).P++;
    if ((m.score?.away ?? 0) === 0) T(m.homeTeamId).cleanSheets++;
    if ((m.score?.home ?? 0) === 0) T(m.awayTeamId).cleanSheets++;
    for (const e of ev) {
      if (e.type === 'goal' || e.type === 'penalty_goal') { P(e.playerId).goals++; if (!hasA && e.assistPlayerId) P(e.assistPlayerId).assists++; }
      else if (e.type === 'assist') P(e.playerId).assists++;
      else if (e.type === 'own_goal') P(e.playerId).og++;
      else if (e.type === 'yellow') { P(e.playerId).yellow++; T(e.teamId).yellow++; }
      else if (e.type === 'red') { P(e.playerId).red++; T(e.teamId).red++; }
    }
  }
  return { pl, tm };
}

/** d = {t, players, teams, sales, matches, audit}. Returns {title, rows}. */
export function buildReport(name, d) {
  const { t = {}, players = [], teams = [], sales = [], matches = [], audit = [] } = d;
  const tn = new Map(teams.map((x) => [sid(x._id), x.name]));
  const pn = new Map(players.map((x) => [sid(x._id), x]));
  const team = (id) => tn.get(sid(id)) || '';
  const approved = teams.filter((x) => x.status === 'approved');
  const squadOf = (id) => players.filter((p) => sid(p.teamId) === sid(id));
  const mrow = (m) => ({ stage: m.stage, round: m.round ?? '', group: m.group ?? '', start: when(m.start), venue: m.venue || '', home: team(m.homeTeamId), away: team(m.awayTeamId), status: m.status });
  const R = (title, rows) => ({ title, rows });

  switch (name) {
    case 'registration':
      return R('Tournament registration', players.map((p) => ({ name: p.name, position: p.position || '', category: p.category || '', status: p.status, registered: when(p.regAt) })));
    case 'categories':
      return R('Player category distribution', (t.categories || []).map((c) => {
        const ps = players.filter((p) => p.category === c.code);
        const n = (s) => ps.filter((p) => s.includes(p.status)).length;
        return { code: c.code, name: c.name, price: c.price, min: c.min, max: c.max, registered: ps.length, approved: n(['approved']), sold: n(['sold']), unsold: n(['unsold']), hold: n(['hold']) };
      }));
    case 'teams':
      return R('Team registration', teams.map((x) => ({ name: x.name, owner: x.ownerName || '', captain: x.captainName || '', status: x.status, budget: x.budget, registered: when(x.regAt) })));
    case 'sales':
      return R('Auction sales', sales.filter((s) => s.status === 'confirmed').sort((a, b) => a.lotNo - b.lotNo).map((s) => ({ lot: s.lotNo, player: pn.get(sid(s.playerId))?.name || '', category: pn.get(sid(s.playerId))?.category || '', team: team(s.teamId), price: s.price, at: when(s.at) })));
    case 'unsold':
      return R('Unsold and held players', players.filter((p) => ['unsold', 'hold'].includes(p.status)).map((p) => ({ name: p.name, position: p.position || '', category: p.category || '', status: p.status, basePrice: p.basePrice ?? '' })));
    case 'budgets':
      return R('Team budget and spending', approved.map((x) => ({ team: x.name, budget: x.budget, spent: x.spent || 0, remaining: x.budget - (x.spent || 0), players: squadOf(x._id).length })));
    case 'squads':
      return R('Final squads', approved.flatMap((x) => squadOf(x._id).map((p) => ({ team: x.name, player: p.name, category: p.category || '', position: p.position || '', price: p.price ?? '', captain: p.captain ? 'yes' : '' }))));
    case 'fixtures':
      return R('Match fixtures', [...matches].sort((a, b) => String(a.start).localeCompare(String(b.start))).map(mrow));
    case 'results':
      return R('Results', matches.filter(isFinal).sort((a, b) => String(a.start).localeCompare(String(b.start))).map((m) => ({ ...mrow(m), score: `${m.score?.home ?? 0}-${m.score?.away ?? 0}` })));
    case 'standings':
      return R('League standings', standingsRows(approved, matches, t.pointsRule));
    case 'performance': {
      const { pl } = tally(matches);
      return R('Player performance', players.filter((p) => pl.has(sid(p._id))).map((p) => ({ player: p.name, team: team(p.teamId), position: p.position || '', ...pl.get(sid(p._id)) })).sort((a, b) => b.goals - a.goals || b.assists - a.assists));
    }
    case 'team-performance': {
      const { tm } = tally(matches);
      return R('Team performance', standingsRows(approved, matches, t.pointsRule).map(({ teamId, ...x }) => ({ ...x, cleanSheets: tm.get(teamId)?.cleanSheets || 0, yellow: tm.get(teamId)?.yellow || 0, red: tm.get(teamId)?.red || 0 })));
    }
    case 'summary': {
      const n = (s) => players.filter((p) => s.includes(p.status)).length;
      const done = matches.filter(isFinal);
      const top = standingsRows(approved, matches, t.pointsRule)[0];
      return R('Tournament summary', Object.entries({
        tournament: t.name, season: t.season || '', status: t.status, teamsApproved: approved.length, playersRegistered: players.length, playersApproved: n(['approved']),
        playersSold: n(['sold']), playersUnsold: n(['unsold']), totalSpent: teams.reduce((s, x) => s + (x.spent || 0), 0),
        matchesTotal: matches.length, matchesCompleted: done.length, goals: done.reduce((s, m) => s + (m.score?.home ?? 0) + (m.score?.away ?? 0), 0),
        leader: top && top.P ? top.name : '',
      }).map(([item, value]) => ({ item, value })));
    }
    case 'audit':
      return R('Audit log', audit.map((a) => ({ at: when(a.at), user: a.userName || '', action: a.action, detail: JSON.stringify(a.detail ?? {}) })));
    default:
      return null;
  }
}

/** Load data for tournament `tid` and build the report. */
export async function report(name, tid) {
  const { col, oid, tour } = await import('./server.js');
  const t = await tour(tid), q = { tournamentId: oid(tid) };
  const get = async (c, sort) => (await col(c)).find(q).sort(sort || {}).toArray();
  const d = { t };
  if (name === 'audit') d.audit = (await (await col('audit')).find(q).sort({ at: -1 }).limit(1000).toArray());
  else {
    [d.players, d.teams, d.sales, d.matches] = await Promise.all([get('players'), get('teams'), get('sales'), get('matches')]);
  }
  return buildReport(name, d);
}
