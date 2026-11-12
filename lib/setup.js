// Pure SETUP helpers (no DB, no Next imports) – usable on server, client and in tests.
// ponytail: STATUS_ORDER duplicates lifecycle.STATUSES because lifecycle.js pulls in server-only imports.
export const STATUS_ORDER = [
  'draft', 'registration_open', 'registration_closed', 'auction_ready', 'auction_in_progress',
  'auction_completed', 'tournament_in_progress', 'tournament_completed', 'archived',
];
export const statusIndex = (s) => STATUS_ORDER.indexOf(s);
export const statusLabel = (s) => String(s || '').replace(/_/g, ' ');
export const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'All-Rounder'];
export const FORMATS = ['single', 'double', 'knockout', 'group_knockout', 'league_playoff'];
export const TIEBREAKS = ['points', 'gd', 'gf', 'h2h', 'fairplay'];
export const PLAYER_PUBLIC = ['approved', 'in_auction', 'sold', 'unsold'];

export const DEFAULT_CATEGORIES = [
  { code: 'A', name: 'Category A', price: 130, min: 2, max: 2, active: true, order: 1 },
  { code: 'B+', name: 'Category B+', price: 100, min: 1, max: 1, active: true, order: 2 },
  { code: 'B', name: 'Category B', price: 60, min: 3, max: 3, active: true, order: 3 },
  { code: 'C', name: 'Category C', price: 40, min: 2, max: 2, active: true, order: 4 },
  { code: 'D', name: 'Category D', price: 30, min: 2, max: 2, active: true, order: 5 },
];
export const DEFAULTS = {
  name: '', code: '', season: String(new Date().getFullYear()), description: '', logo: '', banner: '', visibility: 'public',
  teamsCount: 6, squadSize: 10, budget: 1000, format: 'single', venues: [], matchDuration: 40, breakDuration: 10,
  pointsRule: { win: 3, draw: 1, loss: 0 }, tiebreak: ['points', 'gd', 'gf', 'h2h'], rules: '', rulesDocUrl: '',
  dates: { regStart: '', regEnd: '', auctionAt: '', start: '', end: '' },
  categories: DEFAULT_CATEGORIES,
  auction: { increment: 10, timerSec: 120, extendWithinSec: 0, extendToSec: 0, autoClose: false, unsoldPolicy: 'manual', unsoldReducePct: 10, selection: 'random', publicPrices: true },
};

const str = (v) => String(v ?? '').trim();
const int = (v, d) => { const n = Number(v); return v === '' || v == null || !Number.isFinite(n) ? d : Math.round(n); };
const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(/[\n,]/)).map(str).filter(Boolean);
export const slug = (s) => str(s).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20);
export const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Clean a category list. Returns {cats, errors}. */
export function normCategories(input) {
  const errors = [], seen = new Set();
  const cats = (Array.isArray(input) ? input : []).map((c, i) => {
    const code = str(c.code);
    if (!code) errors.push(`category ${i + 1}: code required`);
    else if (seen.has(code.toLowerCase())) errors.push(`duplicate category code ${code}`);
    seen.add(code.toLowerCase());
    const o = { code, name: str(c.name) || `Category ${code}`, description: str(c.description), price: int(c.price, NaN), min: int(c.min, NaN), max: int(c.max, NaN), active: c.active !== false, order: i + 1 };
    for (const k of ['price', 'min', 'max']) if (!(o[k] >= 0)) { errors.push(`${code || i + 1}: ${k} must be a number >= 0`); o[k] = 0; }
    return o;
  });
  return { cats, errors };
}

/** Whitelist + coerce tournament settings from a request body. Returns {patch (nested, partial), errors}. */
export function pickSettings(b) {
  const p = {}, errors = [];
  for (const k of ['name', 'code', 'season', 'description', 'logo', 'banner', 'rules', 'rulesDocUrl']) if (k in b) p[k] = str(b[k]);
  if ('name' in p && !p.name) errors.push('name required');
  if ('visibility' in b) b.visibility === 'public' || b.visibility === 'private' ? (p.visibility = b.visibility) : errors.push('bad visibility');
  for (const [k, min] of [['teamsCount', 2], ['squadSize', 1], ['budget', 0], ['matchDuration', 1], ['breakDuration', 0]]) {
    if (!(k in b)) continue;
    const n = int(b[k], NaN);
    n >= min ? (p[k] = n) : errors.push(`${k} must be a number >= ${min}`);
  }
  if ('format' in b) FORMATS.includes(b.format) ? (p.format = b.format) : errors.push('bad format');
  if ('venues' in b) p.venues = list(b.venues);
  if ('tiebreak' in b) {
    const t = list(b.tiebreak);
    t.every((x) => TIEBREAKS.includes(x)) && t.length ? (p.tiebreak = t) : errors.push('bad tiebreak order');
  }
  if (b.pointsRule) {
    p.pointsRule = {};
    for (const k of ['win', 'draw', 'loss']) { const n = int(b.pointsRule[k], NaN); Number.isFinite(n) ? (p.pointsRule[k] = n) : errors.push(`points for ${k} must be a number`); }
  }
  if (b.dates) { p.dates = {}; for (const k of ['regStart', 'regEnd', 'auctionAt', 'start', 'end']) if (k in b.dates) p.dates[k] = str(b.dates[k]); }
  if (b.auction) {
    const a = b.auction, o = (p.auction = {});
    for (const [k, min, max] of [['increment', 1, 1e9], ['timerSec', 5, 3600], ['extendWithinSec', 0, 600], ['extendToSec', 0, 600], ['unsoldReducePct', 0, 100]]) {
      if (!(k in a)) continue;
      const n = int(a[k], NaN);
      n >= min && n <= max ? (o[k] = n) : errors.push(`auction ${k} must be ${min}-${max}`);
    }
    for (const k of ['autoClose', 'publicPrices']) if (k in a) o[k] = !!a[k];
    if ('unsoldPolicy' in a) ['manual', 'return_to_pool', 'reduce_base'].includes(a.unsoldPolicy) ? (o.unsoldPolicy = a.unsoldPolicy) : errors.push('bad unsold policy');
    if ('selection' in a) ['random', 'category'].includes(a.selection) ? (o.selection = a.selection) : errors.push('bad selection mode');
  }
  if ('categories' in b) { const r = normCategories(b.categories); p.categories = r.cats; errors.push(...r.errors); }
  return { patch: p, errors };
}

const NESTED = ['pointsRule', 'dates', 'auction'];
/** New tournament doc = defaults + patch. */
export function defaultTournament(patch) {
  const d = { ...DEFAULTS, ...patch };
  for (const k of NESTED) d[k] = { ...DEFAULTS[k], ...(patch[k] || {}) };
  d.code = d.code || slug(d.name).toUpperCase() + d.season;
  return d;
}
/** Nested patch -> Mongo $set with dotted keys for the 3 nested objects. */
export function dot(patch) {
  const o = {};
  for (const [k, v] of Object.entries(patch)) {
    if (NESTED.includes(k)) for (const [k2, v2] of Object.entries(v)) o[`${k}.${k2}`] = v2;
    else o[k] = v;
  }
  return o;
}
/** Clone config (not teams/players/matches). */
export function cloneDoc(t, name, code) {
  const { _id, status, createdAt, ...rest } = t;
  return { ...rest, name: name || `${t.name} (copy)`, code: code || `${t.code}-COPY`, status: 'draft', dates: { ...DEFAULTS.dates }, createdAt: new Date() };
}

// ---------- players ----------
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Validate/normalise a flat player body. opts.self = public registration (category optional, contact required). */
export function playerDoc(b, t, { self = false } = {}) {
  const errors = [];
  const name = str(b.name), phone = str(b.phone ?? b.contact?.phone), email = str(b.email ?? b.contact?.email);
  const category = str(b.category) || null, position = str(b.position);
  if (!name) errors.push('name required');
  if (name.length > 80) errors.push('name too long');
  if (email && !EMAIL.test(email)) errors.push('invalid email');
  if (self && !phone && !email) errors.push('phone or email required');
  if (!position) errors.push('position required');
  if (!category && !self) errors.push('category required');
  if (category && !(t.categories || []).some((c) => c.code === category && c.active !== false)) errors.push(`unknown or inactive category ${category}`);
  const bp = b.basePrice === '' || b.basePrice == null ? null : int(b.basePrice, NaN);
  if (bp !== null && !(bp >= 0)) errors.push('base price must be a number >= 0');
  if (self && bp !== null) errors.push('base price is set by the organizer');
  return {
    errors,
    doc: { name, photo: str(b.photo), contact: { phone, email }, employeeId: str(b.employeeId), department: str(b.department), position, position2: str(b.position2), category, basePrice: bp },
  };
}
export const flatPlayer = (p) => ({ name: p.name, photo: p.photo, phone: p.contact?.phone, email: p.contact?.email, employeeId: p.employeeId, department: p.department, position: p.position, position2: p.position2, category: p.category, basePrice: p.basePrice });
/** Auction base price for a player in this tournament (override > category price). */
export const effectivePrice = (p, t) => p.basePrice ?? (t.categories || []).find((c) => c.code === p.category)?.price ?? null;

const norm = (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIAS = { baseprice: 'basePrice', employeeid: 'employeeId', secondaryposition: 'position2', position2: 'position2', mobile: 'phone', contact: 'phone', dept: 'department', fullname: 'name', playername: 'name' };
/** Import rows (objects keyed by CSV header). Returns {docs, skipped:[{row,name,reason}]}. existing = names already in tournament. */
export function importPlayers(rows, t, existing = []) {
  const seen = new Set(existing.map((n) => n.toLowerCase()));
  const docs = [], skipped = [];
  rows.forEach((raw, i) => {
    const row = {};
    for (const [k, v] of Object.entries(raw || {})) row[ALIAS[norm(k)] || norm(k)] = v;
    const { doc, errors } = playerDoc(row, t);
    const key = doc.name.toLowerCase();
    if (!errors.length && seen.has(key)) errors.push('duplicate name');
    if (errors.length) return skipped.push({ row: i + 1, name: doc.name, reason: errors.join('; ') });
    seen.add(key);
    docs.push(doc);
  });
  return { docs, skipped };
}

// ---------- teams ----------
export function teamDoc(b) {
  const errors = [];
  const name = str(b.name), ownerName = str(b.ownerName);
  if (!name) errors.push('team name required');
  if (name.length > 60) errors.push('team name too long');
  if (!ownerName) errors.push('owner name required');
  const color = str(b.color) || '#2563eb';
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) errors.push('color must look like #aabbcc');
  const email = str(b.email ?? b.contact?.email);
  if (email && !EMAIL.test(email)) errors.push('invalid email');
  return { errors, doc: { name, logo: str(b.logo), color, ownerName, captainName: str(b.captainName), contact: { phone: str(b.phone ?? b.contact?.phone), email } } };
}
/** Category-wise have/min/max for a team. */
export const quota = (t, team) => (t.categories || []).filter((c) => c.active !== false).map((c) => {
  const have = team.counts?.[c.code] || 0;
  return { code: c.code, name: c.name, have, min: c.min, max: c.max, need: Math.max(0, c.min - have), price: c.price };
});
export const teamCount = (team) => Object.values(team.counts || {}).reduce((s, n) => s + n, 0);

// ---------- csv ----------
/** Rows -> CSV text. Cells starting with = + - @ are prefixed with ' (spreadsheet formula injection). */
export function toCsv(rows) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
}

// ---------- bulk photo matching ----------
/** 'Rupok Das.JPG' -> 'rupokdas' (extension and every non-letter removed). */
export const photoKey = (s) => String(s ?? '').replace(/\.[a-z0-9]{2,5}$/i, '').toLowerCase().replace(/[^\p{L}]/gu, '');
function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const similarity = (a, b) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) return 0.9;
  return 1 - lev(a, b) / Math.max(a.length, b.length);
};
/** Fuzzy-match file names to players, one file per player. Returns [{file, playerId|null, score}] in file order. */
export function matchPhotos(files, players, min = 0.75) {
  const keys = players.map((p) => photoKey(p.name));
  const pairs = [];
  files.forEach((f, i) => keys.forEach((k, j) => { const s = similarity(photoKey(f), k); if (s >= min) pairs.push({ i, j, s }); }));
  pairs.sort((a, b) => b.s - a.s);
  const out = files.map((file) => ({ file, playerId: null, score: 0 })), usedP = new Set();
  for (const { i, j, s } of pairs) if (!out[i].playerId && !usedP.has(j)) { out[i] = { file: files[i], playerId: players[j]._id, score: s }; usedP.add(j); }
  return out;
}
