import { api, need } from '@/lib/server';
import { load, summary } from '@/lib/auction';

export const dynamic = 'force-dynamic';
export const GET = api(async (req, { params }) => {
  await need(['organizer', 'auctioneer'], params.tid);
  const { t } = await load(params.tid);
  return summary(t);
});
