'use client';
import { useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { call, useApi } from '@/lib/client';
import { Button, Card, Empty, Field, Msg, PageHeader, Sheet, Skeleton, Table, useFlash } from '@/components/ui';

const ROLES = ['organizer', 'auctioneer', 'owner', 'captain', 'player', 'super'];
const BLANK = { username: '', name: '', role: 'organizer', password: '', tournamentId: '', teamId: '', playerId: '' };

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

// /admin/users: platform user management (super admin only).
export default function UsersPage() {
  const me = useApi('/api/auth/me').data?.user;
  const tournaments = useApi('/api/tournaments').data?.tournaments ?? [];
  const [tid, setTid] = useState('');
  const { data, reload, error } = useApi(me?.role === 'super' ? `/api/users${tid ? `?tournamentId=${tid}` : ''}` : null);
  const [msg, flash] = useFlash();
  const [f, setF] = useState(BLANK);
  const [showNew, setShowNew] = useState(false);
  const [made, setMade] = useState(null);
  const [reset, setReset] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!me) return <Skeleton className="h-40" />;
  if (me.role !== 'super') return <Empty>Only the platform super admin can manage users.</Empty>;

  const submit = (e) => {
    e.preventDefault();
    flash(async () => {
      const r = await call('/api/users', f);
      setShowNew(false); setMade({ username: f.username, ...r }); setF(BLANK); reload();
    }, 'User created');
  };
  const act = (id, d) => flash(async () => { const r = await call(`/api/users/${id}`, d, 'PATCH'); if (r.password) setMade({ username: '(reset)', password: r.password }); reload(); }, 'Updated');

  return (
    <>
      <PageHeader title="Users" subtitle="Logins for organizers, auctioneers, team owners, captains and players"
        right={<Button icon={Plus} onClick={() => setShowNew(true)}>New user</Button>} />
      <Msg {...msg} />
      <Card title="All users" right={
        <select className="!w-full min-w-0 sm:!w-auto sm:max-w-xs" aria-label="Filter by tournament" value={tid} onChange={(e) => setTid(e.target.value)}>
          <option value="">All tournaments</option>{tournaments.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>}>
        {error && <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger"><span>{error}</span><Button size="md" variant="secondary" onClick={reload}>Retry</Button></div>}
        {!data ? error ? <Empty>Could not load users.</Empty> : <Skeleton className="h-32" /> : <Table rows={data.users} cols={[
          { key: 'username', label: 'Username' }, { key: 'name', label: 'Name' }, { key: 'role', label: 'Role' },
          { key: 't', label: 'Tournament', render: (x) => tournaments.find((t) => t._id === x.tournamentId)?.name || '—' },
          { key: 'active', label: 'Active', render: (x) => (x.active === false ? 'no' : 'yes') },
          { key: 'a', label: 'Actions', render: (x) => <span className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="md" onClick={() => act(x._id, { active: x.active === false })}>{x.active === false ? 'Enable' : 'Disable'}</Button>
            <Button variant="secondary" size="md" onClick={() => setReset(x)}>Reset password</Button></span> },
        ]} />}
      </Card>

      <Sheet open={showNew} onClose={() => setShowNew(false)} title="New user">
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Username"><input required value={f.username} onChange={set('username')} autoCapitalize="none" autoComplete="off" /></Field>
          <Field label="Name"><input value={f.name} onChange={set('name')} /></Field>
          <Field label="Role"><select value={f.role} onChange={set('role')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Tournament"><select value={f.tournamentId} onChange={set('tournamentId')}><option value="">—</option>{tournaments.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></Field>
          {['owner', 'captain'].includes(f.role) && <Field label="Team id"><input value={f.teamId} onChange={set('teamId')} /></Field>}
          {f.role === 'player' && <Field label="Player id"><input value={f.playerId} onChange={set('playerId')} /></Field>}
          <Field label="Password" hint="Leave blank to generate one"><input type="password" value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
          <Msg {...msg} />
          <div className="flex gap-2"><Button type="button" variant="secondary" className="flex-1" onClick={() => setShowNew(false)}>Cancel</Button><Button className="flex-1">Create user</Button></div>
        </form>
      </Sheet>

      <Secret made={made} onClose={() => setMade(null)} />
      <Sheet open={!!reset} onClose={() => setReset(null)} title="Reset password?">
        {reset && <div className="grid gap-3"><p className="text-sm">A new one-time password will be generated for <b>{reset.username}</b>.</p>
          <Button variant="danger" onClick={() => { const id = reset._id; setReset(null); act(id, { resetPassword: true }); }}>Reset password</Button></div>}
      </Sheet>
    </>
  );
}
