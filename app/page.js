'use client';
import Link from 'next/link';
import { useApi } from '@/lib/client';
import { Avatar, Empty, PageHeader, StatusBadge, dt } from '@/components/ui';
import { arr, Load } from './t/[tid]/ops';
import TournamentHome from './t/[tid]/page';

// React's use() reads a pre-fulfilled thenable synchronously (no suspend).
const resolved = (value) => ({ status: 'fulfilled', value, then() {} });

export default function Home() {
  const r = useApi('/api/tournaments');
  return (
    <Load r={r}>{(d) => {
      const list = arr(d, 'tournaments');
      // One public tournament: render its home content directly.
      if (list.length === 1) return <TournamentHome params={resolved({ tid: String(list[0]._id) })} />;
      return (
        <>
          <PageHeader title="Tournaments" subtitle="Pick a tournament to follow" />
          {!list.length ? <Empty>No public tournaments yet.</Empty> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((t) => (
                <Link key={t._id} href={`/t/${t._id}`} aria-label={`View ${t.name}`} className="group overflow-hidden rounded-2xl border border-line bg-surface text-fg no-underline shadow-card transition hover:border-primary/50 hover:no-underline">
                  <div className="relative h-28 bg-gradient-to-br from-primary to-cyan-700 bg-cover bg-center" style={t.banner ? { backgroundImage: `url(${t.banner})` } : undefined}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                  </div>
                  <div className="-mt-7 flex items-end gap-3 px-4"><Avatar src={t.logo} name={t.name} size={56} className="ring-2 ring-surface" /></div>
                  <div className="p-4 pt-2">
                    <h2 className="m-0 truncate">{t.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">{t.season}<StatusBadge status={t.status} /></div>
                    {t.dates?.start && <div className="mt-1 text-xs text-muted">Starts {dt(t.dates.start)}</div>}
                    <div className="mt-3 flex min-h-10 items-center justify-between border-t border-line pt-2 text-sm font-semibold text-primary">
                      <span>Open tournament</span><span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      );
    }}</Load>
  );
}
