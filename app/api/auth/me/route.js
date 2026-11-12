import { api, me } from '@/lib/server';
export const dynamic = 'force-dynamic';

export const GET = api(async () => ({ user: await me() }));
