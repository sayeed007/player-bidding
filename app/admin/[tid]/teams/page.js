'use client';
import { use, useState } from 'react';
import { Plus, Check, X, Pencil, Copy, Camera, ImagePlus, KeyRound, Phone } from 'lucide-react';
import { call, useApi, uploadImage } from '@/lib/client';
import { Button, Field, Msg, PageHeader, StatusBadge, Sheet, Avatar, Empty, Skeleton, useFlash, money } from '@/components/ui';

const EMPTY = { name: '', ownerName: '', captainName: '', color: '#2563eb', logo: '', phone: '', email: '' };

export default function Teams({ params }) {
  const { tid } = use(params);
  const { data, error, reload } = useApi(`/api/t/${tid}/teams?all=1`);
  const [form, setForm] = useState(null);
  const [cred, setCred] = useState(null);
  const [copied, setCopied] = useState('');
  const [rej, setRej] = useState(null);
  const [msg, flash] = useFlash();
  const fset = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const act = (x, a) => flash(async () => {
    const r = await call(`/api/t/${tid}/teams/${x._id}/${a}`, {});
    if (r.password) { setCopied(''); setCred({ team: x.name, ...r }); }
    reload();
  }, `${x.name}: ${a}d`);
  const edit = (x) => setForm({ ...EMPTY, ...x, phone: x.contact?.phone || '', email: x.contact?.email || '' });
  const save = (e) => {
    e.preventDefault();
    flash(async () => {
      const { _id, ...b } = form;
      if (_id) await call(`/api/t/${tid}/teams/${_id}`, b, 'PATCH');
      else { const r = await call(`/api/t/${tid}/teams`, b); if (r.password) { setCopied(''); setCred({ team: b.name, ...r }); } }
      setForm(null); reload();
    }, 'Saved');
  };
  const logo = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    file && flash(async () => { const logo = await uploadImage(file); setForm((f) => ({ ...f, logo })); }, 'Logo uploaded');
  };
  const copy = (k, v) => navigator.clipboard?.writeText(v).then(() => setCopied(k));
  const teams = data?.teams;

  return (
    <>
      <PageHeader title="Teams" subtitle={teams && `${teams.filter((x) => x.status === 'approved').length} approved · ${teams.filter((x) => x.status === 'pending').length} pending`}
        right={<Button icon={Plus} onClick={() => setForm({ ...EMPTY, approve: true })}>Add team</Button>} />
      <Msg {...msg} />

      {error && <div role="alert" className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger"><span className="min-w-0 break-words">{error}</span><Button variant="secondary" onClick={reload}>Retry</Button></div>}
      {!teams ? error ? <Empty>Could not load teams.</Empty> : <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        : !teams.length ? <Empty>No teams yet. Add the first one.</Empty> : (
          <ul className="grid gap-3 xl:grid-cols-2">
            {teams.map((x) => {
              const pct = x.budget ? Math.min(100, Math.round(((x.spent || 0) / x.budget) * 100)) : 0;
              return (
                <li key={x._id} className="grad-card overflow-hidden rounded-2xl shadow-card">
                  <div className="flex items-center gap-3 p-4" style={{ background: `linear-gradient(135deg, ${x.color || '#2563eb'}, rgb(var(--bg)) 130%)` }}>
                    <Avatar src={x.logo} name={x.name.replace(/^Team\s+/i, '')} size={64} color={x.color} className="ring-2 ring-white/60" />
                    <div className="min-w-0 flex-1 text-white">
                      <h2 className="m-0 break-words font-display text-2xl font-bold drop-shadow">{x.name}</h2>
                      <p className="break-words text-sm text-white/80">Owner {x.ownerName}{x.captainName ? ` · Capt. ${x.captainName}` : ''}</p>
                    </div>
                    <StatusBadge status={x.status} />
                  </div>
                  <div className="p-4">
                    {(x.contact?.phone || x.contact?.email) && <p className="mt-2 flex items-center gap-1.5 truncate text-sm text-muted"><Phone size={14} aria-hidden />{x.contact?.phone || x.contact?.email}</p>}
                    {x.status === 'approved' && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted"><span>Spent <b className="font-display text-base tabular-nums text-fg">{money(x.spent)}</b> / {money(x.budget)}</span><span className="tabular-nums">{x.count || 0} players</span></div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Budget spent"><div className="grad-volt glow-primary h-full" style={{ width: `${pct}%` }} /></div>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {x.status !== 'approved' && <Button variant="success" size="md" icon={Check} onClick={() => act(x, 'approve')}>Approve</Button>}
                      {(x.status === 'pending' || (x.status === 'approved' && !x.count)) && <Button variant="secondary" size="md" icon={X} className="!text-danger" onClick={() => setRej(x)}>Reject</Button>}
                      <Button variant="secondary" size="md" icon={Pencil} onClick={() => edit(x)}>Edit</Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

      <Sheet open={!!cred} onClose={() => setCred(null)} title={cred ? `Owner login for ${cred.team}` : ''}>
        {cred && (
          <div className="grid gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-surface2 p-3"><KeyRound size={18} className="text-muted" aria-hidden />
              <div className="min-w-0 flex-1"><div className="text-xs text-muted">Username</div><div className="truncate font-semibold">{cred.username}</div></div>
              <Button size="md" variant="secondary" icon={Copy} onClick={() => copy('u', cred.username)}>{copied === 'u' ? 'Copied' : 'Copy'}</Button></div>
            <div className="flex items-center gap-2 rounded-xl bg-surface2 p-3"><KeyRound size={18} className="text-muted" aria-hidden />
              <div className="min-w-0 flex-1"><div className="text-xs text-muted">Password</div><code className="break-all text-lg tabular-nums">{cred.password}</code></div>
              <Button size="md" icon={Copy} onClick={() => copy('p', cred.password)}>{copied === 'p' ? 'Copied' : 'Copy'}</Button></div>
            <p className="text-sm text-warning">This password is shown only once. Copy it and hand it to the owner.</p>
            <Button variant="secondary" onClick={() => setCred(null)}>Done</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!rej} onClose={() => setRej(null)} title="Reject team?">
        {rej && <div className="grid gap-3"><p className="text-sm">{rej.name} will be rejected{rej.status === 'approved' ? ' and its owner login disabled' : ''}.</p>
          <div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setRej(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { const x = rej; setRej(null); act(x, 'reject'); }}>Reject</Button></div></div>}
      </Sheet>

      <Sheet open={!!form} onClose={() => setForm(null)} title={form?._id ? `Edit ${form.name}` : 'Add team'}>
        {form && (
          <form onSubmit={save} className="grid gap-3">
            <Msg {...msg} />
            <div className="flex items-center gap-3 rounded-xl bg-surface2/60 p-3">
              <Avatar src={form.logo} name={form.name.replace(/^Team\s+/i, '')} size={64} color={form.color} />
              <div className="grid flex-1 grid-cols-2 gap-2">
                <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold"><Camera size={16} aria-hidden />Camera
                  <input type="file" accept="image/*" capture="environment" hidden onChange={logo} /></label>
                <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold"><ImagePlus size={16} aria-hidden />Logo
                  <input type="file" accept="image/*" hidden onChange={logo} /></label>
              </div>
            </div>
            <Field label="Team name"><input required value={form.name} onChange={fset('name')} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Owner"><input required value={form.ownerName} onChange={fset('ownerName')} /></Field>
              <Field label="Captain"><input value={form.captainName} onChange={fset('captainName')} /></Field>
            </div>
            <Field label="Team colour"><input type="color" className="!p-1" value={form.color} onChange={fset('color')} /></Field>
            <Field label="Phone"><input type="tel" value={form.phone} onChange={fset('phone')} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={fset('email')} /></Field>
            {!form._id && <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={!!form.approve} onChange={(e) => setForm({ ...form, approve: e.target.checked })} />Approve immediately (creates owner login)</label>}
            <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-line bg-surface px-4 pb-1 pt-3">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button><Button>Save</Button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}
