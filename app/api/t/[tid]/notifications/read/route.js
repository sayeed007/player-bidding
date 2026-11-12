import { api, me, body, col, fail } from '@/lib/server';
import { ObjectId } from 'mongodb';
import { visible } from '@/lib/notif';

/** POST {ids?: [..]} marks those (or all visible) notifications read for the current user. */
export const POST = api(async (req, { params }) => {
  const u = (await me()) || fail(401, 'login required');
  const b = await body(req);
  const q = visible(params.tid, u);
  if (Array.isArray(b.ids)) q._id = { $in: b.ids.filter((i) => ObjectId.isValid(String(i))).map((i) => new ObjectId(String(i))) };
  await (await col('notifications')).updateMany(q, { $addToSet: { readBy: u._id } });
  return { ok: true };
});
