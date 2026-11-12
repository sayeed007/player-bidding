import { api, need, body, col, oid, tour, fail, audit, notify, rateLimit } from '@/lib/server';

export const dynamic = 'force-dynamic';

export const GET = api(async (req, { params }) => {
  await tour(params.tid);
  const announcements = await (await col('notifications')).find({ tournamentId: oid(params.tid), type: 'announcement' })
    .project({ title: 1, text: 1, at: 1 }).sort({ at: -1 }).limit(50).toArray();
  return { announcements };
});

export const POST = api(async (req, { params }) => {
  const { tid } = params;
  const u = await need(['organizer'], tid);
  await rateLimit('announce', 20, 60000);
  const b = await body(req);
  const title = String(b.title || '').trim().slice(0, 120), text = String(b.text || '').trim().slice(0, 2000);
  if (!title) fail(400, 'title required');
  await tour(tid);
  await notify(tid, { all: true }, 'announcement', title, text);
  await audit(tid, u, 'announcement', { title });
  return { ok: true };
});
