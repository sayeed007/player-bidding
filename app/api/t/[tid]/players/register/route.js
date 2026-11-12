import { api, col, body, tour, fail, rateLimit } from '@/lib/server';
import { playerDoc } from '@/lib/setup';

/** Public self-registration -> status pending. */
export const POST = api(async (req, { params }) => {
  await rateLimit('player-reg', 5, 10 * 60 * 1000);
  const t = await tour(params.tid);
  const now = new Date().toISOString().slice(0, 16);
  if (t.status !== 'registration_open' || (t.dates?.regStart && now < t.dates.regStart) || (t.dates?.regEnd && now > t.dates.regEnd)) fail(403, 'registration is not open');
  const { doc, errors } = playerDoc(await body(req), t, { self: true });
  if (errors.length) fail(400, errors.join('; '));
  const players = await col('players');
  if (await players.findOne({ tournamentId: t._id, name: doc.name }, { collation: { locale: 'en', strength: 2 } })) fail(409, 'this name is already registered');
  await players.insertOne({ ...doc, tournamentId: t._id, status: 'pending', teamId: null, price: null, captain: false, regAt: new Date() });
  return { ok: true };
});
