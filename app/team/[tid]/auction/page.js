'use client';
import Link from 'next/link';
import { use, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Minus, Plus, ChevronDown, Trophy, TriangleAlert, Wallet, ArrowLeft } from 'lucide-react';
import { call, useMe } from '@/lib/client';
import { Msg, useFlash, money, Loading, Button, StatusBadge } from '@/components/ui';
import { useAuction, useLeft, LotHero, QuotaChips, BidsList, TeamStrip } from '@/lib/auction-ui';

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export default function BidRoom({ params }) {
  const { tid } = use(params);
  const user = useMe();
  const { data: d, error, reload } = useAuction(tid);
  const [msg, flash] = useFlash();
  const [extra, setExtra] = useState(0); // steps above the minimum next bid
  const [showBids, setShowBids] = useState(false);
  const [busy, setBusy] = useState(false);
  const left = useLeft(d);
  const wasLeading = useRef({}); // lotNo -> I led at some point

  const mine = d?.teams.find((x) => x._id === user?.teamId);
  const l = d?.lot;
  const leading = !!mine && !!l && l.leaderTeamId === mine._id;
  useEffect(() => { if (leading) wasLeading.current[l.no] = true; }, [leading, l?.no]);
  useEffect(() => { setExtra(0); }, [l?.no, l?.bid]);

  if (!d) return <div>{error ? <p className="err">{error}</p> : <Loading />}</div>;

  const inc = d.config.increment;
  const next = l ? (l.leaderTeamId ? l.bid + inc : l.bid) : 0;
  const max = mine?.maxBidForLot ?? null;
  const open = d.status === 'live' && l?.open && !l.held && left > 0;
  const canBid = open && !!mine && !leading && !mine.bidBlock && (max == null || next <= max);
  const amount = next + extra * inc;
  const overMax = max != null && amount > max;
  const outbid = !!mine && !!l && !leading && wasLeading.current[l.no];

  // fresh idempotency key per click; seenBid makes a quick-bid on a moved price fail instead of overpaying
  const send = async () => {
    setBusy(true);
    await flash(async () => {
      const r = await call(`/api/t/${tid}/auction/bid`, { amount, seenBid: extra === 0 ? l.bid : undefined, lotNo: l.no, key: newKey() });
      reload();
      return r;
    }, (r) => `Bid ${money(r.amount)} placed${r.replay ? ' (already received)' : ''}`);
    setBusy(false);
  };

  const banner = !mine ? ['neutral', 'Viewing only: no team linked to this account.']
    : leading ? ['good', 'You are leading. Hold tight.']
    : outbid ? ['bad', 'You have been outbid.']
    : mine.bidBlock && l ? ['warn', `You cannot bid on this player: ${mine.bidBlock}`]
    : null;
  const tone = { good: 'bg-success/15 text-success', bad: 'bg-danger/15 text-danger', warn: 'bg-warning/15 text-warning', neutral: 'bg-surface2 text-muted' };

  return (
    <div className="pb-52 md:pb-40">
      <Link href={`/team/${tid}`} className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-fg no-underline hover:bg-surface2 hover:no-underline"><ArrowLeft size={16} aria-hidden />Team overview</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1"><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Bidding room</p><h1 className="m-0 break-words text-xl md:text-2xl">{mine ? mine.name : 'Live auction'}</h1></div>
        <StatusBadge status={d.status} />
        {error && <span className="shrink-0 text-xs text-danger">Reconnecting...</span>}
      </div>

      <div className="mt-2 min-h-[44px]" aria-live="polite">
        {banner && (
          <div className={clsx('flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold', tone[banner[0]])}>
            {banner[0] === 'good' ? <Trophy size={18} aria-hidden /> : <TriangleAlert size={18} aria-hidden />}{banner[1]}
          </div>
        )}
      </div>

      <LotHero d={d} meTeam={mine?._id} />

      {mine && (
        <section className="my-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <div className="grid grid-cols-3 gap-2 divide-x divide-line text-center [&>div]:min-w-0 [&>div]:break-words [&>div]:px-1">
            <div><div className="text-[11px] text-muted">Max bid now</div><div className="font-display text-xl font-bold tabular-nums">{l ? (mine.bidBlock ? 'None' : money(max)) : '--'}</div></div>
            <div><div className="inline-flex items-center gap-1 text-[11px] text-muted"><Wallet size={11} aria-hidden />Budget left</div><div className="font-display text-xl font-bold tabular-nums">{money(mine.remaining)}</div></div>
            <div><div className="text-[11px] text-muted">Slots</div><div className="font-display text-xl font-bold tabular-nums">{mine.slots}<span className="text-sm font-normal text-muted">/{d.config.squad}</span></div></div>
          </div>
          <div className="mt-3"><div className="mb-1 text-[11px] text-muted">Category quota (have/max)</div><QuotaChips team={mine} d={d} /></div>
        </section>
      )}

      <section className="my-3 rounded-2xl border border-line bg-surface shadow-card">
        <button className="!flex !min-h-14 !w-full !justify-between !rounded-2xl !bg-transparent !px-4 !text-fg" aria-expanded={showBids} aria-controls="recent-team-bids" onClick={() => setShowBids(!showBids)}>
          <span>Recent bids</span><ChevronDown size={18} className={clsx('transition', showBids && 'rotate-180')} aria-hidden />
        </button>
        {showBids && <div id="recent-team-bids" className="px-4 pb-3"><BidsList d={d} /></div>}
      </section>

      <h2>All teams</h2>
      <TeamStrip d={d} meTeam={mine?._id} />

      {/* Sticky action bar sits above the phone tab bar */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 pb-3 pt-2 shadow-card backdrop-blur md:bottom-0">
        <div className="mx-auto max-w-xl">
          <Msg {...msg} />
          <div className="flex items-stretch gap-2">
            <Button variant="secondary" className="!min-w-[52px]" aria-label="Decrease bid" disabled={!canBid || extra === 0} onClick={() => setExtra(extra - 1)}><Minus size={20} /></Button>
            <Button size="lg" variant="success" className="min-w-0 flex-1 !text-xl tabular-nums" disabled={!canBid || busy || overMax} onClick={send}>
              {l ? (leading ? 'You lead' : `Bid ${money(amount)}`) : 'No lot open'}
            </Button>
            <Button variant="secondary" className="!min-w-[52px]" aria-label="Increase bid" disabled={!canBid || (max != null && amount + inc > max)} onClick={() => setExtra(extra + 1)}><Plus size={20} /></Button>
          </div>
          <div className="mt-2 min-h-4 text-center text-xs text-muted">
            {canBid ? (extra === 0 ? `Quick bid: next valid amount (+${inc} steps)` : `Custom bid, +${money(extra * inc)} over minimum`) : !open && l ? 'Bidding is not open' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
