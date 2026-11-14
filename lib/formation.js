// Squad-builder helpers (pure; used by the lineup page and tested in formation.test.mjs).
// Pitch coordinates are percentages: x 0..100 left->right, y 0..100 attack (top) -> own goal (bottom).
export const SIZES = [5, 6, 7, 8, 9, 10, 11]; // players on the pitch, goalkeeper included
export const FORMATIONS = {
  5: ['2-1-1', '1-2-1', '2-2'],
  6: ['2-2-1', '3-1-1', '2-1-2'],
  7: ['2-3-1', '3-2-1', '2-2-2', '3-1-2'],
  8: ['3-3-1', '3-2-2', '2-3-2'],
  9: ['3-3-2', '3-4-1', '4-3-1'],
  10: ['4-3-2', '3-4-2', '4-4-1'],
  11: ['4-4-2', '4-3-3', '3-5-2', '4-5-1'],
};
export const DEFAULT_SIZE = 7;
export const GK_Y = 89;

/** y -> role label. Free dragging changes y, so the label follows the player's spot on the pitch. */
export const roleAt = (y, gk) => (gk ? 'GK' : y < 36 ? 'FWD' : y < 60 ? 'MID' : 'DEF');

/** Formation "2-3-1" -> slots [{x, y, role}], goalkeeper first, then defence to attack. */
export function layout(formation) {
  const lines = String(formation).split('-').map(Number).filter((n) => n > 0);
  const slots = [{ x: 50, y: GK_Y, role: 'GK' }];
  lines.forEach((count, i) => {
    const y = lines.length === 1 ? 45 : 70 - (i * 48) / (lines.length - 1);
    for (let k = 0; k < count; k++) slots.push({ x: Math.round(((k + 1) / (count + 1)) * 100), y: Math.round(y), role: roleAt(y) });
  });
  return slots;
}

export const defaultFormation = (size) => (FORMATIONS[size] || FORMATIONS[DEFAULT_SIZE])[0];

/** Which pitch roles does a free-text position ("GK/DEF", "Forward / Def", "CMF", "RWF") cover? */
export function rolesOf(position = '') {
  const p = String(position).toLowerCase(), out = new Set();
  if (/\bgk\b|keeper/.test(p)) out.add('GK');
  if (/def|back|\bcb\b|\blb\b|\brb\b/.test(p)) out.add('DEF');
  if (/mid|\b[cdalr]mf\b/.test(p)) out.add('MID');
  if (/for|strik|\bst\b|\bcf\b|\b[lr]wf\b|att|wing/.test(p)) out.add('FWD');
  return out;
}

/** Fill slots from a squad by position: returns an array (one playerId or null per slot), no duplicates. */
export function autoFill(slots, players) {
  const left = [...players], out = slots.map(() => null);
  const take = (pred) => { const i = left.findIndex(pred); return i < 0 ? null : left.splice(i, 1)[0]._id; };
  slots.forEach((s, i) => { out[i] = take((p) => rolesOf(p.position).has(s.role)); });
  slots.forEach((s, i) => { if (!out[i]) out[i] = take(() => true); }); // anyone left fills the gaps
  return out;
}

// ---------- squad-builder state (pure; the page only wires pointer events to these) ----------
// slot = { id, x, y, gk, pid }   pid = playerId string or null. A slot can be dragged anywhere, so x/y are free.
const clampPct = (n) => Math.max(4, Math.min(96, Math.round(n)));

export const freshSlots = (formation) => layout(formation).map((s, i) => ({ id: i, x: s.x, y: s.y, gk: i === 0, pid: null }));
/** Put a player in a slot. Whoever was there goes to the bench; the player leaves any slot they held before. */
export const putPlayer = (slots, id, pid) => slots.map((s) => (s.id === id ? { ...s, pid } : s.pid === pid ? { ...s, pid: null } : s));
export const swapSlots = (slots, a, b) => {
  const pa = slots.find((s) => s.id === a)?.pid ?? null, pb = slots.find((s) => s.id === b)?.pid ?? null;
  return slots.map((s) => (s.id === a ? { ...s, pid: pb } : s.id === b ? { ...s, pid: pa } : s));
};
export const moveSlot = (slots, id, x, y) => slots.map((s) => (s.id === id ? { ...s, x: clampPct(x), y: clampPct(y) } : s));
export const clearSlot = (slots, id) => slots.map((s) => (s.id === id ? { ...s, pid: null } : s));
export const placedIds = (slots) => slots.filter((s) => s.pid).map((s) => s.pid);

/** New formation/size: fresh slots, keeping the same players (keeper stays keeper). Extras fall back to the bench. */
export function carry(slots, formation) {
  const next = freshSlots(formation);
  const keeper = slots.find((s) => s.gk)?.pid, rest = slots.filter((s) => !s.gk && s.pid).map((s) => s.pid);
  if (keeper) next[0].pid = keeper;
  rest.forEach((pid, i) => { if (next[i + 1]) next[i + 1].pid = pid; });
  return next;
}

/** Restore a saved lineup: exact positions when we have them, otherwise a sensible auto layout of the saved ids. */
export function buildState(squad, initial = {}) {
  const meta = initial.meta, known = new Set(squad.map((p) => String(p._id)));
  const ids = (initial.ids || []).map(String).filter((id) => known.has(id));
  const size = meta?.size || (ids.length >= 5 ? Math.min(11, ids.length) : DEFAULT_SIZE);
  const formation = FORMATIONS[size]?.includes(meta?.formation) ? meta.formation : defaultFormation(size);
  let slots = freshSlots(formation);
  const saved = (meta?.positions || []).filter((p) => known.has(String(p.playerId)));
  if (saved.length) {
    const gk = saved.find((p) => p.gk);
    if (gk) slots[0] = { ...slots[0], x: gk.x, y: gk.y, pid: String(gk.playerId) };
    saved.filter((p) => p !== gk).forEach((p, i) => { if (slots[i + 1]) slots[i + 1] = { ...slots[i + 1], x: p.x, y: p.y, pid: String(p.playerId) }; });
  } else if (ids.length) {
    const picks = autoFill(slots, squad.filter((p) => ids.includes(String(p._id))));
    slots = slots.map((s, i) => ({ ...s, pid: picks[i] ? String(picks[i]) : null }));
  }
  return { size, formation, slots };
}
