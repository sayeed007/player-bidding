'use client';
// Shared auction UI bits (polling hook, server-clock countdown, lot hero, team strip, feeds).
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Gavel, Pause, Hourglass, CircleOff, ChevronDown } from 'lucide-react';
import { useApi } from '@/lib/client';
import { money, Avatar, Empty, Badge } from '@/components/ui';
import { CatChip, TeamBadge, PlayerPhoto } from '@/components/cards';

export const useAuction = (tid) => useApi(`/api/t/${tid}/auction/state`, { poll: 1500 });

/**
 * Full-screen lottery reveal. Starts when the server reports a fresh draw (lot.lottery), cycles the tied teams while the clock runs to
 * revealAt, then shows the winner. The winner only arrives in the data at revealAt, so nobody can see it early. Visitors who open the
 * page long after the draw just see the result in the lot, not the show.
 */
export function LotteryReveal({ d }) {
  const lt = d?.lot?.lottery;
  const [, tick] = useState(0);
  const [hidden, setHidden] = useState(null); // drawnAt of a draw the user dismissed
  useEffect(() => { if (!lt) return; const i = setInterval(() => tick((n) => n + 1), 80); return () => clearInterval(i); }, [lt]);
  const off = useMemo(() => (d ? d.now - Date.now() : 0), [d]);
  if (!lt || hidden === lt.drawnAt) return null;
  const now = Date.now() + off, total = lt.revealAt - lt.drawnAt, p = (now - lt.drawnAt) / total;
  if (now > lt.revealAt + 7000) return null;
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const names = lt.candidates;
  const spinning = p < 1 && !lt.revealed;
  const idx = Math.floor(28 * (1 - (1 - Math.min(1, Math.max(0, p))) ** 3)) % names.length;
  const text = lt.winner || (spinning ? (reduce ? '…' : names[idx]) : '…');
  return (
    <div role="alertdialog" aria-live="assertive" aria-label="Lottery" onClick={() => !spinning && setHidden(lt.drawnAt)}
      className="fixed inset-0 z-[90] grid place-items-center bg-black/90 p-6 text-center backdrop-blur-md">
      <div className="max-w-full">
        <div className="font-display text-sm font-bold uppercase tracking-[.4em] text-muted sm:text-xl">Tie at {lt.price} · Lottery</div>
        <div key={lt.winner ? 'w' : 'spin'} className={clsx('mt-4 break-words font-display font-bold uppercase leading-none tracking-wide', lt.winner ? 'pop neon-text text-[13vw] sm:text-[9vw]' : 'text-white/80 text-[11vw] sm:text-[8vw]')}>{text}</div>
        <div className="mt-6 min-h-[2.5rem] font-display text-xl font-bold uppercase tracking-[.3em] sm:text-3xl">
          {lt.winner ? <span className="neon-text-accent">wins the lottery</span> : <span className="animate-pulse text-muted">drawing…</span>}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm text-muted">{names.map((n) => <span key={n} className={clsx('rounded-full border px-3 py-1', lt.winner === n ? 'border-primary text-primary' : 'border-line')}>{n}</span>)}</div>
        {lt.winner && <p className="mt-6 text-xs text-muted">Tap anywhere to close</p>}
      </div>
    </div>
  );
}

/** ms left on the lot, measured on the SERVER clock (offset taken from each poll). */
export function useLeft(d) {
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 200); return () => clearInterval(i); }, []);
  const off = useMemo(() => (d ? d.now - Date.now() : 0), [d]);
  const l = d?.lot;
  if (!l?.open) return null;
  return l.endsAt ? Math.max(0, l.endsAt - (Date.now() + off)) : l.pausedLeftMs;
}
export const clock = (ms) => (ms == null ? '--' : `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`);
export const activeCats = (d) => d.config.categories.filter((c) => c.active !== false);
export const isUrgent = (d, left) => left != null && left < 10000 && d.status === 'live' && !d.lot?.held;

export function statusText(d) {
  if (!d) return '';
  if (d.status === 'idle') return 'Auction not started';
  if (d.status === 'completed') return 'Auction completed';
  if (d.status === 'suspended') return 'Auction suspended';
  if (d.status === 'paused') return 'Auction paused';
  if (d.lot?.held) return 'Lot on hold';
  if (d.lot && !d.lot.open) return 'Bidding opens soon';
  if (d.lot) return 'Bidding open';
  return 'Waiting for next player';
}

/** Glowing linear countdown; magenta + pulse under 10s. Fixed height so nothing shifts. */
export function Countdown({ d, left, dark }) {
  const l = d.lot;
  if (!l?.open) return null;
  const total = Math.max(d.config.timerSec * 1000, left || 0, 1);
  const urgent = isUrgent(d, left);
  const pct = Math.min(100, ((left ?? 0) / total) * 100);
  return (
    <div className="w-full" role="timer" aria-label="Time left">
      <div className={clsx('text-center font-display text-4xl font-bold tabular-nums leading-none tracking-wide', urgent ? 'neon-text-accent' : dark ? 'text-white' : 'text-fg')}>{clock(left)}</div>
      <div className={clsx('mt-2 h-2.5 overflow-hidden rounded-full bg-white/10', urgent && 'pulse-live')}>
        <div className={clsx('h-full rounded-full transition-[width] duration-200', urgent ? 'bg-accent shadow-[0_0_14px_rgb(var(--accent))]' : 'grad-volt shadow-[0_0_14px_rgb(var(--primary)/.7)]')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Round countdown ring (overlay on the photo). */
export function CountRing({ d, left }) {
  const l = d.lot;
  if (!l?.open) return null;
  const total = Math.max(d.config.timerSec * 1000, left || 0, 1);
  const urgent = isUrgent(d, left);
  const pct = Math.min(1, (left ?? 0) / total);
  const R = 26, C = 2 * Math.PI * R;
  const col = urgent ? 'rgb(var(--accent))' : 'rgb(var(--primary))';
  return (
    <div role="timer" aria-label="Time left" className={clsx('relative grid h-16 w-16 place-items-center rounded-full bg-black/60 backdrop-blur', urgent && 'pulse-live')}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={R} fill="none" stroke="rgb(255 255 255 / .15)" strokeWidth="5" />
        <circle cx="32" cy="32" r={R} fill="none" strokeWidth="5" strokeLinecap="round" stroke={col}
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset .2s linear', filter: `drop-shadow(0 0 4px ${col})` }} />
      </svg>
      <span className={clsx('relative font-display text-lg font-bold tabular-nums leading-none', urgent ? 'text-accent' : 'text-white')}>{clock(left)}</span>
    </div>
  );
}

/**
 * Hero for the current lot: HUGE photo (category glow, name overlay), giant neon bid, leader, countdown.
 * split: on md+ put the photo left (360px+) and the bid panel right.
 */
export function LotHero({ d, meTeam, split }) {
  const left = useLeft(d);
  const l = d.lot;
  if (!l) {
    const Icon = d.status === 'paused' || d.status === 'suspended' ? Pause : d.status === 'completed' ? CircleOff : Hourglass;
    return (
      <div className="grad-card my-3 flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl p-6 text-center shadow-card">
        <span className="glow-primary grid h-20 w-20 place-items-center rounded-full bg-surface2 text-primary"><Icon size={36} aria-hidden /></span>
        <div className="font-display text-3xl font-bold uppercase tracking-wide">{statusText(d)}</div>
        <p className="max-w-xs text-sm text-muted">{d.status === 'live' ? 'The auctioneer will pick the next player shortly. This page updates by itself.' : 'This page updates by itself.'}</p>
      </div>
    );
  }
  const p = l.player || {};
  const leader = d.teams.find((x) => x._id === l.leaderTeamId);
  const isMe = !!meTeam && leader?._id === meTeam;
  const urgent = isUrgent(d, left);
  const live = l.open && !l.held && d.status === 'live';
  return (
    <section className={clsx('my-3', split && 'md:grid md:grid-cols-[minmax(360px,5fr)_7fr] md:items-start md:gap-6')}>
      <LotteryReveal d={d} />
      <PlayerPhoto player={p} size="xl" className={clsx(split ? 'md:aspect-[3/4]' : 'md:mx-auto md:max-h-[78vh] md:max-w-xl')}>
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="grid gap-1.5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur"><Gavel size={13} aria-hidden />Lot #{l.no}</span>
            <span className={clsx('inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur', live ? 'bg-primary/90 text-primary-fg' : 'bg-black/60 text-white')}>
              {live && <span className="h-1.5 w-1.5 rounded-full bg-primary-fg" aria-hidden />}{statusText(d)}
            </span>
          </div>
          <CountRing d={d} left={left} />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h2 className="m-0 break-words font-display text-5xl font-bold uppercase leading-[.95] tracking-wide text-white drop-shadow-[0_2px_12px_rgb(0_0_0/.8)] sm:text-6xl">{p.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-white/90">
            <CatChip code={p.category} className="!px-2.5 !py-1 !text-sm" />{p.position && <span className="rounded-md bg-white/15 px-2 py-1 backdrop-blur">{p.position}</span>}
            <span className="rounded-md bg-black/55 px-2 py-1 backdrop-blur">Base <b className="tabular-nums text-primary">{money(p.basePrice)}</b></span>
          </div>
        </div>
      </PlayerPhoto>

      <div className={clsx('grad-card mt-2 rounded-2xl p-3 text-center shadow-card sm:mt-3 sm:p-4', split && 'md:mt-0 md:p-6', isMe && '!border-primary glow-primary', urgent && !isMe && '!border-accent glow-accent')}>
        <div className="text-xs font-bold uppercase tracking-[.25em] text-muted">{leader ? 'Current bid' : 'Starting price'}</div>
        <div key={l.bid} className="pop text-grad font-display text-[68px] font-bold leading-none tabular-nums tracking-wide sm:text-[104px]" style={{ filter: 'drop-shadow(0 0 18px rgb(var(--primary) / .45))' }}>{money(l.bid)}</div>
        <div className="mt-2 flex min-h-[40px] items-center justify-center">
          {leader ? <TeamBadge team={leader} size={36} nameClass={clsx('font-display text-xl uppercase tracking-wide', isMe && 'neon-text')} /> : <span className="text-sm text-muted">No bids yet</span>}
        </div>
        <div className="mt-3"><Countdown d={d} left={left} /></div>
      </div>
    </section>
  );
}

export function QuotaChips({ team, d }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {activeCats(d).map((c) => {
        const have = team.counts?.[c.code] || 0;
        const full = have >= c.max, need = have < (c.min || 0);
        return (
          <span key={c.code} className={clsx('inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs tabular-nums', full ? 'border-line bg-surface2/60 text-muted' : need ? 'border-warning/60 bg-warning/10 text-warning' : 'border-line bg-surface2/40 text-fg')}
            title={`${c.code}: have ${have}, min ${c.min || 0}, max ${c.max}`}>
            <CatChip code={c.code} className="!min-w-[22px] !text-[11px]" />{have}/{c.max}{need && <span className="text-[10px]">need {c.min - have}</span>}
          </span>
        );
      })}
    </div>
  );
}

/** Horizontal scroll strip of team budget cards. */
/** Players a team has bought: photo, category, base price, sold price. Used in the admin Teams strip. */
function Roster({ players, open }) {
  if (!open) return null;
  if (!players.length) return <p className="m-0 mt-2 text-sm text-muted">No players bought yet.</p>;
  return (
    <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
      {players.map((p) => (
        <li key={p._id} className="flex items-center gap-2 rounded-xl bg-surface2/50 p-1.5">
          <Avatar src={p.photo} name={p.name} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-tight">{p.name}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted"><CatChip code={p.category} className="!min-w-[20px] !text-[10px]" />base <b className="tabular-nums text-fg">{money(p.basePrice)}</b></span>
          </span>
          <span className="text-right leading-tight"><span className="block text-[10px] uppercase tracking-wider text-muted">sold</span><b className="font-display text-lg tabular-nums text-grad">{p.price == null ? '-' : money(p.price)}</b></span>
        </li>
      ))}
    </ul>
  );
}

export function TeamStrip({ d, meTeam, rosters }) {
  const [open, setOpen] = useState({});
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
      {d.teams.map((t) => {
        const lead = t._id === d.lot?.leaderTeamId;
        return (
          <div key={t._id} className={clsx('grad-card w-64 shrink-0 snap-start rounded-2xl p-3 shadow-card md:w-auto', lead && '!border-primary glow-primary', t._id === meTeam && !lead && '!border-cyan glow-cyan')}
            style={{ borderTopColor: t.color || undefined, borderTopWidth: 4 }}>
            <div className="flex items-center gap-2">
              <TeamBadge team={t} size={28} className="flex-1" />
              {t._id === meTeam && <Badge color="blue">You</Badge>}{lead && <Badge color="green">Leading</Badge>}
            </div>
            <div className="mt-2 flex items-end justify-between">
              <div><div className="text-[11px] text-muted">Budget left</div><div className="font-display text-2xl font-bold uppercase tabular-nums tracking-wide text-grad">{t.remaining == null ? 'Hidden' : money(t.remaining)}</div></div>
              <div className="text-right"><div className="text-[11px] text-muted">Squad</div><div className="font-semibold tabular-nums">{t.count}/{d.config.squad} <span className="text-xs font-normal text-muted">({t.slots} left)</span></div></div>
            </div>
            <div className="mt-2"><QuotaChips team={t} d={d} /></div>
            {rosters && (() => {
              const list = rosters[t._id] || [], isOpen = !!open[t._id];
              return (
                <div className="mt-2 border-t border-line pt-2">
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [t._id]: !o[t._id] }))}
                    className="sec !min-h-[36px] w-full !justify-between !rounded-lg !px-2.5 text-sm font-medium">
                    <span>Players bought ({list.length})</span><ChevronDown size={16} aria-hidden className={clsx('transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  <Roster players={list} open={isOpen} />
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

export function BidsList({ d, limit = 8 }) {
  if (!d.recentBids.length) return <Empty>No bids yet.</Empty>;
  return (
    <ul className="divide-y divide-line/60">
      {d.recentBids.slice(0, limit).map((b, i) => (
        <li key={`${b.lotNo}-${b.amount}-${i}`} className={clsx('flex items-center justify-between gap-3 py-2 text-sm', i === 0 && 'font-semibold neon-text')}>
          <span className="min-w-0 truncate">{b.teamName} <span className="font-normal text-muted">{b.match ? 'matched on' : 'on'} {b.playerName}</span></span>
          <span className="tabular-nums">{money(b.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

export function SalesList({ d, limit = 10 }) {
  if (!d.recentSales.length) return <Empty>No sales yet.</Empty>;
  return (
    <ul className="grid gap-2">
      {d.recentSales.slice(0, limit).map((s) => (
        <li key={s._id} className="flex items-center gap-3 rounded-xl border border-line bg-surface2/40 p-2">
          <Avatar src={s.player?.photo} name={s.player?.name || ''} size={40} />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{s.player?.name}</span><span className="block truncate text-xs text-muted">to {s.teamName}</span></span>
          {s.price != null && <b className="font-display tabular-nums tracking-wide text-primary">{money(s.price)}</b>}
        </li>
      ))}
    </ul>
  );
}

export function ProgressBar({ d, dark }) {
  const { sold, total, unsold, available } = d.progress;
  return (
    <div className="min-w-0">
      <div className={clsx('flex flex-wrap justify-between gap-x-3 text-xs tabular-nums', dark ? 'text-white/70' : 'text-muted')}>
        <span><b className={dark ? 'text-white' : 'text-fg'}>{sold}</b>/{total} sold</span><span>{unsold} unsold</span><span>{available} available</span>
      </div>
      <div className={clsx('mt-1 h-2 overflow-hidden rounded-full', dark ? 'bg-white/15' : 'bg-surface2')}>
        <div className="grad-volt h-full rounded-full" style={{ width: `${total ? (sold / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
