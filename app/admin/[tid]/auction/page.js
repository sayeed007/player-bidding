'use client';
import { use, useEffect, useState } from 'react';
import clsx from 'clsx';
import { Play, Dices, Gavel, Loader2, AlertTriangle, CheckCircle2, XCircle, Pause, MoreHorizontal, SkipForward, Ban, Lock, Siren, Wrench, RotateCcw } from 'lucide-react';
import { call, useApi, useMe } from '@/lib/client';
import { Card, Msg, useFlash, Field, money, Button, Segmented, Sheet, StatusBadge, Loading, Avatar } from '@/components/ui';
import { useAuction, useLeft, clock, LotHero, TeamStrip, BidsList, SalesList, ProgressBar } from '@/lib/auction-ui';
import Summary from './Summary';

// one control cell: icon above a short label, so three fit in a row on a phone
const PENDING = { 'draw-lottery': 'Drawing…', 'random-pick': 'Picking…', open: 'Opening…', close: 'Saving…', pause: 'Pausing…', resume: 'Resuming…' };
const CELL = '!h-auto !min-h-[68px] w-full !flex-col !gap-1 !px-1.5 !py-2 text-center text-[13px] leading-tight sm:!min-h-[76px] sm:text-sm';

export default function ControlRoom({ params }) {
  const { tid } = use(params);
  const user = useMe();
  const { data: d, error, reload } = useAuction(tid);
  const ready = useApi(`/api/t/${tid}/readiness`);
  const sum = useApi(`/api/t/${tid}/auction/summary`);
  const [msg, flash] = useFlash();
  const [cat, setCat] = useState('');
  const [fix, setFix] = useState({ saleId: '', newTeamId: '', newPrice: '', reason: '' });
  const [more, setMore] = useState(false);
  const [alloc, setAlloc] = useState(null); // {teamId, price}: the admin's allocation popup
  const [fixOpen, setFixOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // {title, text, label, run}
  const left = useLeft(d);
  const url = (a) => `/api/t/${tid}/auction/${a}`;
  const [busy, setBusy] = useState('');
  const [autoOpen, setAutoOpen] = useState(false); // open bidding straight after picking; remembered on this device
  useEffect(() => { try { setAutoOpen(localStorage.getItem('bidarena.autoOpen') === '1'); } catch {} }, []);
  const toggleAuto = (v) => { setAutoOpen(v); try { localStorage.setItem('bidarena.autoOpen', v ? '1' : '0'); } catch {} };
  // Only refetch what the action can change: the auction state always; the summary after sales/closing; readiness only on start.
  const REFRESH_SUMMARY = ['close', 'correct-sale', 'complete', 'skip', 'cancel-lot', 'reopen', 'start'];
  const act = (a, data = {}, ok = 'Done') => {
    setBusy(a);
    return flash(async () => {
      const r = await call(url(a), data);
      if (a === 'random-pick' && autoOpen) await call(url('open'), {});
      return r;
    }, ok).finally(() => {
      setBusy(''); // the action is answered: unlock now, refresh the screen in the background
      reload();
      if (REFRESH_SUMMARY.includes(a)) sum.reload();
      if (a === 'start') ready.reload();
    });
  };
  const canCorrect = user && ['super', 'organizer'].includes(user.role);

  if (!d) return <main>{error ? <div role="alert" className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger"><span className="min-w-0 break-words">{error}</span><Button variant="secondary" onClick={reload}>Retry</Button></div> : <Loading />}</main>;
  const l = d.lot, live = d.status === 'live', paused = ['paused', 'suspended'].includes(d.status);
  const r = ready.data;
  const unsold = sum.data?.unassigned.filter((p) => p.status === 'unsold') || [];
  const cats = d.config.categories.filter((c) => c.active !== false);
  const ask = (title, text, label, run) => { setMore(false); setConfirm({ title, text, label, run }); };
  const B = ({ a, label, data, off, ok, icon, variant, className, pre }) => {
    const go = () => (pre ? pre(() => act(a, data, ok || label)) : act(a, data, ok || label));
    return (
    <Button size="lg" variant={variant} icon={busy === a ? Loader2 : icon} className={clsx(CELL, busy === a && '[&_svg]:animate-spin', variant === 'success' && !off && !busy && 'grad-volt glow-primary', variant === 'secondary' && 'border-cyan/40', className)} disabled={off || !!busy} onClick={() => go()}>{busy === a ? (PENDING[a] || 'Working…') : label}</Button>
    );
  };
  const adminAlloc = d.config.allocation !== 'auto';
  const canSell = live && l && !l.held && (adminAlloc || l.leaderTeamId);
  // bids only suggest: the lottery winner if one was drawn, else the top bidder
  const suggested = l && (d.teams.find((x) => l.lottery?.revealed && x.name === l.lottery.winner)?._id || l.leaderTeamId || '');
  const openAlloc = () => setAlloc({ teamId: suggested, price: String(l.bid) });
  const sellTo = () => {
    const a = alloc; setAlloc(null);
    act('close', { outcome: 'sold', teamId: a.teamId, price: Number(a.price) }, 'Sold');
  };

  return (
    <main className="pb-8">
      {/* sticky status header */}
      <div className="sticky top-16 z-30 -mx-4 border-b border-primary/30 bg-bg/90 px-4 py-2 backdrop-blur-md md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 flex-1 truncate text-lg md:text-xl">Control room</h1>
          <StatusBadge status={d.status} />{l?.held && <StatusBadge status="hold" />}
          {l?.open && <span className={clsx('font-display text-lg font-bold tabular-nums', left != null && left < 10000 && live ? 'neon-text-accent' : 'neon-text')} aria-label="Time left">{clock(left)}</span>}
        </div>
        <div className="mt-1.5"><ProgressBar d={d} /></div>
      </div>
      {error && <div role="alert" className="mt-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger">Connection problem: {error}. Live information may be outdated.<Button variant="secondary" className="ml-2" onClick={reload}>Retry</Button></div>}
      <Msg {...msg} />

      {d.status === 'idle' && (
        <Card title="Start auction">
          {!r ? ready.error ? <div role="alert" className="mb-3 text-sm text-danger"><p className="mb-2">{ready.error}</p><Button variant="secondary" onClick={ready.reload}>Retry readiness check</Button></div> : <p className="mut">Checking readiness...</p> : <div className="mb-3 grid gap-1">
            {r.errors.map((e) => <p key={e} className="err m-0 text-sm">{e}</p>)}
            {r.warnings.map((e) => <p key={e} className="warn m-0 text-sm">{e}</p>)}
            {d.tournamentStatus !== 'auction_ready' && <p className="mut m-0 text-sm">Tournament status is {d.tournamentStatus}; it must be auction_ready.</p>}
          </div>}
          <B a="start" label="Start auction" icon={Play} variant="success" className="w-full" off={!r || r.errors.length > 0 || d.tournamentStatus !== 'auction_ready'} />
        </Card>
      )}

      {d.status !== 'idle' && <>
        <LotHero d={d} split />

        <Card title="Lot controls">
          <div className="grid gap-3">
            <div>
              {d.config.selection === 'sequence' ? <>
                <div className="mb-1 text-xs font-medium text-muted">Category order</div>
                <div className="flex flex-wrap items-center gap-1.5">{(d.config.order || []).map((c) => <span key={c} className={clsx('rounded-lg px-3 py-1.5 font-display text-sm font-bold uppercase tracking-wider', c === d.config.currentCategory ? 'grad-volt glow-primary text-black' : 'bg-surface2 text-muted')}>{c}</span>)}</div>
                <p className="mb-0 mt-1.5 text-xs text-muted">{d.config.currentCategory ? `Now: category ${d.config.currentCategory}. Every player in it must be sold before the next category starts.` : 'All categories are done.'}</p>
              </> : <>
              <div className="mb-1 text-xs font-medium text-muted">Random pick from</div>
              <Segmented value={cat} onChange={setCat} options={[{ value: '', label: 'Any' }, ...cats.map((c) => ({ value: c.code, label: c.code }))]} /></>}
            </div>
            {l?.tie && (
              <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
                <span className="flex min-w-0 flex-1 items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden /><span><b>Tie at {money(l.tie.price)}</b>: {l.tie.teams.join(' and ')} (matched) cannot go any higher. Draw the lottery before selling.</span></span>
                <Button size="md" variant="danger" icon={busy === 'draw-lottery' ? Loader2 : Dices} className={clsx(busy === 'draw-lottery' && '[&_svg]:animate-spin')} disabled={!!busy}
                  onClick={() => act('draw-lottery', {}, 'Lottery drawn: watch the screen')}>{busy === 'draw-lottery' ? 'Drawing…' : 'Draw lottery'}</Button>
              </div>
            )}
            {l?.lottery && !l.lottery.revealed && <p role="status" className="m-0 animate-pulse rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">Drawing the lottery… the winner appears on every screen in a few seconds.</p>}
            {l?.lottery?.revealed && <p role="status" className="m-0 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"><b>{l.lottery.winner}</b> won the lottery at {money(l.lottery.price)}. You can sell now.</p>}
            <label className="flex min-h-[40px] items-center gap-2 text-sm text-muted"><input type="checkbox" className="h-5 w-5" checked={autoOpen} onChange={(e) => toggleAuto(e.target.checked)} />Open bidding right after picking a player</label>
            {/* 6 controls = 2 rows x 3 columns */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <B a="random-pick" label="Pick random" icon={Dices} data={{ category: d.config.selection === 'sequence' ? undefined : cat || undefined }} off={!live || !!l} ok={(x) => `Picked ${x.name} (from ${x.candidates} candidates)`} />
              <B a="open" label="Open bidding" icon={Gavel} variant="success" off={!live || !l || l.open} />
              {paused
                ? <B a="resume" label="Resume" icon={Play} variant="success" />
                : <B a="pause" label="Pause" icon={Pause} variant="secondary" off={!live} />}
              {adminAlloc
                ? <Button size="lg" variant="success" icon={CheckCircle2} className={clsx(CELL, canSell && !busy && 'grad-volt glow-primary')} disabled={!canSell || !!busy} onClick={openAlloc}>{busy === 'close' ? 'Saving…' : 'Sold'}</Button>
                : <B a="close" label="Sold" icon={CheckCircle2} variant="success" data={{ outcome: 'sold' }} off={!canSell || !!l?.tie || (!!l?.lottery && !l.lottery.revealed)}
                  ok={(r) => (r.lottery ? `Sold to ${r.lottery.winner} after the lottery` : 'Sold')} />}
              <Button size="lg" variant="secondary" icon={XCircle} className={CELL} disabled={!live || !l || l.held || !!busy}
                onClick={() => l.leaderTeamId
                  ? ask('Mark unsold?', `${l.player?.name} has a bid of ${money(l.bid)}. Marking unsold discards it.`, 'Mark unsold', () => act('close', { outcome: 'unsold', force: true }, 'Marked unsold'))
                  : act('close', { outcome: 'unsold', force: false }, 'Marked unsold')}>Unsold</Button>
              <Button size="lg" variant="ghost" icon={MoreHorizontal} className={clsx(CELL, 'border border-line')} onClick={() => setMore(true)}>More</Button>
            </div>
          </div>
          <p className="mut mb-0 mt-3 text-xs">Lot hold freezes one player; pause/suspend freeze the whole session.</p>
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          <Card title="Live bids"><BidsList d={d} /></Card>
          <Card title="Recent sales"><SalesList d={d} limit={5} /></Card>
        </div>

        <h2>Teams</h2>
        <TeamStrip d={d} rosters={Object.fromEntries((sum.data?.teams || []).map((t) => [t._id, t.squad]))} />

        {unsold.length > 0 && (
          <Card title={`Unsold players (${unsold.length})`}>
            <ul className="grid gap-2">
              {unsold.map((p) => (
                <li key={p._id} className="flex items-center gap-3">
                  <Avatar src={p.photo} name={p.name} size={40} />
                  <span className="min-w-0 flex-1 text-sm"><b className="block truncate">{p.name}</b><span className="text-muted">{p.category} · base {money(p.basePrice)}</span></span>
                  <Button size="md" variant="secondary" icon={RotateCcw} onClick={() => flash(async () => { await call(url(`reopen/${p._id}`), {}); reload(); sum.reload(); }, 'Returned to pool')}>Re-open</Button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Summary data={sum.data} error={sum.error} retry={sum.reload} d={d} lotOpen={!!l}
          onComplete={(exception) => ask('Complete the auction?', 'This closes the auction for good.', 'Complete auction', () => act('complete', { exception }, 'Auction completed'))} />
      </>}

      <Sheet open={!!alloc} onClose={() => setAlloc(null)} title="Allocate player">
        {alloc && l && (
          <div className="grid gap-3">
            <p className="m-0 text-sm text-muted"><b className="text-fg">{l.player?.name}</b>: {l.leaderTeamId ? <>top bid <b>{money(l.bid)}</b> by {d.teams.find((x) => x._id === l.leaderTeamId)?.name}</> : <>no bids, base {money(l.bid)}</>}. You decide who gets the player.</p>
            <Field label="Team">
              <select value={alloc.teamId} onChange={(e) => setAlloc({ ...alloc, teamId: e.target.value })}>
                <option value="">Select team...</option>
                {d.teams.map((x) => { const cc = d.config.categories.find((c) => c.code === l.player?.category), full = x.slots <= 0 || (cc && (x.counts?.[cc.code] || 0) >= cc.max);
                  return <option key={x._id} value={x._id} disabled={full}>{x.name}{x._id === suggested ? ' (suggested)' : ''} · {money(x.remaining)} left{full ? ` · ${x.slots <= 0 ? 'squad full' : `${cc.code} quota full`}` : ''}</option>; })}
              </select>
            </Field>
            <Field label="Price"><input type="number" inputMode="numeric" min="0" value={alloc.price} onChange={(e) => setAlloc({ ...alloc, price: e.target.value })} /></Field>
            <Button size="lg" variant="success" icon={CheckCircle2} disabled={!alloc.teamId || !alloc.price || !!busy} onClick={sellTo}>Confirm sale</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={more} onClose={() => setMore(false)} title="More actions">
        <div className="grid gap-2">
          <Button variant="secondary" icon={Lock} disabled={!l} onClick={() => { setMore(false); act('hold-lot', { release: !!l?.held }, l?.held ? 'Hold released' : 'Lot on hold'); }}>{l?.held ? 'Release lot hold' : 'Hold lot'}</Button>
          <Button variant="secondary" icon={SkipForward} disabled={!l} onClick={() => ask('Skip this player?', 'The player goes back into the pool.', 'Skip', () => act('skip', {}, 'Skipped, player back in pool'))}>Skip (back to pool)</Button>
          <Button variant="secondary" icon={Ban} disabled={!l} onClick={() => ask('Cancel this lot?', 'All bids on this lot are discarded.', 'Cancel lot', () => act('cancel-lot', { reason: 'cancelled by auctioneer' }, 'Lot cancelled'))}>Cancel lot</Button>
          {canCorrect && <Button variant="secondary" icon={Wrench} onClick={() => { setMore(false); setFixOpen(true); }}>Correct a sale</Button>}
          <Button variant="danger" icon={Siren} disabled={!['live', 'paused'].includes(d.status)} onClick={() => ask('Emergency suspend?', 'Freezes the whole auction until resumed.', 'Suspend', () => act('suspend', {}, 'Suspended'))}>Emergency suspend</Button>
        </div>
      </Sheet>

      <Sheet open={fixOpen} onClose={() => setFixOpen(false)} title="Correct a sale">
        <div className="grid gap-3">
          <Field label="Sale (recent)">
            <select value={fix.saleId} onChange={(e) => setFix({ ...fix, saleId: e.target.value })}>
              <option value="">Select...</option>
              {d.recentSales.map((s) => <option key={s._id} value={s._id}>#{s.lotNo} {s.player?.name} → {s.teamName} {s.price != null && money(s.price)}</option>)}
            </select>
          </Field>
          <Field label="New team (optional)">
            <select value={fix.newTeamId} onChange={(e) => setFix({ ...fix, newTeamId: e.target.value })}>
              <option value="">Same team</option>
              {d.teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="New price (optional)"><input type="number" inputMode="numeric" value={fix.newPrice} onChange={(e) => setFix({ ...fix, newPrice: e.target.value })} /></Field>
          <Field label="Reason (required)"><input value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} /></Field>
          <Button disabled={!fix.saleId} onClick={() => { setFixOpen(false); act('correct-sale', { ...fix, newTeamId: fix.newTeamId || undefined, newPrice: fix.newPrice || undefined }, 'Sale corrected'); }}>Apply correction</Button>
          <Button variant="danger" disabled={!fix.saleId} onClick={() => { setFixOpen(false); setConfirm({ title: 'Void this sale?', text: 'The player returns to the pool; the original sale is kept as voided with a compensating ledger entry.', label: 'Void sale', run: () => act('correct-sale', { saleId: fix.saleId, reason: fix.reason, voidOnly: true }, 'Sale voided, player back in pool') }); }}>Void sale only</Button>
        </div>
      </Sheet>

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title}>
        <p className="mt-0 text-sm text-muted">{confirm?.text}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => setConfirm(null)}>Back</Button>
          <Button variant="danger" onClick={() => { const c = confirm; setConfirm(null); c.run(); }}>{confirm?.label}</Button>
        </div>
      </Sheet>
    </main>
  );
}
