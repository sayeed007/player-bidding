import { api, endSession } from '@/lib/server';

export const POST = api(async () => { await endSession(); return { ok: true }; });
