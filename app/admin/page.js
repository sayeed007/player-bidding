'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Plus, ChevronRight } from 'lucide-react';
import { call, useApi } from '@/lib/client';
import { Card, Button, Field, Msg, PageHeader, StatusBadge, Badge, Sheet, Table, Skeleton, Empty, useFlash } from '@/components/ui';
import { FORMATS } from '@/lib/setup';

const ROLES = ['organizer', 'auctioneer', 'owner', 'captain', 'player', 'super'];

function Secret({ made, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <Sheet open={!!made} onClose={() => { setCopied(false); onClose(); }} title="One-time password">
      {made && <div className="grid gap-3">
        <p className="text-sm">User <b>{made.username}</b></p>
        <code className="break-all rounded-xl bg-surface2 p-3 text-lg tabular-nums">{made.password || '(as entered)'}</code>
        <p className="text-sm text-warning">Shown only once. Copy it now.</p>
        {made.password && <Button icon={Copy} onClick={() => navigator.clipboard?.writeText(made.password).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy password'}</Button>}
      </div>}
    </Sheet>
  );
}

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
      <PageHeader title="Tournaments" subtitle={isSuper ? 'Create, clone, and manage competitions' : 'Choose a tournament to manage'} right={isSuper && <Button icon={Plus} onClick={() => setShowNew((v) => !v)}>New tournament</Button>} />
      <Msg {...msg} />
      {tournamentsError && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger"><span>{tournamentsError}</span><Button size="md" variant="secondary" onClick={reload}>Retry</Button></div>}
      {isSuper && showNew && (
        <Card title="Create tournament">
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name"><input required value={f.name} onChange={set('name')} /></Field>
            <Field label="Code"><input value={f.code} onChange={set('code')} placeholder="auto" /></Field>
            <Field label="Season"><input value={f.season} onChange={set('season')} /></Field>
            <Field label="Teams"><input type="number" inputMode="numeric" min="2" value={f.teamsCount} onChange={set('teamsCount')} /></Field>
            <Field label="Players per team"><input type="number" inputMode="numeric" min="1" value={f.squadSize} onChange={set('squadSize')} /></Field>
            <Field label="Budget per team"><input type="number" inputMode="numeric" min="0" value={f.budget} onChange={set('budget')} /></Field>
            <Field label="Format"><select value={f.format} onChange={set('format')}>{FORMATS.map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}</select></Field>
            <div className="flex items-end"><Button className="w-full">Create tournament</Button></div>
            <p className="text-xs text-muted sm:col-span-2 lg:col-span-3">Default categories A / B+ / B / C / D are added; edit them in Settings.</p>
          </form>
        </Card>
      )}
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
          <Button disabled={!cl.name.trim()} onClick={clone}>Clone</Button>
        </div>}
      </Sheet>
      </div>
      {isSuper && <section id="users" className="mt-6 scroll-mt-24"><Users tournaments={list || []} /></section>}
    </>
  );
}

function Users({ tournaments }) {
  const [tid, setTid] = useState('');
  const { data, reload, error } = useApi(`/api/users${tid ? `?tournamentId=${tid}` : ''}`);
  const [msg, flash] = useFlash();
  const [f, setF] = useState({ username: '', name: '', role: 'organizer', password: '', tournamentId: '', teamId: '', playerId: '' });
  const [made, setMade] = useState(null);
  const [reset, setReset] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => { e.preventDefault(); flash(async () => { const r = await call('/api/users', f); setMade({ username: f.username, ...r }); reload(); }, 'User created'); };
  const act = (id, d) => flash(async () => { const r = await call(`/api/users/${id}`, d, 'PATCH'); if (r.password) setMade({ username: '(reset)', password: r.password }); reload(); }, 'Updated');
  return (
    <Card title="Users" right={<select className="!w-full min-w-0 sm:!w-auto sm:max-w-xs" aria-label="Filter by tournament" value={tid} onChange={(e) => setTid(e.target.value)}><option value="">All tournaments</option>{tournaments.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select>}>
      <Msg {...msg} />
      {error && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger"><span>{error}</span><Button size="md" variant="secondary" onClick={reload}>Retry</Button></div>}
      {!data ? error ? <Empty>Could not load users.</Empty> : <Skeleton className="h-32" /> : <Table rows={data.users} cols={[
        { key: 'username', label: 'Username' }, { key: 'name', label: 'Name' }, { key: 'role', label: 'Role' },
        { key: 't', label: 'Tournament', render: (x) => tournaments.find((t) => t._id === x.tournamentId)?.name || '—' },
        { key: 'active', label: 'Active', render: (x) => (x.active === false ? 'no' : 'yes') },
        { key: 'a', label: 'Actions', render: (x) => <span className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="md" onClick={() => act(x._id, { active: x.active === false })}>{x.active === false ? 'Enable' : 'Disable'}</Button>
          <Button variant="secondary" size="md" onClick={() => setReset(x)}>Reset password</Button></span> },
      ]} />}
      <h3 className="mb-2 mt-5 font-display text-base font-semibold">New user</h3>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Username"><input required value={f.username} onChange={set('username')} autoCapitalize="none" /></Field>
        <Field label="Name"><input value={f.name} onChange={set('name')} /></Field>
        <Field label="Role"><select value={f.role} onChange={set('role')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Tournament"><select value={f.tournamentId} onChange={set('tournamentId')}><option value="">—</option>{tournaments.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></Field>
        {['owner', 'captain'].includes(f.role) && <Field label="Team id"><input value={f.teamId} onChange={set('teamId')} /></Field>}
        {f.role === 'player' && <Field label="Player id"><input value={f.playerId} onChange={set('playerId')} /></Field>}
        <Field label="Password (blank = generate)"><input type="password" value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <div className="flex items-end"><Button className="w-full">Create user</Button></div>
      </form>
      <Secret made={made} onClose={() => setMade(null)} />
      <Sheet open={!!reset} onClose={() => setReset(null)} title="Reset password?">
        {reset && <div className="grid gap-3"><p className="text-sm">A new one-time password will be generated for <b>{reset.username}</b>.</p>
          <Button variant="danger" onClick={() => { const id = reset._id; setReset(null); act(id, { resetPassword: true }); }}>Reset password</Button></div>}
      </Sheet>
    </Card>
  );
}
