import { api, need, tour } from '@/lib/server';
import { auctionReadiness, checkTransition, STATUSES } from '@/lib/lifecycle';

export const dynamic = 'force-dynamic';

/** Supply vs demand + the blocking problems for each allowed next status. */
export const GET = api(async (_req, { params }) => {
  await need(['organizer', 'auctioneer'], params.tid);
  const t = await tour(params.tid);
  const i = STATUSES.indexOf(t.status);
  const to = [STATUSES[i + 1], ...(t.status === 'registration_closed' ? ['registration_open'] : [])].filter(Boolean);
  const targets = {};
  for (const s of to) targets[s] = ['auction_in_progress', 'auction_completed'].includes(s) ? ['started/completed from the Auction room'] : await checkTransition(t, s);
  return { status: t.status, ...(await auctionReadiness(t)), targets };
});
