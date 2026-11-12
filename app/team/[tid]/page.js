'use client';
import Link from 'next/link';
import { use } from 'react';
import clsx from 'clsx';
import { Gavel, Check, ClipboardList, Bell, CalendarDays, MapPin, ArrowRight } from 'lucide-react';
import { useApi } from '@/lib/client';
import { Card, Skeleton, Empty, Badge, Avatar, money, dt } from '@/components/ui';
import { PlayerTile, CatChip, catOf } from '@/components/cards';

export default function TeamHome({ params }) {
  const { tid } = use(params);
  const { data: meD, error: meE } = useApi('/api/auth/me');
  const me = meD?.user;
  const teamId = me?.teamId;
  const { data: b, error } = useApi(teamId ? `/api/t/${tid}/teams/${teamId}/budget` : null, { poll: 5000 });
  const { data: d } = useApi(teamId ? `/api/t/${tid}/teams/${teamId}` : null, { poll: 5000 });
  const { data: tour } = useApi(teamId ? `/api/t/${tid}` : null, { poll: 15000 });
  // other modules' endpoints: tolerate errors until they exist
  const { data: m } = useApi(teamId ? `/api/t/${tid}/matches` : null, { poll: 30000 });
  const { data: n } = useApi(teamId ? `/api/t/${tid}/notifications` : null, { poll: 10000 });

  const gate = (x) => <div className="mx-auto mt-10 max-w-sm grad-border rounded-2xl p-5 text-center text-sm shadow-card">{x}</div>;
  if (!meD && !meE) return <Skeleton className="h-40" />;
  if (!me) return gate(<>Please <Link href="/login">log in</Link> as a team owner or captain.</>);
  if (!teamId) return gate(<span className="text-danger">This login is not linked to a team.</span>);

  const team = d?.team;
  const squad = d?.squad || [];
  const live = tour?.status === 'auction_in_progress';
  const now = new Date().toISOString();
  const fixtures = (m?.matches || []).filter((x) => (x.homeTeamId === teamId || x.awayTeamId === teamId) && x.status !== 'completed' && x.status !== 'cancelled' && x.start >= now.slice(0, 10))
    .sort((a, c) => (a.start < c.start ? -1 : 1)).slice(0, 5);
  const pct = b?.budget ? Math.min(100, Math.round((b.spent / b.budget) * 100)) : 0;

  return (
    <>
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <Avatar src={team?.logo} name={(team?.name || '').replace(/^Team\s+/i, '')} size={56} color={team?.color} />
        <div className="min-w-0 flex-1"><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Team workspace</p><h1 className="m-0 break-words text-grad">{team?.name || 'My team'}</h1></div>
        {me.role === 'captain' && <Link href={`/team/${tid}/lineup`} className="inline-flex min-h-11 items-center justify-center gap-2 grad-card rounded-xl px-3 text-sm font-semibold text-fg no-underline hover:bg-surface2 hover:no-underline"><ClipboardList size={17} aria-hidden />Lineup</Link>}
      </div>
      <nav aria-label="Team shortcuts" className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href={`/t/${tid}`} className="inline-flex min-h-11 items-center gap-2 grad-card rounded-xl px-3 font-medium">Tournament overview<ArrowRight size={15} aria-hidden /></Link>
        <Link href={`/t/${tid}/fixtures`} className="inline-flex min-h-11 items-center gap-2 grad-card rounded-xl px-3 font-medium"><CalendarDays size={15} aria-hidden />All fixtures</Link>
      </nav>
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {/* hero: remaining budget */}
      {!b ? <Skeleton className="h-44" /> : (
        <section className="grad-hero glow-accent rounded-2xl p-5 text-white shadow-card md:p-7" aria-label="Budget">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/80">Remaining budget</p>
          <p className="break-words font-display text-7xl font-extrabold leading-none tabular-nums drop-shadow-[0_0_24px_rgb(255_255_255/.35)] sm:text-8xl md:text-9xl">{money(b.remaining)}</p>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-black/30" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Budget spent"><div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/25 pt-4 text-sm">
            <div><p className="uppercase tracking-wider text-white/75">Spent</p><p className="font-display text-2xl font-bold tabular-nums">{money(b.spent)}</p></div>
            <div><p className="uppercase tracking-wider text-white/75">Players</p><p className="font-display text-2xl font-bold tabular-nums">{b.count} / {b.squad}</p></div>
            <div><p className="uppercase tracking-wider text-white/75">Slots left</p><p className="font-display text-2xl font-bold tabular-nums">{b.slots}</p></div>
          </div>
        </section>
      )}

      <Link href={`/team/${tid}/auction`} className={clsx('mt-3 flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-5 py-3 font-display text-xl font-bold uppercase tracking-wide no-underline hover:no-underline', live ? 'pulse-live glow-accent border-accent bg-accent text-white' : 'grad-card text-fg hover:border-primary/60')}>
        <Gavel size={24} aria-hidden /><span className="flex-1">{live ? 'Enter bidding room — LIVE' : 'Auction room'}</span><ArrowRight size={22} aria-hidden />
      </Link>

      {b && (
        <Card title="Category quota">
          <ul className="grid gap-4 sm:grid-cols-2">
            {b.quota.map((q) => {
              const ok = q.have >= q.min, c = catOf(q.code);
              return (
                <li key={q.code}>
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <CatChip code={q.code} /><span className="flex-1 font-display text-lg tabular-nums text-fg">{q.have} <span className="text-sm text-muted">of {q.min}{q.max !== q.min ? `–${q.max}` : ''}</span></span>
                    {ok ? <span className="flex items-center gap-1 text-success"><Check size={14} aria-hidden />Met</span> : <span className="text-warning">need {q.need} more</span>}
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={q.have} aria-valuemin={0} aria-valuemax={q.max || q.min} aria-label={`Category ${q.code}`}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (q.have / Math.max(q.max || q.min, 1)) * 100)}%`, background: `linear-gradient(90deg, ${c.from}, ${c.to})`, boxShadow: `0 0 12px ${c.from}` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title={`Roster${squad.length ? ` (${squad.length})` : ''}`}>
        {!d ? <Skeleton className="h-16" /> : !squad.length ? <Empty>No players yet. Win some in the auction.</Empty> : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {squad.map((p) => <li key={p._id} className="relative"><PlayerTile player={p} price={money(p.price)} />{p.captain && <span className="absolute bottom-2 right-2 z-10"><Badge color="amber">C</Badge></span>}</li>)}
          </ul>
        )}
      </Card>

      <Card title="Upcoming fixtures" right={<Link href={`/t/${tid}/fixtures`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium">View all<ArrowRight size={15} aria-hidden /></Link>}>
        {!fixtures.length ? <Empty>No fixtures published yet.</Empty> : (
          <ul className="grid gap-2">
            {fixtures.map((x) => (
              <li key={x._id} className="rounded-xl border border-line p-3">
                <p className="font-semibold">{x.homeName} <span className="text-muted">vs</span> {x.awayName}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted"><span className="flex items-center gap-1"><CalendarDays size={14} aria-hidden />{dt(x.start)}</span>{x.venue && <span className="flex items-center gap-1"><MapPin size={14} aria-hidden />{x.venue}</span>}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Notifications" right={<Bell size={16} className="text-muted" aria-hidden />}>
        {!(n?.items || []).length ? <Empty>No notifications.</Empty> : (
          <ul className="divide-y divide-line">
            {n.items.slice(0, 10).map((x) => (
              <li key={x._id} className="py-2 first:pt-0 last:pb-0"><p className="font-semibold">{x.title}</p><p className="text-sm">{x.text}</p><p className="text-xs text-muted">{dt(x.at)}</p></li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
