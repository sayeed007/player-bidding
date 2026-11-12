import { api, body, need, tour, json, audit, notify } from '@/lib/server';
import { checkTransition, setStatus } from '@/lib/lifecycle';
import { statusLabel } from '@/lib/setup';

/** Organizer moves the tournament along its lifecycle. The two auction statuses belong to the auction module. */
export const POST = api(async (req, { params }) => {
  const u = await need(['organizer'], params.tid);
  const t = await tour(params.tid);
  const { to } = await body(req);
  const problems = ['auction_in_progress', 'auction_completed'].includes(to)
    ? ['the auction status changes when the auction is started/completed in the Auction room']
    : await checkTransition(t, to);
  if (problems.length) return json({ error: problems.join('; '), problems }, 409);
  await setStatus(t._id, to);
  await audit(t._id, u, 'tournament.status', { from: t.status, to });
  await notify(t._id, { all: true }, 'info', `Tournament is now: ${statusLabel(to)}`);
  return { status: to };
});
