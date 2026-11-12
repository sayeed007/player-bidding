import { api, col, need, tour } from '@/lib/server';
import { toCsv, effectivePrice } from '@/lib/setup';

export const dynamic = 'force-dynamic';

export const GET = api(async (_req, { params }) => {
  await need(['organizer'], params.tid);
  const t = await tour(params.tid);
  const teams = Object.fromEntries((await (await col('teams')).find({ tournamentId: t._id }).toArray()).map((x) => [String(x._id), x.name]));
  const players = await (await col('players')).find({ tournamentId: t._id }).sort({ name: 1 }).toArray();
  const csv = toCsv(players.map((p) => ({
    name: p.name, position: p.position, position2: p.position2, category: p.category, basePrice: p.basePrice ?? '', effectivePrice: effectivePrice(p, t) ?? '',
    status: p.status, team: teams[String(p.teamId)] || '', soldPrice: p.price ?? '', phone: p.contact?.phone, email: p.contact?.email,
    employeeId: p.employeeId, department: p.department, registered: p.regAt?.toISOString?.() || '',
  })));
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="players.csv"' } });
});
