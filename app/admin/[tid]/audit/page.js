'use client';
import { use, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useApi } from '@/lib/client';
import { Button, Card, Empty, Loading, PageHeader, dt } from '@/components/ui';

const SIZE = 50;

export default function Audit({ params }) {
  const { tid } = use(params);
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, reload } = useApi(`/api/t/${tid}/audit?page=${page}&size=${SIZE}&action=${encodeURIComponent(action)}`);
  const pages = Math.max(1, Math.ceil((data?.total || 0) / SIZE));
  const rows = data?.rows || [];
  return (
    <>
      <PageHeader title="Audit log" subtitle={`${data?.total ?? 0} entries`} />
      <div className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" aria-label="Filter by action" placeholder="Filter by action (e.g. bid, player)" className="!pl-10" value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }} />
      </div>
      {error && <div role="alert" className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger"><span className="min-w-0 break-words">{error}</span><Button variant="secondary" onClick={reload}>Retry</Button></div>}
      <Card flush className="overflow-hidden">
        {!data ? <div className="p-4">{error ? <Empty>Could not load audit entries.</Empty> : <Loading />}</div> : !rows.length ? <div className="p-4"><Empty>{action ? "No entries match this action filter." : "No audit entries yet."}</Empty></div> : (
          <ul className="m-0 list-none p-0">
            {rows.map((a, i) => (
              <li key={a._id ?? i} className="border-b border-line px-4 py-3 last:border-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs font-semibold text-primary ring-1 ring-primary/30">{a.action}</span>
                  <span className="text-sm font-medium">{a.userName || 'system'}</span>
                  <span className="ml-auto text-xs text-muted tabular-nums">{dt(a.at)}</span>
                </div>
                <code className="mt-1 block break-all text-xs text-muted">{JSON.stringify(a.detail ?? {})}</code>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
        <span className="text-sm text-muted tabular-nums">Page {page} / {pages}</span>
        <Button variant="secondary" disabled={!data || page >= pages} onClick={() => setPage(page + 1)}>Next<ChevronRight size={18} aria-hidden /></Button>
      </div>
    </>
  );
}
