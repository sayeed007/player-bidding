// Pure auction helpers (no DB, no Next imports) so they can be unit-tested.

/** New lot end time after a bid at `now`. Extends only when bid lands inside the extension window. */
export function nextEnd(endsAt, now, cfg = {}) {
  const w = (cfg.extendWithinSec || 0) * 1000, to = (cfg.extendToSec || 0) * 1000;
  if (!w || !to || endsAt - now > w) return endsAt;
  return Math.max(endsAt, now + to);
}

/** Timer fields to set when the lot's frozen state changes. null = nothing to change. */
export function timing(lot, now, freeze) {
  if (!lot?.open) return null;
  if (freeze && lot.endsAt) return { endsAt: null, pausedLeftMs: Math.max(0, lot.endsAt - now) };
  if (!freeze && !lot.endsAt) return { endsAt: now + (lot.pausedLeftMs || 0), pausedLeftMs: null };
  return null;
}

/** Players a random pick may choose from. Unsold ones only re-enter when nothing else is left. */
export function eligible(players, { category, active }) {
  const ok = (p) => !p.teamId && (!category || p.category === category) && (!active || active.includes(p.category));
  const fresh = players.filter((p) => ok(p) && p.status === 'approved');
  return fresh.length ? fresh : players.filter((p) => ok(p) && p.status === 'unsold');
}

export const reducedBase = (base, pct) => Math.max(1, Math.floor(base * (100 - (pct || 0)) / 100));

/** Cap violations (not minimums: squads are still being built) for a team state. */
export function capProblems(cfg, tm) {
  const out = [];
  if (tm.spent > tm.budget) out.push('budget exceeded');
  let n = 0;
  for (const c of cfg.categories.filter((x) => x.active !== false)) {
    const k = tm.counts?.[c.code] || 0;
    n += k;
    if (k > c.max) out.push(`${c.code} quota exceeded (${k}/${c.max})`);
  }
  if (n > cfg.squad) out.push(`squad over limit (${n}/${cfg.squad})`);
  return out;
}

/** Problems if sale (oldPrice, team oldT) becomes (newPrice, newT|same team). */
export function correctionProblems(cfg, oldT, newT, code, oldPrice, newPrice) {
  const step = (tm, d, p) => ({ ...tm, spent: tm.spent + d * p, counts: { ...tm.counts, [code]: (tm.counts?.[code] || 0) + d } });
  const after = newT ? [step(oldT, -1, oldPrice), step(newT, 1, newPrice)] : [step(step(oldT, -1, oldPrice), 1, newPrice)];
  return after.flatMap((tm) => capProblems(cfg, tm).map((x) => `${tm.name}: ${x}`));
}

/**
 * Teams that are TIED at the final price of a lot: nobody in the group can go higher, so whoever bid first would win by arrival order.
 * Rule: the leader is capped (its max < price + increment), and every OTHER team that bid on this lot and could match the price
 * but not beat it (price <= max < price + increment) is also in the tie. Returns ids (leader first), or [] when there is no tie.
 * A team that never bid is not part of it; a team that could still outbid the leader makes it a normal auction, not a tie.
 */
export function tieGroup({ price, increment = 1, leaderId, bidders = [], maxByTeam = {} }) {
  if (!leaderId) return [];
  const cap = price + (increment || 1);
  const maxOf = (id) => maxByTeam[String(id)];
  if (!(maxOf(leaderId) < cap)) return []; // the leader could still raise: nobody is stuck on arrival order
  const others = [...new Set(bidders.map(String))].filter((id) => id !== String(leaderId) && maxOf(id) >= price && maxOf(id) < cap);
  return others.length ? [String(leaderId), ...others] : [];
}

/**
 * What a client may see of a drawn lottery. The winner is decided on the server when "Draw lottery" is pressed, but it is
 * withheld until `revealAt`, so nobody learns it before the on-screen reveal finishes. `lottery` is the stored object
 * {candidates:[{_id,name}], winnerId, drawnAt, revealAt}. Returns null when no lottery was drawn.
 */
export function lotteryView(lottery, now) {
  if (!lottery) return null;
  const view = { candidates: lottery.candidates.map((c) => c.name), drawnAt: lottery.drawnAt, revealAt: lottery.revealAt, price: lottery.price, revealed: now >= lottery.revealAt };
  if (view.revealed) {
    view.winnerId = String(lottery.winnerId);
    view.winner = lottery.candidates.find((c) => String(c._id) === String(lottery.winnerId))?.name;
  }
  return view;
}
