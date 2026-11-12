import { api, me } from '@/lib/server';
import { load, state } from '@/lib/auction';

export const dynamic = 'force-dynamic';
export const GET = api(async (req, { params }) => {
  const { t, a } = await load(params.tid);
  return state(t, a, await me());
});
