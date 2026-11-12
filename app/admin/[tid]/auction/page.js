'use client';
import { use, useState } from 'react';
import clsx from 'clsx';
import { Play, Dices, Gavel, CheckCircle2, XCircle, Pause, MoreHorizontal, SkipForward, Ban, Lock, Siren, Wrench, RotateCcw } from 'lucide-react';
import { call, useApi, useMe } from '@/lib/client';
import { Card, Msg, useFlash, Field, money, Button, Segmented, Sheet, StatusBadge, Loading, Avatar } from '@/components/ui';
import { useAuction, useLeft, LotHero, TeamStrip, BidsList, SalesList, ProgressBar } from '@/lib/auction-ui';

export default function ControlRoom({ params }) {
  const { tid } = use(params);
  const user = useMe();
  const { data: d, error, reload } = useAuction(tid);
  const ready = useApi(`/api/t/${tid}/readiness`);
  const sum = useApi(`/api/t/${tid}/auction/summary`);
  const [msg, flash] = useFlash();
  const [cat, setCat] = useState('');
  const [fix, setFix] = useState({ saleId: '', newTeamId: '', newPrice: '', reason: '' });
  const [exception, setException] = useState('');
  const [more, setMore] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // {title, text, label, run}
  const left = useLeft(d);
  const url = (a) => `/api/t/${tid}/auction/${a}`;
  const act = (a, data = {}, ok = 'Done') => flash(async () => {
    const r = await call(url(a), data);
    reload(); sum.reload(); ready.reload();
    return r;
  }, ok);
  const canCorrect = user && ['super', 'organizer'].includes(user.role);

  if (!d) return <main>{error ? <div role="alert" className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger"><span className="min-w-0 break-words">{error}</span><Button variant="secondary" onClick={reload}>Retry</Button></div> : <Loading />}</main>;
  const l = d.lot, live = d.status === 'live';
  const r = ready.data;
  const unsold = sum.data?.unassigned.filter((p) => p.status === 'unsold') || [];
  const cats = d.config.categories.filter((c) => c.active !== false);
  const ask = (title, text, label, run) => { setMore(false); setConfirm({ title, text, label, run }); };
  const B = ({ a, label, data, off, ok, icon, variant, className }) => (
    <Button size="lg" variant={variant} icon={icon} className={clsx(variant === 'success' && !off && 'grad-volt glow-primary', variant === 'secondary' && 'border-cyan/40', className)} disabled={off} onClick={() => act(a, data, ok || label)}>{label}</Button>
  );
  const canSell = live && l && l.leaderTeamId && !l.held;

  return (
    <main className="pb-8">
      {/* sticky status header */}
      <div className="sticky top-16 z-30 -mx-4 border-b border-primary/30 bg-bg/90 px-4 py-2 backdrop-blur-md md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 flex-1 truncate text-lg md:text-xl">Control room</h1>
          <StatusBadge status={d.status} />{l?.held && <StatusBadge status="hold" />}
          {l?.open && <span className={clsx('font-display text-lg font-bold tabular-nums', left < 10000 && live ? 'neon-text-accent' : 'neon-text')}>{Math.floor((left || 0) / 1000)}s</span>}
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
              <div className="mb-1 text-xs font-medium text-muted">Random pick from</div>
              <Segmented value={cat} onChange={setCat} options={[{ value: '', label: 'Any' }, ...cats.map((c) => ({ value: c.code, label: c.code }))]} />
            </div>
            <B a="random-pick" label="Pick random player" icon={Dices} data={{ category: cat || undefined }} off={!live || !!l} ok={(x) => `Picked ${x.name} (from ${x.candidates} candidates)`} className="w-full" />
            <B a="open" label="Open bidding" icon={Gavel} variant="success" off={!live || !l || l.open} className="w-full" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <B a="close" label="Sold" icon={CheckCircle2} variant="success" data={{ outcome: 'sold' }} off={!canSell} ok="Sold" />
              <Button size="lg" variant="secondary" icon={XCircle} disabled={!live || !l || l.held}
                onClick={() => l.leaderTeamId
                  ? ask('Mark unsold?', `${l.player?.name} has a bid of ${money(l.bid)}. Marking unsold discards it.`, 'Mark unsold', () => act('close', { outcome: 'unsold', force: true }, 'Marked unsold'))
                  : act('close', { outcome: 'unsold', force: false }, 'Marked unsold')}>Unsold</Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <B a="pause" label="Pause" icon={Pause} variant="secondary" off={!live} />
              <B a="resume" label="Resume" icon={Play} variant="success" off={!['paused', 'suspended'].includes(d.status)} />
            </div>
            <Button variant="ghost" icon={MoreHorizontal} className="border border-line" onClick={() => setMore(true)}>More actions</Button>
          </div>
          <p className="mut mb-0 mt-3 text-xs">Lot hold freezes one player; pause/suspend freeze the whole session.</p>
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          <Card title="Live bids"><BidsList d={d} /></Card>
          <Card title="Recent sales"><SalesList d={d} limit={5} /></Card>
        </div>

        <h2>Teams</h2>
        <TeamStrip d={d} />

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

        <Card title="Summary and completion">
          {!sum.data ? sum.error ? <div role="alert" className="text-sm text-danger"><p className="mb-2">{sum.error}</p><Button variant="secondary" onClick={sum.reload}>Retry summary</Button></div> : <p className="mut">Loading...</p> : <>
            <p className="m-0 text-sm">Total spend <b className="tabular-nums">{money(sum.data.totalSpend)}</b> · unassigned <b>{sum.data.unassigned.length}</b></p>
            {sum.data.warnings.map((w) => <p key={w} className="warn my-1 text-sm">{w}</p>)}
            <ul className="mt-3 grid gap-2">
              {sum.data.teams.map((t) => (
                <li key={t._id} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-3"><b className="flex-1">{t.name}</b><span className="tabular-nums">{t.count}/{d.config.squad} · left {money(t.remaining)}</span></div>
                  {t.problems.length ? <p className="err m-0 mt-1 text-xs">{t.problems.join(', ')}</p> : <p className="okc m-0 mt-1 text-xs">Complete</p>}
                  <p className="mut m-0 mt-1 text-xs">{t.squad.map((p) => `${p.name} (${p.category}${p.price != null ? ` ${p.price}` : ''})`).join(', ') || 'No players'}</p>
                </li>
              ))}
            </ul>
          </>}
          {d.status !== 'completed' ? (
            <div className="mt-3 grid gap-2">
              <Field label="Exception text (needed if squads are incomplete)"><input value={exception} onChange={(e) => setException(e.target.value)} /></Field>
              <Button size="lg" variant="success" icon={CheckCircle2} disabled={!!l}
                onClick={() => ask('Complete the auction?', 'This closes the auction for good.', 'Complete auction', () => act('complete', { exception }, 'Auction completed'))}>Complete auction</Button>
            </div>
          ) : <p className="okc mt-3">Auction completed{d.completion?.exception ? ` with exception: ${d.completion.exception}` : ''}.</p>}
        </Card>
      </>}

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
