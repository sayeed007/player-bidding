import { api, col, body, need, oid, fail, audit } from '@/lib/server';
import { hash, randomPassword } from '@/lib/hash';

/** Super: activate/deactivate, rename, reset password ({resetPassword:true} returns a new one-time password). */
export const PATCH = api(async (req, { params }) => {
  const u = await need(['super']);
  const b = await body(req);
  const set = {};
  if ('active' in b) set.active = !!b.active;
  if (b.name) set.name = String(b.name).trim();
  let password;
  if (b.resetPassword) { password = randomPassword(); set.hash = hash(password); }
  if (!Object.keys(set).length) fail(400, 'nothing to change');
  const r = await (await col('users')).updateOne({ _id: oid(params.id) }, { $set: set });
  if (!r.matchedCount) fail(404, 'user not found');
  await audit(null, u, 'user.update', { id: params.id, ...('active' in set ? { active: set.active } : {}), reset: !!password });
  return password ? { password } : { ok: true };
});
