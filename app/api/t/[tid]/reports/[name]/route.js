import { api, need, fail } from '@/lib/server';
import { REPORTS, report } from '@/lib/reports';

export const dynamic = 'force-dynamic';

export const GET = api(async (req, { params }) => {
  const { tid, name } = params;
  await need(['organizer'], tid);
  if (!REPORTS.includes(name)) fail(404, 'unknown report');
  return report(name, tid);
});
