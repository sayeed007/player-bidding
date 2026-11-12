'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Plus, ChevronRight } from 'lucide-react';
import { call, useApi } from '@/lib/client';
import { Button, Field, Msg, PageHeader, StatusBadge, Badge, Sheet, Skeleton, Empty, useFlash } from '@/components/ui';
import { FORMATS } from '@/lib/setup';

export default function Admin() {
  const router = useRouter();
  const { data: meData } = useApi('/api/auth/me');
  const u = meData?.user;
  const { data, reload, error: tournamentsError } = useApi('/api/tournaments');
  const [msg, flash] = useFlash();
  const [f, setF] = useState({ name: '', code: '', season: String(new Date().getFullYear()), teamsCount: 6, squadSize: 10, budget: 1000, format: 'single' });
  const [cl, setCl] = useState(null);
  const [showNew, setShowNew] = useState(false);
  useEffect(() => { if (u && u.role !== 'super' && u.tournamentId) router.replace(`/admin/${u.tournamentId}`); }, [u, router]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const create = (e) => { e.preventDefault(); flash(async () => { const r = await call('/api/tournaments', f); router.push(`/admin/${r._id}/settings`); }); };
  const clone = () => flash(async () => {
    await call(`/api/tournaments/${cl.t._id}/clone`, { name: cl.name, code: `${cl.t.code}-${Date.now() % 1000}`, copyPlayers: cl.copyPlayers });
    setCl(null); reload();
  }, 'Cloned');
  if (!u) return <Skeleton className="h-40" />;
  const isSuper = u.role === 'super';
  const list = data?.tournaments;
  return (
    <>
      <div id="tournaments" className="scroll-mt-24">
      <PageHeader title="Tournaments" subtitle={isSuper ? 'Create, clone, and manage competitions' : 'Choose a tournament to manage'} right={isSuper && <Button icon={Plus} onClick={() => setShowNew(true)}>New tournament</Button>} />
      <Msg {...msg} />
      {tournamentsError && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger"><span>{tournamentsError}</span><Button size="md" variant="secondary" onClick={reload}>Retry</Button></div>}
      <Sheet open={isSuper && showNew} onClose={() => setShowNew(false)} title="New tournament">
          <form onSubmit={create} className="grid gap-3">
            <Field label="Name"><input required value={f.name} onChange={set('name')} /></Field>
            <Field label="Code"><input value={f.code} onChange={set('code')} placeholder="auto" /></Field>
            <Field label="Season"><input value={f.season} onChange={set('season')} /></Field>
            <Field label="Teams"><input type="number" inputMode="numeric" min="2" value={f.teamsCount} onChange={set('teamsCount')} /></Field>
            <Field label="Players per team"><input type="number" inputMode="numeric" min="1" value={f.squadSize} onChange={set('squadSize')} /></Field>
            <Field label="Budget per team"><input type="number" inputMode="numeric" min="0" value={f.budget} onChange={set('budget')} /></Field>
            <Field label="Format"><select value={f.format} onChange={set('format')}>{FORMATS.map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}</select></Field>
            <Msg {...msg} />
            <Button className="w-full">Create tournament</Button>
            <p className="m-0 text-xs text-muted">Default categories A / B+ / B / C / D are added; edit them in Settings.</p>
          </form>
        </Sheet>
      {!list ? tournamentsError ? <Empty>Could not load tournaments.</Empty> : <Skeleton className="h-32" /> : !list.length ? <Empty>No tournaments yet.</Empty> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((t) => (
            <li key={t._id} className="grad-card rounded-2xl p-4 shadow-card transition hover:border-primary/60 hover:shadow-[0_0_24px_-8px_rgb(var(--primary)/.8)]">
              <Link href={`/admin/${t._id}`} className="flex items-center gap-3 text-fg no-underline hover:no-underline">
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-display text-xl font-semibold uppercase tracking-wide">{t.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">{t.code} · {t.season}<StatusBadge status={t.status} /><Badge>{t.visibility}</Badge></span>
                </span>
                <ChevronRight size={20} className="text-muted" aria-hidden />
              </Link>
              {isSuper && <Button variant="secondary" size="md" icon={Copy} className="mt-3" onClick={() => setCl({ t, name: `${t.name} (copy)`, copyPlayers: false })}>Clone</Button>}
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!cl} onClose={() => setCl(null)} title="Clone tournament">
        {cl && <div className="grid gap-3">
          <Field label="Name of the new tournament"><input value={cl.name} onChange={(e) => setCl({ ...cl, name: e.target.value })} /></Field>
          <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={cl.copyPlayers} onChange={(e) => setCl({ ...cl, copyPlayers: e.target.checked })} />Also copy players as fresh pending registrations</label>
          <Msg {...msg} />
          <Button disabled={!cl.name.trim()} onClick={clone}>Clone</Button>
        </div>}
      </Sheet>
      </div>
    </>
  );
}
