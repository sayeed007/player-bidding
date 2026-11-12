'use client';
import Link from 'next/link';
import { useState } from 'react';
import { LogIn, ArrowLeft } from 'lucide-react';
import { call } from '@/lib/client';
import { Button, Field, Msg, useFlash } from '@/components/ui';

export default function Login() {
  const [f, setF] = useState({ username: '', password: '' });
  const [m, flash] = useFlash();
  const [busy, setBusy] = useState(false);
  const go = () => { setBusy(true); flash(async () => { await call('/api/auth/login', f); location.href = '/'; }, 'Welcome').finally(() => setBusy(false)); };
  return (
    <div className="mx-auto mt-3 max-w-md md:mt-12">
      <Link href="/" className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-medium"><ArrowLeft size={16} aria-hidden />Browse tournaments</Link>
      <div className="grad-border glow-primary rounded-2xl p-5 shadow-card sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-xl grad-volt glow-primary"><LogIn size={22} aria-hidden /></span>
        <h1 className="mb-1 mt-3 text-4xl text-grad">Sign in</h1>
        <p className="mb-6 text-base text-muted">Access your tournament, team or player account.</p>
        <form className="grid gap-4" aria-busy={busy} onSubmit={(e) => { e.preventDefault(); go(); }}>
          <Field label="Username"><input required value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus /></Field>
          <Field label="Password"><input required type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" /></Field>
          <Msg {...m} />
          <Button size="lg" icon={LogIn} className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
      </div>
    </div>
  );
}
