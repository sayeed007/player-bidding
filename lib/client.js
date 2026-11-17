'use client';
import { useCallback, useEffect, useState } from 'react';

/** fetch JSON; throws Error(message) on non-2xx. */
export async function call(url, data, method = data === undefined ? 'GET' : 'POST', timeoutMs = 25000) {
  // a request that never answers must fail visibly, not leave buttons locked forever
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  let r;
  try {
    r = await fetch(url, {
      method, cache: 'no-store', signal: ctl.signal,
      headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'The server did not answer in time. Check your connection and try again.' : `Network problem: ${e.message}`);
  } finally { clearTimeout(timer); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `request failed (${r.status})`);
  return j;
}

/** GET url, optionally polling every `poll` ms. Returns {data, error, reload}. */
export function useApi(url, { poll = 0 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => (url ? call(url).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)) : null), [url]);
  useEffect(() => {
    reload();
    if (!poll) return;
    const t = setInterval(() => { if (!document.hidden) reload(); }, poll);
    const onShow = () => { if (!document.hidden) reload(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onShow); };
  }, [reload, poll]);
  return { data, error, reload };
}

export const useMe = () => useApi('/api/auth/me').data?.user ?? null;

/** Download rows as CSV in the browser. rows: array of plain objects. */
export function downloadCsv(name, rows) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  a.click();
}

/** Parse CSV text (quotes supported) into objects keyed by header row. */
export function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; rows.push(row); row = []; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...rest] = rows.filter((r) => r.some((c) => c.trim()));
  return rest.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()])));
}

/** Upload an image to Cloudinary (unsigned preset) and return its URL. */
export async function uploadImage(file) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD, preset = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET;
  if (!cloud || !preset) throw new Error('Cloudinary env vars not set');
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', preset);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: fd }).then((x) => x.json());
  if (!r.secure_url) throw new Error(r.error?.message || 'upload failed');
  return r.secure_url;
}
