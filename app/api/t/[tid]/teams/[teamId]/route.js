import { api, col, body, tour, oid, fail, audit } from '@/lib/server';
import { teamDoc, teamCount } from '@/lib/setup';
import { viewer, shapeTeam, shapePlayer, ownTeam, teamNameTaken } from '@/lib/setup-server';

export const dynamic = 'force-dynamic';

async function load(t, id) {
  return (await (await col('teams')).findOne({ _id: oid(id), tournamentId: t._id })) || fail(404, 'team not found');
}

/** Team + squad. Prices only when publicPrices, staff or own team. */
export const GET = api(async (_req, { params }) => {
  const t = await tour(params.tid);
  const v = await viewer(t._id);
  const team = await load(t, params.teamId);
  if (team.status !== 'approved' && !v.staff && !ownTeam(v, team._id)) fail(404, 'team not found');
  const squad = await (await col('players')).find({ tournamentId: t._id, teamId: team._id }).sort({ price: -1, name: 1 }).toArray();
  return { team: { ...shapeTeam(team, t, v), count: teamCount(team) }, squad: squad.map((p) => shapePlayer(p, t, v)) };
});

/** Organizer edits everything editable; the team owner may only change logo/color. */
export const PATCH = api(async (req, { params }) => {
  const t = await tour(params.tid);
  const v = await viewer(t._id);
  const team = await load(t, params.teamId);
  const b = await body(req);
  let set;
  if (v.admin) {
    const flat = { ...team, phone: team.contact?.phone, email: team.contact?.email, ...b };
    const { doc, errors } = teamDoc(flat);
    if (errors.length) fail(400, errors.join('; '));
    if (doc.name !== team.name && (await teamNameTaken(t._id, doc.name, team._id))) fail(409, 'team name already used in this tournament');
    set = doc;
    if ('captainPlayerId' in b) set.captainPlayerId = b.captainPlayerId ? oid(b.captainPlayerId) : null;
  } else if (v.u?.role === 'owner' && ownTeam(v, team._id)) {
    set = {};
    if ('logo' in b) set.logo = String(b.logo || '').trim();
    if ('color' in b) /^#[0-9a-fA-F]{6}$/.test(b.color) ? (set.color = b.color) : fail(400, 'bad color');
  } else fail(403, 'not allowed');
  await (await col('teams')).updateOne({ _id: team._id }, { $set: set });
  await audit(t._id, v.u, 'team.update', { teamId: team._id, fields: Object.keys(set) });
  return { ok: true };
});
