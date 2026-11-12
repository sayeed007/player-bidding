import { api, body, login, startSession, rateLimit, fail } from '@/lib/server';

export const POST = api(async (req) => {
  await rateLimit('login', 10, 60_000);
  const { username, password } = await body(req);
  const u = await login(username, password);
  if (!u) fail(401, 'wrong username or password');
  await startSession(u._id);
  return { ok: true, role: u.role };
});
