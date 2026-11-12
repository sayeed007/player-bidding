import { api, body } from '@/lib/server';
import { runAction } from '@/lib/auction';

// One POST route for all auction actions (start, random-pick, open, bid, close, pause, resume, suspend,
// skip, cancel-lot, hold-lot, correct-sale, complete). Static sibling routes (state, summary, reopen) win.
export const POST = api((req, { params }) => runAction(params.action, params.tid, req, body));
