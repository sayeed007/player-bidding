'use client';
import { use } from 'react';
import clsx from 'clsx';
import { useAuction, useLeft, clock, isUrgent, statusText, activeCats } from '@/lib/auction-ui';
import { money } from '@/components/ui';
import { catOf } from '@/components/cards';

// Big-screen stage: forced dark look, sizes in vw/clamp so it reads from 10 m and still fits a phone.
const vw = (min, v, max) => `clamp(${min}px, ${v}vw, ${max}px)`;
const Logo = ({ t, size }) => t?.logo
  // eslint-disable-next-line @next/next/no-img-element
  ? <img src={t.logo} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover object-top ring-2 ring-white/30" />
  : <span aria-hidden style={{ width: size, height: size, background: t?.color || '#334155', fontSize: `calc(${size} * .4)` }} className="grid shrink-0 place-items-center rounded-full font-display font-bold text-white ring-2 ring-white/30">{(t?.name || '?').replace(/^Team\s+/i, '')[0]}</span>;

export default function Projector({ params }) {
  const { tid } = use(params);
  const { data: d, error } = useAuction(tid);
  const left = useLeft(d);
  if (!d) return <div className="fixed inset-0 grid place-items-center bg-bg text-2xl text-white/70">{error || 'Loading...'}</div>;

  const l = d.lot, p = l?.player || {};
  const leader = l && d.teams.find((t) => t._id === l.leaderTeamId);
  const urgent = isUrgent(d, left);
  const cats = activeCats(d);
  const { sold, total } = d.progress;
  const total_ms = Math.max(d.config.timerSec * 1000, left || 0, 1);
  const c = catOf(p.category);
  const initials = (p.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-bg text-white" style={{ padding: vw(10, 1.4, 36), gap: vw(8, 1, 24) }}>
      {/* animated glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[20%] h-[70vh] w-[60vw] animate-pulse rounded-full blur-3xl" style={{ background: `${c.from}`, opacity: 0.22, animationDuration: '5s' }} />
        <div className="absolute -bottom-[25%] right-[-10%] h-[70vh] w-[55vw] animate-pulse rounded-full bg-accent/25 blur-3xl" style={{ animationDuration: '7s' }} />
        <div className="absolute right-[20%] top-[-20%] h-[50vh] w-[40vw] animate-pulse rounded-full bg-violet/25 blur-3xl" style={{ animationDuration: '9s' }} />
      </div>

      {/* top bar */}
      <header className="relative z-10 flex min-w-0 shrink-0 flex-wrap items-center gap-2 leading-tight sm:gap-4" style={{ fontSize: vw(12, 1.3, 28) }}>
        <b className="neon-text font-display uppercase tracking-[.3em]">Live auction</b>
        <span className={clsx('rounded-full px-3 py-0.5 font-bold uppercase tracking-wider', d.status === 'live' ? 'bg-accent pulse-live' : 'bg-white/15')}>{statusText(d)}</span>
        {error && <span className="text-warning">reconnecting...</span>}
        <span className="ml-auto tabular-nums text-white/80">{sold}/{total} sold</span>
        <div className="hidden h-[0.6em] w-[18vw] overflow-hidden rounded-full bg-white/15 sm:block"><div className="grad-volt h-full" style={{ width: `${total ? (sold / total) * 100 : 0}%` }} /></div>
      </header>

      {/* stage */}
      <main aria-label="Live auction stage" className="relative z-10 flex min-h-0 flex-1 flex-col md:flex-row" style={{ gap: vw(10, 2, 48), maxWidth: 'none', padding: 0 }}>
        {!l ? (
          <div className="grid flex-1 place-items-center text-center font-display font-bold uppercase tracking-wide text-white/70" style={{ fontSize: vw(28, 6, 140) }}>{statusText(d)}</div>
        ) : <>
          {/* LEFT: portrait */}
          <div className="relative min-h-0 flex-[0_0_40%] overflow-hidden rounded-3xl md:flex-[0_0_45%]" style={{ background: `linear-gradient(155deg, ${c.from}, ${c.to})`, boxShadow: `0 0 ${vw(30, 5, 120)} -${vw(6, 1, 24)} ${c.from}` }}>
            {p.photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={p.photo} alt={p.name} className="absolute inset-0 h-full w-full object-cover object-top" />
              : <span aria-hidden className="absolute inset-0 grid place-items-center font-display font-bold text-white/80" style={{ fontSize: vw(80, 14, 320) }}>{initials}</span>}
            <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            <span className="absolute left-[3%] top-[3%] rounded-full bg-black/60 px-[0.9em] py-[0.2em] font-bold uppercase tracking-widest backdrop-blur" style={{ fontSize: vw(12, 1.3, 28) }}>Lot #{l.no}</span>
            <div className="absolute inset-x-0 bottom-0 min-w-0 p-[4%] text-left">
              <div className="font-display font-bold uppercase leading-[.9] tracking-wide drop-shadow-[0_4px_20px_rgb(0_0_0/.8)]" style={{ fontSize: vw(32, 5.2, 130), wordBreak: 'break-word' }}>{p.name}</div>
              <div className="mt-[0.8vw] flex flex-wrap items-center gap-[0.8vw] font-bold" style={{ fontSize: vw(13, 1.8, 44) }}>
                <span className={clsx('rounded-lg px-[0.6em] py-[0.1em] font-extrabold', c.chip)}>Cat {p.category}</span>
                {p.position && <span className="rounded-lg bg-white/15 px-[0.6em] py-[0.1em] backdrop-blur">{p.position}</span>}
                <span className="rounded-lg bg-black/55 px-[0.6em] py-[0.1em] backdrop-blur">Base <span className="tabular-nums text-primary">{money(p.basePrice)}</span></span>
              </div>
            </div>
          </div>

          {/* RIGHT: bid */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center text-center" style={{ gap: vw(4, 0.8, 22) }}>
            <div className="font-bold uppercase tracking-[.35em] text-white/60" style={{ fontSize: vw(11, 1.4, 32) }}>{leader ? 'Current bid' : 'Starting price'}</div>
            <div key={l.bid} className="pop text-grad font-display font-bold leading-none tabular-nums tracking-wide" style={{ fontSize: vw(72, 14.5, 340), filter: 'drop-shadow(0 0 30px rgb(var(--primary) / .5))' }}>{money(l.bid)}</div>
            <div className="flex items-center justify-center" style={{ gap: vw(8, 1.2, 28), minHeight: vw(28, 4, 100), fontSize: vw(18, 3.2, 80) }}>
              {leader ? <><Logo t={leader} size={vw(28, 4, 100)} /><b className="neon-text font-display uppercase tracking-wide">{leader.name}</b></> : <span className="text-white/50">No bids yet</span>}
            </div>
            {l.open && (
              <div className="w-full max-w-[40vw] min-w-[200px]" role="timer" aria-label="Time left">
                <div className={clsx('font-display font-bold leading-none tabular-nums tracking-wide', urgent ? 'neon-text-accent' : 'text-white')} style={{ fontSize: vw(36, 8, 190) }}>{clock(left)}</div>
                <div className={clsx('mx-auto mt-[0.6vw] h-[1vw] min-h-[8px] overflow-hidden rounded-full bg-white/10', urgent && 'pulse-live')}>
                  <div className={clsx('h-full rounded-full transition-[width] duration-200', urgent ? 'bg-accent shadow-[0_0_20px_rgb(var(--accent))]' : 'grad-volt shadow-[0_0_20px_rgb(var(--primary)/.7)]')} style={{ width: `${Math.min(100, ((left ?? 0) / total_ms) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </>}
      </main>

      {/* team budgets */}
      <section aria-label="Team budgets and squad progress" className="projector-teams relative z-10 grid min-h-0 shrink-0 overscroll-contain" style={{ gap: vw(6, 0.8, 18), gridTemplateColumns: `repeat(auto-fit, minmax(${vw(130, 12, 380)}, 1fr))`, fontSize: vw(11, 1.1, 26) }}>
        {d.teams.map((t) => {
          const lead = t._id === l?.leaderTeamId;
          return (
            <div key={t._id} className={clsx('grad-card min-w-0 rounded-2xl p-[0.9em]', lead && '!border-primary glow-primary')} style={{ borderTop: `0.3em solid ${t.color || '#475569'}` }}>
              <div className="flex items-center gap-[0.6em]"><Logo t={t} size="2em" /><b className="truncate font-display uppercase tracking-wide">{t.name}</b></div>
              <div className="mt-[0.4em] flex items-baseline justify-between">
                <span className="text-grad font-display font-bold tabular-nums tracking-wide" style={{ fontSize: '1.9em' }}>{t.remaining == null ? 'Hidden' : money(t.remaining)}</span>
                <span className="tabular-nums text-white/70">{t.count}/{d.config.squad}</span>
              </div>
              <div className="mt-[0.4em] flex flex-wrap gap-x-[0.8em] gap-y-[0.2em]">
                {cats.map((cc) => {
                  const have = t.counts?.[cc.code] || 0;
                  return (
                    <span key={cc.code} className="inline-flex items-center gap-[0.3em] tabular-nums text-white/80">
                      <b>{cc.code}</b>
                      {Array.from({ length: cc.max }, (_, i) => <i key={i} className="inline-block h-[0.7em] w-[0.7em] rounded-full" style={i < have ? { background: catOf(cc.code).from, boxShadow: `0 0 6px ${catOf(cc.code).from}` } : { background: 'rgb(255 255 255 / .2)' }} />)}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* sales ticker */}
      <footer aria-label="Recent sales" className="relative z-10 flex shrink-0 items-center gap-[1vw] overflow-hidden whitespace-nowrap pb-1" style={{ fontSize: vw(11, 1.4, 32) }}>
        <b className="neon-text-accent shrink-0 font-display uppercase tracking-widest">Sold</b>
        {d.recentSales.length === 0 && <span className="text-white/40">No sales yet</span>}
        {d.recentSales.slice(0, 6).map((s) => (
          <span key={s._id} className="shrink-0 rounded-full border border-line bg-white/10 px-[1em] py-[0.2em]">{s.player?.name} <span className="text-white/60">to</span> {s.teamName}{s.price != null && <b className="ml-[0.5em] tabular-nums text-primary">{money(s.price)}</b>}</span>
        ))}
      </footer>
    </div>
  );
}
