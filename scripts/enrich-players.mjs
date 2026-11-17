// One-off: match sheet players to HRMS employees, download photos, upload to Cloudinary, rewrite data/players.json.
// Usage: node --env-file=.env.local scripts/enrich-players.mjs   (needs .tmp/employees.json from the HRMS crawl)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const BASE = 'https://nsl-hrms.tafurihr.com:49004/';
const { NEXT_PUBLIC_CLOUDINARY_CLOUD: cloud, NEXT_PUBLIC_CLOUDINARY_PRESET: preset } = process.env;
const players = JSON.parse(readFileSync('.tmp/players.sheet.json', 'utf8'));
const emps = JSON.parse(readFileSync('.tmp/employees.json', 'utf8'));
// Confirmed by hand (sheet name -> employee id); skipped by fuzzy matching.
const OVERRIDE = { Azad: 200083, Tanzid: 200146, Saadman: 200012, Digonto: 200312, Kawser: 200140, 'Raghib Yeasir': 200301, Shazedur: 200261, Siddikur: 200226, Ushan: 200256, Fidak: 200307, Robin: 200281, Riyad: 200327 };
const REMOVE = new Set();
const AMBIGUOUS = new Set([...Object.keys(OVERRIDE), ...REMOVE]);

const tok = (s) => s.toLowerCase().replace(/\b(md|mohammad|mohammed|muhammad|mr|m)\b\.?/g, ' ').replace(/[^a-z ]/g, ' ').split(/\s+/).filter((t) => t.length > 1);
const score = (p, e) => {
  const a = tok(p), b = tok(e); if (!a.length || !b.length) return 0;
  const hit = a.filter((t) => b.some((u) => u === t || (t.length > 3 && (u.startsWith(t) || t.startsWith(u))))).length;
  return (hit / a.length) * ((hit / b.length) * 0.5 + 0.5);
};

// 1:1 assignment: best scores first, each employee used once.
const pairs = players.flatMap((p, i) => emps.map((e) => ({ i, e, s: score(p.name, e.name) }))).filter((x) => x.s >= 0.66 && !AMBIGUOUS.has(players[x.i].name)).sort((a, b) => b.s - a.s);
const byPlayer = new Map(), used = new Set();
players.forEach((p, i) => { const e = emps.find((x) => x.id === String(OVERRIDE[p.name])); if (e) { byPlayer.set(i, { e, s: 1 }); used.add(e.eid); } });
for (const x of pairs) if (!byPlayer.has(x.i) && !used.has(x.e.eid)) { byPlayer.set(x.i, x); used.add(x.e.eid); }

async function pool(items, n, fn) { const out = []; let k = 0; await Promise.all(Array.from({ length: n }, async () => { while (k < items.length) { const i = k++; out[i] = await fn(items[i], i); } })); return out; }

async function photo(e) {
  if (!e.pic) return '';
  const r = await fetch(BASE + e.pic); if (!r.ok) throw new Error(`download ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: r.headers.get('content-type') || 'image/jpeg' }), `${e.id}.jpg`);
  fd.append('upload_preset', preset); fd.append('public_id', `nftms/${e.id}`);
  const u = await (await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: fd })).json();
  if (!u.secure_url) throw new Error(u.error?.message || 'upload failed');
  return u.secure_url;
}

const log = [];
const out = (await pool(players, 6, async (p, i) => {
  const m = byPlayer.get(i);
  if (!m) { log.push(`NO MATCH   ${p.name}${AMBIGUOUS.has(p.name) ? '  (ambiguous)' : ''}`); return { ...p, sheetName: p.name }; }
  const e = m.e; let url = '';
  try { url = await photo(e); } catch (err) { log.push(`PHOTO FAIL ${p.name} / ${e.name}: ${err.message}`); }
  return { ...p, sheetName: p.name, name: e.name, department: e.dept, employeeId: e.id, company: e.company, photo: url, matchScore: +m.s.toFixed(2) };
})).filter((p) => !REMOVE.has(p.sheetName));
writeFileSync('data/players.json', JSON.stringify(out, null, 1));
console.log(`matched ${byPlayer.size}/${out.length}, with photo ${out.filter((p) => p.photo).length}`); console.log(log.sort().join('\n'));
