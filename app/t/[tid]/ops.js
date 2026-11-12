'use client';
// Shared bits for the public pages (OPS module). API shapes are tolerated loosely: array or {key:[...]}.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Avatar, Skeleton, dt } from '@/components/ui';

export const arr = (d, k) => (Array.isArray(d) ? d : d?.[k] || []);
export const LIVE = ['live', 'half_time'];
export const DONE = ['completed', 'forfeited'];
export const label = (s) => String(s || '').replace(/_/g, ' ');
/** Price only when the API provided one. */
export const price = (p) => (p == null ? null : Number(p).toLocaleString());
export const byId = (list, k = '_id') => Object.fromEntries(list.map((x) => [String(x[k]), x]));

/** Loading skeleton / error / children(data) for a useApi result. */
export function Load({ r, children }) {
  if (r.error) return <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{r.error}</p>;
  if (!r.data) return <div className="grid gap-3"><Skeleton className="h-28" /><Skeleton className="h-40" /><Skeleton className="h-24" /></div>;
  return children(r.data);
}

export const Logo = ({ src, name = '?', color, sm }) => <Avatar src={src} name={name.replace(/^Team\s+/i, '')} color={color} size={sm ? 28 : 56} />;

export const SectionTitle = ({ children, href, linkText = 'See all' }) => (
  <div className="mb-2 mt-6 flex items-end justify-between">
    <h2 className="m-0 text-lg">{children}</h2>
    {href && <Link href={href} className="inline-flex min-h-[44px] items-center text-sm font-medium">{linkText}</Link>}
  </div>
);

export const Live = ({ children = 'LIVE' }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white">
    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />{children}
  </span>
);

const when = (d) => (d ? new Date(d).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBD');

/** Score card. teams: optional {id: team} lookup for logos/colours. */
export function MatchCard({ tid, m, teams = {}, className }) {
  const live = LIVE.includes(m.status), done = DONE.includes(m.status), shown = live || done;
  const side = (id, name, right) => {
    const t = teams[String(id)] || {};
    return (
      <Link href={`/t/${tid}/teams/${id}`} className={clsx('flex min-w-0 flex-col items-center gap-1 text-center text-fg no-underline hover:no-underline', right && '')}>
        <Avatar src={t.logo} name={(name || 'TBD').replace(/^Team\s+/i, '')} color={t.color} size={44} />
        <span className="line-clamp-2 w-full text-sm font-semibold leading-tight">{name || 'TBD'}</span>
      </Link>
    );
  };
  return (
    <div className={clsx('rounded-2xl border border-line bg-surface p-3 shadow-card', live && 'border-danger/60', className)}>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="truncate">{m.stage ? label(m.stage) : 'Match'}{m.round ? ` · R${m.round}` : ''}</span>
        {live ? <Live>{m.status === 'half_time' ? 'HT' : 'LIVE'}</Live> : done ? <span className="font-medium">{m.status === 'forfeited' ? 'Forfeit' : 'FT'}</span>
          : m.status && m.status !== 'scheduled' ? <span className="font-medium capitalize">{label(m.status)}</span> : null}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {side(m.homeTeamId, m.homeName)}
        <div className="min-w-[72px] text-center font-display text-2xl font-bold tabular-nums">
          {shown ? `${m.score?.home ?? 0} – ${m.score?.away ?? 0}` : <span className="text-base font-semibold text-muted">vs</span>}
        </div>
        {side(m.awayTeamId, m.awayName, true)}
      </div>
      <div className="mt-2 text-center text-xs text-muted">{when(m.start)}{m.venue ? ` · ${m.venue}` : ''}</div>
    </div>
  );
}

export function Countdown({ to, label: text, light }) {
  const [now, setNow] = useState(null);
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const s = now && Math.floor((new Date(to) - now) / 1000);
  if (!(s > 0)) return null;
  const parts = [[Math.floor(s / 86400), 'd'], [Math.floor(s / 3600) % 24, 'h'], [Math.floor(s / 60) % 60, 'm'], [s % 60, 's']];
  return (
    <div>
      <div className={clsx('text-xs', light ? 'text-white/80' : 'text-muted')}>{text}</div>
      <div className="mt-0.5 flex gap-1.5 font-display text-xl font-bold tabular-nums" aria-label={`${text} ${parts.map((p) => p.join('')).join(' ')}`}>
        {parts.map(([n, u]) => <span key={u} className={clsx('rounded-lg px-2 py-1', light ? 'bg-white/15' : 'bg-surface2')}>{String(n).padStart(2, '0')}<small className="ml-0.5 text-xs font-medium opacity-70">{u}</small></span>)}
      </div>
    </div>
  );
}

/** Banner/gradient hero with logo, name and children (badges, countdowns). */
export function Hero({ t, children }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-primary to-cyan-700 text-white shadow-card">
      {t.banner && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${t.banner})` }} />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
      <div className="relative flex flex-col gap-3 p-4 pt-16 md:p-6 md:pt-24">
        <div className="flex items-center gap-3">
          <Avatar src={t.logo} name={t.name} size={56} className="ring-2 ring-white/70" />
          <div className="min-w-0">
            <h1 className="m-0 truncate text-xl text-white md:text-3xl">{t.name}</h1>
            <div className="truncate text-sm text-white/85">{[t.season, t.description].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export const FILTER_SELECT = 'min-h-[44px] rounded-xl border border-line bg-surface px-3 text-base';
export { dt };
