'use client';
import Link from 'next/link';
import { use } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';
import { useApi } from '@/lib/client';
import { Badge, Card, Empty, PageHeader, Skeleton, StatusBadge, Stat, Table } from '@/components/ui';
import { STATUS_ORDER, statusIndex, statusLabel } from '@/lib/setup';
import { arr, byId, MatchCard } from '@/app/t/[tid]/ops';

const TOP = new Set(['pending', 'pendingTeams', 'pendingResults']);

export default function Dashboard({ params }) {
  const { tid } = use(params);
  const { data, error, reload } = useApi(`/api/t/${tid}/dashboard`, { poll: 10000 });
  const { data: t, error: tournamentError, reload: reloadTournament } = useApi(`/api/t/${tid}`);
  const { data: readiness, error: readinessError } = useApi(`/api/t/${tid}/readiness`);
  const teamMap = byId(arr(useApi(`/api/t/${tid}/teams`).data, 'teams')); // crests and colours for the match cards
  const cur = t ? statusIndex(t.status) : -1;
  const attention = (data?.widgets || []).filter((w) => TOP.has(w.key) && Number(w.value) > 0);
  const blockers = readiness?.errors || [];
  const warnings = readiness?.warnings || [];
  const hasReadiness = !!readiness;

  return (
    <>
      <PageHeader title={t?.name || 'Tournament overview'} subtitle={t && `${t.season} · ${t.format?.replace(/_/g, ' ')}`} right={t && <StatusBadge status={t.status} />} />
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger"><span>{error}</span><button className="sec !min-h-9 !px-3" onClick={reload}>Retry</button></div>}
      {tournamentError && <div role="alert" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger"><span>{tournamentError}</span><button className="sec !min-h-9 !px-3" onClick={reloadTournament}>Retry</button></div>}

      <Card title="Tournament progress" right={t && <Link href={`/admin/${tid}/settings`} className="text-sm">Manage setup</Link>}>
        {tournamentError ? <Empty>Could not load tournament progress.</Empty> : !t ? <Skeleton className="h-12" /> : (
          <>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-label="Tournament progress" aria-valuemin={0} aria-valuemax={STATUS_ORDER.length} aria-valuenow={cur + 1}>
            <div className="h-full rounded-full grad-volt glow-primary transition-all" style={{ width: `${((cur + 1) / STATUS_ORDER.length) * 100}%` }} />
          </div>
          <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {STATUS_ORDER.map((s, i) => (
              <li key={s} aria-current={i === cur ? 'step' : undefined} className="flex shrink-0 items-center gap-2">
                <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${i === cur ? 'grad-volt glow-primary font-bold' : i < cur ? 'bg-success/15 text-success' : 'bg-surface2 text-muted'}`}>
                  {i < cur ? <CheckCircle2 size={14} aria-hidden /> : <span className="tabular-nums">{i + 1}</span>}{statusLabel(s)}
                </span>
              </li>
            ))}
          </ol>
          </>
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
        <Card title="Needs attention" right={attention.length > 0 && <Badge color="amber">{attention.length} items</Badge>}>
          {!data ? error ? <Empty>Could not load dashboard items.</Empty> : <div className="grid gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            : attention.length || blockers.length || readinessError ? <div className="grid gap-2">
              {attention.map((w) => <Link key={w.key} href={w.href} className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface2/50 px-3 text-fg no-underline hover:border-primary/40 hover:no-underline">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warning/15 text-warning"><Clock3 size={17} aria-hidden /></span>
                <span className="min-w-0 flex-1 text-sm font-medium">{w.label}</span><b className="tabular-nums">{w.value}</b><ArrowRight size={16} className="text-muted" aria-hidden />
              </Link>)}
              {readinessError && <p role="alert" className="m-0 rounded-xl bg-danger/10 p-3 text-sm text-danger">Could not load auction readiness: {readinessError}</p>}
              {blockers.map((issue) => <Link key={issue} href={`/admin/${tid}/settings`} className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-fg no-underline hover:no-underline">
                <AlertTriangle size={17} className="mt-0.5 shrink-0 text-danger" aria-hidden /><span className="min-w-0 flex-1"><b className="block text-danger">Auction readiness blocker</b>{issue}</span><ArrowRight size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
              </Link>)}
            </div> : hasReadiness ? <Empty><span className="text-center"><b className="block text-fg">No pending work</b>There are no pending reviews, results, or readiness blockers.</span></Empty> : <Skeleton className="h-16" />}
        </Card>

        <Card title="Auction readiness" right={hasReadiness && <Badge color={blockers.length ? 'red' : warnings.length ? 'amber' : 'green'}>{blockers.length ? `${blockers.length} blockers` : warnings.length ? `${warnings.length} warnings` : 'Ready'}</Badge>}>
          {readinessError ? <p role="alert" className="m-0 rounded-xl bg-danger/10 p-3 text-sm text-danger">{readinessError}</p> : !readiness ? <Skeleton className="h-20" /> : <>
            <p className="m-0 text-sm text-muted">Player supply compared with category demand.</p>
            <Table rowKey="code" rows={Object.entries(readiness.supply || {}).map(([code, s]) => ({ code, ...s }))} empty="No active categories." cols={[
              { key: 'code', label: 'Category' },
              { key: 'need', label: 'Need' },
              { key: 'have', label: 'Approved' },
              { key: 'balance', label: 'Status', render: (s) => s.have < s.need ? <Badge color="red">Short {s.need - s.have}</Badge> : s.have > s.need ? <Badge color="amber">Extra {s.have - s.need}</Badge> : <Badge color="green">Ready</Badge> },
            ]} />
            {warnings.length > 0 && <ul className="mt-3 grid gap-1 text-sm text-warning">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
          </>}
        </Card>
      </div>

      <Card title="Tournament snapshot">
        {!data ? error ? <Empty>Could not load tournament summary.</Empty> : <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
          : <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{data.widgets.filter((w) => !TOP.has(w.key)).map((w) => <Stat key={w.key} label={w.label} value={w.value} href={w.href} />)}</div>}
      </Card>

      <Card title="Upcoming fixtures" right={<Link href={`/admin/${tid}/fixtures`} className="text-sm">All fixtures</Link>}>
        {!data ? error ? <Empty>Could not load upcoming fixtures.</Empty> : <Skeleton className="h-16" /> : !data.upcoming.length ? <Empty>No upcoming fixtures.</Empty> : (
          <div className="grid gap-3 md:grid-cols-2">{data.upcoming.map((m) => <MatchCard key={m._id} plain m={m} teams={teamMap} />)}</div>
        )}
      </Card>
    </>
  );
}
