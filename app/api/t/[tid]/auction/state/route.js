import { cookies } from 'next/headers';
import { api, me } from '@/lib/server';
import { load, state } from '@/lib/auction';

export const dynamic = 'force-dynamic';

// Spectators and the projector send no session cookie and all see the same thing, so one database read per second per
// server instance is enough for any number of them. Logged-in viewers always get a fresh, personal answer.
const seen = (globalThis._stateCache ??= new Map());
export const GET = api(async (req, { params }) => {
  const anon = !(await cookies()).get('s');
  const hit = anon && seen.get(params.tid);
  if (hit && Date.now() - hit.at < 1000) return { ...hit.v, now: Date.now() }; // fresh server clock keeps the countdown exact
  const { t, a } = await load(params.tid);
  const v = await state(t, a, anon ? null : await me());
  if (anon) seen.set(params.tid, { at: Date.now(), v });
  return v;
});
