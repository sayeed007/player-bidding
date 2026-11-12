'use client';
import Link from 'next/link';
import { Target, Handshake, Square, Trophy, ArrowRight, CalendarDays } from 'lucide-react';
import { useApi } from '@/lib/client';
import { Stat, Avatar, StatusBadge, Skeleton, PageHeader, money } from '@/components/ui';
import { CatChip } from '@/components/cards';

const NOTE = {
  pending: 'Your registration is waiting for approval.',
  approved: 'You are approved and in the auction pool.',
  hold: 'You are on hold and will not be picked until released.',
  in_auction: 'You are being auctioned right now!',
  sold: 'You have been picked by a team.',
  unsold: 'You were not picked in the auction yet.',
  withdrawn: 'Your registration was withdrawn or rejected.',
};

export default function Me() {
  const { data: meD, error: meE } = useApi('/api/auth/me');
  const me = meD?.user;
  const tid = me?.tournamentId, pid = me?.playerId;
  const { data: p, error } = useApi(pid ? `/api/t/${tid}/players/${pid}` : null, { poll: 10000 });
  const { data: team } = useApi(p?.teamId ? `/api/t/${tid}/teams/${p.teamId}` : null);
  const { data: t } = useApi(tid ? `/api/t/${tid}` : null);
  const { data: stats } = useApi(pid ? `/api/t/${tid}/stats` : null); // MATCH module; may not exist yet
  const gate = (x) => <div className="mx-auto mt-10 max-w-sm grad-border rounded-2xl p-5 text-center text-sm shadow-card">{x}</div>;
  if (!meD && !meE) return <Skeleton className="h-48" />;
  if (!me) return gate(<>Please <Link href="/login">log in</Link>.</>);
  if (!pid) return gate(<span className="text-muted">This account is not linked to a player profile.</span>);
  const mine = stats?.players?.find((x) => x.playerId === pid);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My player profile" subtitle="Your registration, team and match performance" />
      {tid && <nav aria-label="Player shortcuts" className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href={`/t/${tid}`} className="inline-flex min-h-11 items-center gap-2 grad-card rounded-xl px-3 font-medium">Tournament overview<ArrowRight size={15} aria-hidden /></Link>
        <Link href={`/t/${tid}/fixtures`} className="inline-flex min-h-11 items-center gap-2 grad-card rounded-xl px-3 font-medium"><CalendarDays size={15} aria-hidden />Fixtures</Link>
      </nav>}
      {error && <p role="alert" className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {!p ? <Skeleton className="h-56" /> : (
        <section className="grad-border glow-primary rounded-2xl p-5 text-center shadow-card sm:p-8">
          <div className="flex flex-col items-center gap-4">
            <Avatar src={p.photo} name={p.name} size={144} className="ring-4 ring-primary/70 shadow-[0_0_32px_-4px_rgb(var(--primary)/.7)]" />
            <div>
              <h2 className="m-0 break-words font-display text-4xl font-bold uppercase tracking-wide sm:text-5xl">{p.name}</h2>
              <p className="mt-1 text-sm text-muted">{t?.name}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <StatusBadge status={p.status} />
              {p.category ? <CatChip code={p.category} /> : <span className="text-xs text-muted">Category to be assigned</span>}
              <span className="text-sm text-muted">{p.position}{p.position2 ? ` / ${p.position2}` : ''}</span>
            </div>
            <p className="w-full rounded-xl bg-surface2/70 px-4 py-3 text-base">{NOTE[p.status]}</p>
            {p.teamId && team && (
              <Link href={`/t/${tid}/teams/${p.teamId}`} className="flex min-h-14 w-full items-center gap-3 rounded-xl grad-card px-4 py-3 text-left text-fg no-underline hover:bg-surface2 hover:no-underline">
                <span className="min-w-0 flex-1"><span className="block text-xs text-muted">My team</span><span className="block break-words font-semibold">{team.team.name}</span></span>{p.price != null && <span className="text-sm tabular-nums text-muted">price {money(p.price)}</span>}<ArrowRight size={18} className="shrink-0 text-muted" aria-hidden />
              </Link>
            )}
          </div>
        </section>
      )}
      {mine ? (
        <section aria-labelledby="player-performance" className="mt-5">
          <h2 id="player-performance" className="mb-3 mt-0 text-lg font-semibold">Match performance</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Matches" value={mine.P} icon={Trophy} /><Stat label="Goals" value={mine.goals} icon={Target} /><Stat label="Assists" value={mine.assists} icon={Handshake} />
            <Stat label="Yellow" value={mine.yellow} icon={Square} /><Stat label="Red" value={mine.red} icon={Square} />
          </div>
        </section>
      ) : stats && <p className="text-center text-sm text-muted">No match statistics yet.</p>}
    </div>
  );
}
