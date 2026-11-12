import { api } from '@/lib/server';
import { reopen } from '@/lib/auction';

export const POST = api((req, { params }) => reopen(params.tid, params.pid));
