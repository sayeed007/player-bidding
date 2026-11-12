'use client';
import { use, useState } from 'react';
import { CheckCircle2, Camera, ImagePlus } from 'lucide-react';
import { call, useApi, uploadImage } from '@/lib/client';
import { Card, Button, Field, Msg, Avatar, Skeleton, useFlash } from '@/components/ui';
import { POSITIONS } from '@/lib/setup';

const EMPTY = { name: '', phone: '', email: '', employeeId: '', department: '', position: 'Midfielder', position2: '', photo: '' };

export default function Register({ params }) {
  const { tid } = use(params);
  const { data: t, error } = useApi(`/api/t/${tid}`);
  const [f, setF] = useState(EMPTY);
  const [done, setDone] = useState(false);
  const [up, setUp] = useState(false);
  const [msg, flash] = useFlash();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const photo = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUp(true);
    flash(async () => { const photo = await uploadImage(file); setF((x) => ({ ...x, photo })); }, 'Photo uploaded').finally(() => setUp(false));
  };
  if (error) return <p role="alert" className="mx-auto mt-10 max-w-sm rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>;
  if (!t) return <div className="mx-auto max-w-lg"><Skeleton className="h-72" /></div>;
  if (done) return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
      <CheckCircle2 size={44} className="mx-auto text-success" aria-hidden />
      <h1 className="mt-3">Thank you!</h1>
      <p className="text-muted">Your registration for {t.name} was received. An organizer will review it.</p>
    </div>
  );
  const open = t.status === 'registration_open';
  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-3 mt-1"><h1 className="m-0">Player registration</h1><p className="text-sm text-muted">{t.name}</p></div>
      {!open && <p role="alert" className="mb-3 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">Registration is not open right now.</p>}
      <form onSubmit={(e) => { e.preventDefault(); flash(async () => { await call(`/api/t/${tid}/players/register`, f); setDone(true); }); }}>
        <Card title="Your photo">
          <div className="flex items-center gap-4">
            <Avatar src={f.photo} name={f.name} size={80} />
            <div className="grid flex-1 gap-2">
              <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold"><Camera size={16} aria-hidden />{up ? 'Uploading…' : 'Take a selfie'}
                <input type="file" accept="image/*" capture="user" hidden onChange={photo} disabled={up} /></label>
              <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold"><ImagePlus size={16} aria-hidden />Choose from gallery
                <input type="file" accept="image/*" hidden onChange={photo} disabled={up} /></label>
            </div>
          </div>
        </Card>
        <Card title="About you">
          <div className="grid gap-3">
            <Field label="Full name *"><input required autoComplete="name" value={f.name} onChange={set('name')} /></Field>
            <Field label="Phone"><input type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></Field>
            <Field label="Email" hint="Phone or email is required."><input type="email" autoComplete="email" value={f.email} onChange={set('email')} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Employee ID"><input value={f.employeeId} onChange={set('employeeId')} /></Field>
              <Field label="Department"><input value={f.department} onChange={set('department')} /></Field>
            </div>
          </div>
        </Card>
        <Card title="Playing position">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Preferred *"><select value={f.position} onChange={set('position')}>{POSITIONS.map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Secondary"><select value={f.position2} onChange={set('position2')}><option value="">—</option>{POSITIONS.map((p) => <option key={p}>{p}</option>)}</select></Field>
          </div>
          <p className="mt-3 text-xs text-muted">Your category and base price are set by the organizers.</p>
        </Card>
        <Msg {...msg} />
        <Button size="lg" className="w-full" disabled={!open || up}>Register</Button>
      </form>
    </div>
  );
}
