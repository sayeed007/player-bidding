import { api, col, need, oid, audit, notify } from '@/lib/server';

export const POST = api(async (req, { params }) => {
  const { tid } = params;
  const u = await need(['organizer'], tid);
  const mc = await col('matches');
  const r = await mc.updateMany({ tournamentId: oid(tid), published: { $ne: true }, status: { $ne: 'cancelled' } }, { $set: { published: true } });
  await mc.updateMany({ tournamentId: oid(tid), published: true, status: 'scheduled' }, { $set: { status: 'upcoming' } });
  await audit(tid, u, 'fixtures.publish', { count: r.modifiedCount });
  if (r.modifiedCount) await notify(tid, { all: true }, 'fixture', 'Fixtures published', `${r.modifiedCount} match(es) added to the schedule.`);
  return { ok: true, published: r.modifiedCount };
});
