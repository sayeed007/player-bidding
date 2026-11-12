'use client';
import { use } from 'react';
import clsx from 'clsx';
import { useAuction, useLeft, clock, isUrgent, statusText, activeCats } from '@/lib/auction-ui';
import { money } from '@/components/ui';
import { catOf } from '@/components/cards';

// Big-screen stage: forced dark look. Sizes use vmin (the smaller of width/height) so the layout fits both
// 16:9 TVs and short, wide windows; the portrait takes the full stage height at a true portrait ratio.
const vm = (min, v, max) => `clamp(${min}px, ${v}vmin, ${max}px)`;
const Logo = ({ t, size }) => t?.logo
  // eslint-disable-next-line @next/next/no-img-element
  ? <img src={t.logo} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover object-top ring-2 ring-white/30" />
  : <span aria-hidden style={{ width: size, height: size, background: t?.color || '#334155', fontSize: `calc(${size} * .4)` }} className="grid shrink-0 place-items-center rounded-full font-display font-bold text-white ring-2 ring-white/30">{(t?.name || '?').replace(/^Team\s+/i, '')[0]}</span>;

function Teams({ d, l, cats, className }) {
  return (
    <section aria-label="Team budgets and squad progress" className={clsx('relative z-10 min-w-0 overscroll-contain', className)} style={{ gap: vm(6, 0.9, 18), fontSize: vm(11, 1.45, 26) }}>
      {d.teams.map((t) => {
        const lead = t._id === l?.leaderTeamId;
        return (
          <div key={t._id} className={clsx('grad-card min-w-0 rounded-2xl p-[0.8em]', lead && '!border-primary glow-primary')} style={{ borderTop: `0.3em solid ${t.color || '#475569'}` }}>
            <div className="flex items-center gap-[0.6em]"><Logo t={t} size="1.9em" /><b className="truncate font-display uppercase tracking-wide">{t.name}</b></div>
            <div className="mt-[0.3em] flex items-baseline justify-between">
              <span className="text-grad font-display font-bold tabular-nums tracking-wide" style={{ fontSize: '1.9em' }}>{t.remaining == null ? 'Hidden' : money(t.remaining)}</span>
              <span className="tabular-nums text-white/70">{t.count}/{d.config.squad}</span>
            </div>
            <div className="mt-[0.3em] flex flex-wrap gap-x-[0.8em] gap-y-[0.15em]">
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
  );
}

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
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-bg text-white" style={{ padding: vm(10, 1.6, 36), gap: vm(8, 1.2, 24) }}>
      {/* animated glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[20%] h-[70vh] w-[60vw] animate-pulse rounded-full blur-3xl" style={{ background: `${c.from}`, opacity: 0.22, animationDuration: '5s' }} />
        <div className="absolute -bottom-[25%] right-[-10%] h-[70vh] w-[55vw] animate-pulse rounded-full bg-accent/25 blur-3xl" style={{ animationDuration: '7s' }} />
        <div className="absolute right-[20%] top-[-20%] h-[50vh] w-[40vw] animate-pulse rounded-full bg-violet/25 blur-3xl" style={{ animationDuration: '9s' }} />
      </div>

      {/* top bar */}
      <header className="relative z-10 flex min-w-0 shrink-0 flex-wrap items-center gap-2 leading-tight sm:gap-4" style={{ fontSize: vm(12, 1.7, 28) }}>
        <b className="neon-text font-display uppercase tracking-[.3em]">Live auction</b>
        <span className={clsx('rounded-full px-3 py-0.5 font-bold uppercase tracking-wider', d.status === 'live' ? 'bg-accent pulse-live' : 'bg-white/15')}>{statusText(d)}</span>
        {error && <span className="text-warning">reconnecting...</span>}
        <span className="ml-auto tabular-nums text-white/80">{sold}/{total} sold</span>
        <div className="hidden h-[0.6em] w-[18vw] overflow-hidden rounded-full bg-white/15 sm:block"><div className="grad-volt h-full" style={{ width: `${total ? (sold / total) * 100 : 0}%` }} /></div>
      </header>

      {/* stage */}
      <main aria-label="Live auction stage" className="relative z-10 flex min-h-0 flex-1 flex-col md:flex-row" style={{ gap: vm(10, 2.4, 48), maxWidth: 'none', padding: 0 }}>
        {!l ? (
          <div className="grid flex-1 place-items-center text-center font-display font-bold uppercase tracking-wide text-white/70" style={{ fontSize: vm(28, 8, 140) }}>{statusText(d)}</div>
        ) : <>
          {/* LEFT: portrait. Phones: top band. md+: full stage height at a true 4:5 portrait ratio (never a wide strip). */}
          <div className="relative min-h-[46svh] flex-[0_0_50%] overflow-hidden rounded-3xl md:min-h-0 md:aspect-[4/5] md:h-full md:max-w-[48%] md:flex-none" style={{ background: `linear-gradient(155deg, ${c.from}, ${c.to})`, boxShadow: `0 0 ${vm(30, 6, 120)} -${vm(6, 1.2, 24)} ${c.from}` }}>
            {p.photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={p.photo} alt={p.name} className="absolute inset-0 h-full w-full object-cover object-[50%_8%] md:object-[50%_18%]" />
              : <span aria-hidden className="absolute inset-0 grid place-items-center font-display font-bold text-white/80" style={{ fontSize: vm(80, 18, 320) }}>{initials}</span>}
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />
            <span className="absolute left-[4%] top-[3%] rounded-full bg-black/60 px-[0.9em] py-[0.2em] font-bold uppercase tracking-widest backdrop-blur" style={{ fontSize: vm(12, 1.7, 28) }}>Lot #{l.no}</span>
            <div className="absolute inset-x-0 bottom-0 min-w-0 p-[5%] text-left">
              <div className="font-display font-bold uppercase leading-[.92] tracking-wide drop-shadow-[0_4px_20px_rgb(0_0_0/.8)]" style={{ fontSize: vm(28, 6, 130), wordBreak: 'break-word' }}>{p.name}</div>
              <div className="mt-[0.6vmin] flex flex-wrap items-center gap-[0.8vmin] font-bold" style={{ fontSize: vm(12, 2.2, 44) }}>
                <span className={clsx('rounded-lg px-[0.6em] py-[0.1em] font-extrabold', c.chip)}>Cat {p.category}</span>
                {p.position && <span className="rounded-lg bg-white/15 px-[0.6em] py-[0.1em] backdrop-blur">{p.position}</span>}
                <span className="rounded-lg bg-black/55 px-[0.6em] py-[0.1em] backdrop-blur">Base <span className="tabular-nums text-primary">{money(p.basePrice)}</span></span>
              </div>
            </div>
          </div>

          {/* RIGHT: bid, leader, timer, then team budgets (md+) */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-between overflow-hidden text-center" style={{ gap: vm(6, 1, 22) }}>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center" style={{ gap: vm(4, 0.8, 22) }}>
              <div className="font-bold uppercase tracking-[.35em] text-white/60" style={{ fontSize: vm(11, 1.7, 32) }}>{leader ? 'Current bid' : 'Starting price'}</div>
              <div key={l.bid} className="pop text-grad font-display font-bold leading-none tabular-nums tracking-wide" style={{ fontSize: vm(64, 21, 340), filter: 'drop-shadow(0 0 30px rgb(var(--primary) / .5))' }}>{money(l.bid)}</div>
              <div className="flex items-center justify-center" style={{ gap: vm(8, 1.4, 28), minHeight: vm(28, 5, 100), fontSize: vm(16, 4, 80) }}>
                {leader ? <><Logo t={leader} size={vm(28, 5, 100)} /><b className="neon-text font-display uppercase tracking-wide">{leader.name}</b></> : <span className="text-white/50">No bids yet</span>}
              </div>
              {l.open && (
                <div className="w-full max-w-[40vw] min-w-[200px]" role="timer" aria-label="Time left">
                  <div className={clsx('font-display font-bold leading-none tabular-nums tracking-wide', urgent ? 'neon-text-accent' : 'text-white')} style={{ fontSize: vm(34, 11, 190) }}>{clock(left)}</div>
                  <div className={clsx('mx-auto mt-[0.8vmin] h-[1.2vmin] min-h-[8px] overflow-hidden rounded-full bg-white/10', urgent && 'pulse-live')}>
                    <div className={clsx('h-full rounded-full transition-[width] duration-200', urgent ? 'bg-accent shadow-[0_0_20px_rgb(var(--accent))]' : 'grad-volt shadow-[0_0_20px_rgb(var(--primary)/.7)]')} style={{ width: `${Math.min(100, ((left ?? 0) / total_ms) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
            <Teams d={d} l={l} cats={cats} className="hidden w-full shrink-0 text-left md:grid md:grid-cols-3" />
          </div>
        </>}
      </main>

      {/* team budgets: phones, or when no lot is open */}
      <Teams d={d} l={l} cats={cats} className={clsx('projector-teams grid shrink-0', l ? 'md:hidden' : '')} />
      <style>{`.projector-teams{grid-template-columns:repeat(auto-fit,minmax(${vm(130, 14, 380)},1fr))}@media (max-width:767px){.projector-teams{display:flex!important;overflow-x:auto;overflow-y:hidden;max-height:none;scroll-snap-type:x mandatory;scrollbar-width:none}.projector-teams::-webkit-scrollbar{display:none}.projector-teams>div{flex:0 0 46%;scroll-snap-align:start}}`}</style>

      {/* sales ticker */}
      <footer aria-label="Recent sales" className="relative z-10 flex shrink-0 items-center gap-[1.4vmin] overflow-hidden whitespace-nowrap pb-1" style={{ fontSize: vm(11, 1.7, 32) }}>
        <b className="neon-text-accent shrink-0 font-display uppercase tracking-widest">Sold</b>
        {d.recentSales.length === 0 && <span className="text-white/40">No sales yet</span>}
        {d.recentSales.slice(0, 6).map((s) => (
          <span key={s._id} className="shrink-0 rounded-full border border-line bg-white/10 px-[1em] py-[0.2em]">{s.player?.name} <span className="text-white/60">to</span> {s.teamName}{s.price != null && <b className="ml-[0.5em] tabular-nums text-primary">{money(s.price)}</b>}</span>
        ))}
      </footer>
    </div>
  );
}
