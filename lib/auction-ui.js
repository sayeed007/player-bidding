'use client';
// Shared auction UI bits (polling hook, server-clock countdown, lot hero, team strip, feeds).
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Gavel, Pause, Hourglass, CircleOff } from 'lucide-react';
import { useApi } from '@/lib/client';
import { money, Avatar, Empty, Badge } from '@/components/ui';
import { CatChip, TeamBadge } from '@/components/cards';

export const useAuction = (tid) => useApi(`/api/t/${tid}/auction/state`, { poll: 1500 });

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

/** Linear countdown; red under 10s. Fixed height so nothing shifts. */
export function Countdown({ d, left, dark }) {
  const l = d.lot;
  if (!l?.open) return null;
  const total = Math.max(d.config.timerSec * 1000, left || 0, 1);
  const urgent = isUrgent(d, left);
  const pct = Math.min(100, ((left ?? 0) / total) * 100);
  return (
    <div className="w-full" role="timer" aria-label="Time left">
      <div className={clsx('text-center font-display text-4xl font-extrabold tabular-nums leading-none', urgent ? 'text-danger' : dark ? 'text-white' : 'text-fg')}>{clock(left)}</div>
      <div className={clsx('mt-2 h-2 overflow-hidden rounded-full', dark ? 'bg-white/15' : 'bg-surface2')}>
        <div className={clsx('h-full rounded-full transition-[width] duration-200', urgent ? 'bg-danger' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function PlayerPhoto({ p, size = 120, className }) {
  return <Avatar src={p.photo} name={p.name} size={size} className={clsx('!rounded-2xl', className)} />;
}

/** Hero for the current lot: photo, name, category, base price, big bid, leader, countdown. */
export function LotHero({ d, meTeam }) {
  const left = useLeft(d);
  const l = d.lot;
  if (!l) {
    const Icon = d.status === 'paused' || d.status === 'suspended' ? Pause : d.status === 'completed' ? CircleOff : Hourglass;
    return (
      <div className="my-3 flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-surface2 text-muted"><Icon size={30} aria-hidden /></span>
        <div className="font-display text-xl font-bold">{statusText(d)}</div>
        <p className="max-w-xs text-sm text-muted">{d.status === 'live' ? 'The auctioneer will pick the next player shortly. This page updates by itself.' : 'This page updates by itself.'}</p>
      </div>
    );
  }
  const p = l.player || {};
  const leader = d.teams.find((x) => x._id === l.leaderTeamId);
  const isMe = !!meTeam && leader?._id === meTeam;
  return (
    <section className="my-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface2/60 px-4 py-2 text-xs font-medium text-muted">
        <span className="inline-flex items-center gap-1.5"><Gavel size={14} aria-hidden />Lot #{l.no}</span>
        <span className={clsx(l.open && !l.held && d.status === 'live' && 'font-semibold text-success')}>{statusText(d)}</span>
      </div>
      <div className="flex flex-col items-center gap-3 p-4 text-center">
        <PlayerPhoto p={p} size={120} />
        <div className="min-w-0 max-w-full">
          <h2 className="m-0 truncate font-display text-2xl font-bold">{p.name}</h2>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
            <CatChip code={p.category} />{p.position && <span>{p.position}</span>}<span>Base <b className="tabular-nums text-fg">{money(p.basePrice)}</b></span>
          </div>
        </div>
        <div className="w-full rounded-xl bg-surface2/60 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">{leader ? 'Current bid' : 'Starting price'}</div>
          <div className="font-display text-6xl font-extrabold leading-tight tabular-nums md:text-7xl">{money(l.bid)}</div>
          <div className="mt-1 flex min-h-[32px] items-center justify-center">
            {leader ? <TeamBadge team={leader} size={28} nameClass={clsx('text-base', isMe && 'text-success')} /> : <span className="text-sm text-muted">No bids yet</span>}
          </div>
        </div>
        <Countdown d={d} left={left} />
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
          <span key={c.code} className={clsx('inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs tabular-nums', full ? 'border-line bg-surface2 text-muted' : need ? 'border-warning/50 bg-warning/10 text-warning' : 'border-line text-fg')}
            title={`${c.code}: have ${have}, min ${c.min || 0}, max ${c.max}`}>
            <CatChip code={c.code} className="!min-w-[22px] !text-[11px]" />{have}/{c.max}{need && <span className="text-[10px]">need {c.min - have}</span>}
          </span>
        );
      })}
    </div>
  );
}

/** Horizontal scroll strip of team budget cards. */
export function TeamStrip({ d, meTeam }) {
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
      {d.teams.map((t) => {
        const lead = t._id === d.lot?.leaderTeamId;
        return (
          <div key={t._id} className={clsx('w-64 shrink-0 snap-start rounded-2xl border bg-surface p-3 shadow-card md:w-auto', lead ? 'border-success ring-2 ring-success/40' : 'border-line')}
            style={{ borderTopColor: t.color || undefined, borderTopWidth: 4 }}>
            <div className="flex items-center gap-2">
              <TeamBadge team={t} size={28} className="flex-1" />
              {t._id === meTeam && <Badge color="blue">You</Badge>}{lead && <Badge color="green">Leading</Badge>}
            </div>
            <div className="mt-2 flex items-end justify-between">
              <div><div className="text-[11px] text-muted">Budget left</div><div className="font-display text-xl font-bold tabular-nums">{t.remaining == null ? 'Hidden' : money(t.remaining)}</div></div>
              <div className="text-right"><div className="text-[11px] text-muted">Squad</div><div className="font-semibold tabular-nums">{t.count}/{d.config.squad} <span className="text-xs font-normal text-muted">({t.slots} left)</span></div></div>
            </div>
            <div className="mt-2"><QuotaChips team={t} d={d} /></div>
          </div>
        );
      })}
    </div>
  );
}

export function BidsList({ d, limit = 8 }) {
  if (!d.recentBids.length) return <Empty>No bids yet.</Empty>;
  return (
    <ul className="divide-y divide-line">
      {d.recentBids.slice(0, limit).map((b, i) => (
        <li key={`${b.lotNo}-${b.amount}-${i}`} className={clsx('flex items-center justify-between gap-3 py-2 text-sm', i === 0 && 'font-semibold')}>
          <span className="min-w-0 truncate">{b.teamName} <span className="font-normal text-muted">on {b.playerName}</span></span>
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
        <li key={s._id} className="flex items-center gap-3 rounded-xl border border-line p-2">
          <Avatar src={s.player?.photo} name={s.player?.name || ''} size={40} />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{s.player?.name}</span><span className="block truncate text-xs text-muted">to {s.teamName}</span></span>
          {s.price != null && <b className="tabular-nums">{money(s.price)}</b>}
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
        <div className="h-full rounded-full bg-primary" style={{ width: `${total ? (sold / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
