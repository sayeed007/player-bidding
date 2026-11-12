'use client';
// Shared bits for the public pages (OPS module). API shapes are tolerated loosely: array or {key:[...]}.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Avatar, Skeleton, dt } from '@/components/ui';
import { PlayerPhoto } from '@/components/cards';

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
  <div className="mb-3 mt-8 flex items-end justify-between gap-3">
    <h2 className="m-0 flex items-center gap-2 text-xl"><span aria-hidden className="h-5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_rgb(var(--primary))]" />{children}</h2>
    {href && <Link href={href} className="inline-flex min-h-[44px] items-center text-sm font-semibold">{linkText}<span aria-hidden className="ml-1">→</span></Link>}
  </div>
);

export const Live = ({ children = 'LIVE' }) => (
  <span className="pulse-live inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-white">
    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />{children}
  </span>
);

const when = (d) => (d ? new Date(d).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'TBD');

/** Gradient scoreboard card. teams: optional {id: team} lookup for logos/colours. big = giant numerals (home). */
export function MatchCard({ tid, m, teams = {}, className, big }) {
  const live = LIVE.includes(m.status), done = DONE.includes(m.status), shown = live || done;
  const hc = teams[String(m.homeTeamId)]?.color, ac = teams[String(m.awayTeamId)]?.color;
  const side = (id, name) => {
    const t = teams[String(id)] || {};
    return (
      <Link href={`/t/${tid}/teams/${id}`} className="flex min-w-0 flex-col items-center gap-1.5 text-center text-fg no-underline hover:no-underline">
        <Avatar src={t.logo} name={(name || 'TBD').replace(/^Team\s+/i, '')} color={t.color} size={big ? 64 : 48} className="ring-2 ring-white/20" />
        <span className="w-full break-words font-display text-sm font-semibold uppercase leading-tight tracking-wide">{name || 'TBD'}</span>
      </Link>
    );
  };
  return (
    <div className={clsx('grad-card relative overflow-hidden rounded-2xl p-3 shadow-card', big && 'p-4', live && 'glow-accent !border-accent/70', className)}
      style={hc || ac ? { backgroundImage: `linear-gradient(90deg, ${hc || 'transparent'}33, transparent 40%, transparent 60%, ${ac || 'transparent'}33), linear-gradient(145deg, rgb(var(--surface2)), rgb(var(--surface)))` } : undefined}>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span className="min-w-0 break-words font-semibold uppercase tracking-wider">{m.stage ? label(m.stage) : 'Match'}{m.round ? ` · R${m.round}` : ''}</span>
        {live ? <Live>{m.status === 'half_time' ? 'HT' : 'LIVE'}</Live> : done ? <span className="rounded-full bg-surface2 px-2 py-0.5 font-bold">{m.status === 'forfeited' ? 'Forfeit' : 'FT'}</span>
          : m.status && m.status !== 'scheduled' ? <span className="font-medium capitalize">{label(m.status)}</span> : null}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {side(m.homeTeamId, m.homeName)}
        <div className={clsx('min-w-[84px] text-center font-display font-bold tabular-nums', big ? 'text-5xl sm:text-6xl' : 'text-3xl')}>
          {shown ? <span className={clsx(live ? 'neon-text-accent' : 'neon-text')}>{m.score?.home ?? 0}<span className="mx-1 text-muted">:</span>{m.score?.away ?? 0}</span> : <span className="text-xl font-bold uppercase text-muted">vs</span>}
        </div>
        {side(m.awayTeamId, m.awayName)}
      </div>
      <div className="mt-3 text-center text-xs text-muted">{when(m.start)}{m.venue ? ` · ${m.venue}` : ''}</div>
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
      <div className={clsx('text-xs font-semibold uppercase tracking-wider', light ? 'text-white/85' : 'text-muted')}>{text}</div>
      <div className="mt-1 flex gap-1.5 font-display text-2xl font-bold tabular-nums" aria-label={`${text} ${parts.map((p) => p.join('')).join(' ')}`}>
        {parts.map(([n, u]) => <span key={u} className={clsx('rounded-xl px-2.5 py-1.5 text-center', light ? 'bg-black/35 ring-1 ring-white/20 backdrop-blur' : 'bg-surface2')}>{String(n).padStart(2, '0')}<small className="ml-0.5 text-xs font-medium opacity-70">{u}</small></span>)}
      </div>
    </div>
  );
}

/** Cinematic hero: banner (if any) under a violet/magenta/cyan gradient, big wrapping name. */
export function Hero({ t, children }) {
  return (
    <div className="grad-hero glow-accent relative overflow-hidden rounded-3xl text-white">
      {t.banner && <div className="absolute inset-0 bg-cover bg-center opacity-60 mix-blend-overlay" style={{ backgroundImage: `url(${t.banner})` }} />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div aria-hidden className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/30 blur-3xl" />
      <div className="relative flex flex-col gap-4 p-5 pt-14 md:p-8 md:pt-20">
        <div className="flex items-center gap-4">
          <Avatar src={t.logo} name={t.name} size={72} className="ring-2 ring-white/70" />
          <div className="min-w-0">
            <h1 className="m-0 break-words font-display text-4xl font-bold uppercase leading-none tracking-wide drop-shadow md:text-6xl">{t.name}</h1>
            <div className="mt-1.5 break-words text-sm text-white/90">{[t.season, t.description].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** #1 leader: big portrait with giant value. pm = players by id (for category/photo). */
export function LeaderHero({ tid, x, pm = {}, unit }) {
  const p = pm[String(x.playerId)] || {};
  return (
    <Link href={`/t/${tid}/players/${x.playerId}`} className="block text-fg no-underline hover:no-underline">
      <PlayerPhoto player={{ name: x.name, photo: x.photo || p.photo, category: p.category }} size="xl" className="!aspect-[4/5] sm:!aspect-[16/9]">
        <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 font-display text-sm font-bold uppercase tracking-wider text-primary-fg">#1</span>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="break-words font-display text-3xl font-bold uppercase leading-none tracking-wide drop-shadow">{x.name}</div>
            <div className="mt-1 break-words text-sm text-white/85">{x.teamName}</div>
          </div>
          <div className="text-right"><div className="neon-text font-display text-6xl font-bold leading-none tabular-nums">{x.value}</div>{unit && <div className="text-xs font-semibold uppercase tracking-wider text-white/80">{unit}</div>}</div>
        </div>
      </PlayerPhoto>
    </Link>
  );
}

export const FILTER_SELECT = 'min-h-[44px] rounded-xl border border-line bg-surface2/70 px-3 text-base';
export { dt };
