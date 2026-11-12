import { api, me, col, fail } from '@/lib/server';
import { visible } from '@/lib/notif';

export const dynamic = 'force-dynamic';

export const GET = api(async (req, { params }) => {
  const u = (await me()) || fail(401, 'login required');
  const rows = await (await col('notifications')).find(visible(params.tid, u)).sort({ at: -1 }).limit(50).toArray();
  const items = rows.map(({ readBy, to, ...n }) => ({ ...n, read: (readBy || []).some((x) => String(x) === String(u._id)) }));
  return { items, unread: items.filter((n) => !n.read).length };
});
