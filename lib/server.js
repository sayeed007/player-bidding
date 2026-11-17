// Server-only helpers shared by every API route. See DESIGN.md.
import { MongoClient, ObjectId } from 'mongodb';
import { createHmac } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { verify } from './hash.js';

const g = globalThis;
export async function client() {
  // A failed first connect must NOT stay cached: on a warm serverless instance that would make every request fail
  // until Vercel recycles the instance. Short timeouts also turn a stuck connection into a fast, retryable error.
  g._mongo ??= new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000, socketTimeoutMS: 25000 })
    .connect().catch((e) => { g._mongo = null; throw e; });
  return g._mongo;
}
export const db = async () => (await client()).db();
export const col = async (name) => (await db()).collection(name);

// ---------- errors / api wrapper ----------
export class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}
export const fail = (status, msg) => { throw new HttpError(status, msg); };
export const json = (d, status = 200) => Response.json(d, { status });
export const body = (req) => req.json().catch(() => ({}));

/** Wrap a route handler: awaits params, turns thrown HttpError into JSON, returns plain objects as JSON. */
export const api = (fn) => async (req, ctx) => {
  try {
    const r = await fn(req, { params: await ctx?.params });
    return r instanceof Response ? r : json(r ?? { ok: true });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'server error' }, 500);
  }
};

export function oid(s) {
  if (s instanceof ObjectId) return s;
  if (!ObjectId.isValid(s) || String(s).length !== 24) fail(400, 'invalid id');
  return new ObjectId(s);
}
export const oidOrNull = (s) => (s ? oid(s) : null);

/** Fetch tournament by id or 404. */
export async function tour(tid) {
  const t = await (await col('tournaments')).findOne({ _id: oid(tid) });
  return t || fail(404, 'tournament not found');
}

// ---------- sessions & roles ----------
// roles: super | organizer | auctioneer | owner | captain | player
const secret = () => process.env.SECRET || fail(500, 'SECRET not set');
const sign = (v) => createHmac('sha256', secret()).update(v).digest('hex');

export async function startSession(userId) {
  const v = String(userId);
  (await cookies()).set('s', `${v}.${sign(v)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 604800,
  });
}
export async function endSession() { (await cookies()).delete('s'); }

/** Current user (without hash) or null. */
export async function me() {
  const raw = (await cookies()).get('s')?.value || '';
  const i = raw.lastIndexOf('.');
  if (i < 0 || sign(raw.slice(0, i)) !== raw.slice(i + 1)) return null;
  const u = await (await col('users')).findOne({ _id: oid(raw.slice(0, i)), active: { $ne: false } });
  if (!u) return null;
  delete u.hash;
  return u;
}

/** Require a logged-in user with one of `roles` (super always passes) bound to tournament `tid`. */
export async function need(roles, tid) {
  const u = await me();
  if (!u) fail(401, 'login required');
  if (u.role === 'super') return u;
  if (!roles.includes(u.role)) fail(403, 'not allowed');
  if (tid && String(u.tournamentId) !== String(tid)) fail(403, 'not allowed for this tournament');
  return u;
}
/** Organizer/auctioneer/super, or the owner/captain of `teamId`. */
export async function needTeam(tid, teamId, roles = ['owner', 'captain']) {
  const u = await need(['organizer', 'auctioneer', ...roles], tid);
  if (roles.includes(u.role) && String(u.teamId) !== String(teamId)) fail(403, 'not your team');
  return u;
}

export async function login(username, password) {
  const u = await (await col('users')).findOne({ username: String(username || '').toLowerCase().trim(), active: { $ne: false } });
  return u && verify(String(password || ''), u.hash) ? u : null;
}

// ---------- rate limit (per server instance; ponytail: use Mongo/Upstash if abuse matters) ----------
const hits = (g._hits ??= new Map());
export async function rateLimit(key, max, windowMs) {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] || 'local';
  const k = `${key}:${ip}`, now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) fail(429, 'too many requests, slow down');
  arr.push(now);
  hits.set(k, arr);
}

// ---------- audit & notifications ----------
export async function audit(tid, user, action, detail = {}) {
  await (await col('audit')).insertOne({ tournamentId: tid ? oid(tid) : null, at: new Date(), userId: user?._id, userName: user?.username, action, detail });
}
/** to: {all:true} | {teamId} | {userId}. type: info|announcement|auction|fixture|result */
export async function notify(tid, to, type, title, text = '') {
  await (await col('notifications')).insertOne({ tournamentId: oid(tid), to, type, title, text, at: new Date(), readBy: [] });
}

// ---------- privacy ----------
export const publicPlayer = (p) => { const { contact, employeeId, department, ...rest } = p; return rest; };
