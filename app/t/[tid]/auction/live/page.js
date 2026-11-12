'use client';
import { use } from 'react';
import clsx from 'clsx';
import { useAuction, useLeft, clock, isUrgent, statusText, activeCats } from '@/lib/auction-ui';
import { money } from '@/components/ui';

// Big-screen stage: forced dark look, sizes in vw/clamp so it reads from 10 m and still fits a phone.
const vw = (min, v, max) => `clamp(${min}px, ${v}vw, ${max}px)`;
const Photo = ({ src, name, size }) => src
  // eslint-disable-next-line @next/next/no-img-element
  ? <img src={src} alt={name} style={{ width: size, height: size }} className="shrink-0 rounded-3xl object-cover object-top" />
  : <span aria-hidden style={{ width: size, height: size, fontSize: `calc(${size} * .38)` }} className="grid shrink-0 place-items-center rounded-3xl bg-white/10 font-bold text-white">{(name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>;
const Logo = ({ t, size }) => t?.logo
  // eslint-disable-next-line @next/next/no-img-element
  ? <img src={t.logo} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover object-top" />
  : <span aria-hidden style={{ width: size, height: size, background: t?.color || '#334155', fontSize: `calc(${size} * .4)` }} className="grid shrink-0 place-items-center rounded-full font-bold text-white">{(t?.name || '?').replace(/^Team\s+/i, '')[0]}</span>;

export default function Projector({ params }) {
  const { tid } = use(params);
  const { data: d, error } = useAuction(tid);
  const left = useLeft(d);
  if (!d) return <div className="fixed inset-0 grid place-items-center bg-slate-950 text-2xl text-white/70">{error || 'Loading...'}</div>;

  const l = d.lot, p = l?.player || {};
  const leader = l && d.teams.find((t) => t._id === l.leaderTeamId);
  const urgent = isUrgent(d, left);
  const cats = activeCats(d);
  const { sold, total } = d.progress;
  const total_ms = Math.max(d.config.timerSec * 1000, left || 0, 1);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-slate-950 text-white" style={{ padding: vw(10, 1.6, 40), gap: vw(8, 1.2, 28) }}>
      {/* top bar */}
      <header className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 leading-tight sm:gap-4" style={{ fontSize: vw(12, 1.3, 28) }}>
        <b className="tracking-widest">LIVE AUCTION</b>
        <span className={clsx('rounded-full px-3 py-0.5 font-semibold', d.status === 'live' ? 'bg-red-600' : 'bg-white/15')}>{statusText(d)}</span>
        {error && <span className="text-amber-300">reconnecting...</span>}
        <span className="ml-auto tabular-nums text-white/80">{sold}/{total} sold</span>
        <div className="hidden h-[0.6em] w-[18vw] overflow-hidden rounded-full bg-white/15 sm:block"><div className="h-full bg-emerald-400" style={{ width: `${total ? (sold / total) * 100 : 0}%` }} /></div>
      </header>

      {/* stage */}
      <main aria-label="Live auction stage" className="flex min-h-0 flex-1 flex-col items-center justify-center text-center" style={{ gap: vw(6, 1, 24), maxWidth: 'none', padding: 0 }}>
        {!l ? (
          <div className="font-display font-extrabold text-white/70" style={{ fontSize: vw(28, 6, 140) }}>{statusText(d)}</div>
        ) : <>
          <div className="flex min-w-0 max-w-full flex-col items-center sm:flex-row" style={{ gap: vw(12, 2.5, 56) }}>
            <Photo src={p.photo} name={p.name} size={vw(96, 17, 360)} />
            <div className="min-w-0 sm:text-left">
              <div className="font-display font-extrabold leading-none" style={{ fontSize: vw(30, 6.5, 150), wordBreak: 'break-word' }}>{p.name}</div>
              <div className="mt-[0.4vw] text-white/70" style={{ fontSize: vw(14, 2.2, 52) }}>
                <span className="mr-[1vw] rounded-lg bg-amber-500 px-[0.8vw] py-[0.1vw] font-bold text-black">Cat {p.category}</span>
                {p.position}{p.position ? ' · ' : ''}Base {money(p.basePrice)} · Lot #{l.no}
              </div>
            </div>
          </div>

          <div>
            <div className="text-white/60 uppercase tracking-widest" style={{ fontSize: vw(11, 1.4, 32) }}>{leader ? 'Current bid' : 'Starting price'}</div>
            <div className="font-display font-black leading-none tabular-nums" style={{ fontSize: vw(72, 13, 340) }}>{money(l.bid)}</div>
          </div>

          <div className="flex items-center justify-center" style={{ gap: vw(8, 1.2, 28), minHeight: vw(28, 4, 100), fontSize: vw(18, 3.4, 80) }}>
            {leader ? <><Logo t={leader} size={vw(28, 4, 100)} /><b>{leader.name}</b></> : <span className="text-white/50">No bids yet</span>}
          </div>

          {l.open && (
            <div className="w-full max-w-[70vw]">
              <div className={clsx('font-display font-extrabold leading-none tabular-nums', urgent ? 'text-red-500' : 'text-white')} style={{ fontSize: vw(36, 7, 160) }}>{clock(left)}</div>
              <div className="mx-auto mt-[0.6vw] h-[0.9vw] min-h-[6px] overflow-hidden rounded-full bg-white/15">
                <div className={clsx('h-full transition-[width] duration-200', urgent ? 'bg-red-500' : 'bg-emerald-400')} style={{ width: `${Math.min(100, ((left ?? 0) / total_ms) * 100)}%` }} />
              </div>
            </div>
          )}
        </>}
      </main>

      {/* team budgets */}
      <section aria-label="Team budgets and squad progress" className="projector-teams grid min-h-0 shrink-0 overscroll-contain" style={{ gap: vw(6, 0.8, 18), gridTemplateColumns: `repeat(auto-fit, minmax(${vw(130, 12, 380)}, 1fr))`, fontSize: vw(11, 1.1, 26) }}>
        {d.teams.map((t) => {
          const lead = t._id === l?.leaderTeamId;
          return (
            <div key={t._id} className={clsx('min-w-0 rounded-2xl p-[0.9em]', lead ? 'bg-emerald-500/25 ring-2 ring-emerald-400' : 'bg-white/[.07]')} style={{ borderTop: `0.3em solid ${t.color || '#475569'}` }}>
              <div className="flex items-center gap-[0.6em]"><Logo t={t} size="2em" /><b className="truncate">{t.name}</b></div>
              <div className="mt-[0.4em] flex items-baseline justify-between">
                <span className="font-display font-bold tabular-nums" style={{ fontSize: '1.7em' }}>{t.remaining == null ? 'Hidden' : money(t.remaining)}</span>
                <span className="tabular-nums text-white/70">{t.count}/{d.config.squad}</span>
              </div>
              <div className="mt-[0.4em] flex flex-wrap gap-x-[0.8em] gap-y-[0.2em]">
                {cats.map((c) => {
                  const have = t.counts?.[c.code] || 0;
                  return (
                    <span key={c.code} className="inline-flex items-center gap-[0.3em] tabular-nums text-white/80">
                      <b>{c.code}</b>
                      {Array.from({ length: c.max }, (_, i) => <i key={i} className={clsx('inline-block h-[0.7em] w-[0.7em] rounded-full', i < have ? 'bg-emerald-400' : 'bg-white/20')} />)}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* sales ticker */}
      <footer aria-label="Recent sales" className="flex shrink-0 items-center gap-[1vw] overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:thin]" style={{ fontSize: vw(11, 1.4, 32) }}>
        <b className="shrink-0 text-white/60">SOLD</b>
        {d.recentSales.length === 0 && <span className="text-white/40">No sales yet</span>}
        {d.recentSales.slice(0, 6).map((s) => (
          <span key={s._id} className="shrink-0 rounded-full bg-white/10 px-[1em] py-[0.2em]">{s.player?.name} <span className="text-white/60">to</span> {s.teamName}{s.price != null && <b className="ml-[0.5em] tabular-nums text-emerald-300">{money(s.price)}</b>}</span>
        ))}
      </footer>
    </div>
  );
}
