// Pure bid rules (no DB). Shared by server routes and tests.
// cfg  = { squad, categories: [{code, price, min, max, active}] }
// team = { budget, spent, counts: {A: 1, ...} }

// a later player of C/D may come back dearer after being unsold, so a reserved slot keeps room for one bump
const slotCost = (c) => c.price + (c.unsoldBump || 0);
const cats = (cfg) => cfg.categories.filter((c) => c.active !== false);

/** Max bid `team` may place on a player of category `code`, or {error}. */
export function maxBid(cfg, team, code, basePrice) {
  const list = cats(cfg);
  const cat = list.find((c) => c.code === code);
  if (!cat) return { error: 'category not active' };
  const n = list.reduce((s, c) => s + (team.counts?.[c.code] || 0), 0);
  if (n >= cfg.squad) return { error: 'squad is full' };
  if ((team.counts?.[code] || 0) >= cat.max) return { error: `${code} quota is full` };

  const after = (c) => (team.counts?.[c.code] || 0) + (c.code === code ? 1 : 0);
  const slotsLeft = cfg.squad - n - 1;
  const required = list.reduce((s, c) => s + Math.max(0, c.min - after(c)), 0);
  if (required > slotsLeft) return { error: 'would make required categories impossible' };
  let reserve = list.reduce((s, c) => s + Math.max(0, c.min - after(c)) * slotCost(c), 0);
  const free = slotsLeft - required; // slots with no category requirement: price at cheapest category still open
  if (free > 0) {
    const open = list.filter((c) => after(c) + Math.max(0, c.min - after(c)) < c.max).map(slotCost);
    if (!open.length) return { error: 'squad cannot be completed' };
    reserve += free * Math.min(...open);
  }
  const max = team.budget - team.spent - reserve;
  const floor = basePrice ?? cat.price;
  if (max < floor) return { error: 'not enough points left to complete squad' };
  return { max };
}

/** Validate a bid. Returns error string or null. `current` = base price when no leader yet. */
export function checkBid(cfg, team, code, amount, current, hasLeader, increment, basePrice) {
  const m = maxBid(cfg, team, code, basePrice);
  if (m.error) return m.error;
  if (!Number.isFinite(amount)) return 'invalid amount';
  const min = hasLeader ? current + increment : current;
  if (amount < min) return `minimum bid is ${min}`;
  if (amount > m.max) return `your max bid for this player is ${m.max}`;
  return null;
}

/** Is a finished squad valid? Returns list of problems. */
export function squadProblems(cfg, team) {
  const out = [];
  let n = 0;
  for (const c of cats(cfg)) {
    const k = team.counts?.[c.code] || 0;
    n += k;
    if (k < c.min) out.push(`${c.code}: ${k}/${c.min} required`);
    if (k > c.max) out.push(`${c.code}: ${k} exceeds max ${c.max}`);
  }
  if (n !== cfg.squad) out.push(`squad ${n}/${cfg.squad}`);
  return out;
}

/** Category config sanity. Returns list of problems. */
export function categoryProblems(squad, categories) {
  const act = categories.filter((c) => c.active !== false);
  const out = [];
  const min = act.reduce((s, c) => s + c.min, 0), max = act.reduce((s, c) => s + c.max, 0);
  if (!act.length) out.push('no active categories');
  if (min > squad) out.push(`required category slots (${min}) exceed squad size (${squad})`);
  if (max < squad) out.push(`category maximums (${max}) cannot fill squad size (${squad})`);
  for (const c of act) if (c.min > c.max) out.push(`${c.code}: min > max`);
  return out;
}
