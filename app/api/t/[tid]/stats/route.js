import { api } from '@/lib/server';
import { computeStats } from '@/lib/stats';
import { isStaff, loadStats } from '@/lib/matchapi';

export const dynamic = 'force-dynamic';

export const GET = api(async (req, { params }) => {
  const { t, teams, players, matches } = await loadStats(params.tid);
  const s = computeStats(players, teams, matches, t);
  if (!t?.auction?.publicPrices && !(await isStaff(params.tid))) s.players.forEach((p) => delete p.price);
  return s;
});
