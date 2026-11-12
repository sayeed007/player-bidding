// Pure player/team statistics, derived from FINAL match docs on every read (spec 13.4).
// Rules (documented):
//  - P: player is in the lineup OR appears in any event (scorer/assist/card/sub in+out) of a final match. starts: in lineup.
//  - goals = goal + penalty_goal events by the player; penGoals subset; og = own_goal events by the player.
//  - assists = 'assist' events by the player + goal events naming him as assistPlayerId.
//  - cleanSheets: only goalkeepers (position matches /gk|goalkeeper/i) who are IN THE RECORDED LINEUP of a team that conceded 0.
//    A keeper with no lineup recorded gets no clean sheet (we cannot know he played).
//  - potm = matches where match.potmPlayerId is the player.
import { FINAL, computeStandings } from './standings.js';

const S = String;
const GK = /gk|goalkeeper/i;

export function computeStats(players, teams, matches, t = {}) {
  const tm = new Map(teams.map((x) => [S(x._id), x]));
  const rows = new Map(players.filter((p) => p.teamId).map((p) => [S(p._id), {
    playerId: S(p._id), name: p.name, photo: p.photo, teamId: S(p.teamId), teamName: tm.get(S(p.teamId))?.name,
    position: p.position, category: p.category, price: p.price,
    P: 0, starts: 0, goals: 0, assists: 0, yellow: 0, red: 0, og: 0, penGoals: 0, cleanSheets: 0, potm: 0,
  }]));
  const teamX = new Map(teams.map((x) => [S(x._id), { cleanSheets: 0, yellow: 0, red: 0 }]));
  const fin = matches.filter(FINAL);
  for (const m of fin) {
    const played = new Set();
    for (const [side, conceded] of [['home', m.score.away], ['away', m.score.home]]) {
      const tx = teamX.get(S(side === 'home' ? m.homeTeamId : m.awayTeamId));
      if (tx && conceded === 0) tx.cleanSheets++;
      for (const pid of m.lineups?.[side] || []) {
        const r = rows.get(S(pid));
        if (!r) continue;
        played.add(S(pid)); r.starts++;
        if (conceded === 0 && GK.test(r.position || '')) r.cleanSheets++;
      }
    }
    for (const e of m.events || []) {
      const r = rows.get(S(e.playerId)), tx = teamX.get(S(e.teamId));
      for (const id of [e.playerId, e.assistPlayerId, e.inPlayerId]) if (id) played.add(S(id));
      if (e.type === 'yellow' && tx) tx.yellow++;
      if (e.type === 'red' && tx) tx.red++;
      if (r) {
        if (e.type === 'goal' || e.type === 'penalty_goal') r.goals++;
        if (e.type === 'penalty_goal') r.penGoals++;
        if (e.type === 'assist') r.assists++;
        if (e.type === 'yellow') r.yellow++;
        if (e.type === 'red') r.red++;
        if (e.type === 'own_goal') r.og++;
      }
      if ((e.type === 'goal' || e.type === 'penalty_goal') && e.assistPlayerId) { const a = rows.get(S(e.assistPlayerId)); if (a) a.assists++; }
    }
    for (const id of played) { const r = rows.get(id); if (r) r.P++; }
    const pm = m.potmPlayerId && rows.get(S(m.potmPlayerId));
    if (pm) pm.potm++;
  }
  const table = computeStandings(teams, matches, t);
  return {
    players: [...rows.values()],
    teams: table.map(({ fairplay, ...r }) => ({ ...r, ...teamX.get(r.teamId) })),
  };
}

// Leaderboard helpers.
export const top = (ps, k, n = 10) => ps.filter((p) => p[k] > 0)
  .sort((a, b) => b[k] - a[k] || a.name.localeCompare(b.name)).slice(0, n)
  .map((p) => ({ playerId: p.playerId, name: p.name, photo: p.photo, teamId: p.teamId, teamName: p.teamName, value: p[k] }));

/** Computed award suggestions (explicit criteria): golden boot = most goals; best GK = most clean sheets; MVP = most POTM, then goals+assists. */
export function suggest(ps) {
  const one = (arr) => arr[0] && { playerId: arr[0].playerId, name: arr[0].name };
  return {
    golden_boot: one(top(ps, 'goals', 1)),
    best_goalkeeper: one(top(ps.filter((p) => /gk|goalkeeper/i.test(p.position || '')), 'cleanSheets', 1)),
    mvp: one(top(ps.map((p) => ({ ...p, score: p.potm * 1000 + p.goals + p.assists })), 'score', 1)),
  };
}

