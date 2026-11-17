'use client';
import { use, useEffect, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Check, Plus, Trash2, AlertTriangle, XCircle, ImagePlus, Save, ArrowRight } from 'lucide-react';
import { call, useApi, uploadImage } from '@/lib/client';
import { Button, Field, Msg, PageHeader, StatusBadge, Table, Skeleton, Avatar, useFlash } from '@/components/ui';
import { categoryProblems } from '@/lib/rules';
import { STATUS_ORDER, statusIndex, statusLabel, FORMATS, TIEBREAKS } from '@/lib/setup';

const num = (v) => (v === '' ? '' : Number(v));
const NUM = { type: 'number', inputMode: 'numeric' };

function Section({ title, hint, defaultOpen = false, children }) {
  return (
    <details open={defaultOpen} className="group my-3 grad-card rounded-2xl shadow-card open:border-primary/40">
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-2 px-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1"><span className="block font-display text-lg font-semibold uppercase tracking-wide">{title}</span>{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
        <ChevronDown size={18} className="text-muted transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

export default function Settings({ params }) {
  const { tid } = use(params);
  const { data: t, error: settingsError, reload: reloadT } = useApi(`/api/t/${tid}`);
  const { data: ready, error: readyError, reload: reloadReady } = useApi(`/api/t/${tid}/readiness`);
  const [f, setF] = useState(null);
  const [msg, flash] = useFlash();
  useEffect(() => { if (t && !f) setF({ ...t, venues: (t.venues || []).join('\n'), tiebreak: (t.tiebreak || []).join(',') }); }, [t, f]);
  if (!f && settingsError) return <><PageHeader title="Settings" /><div role="alert" className="rounded-xl border border-danger/20 bg-danger/10 p-4"><p className="mb-3 break-words text-sm text-danger">{settingsError}</p><Button variant="secondary" onClick={reloadT}>Retry</Button></div></>;
  if (!f) return <div className="grid gap-3"><Skeleton className="h-12" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const sub = (o, k, conv = (x) => x) => (e) => setF({ ...f, [o]: { ...f[o], [k]: conv(e.target.type === 'checkbox' ? e.target.checked : e.target.value) } });
  const cats = f.categories || [];
  const setCat = (i, k, v) => setF({ ...f, categories: cats.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });
  const problems = categoryProblems(num(f.squadSize), cats.map((c) => ({ ...c, min: Number(c.min), max: Number(c.max) })));
  const locked = statusIndex(t.status) >= statusIndex('auction_in_progress');

  const save = () => flash(async () => {
    const { _id, status, createdAt, ...rest } = f;
    await call(`/api/t/${tid}`, { ...rest, tiebreak: f.tiebreak.split(',').map((x) => x.trim()).filter(Boolean) }, 'PATCH');
    reloadT(); reloadReady();
  }, 'Saved');
  const move = (to) => flash(async () => { await call(`/api/t/${tid}/status`, { to }); await reloadT(); await reloadReady(); setF(null); }, `Moved to ${statusLabel(to)}`);
  const upload = (k) => (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    file && flash(async () => { const url = await uploadImage(file); setF((x) => ({ ...x, [k]: url })); }, 'Uploaded — remember to save');
  };
  const cur = statusIndex(t.status);

  return (
    <>
      <PageHeader title="Settings" subtitle="Configure the competition and review readiness before changing its status" right={<StatusBadge status={t.status} />} />
      <Msg {...msg} />
      <Section title="Lifecycle" hint={`Now: ${statusLabel(t.status)}`} defaultOpen>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface2" aria-hidden><div className="grad-volt glow-primary h-full rounded-full transition-all" style={{ width: `${((cur + 1) / STATUS_ORDER.length) * 100}%` }} /></div>
        <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {STATUS_ORDER.map((s, i) => (
            <li key={s} aria-current={i === cur ? 'step' : undefined}
              className={clsx('inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium',
                i === cur ? 'grad-volt glow-primary font-bold' : i < cur ? 'bg-success/15 text-success' : 'bg-surface2 text-muted')}>
              {i < cur ? <Check size={13} aria-hidden /> : <span className="tabular-nums">{i + 1}</span>}{statusLabel(s)}
            </li>
          ))}
        </ol>
        {readyError && <div role="alert" className="my-3 rounded-xl bg-danger/10 p-3 text-sm text-danger"><p className="mb-2">{readyError}</p><Button variant="secondary" onClick={reloadReady}>Retry readiness check</Button></div>}
        {ready && Object.entries(ready.targets).map(([to, probs]) => (
          <div key={to} className="mt-3 rounded-xl border border-line p-3">
            <Button className="w-full sm:w-auto" icon={ArrowRight} disabled={probs.length > 0} onClick={() => move(to)}>Move to {statusLabel(to)}</Button>
            {probs.map((p) => <p key={p} className="mt-2 flex items-start gap-2 text-sm text-danger"><XCircle size={16} className="mt-0.5 shrink-0" aria-hidden />{p}</p>)}
          </div>
        ))}
        {ready?.warnings.map((w) => <p key={w} className="mt-2 flex items-start gap-2 text-sm text-warning"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />{w}</p>)}
        {ready && <>
          <h3 className="mb-2 mt-5 font-display text-base font-semibold">Supply vs demand</h3>
          <Table rows={Object.entries(ready.supply).map(([code, s]) => ({ code, ...s }))} rowKey="code" cols={[
            { key: 'code', label: 'Category' }, { key: 'need', label: 'Needed (min × teams)' }, { key: 'have', label: 'Approved players' },
            { key: 'd', label: 'Balance', render: (s) => (s.have < s.need ? <span className="text-danger">short {s.need - s.have}</span> : s.have > s.need ? <span className="text-warning">surplus {s.have - s.need}</span> : <span className="text-success">exact</span>) },
          ]} />
        </>}
      </Section>

      <Section title="Basics" hint="Name, format, squad and budget" defaultOpen>
        {locked && <p className="mb-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning" role="note">The auction has started, so the number of teams, players per team and budget are locked. Everything else can still be edited.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input value={f.name} onChange={set('name')} /></Field>
          <Field label="Code"><input value={f.code} onChange={set('code')} /></Field>
          <Field label="Season"><input value={f.season} onChange={set('season')} /></Field>
          <Field label="Visibility"><select value={f.visibility} onChange={set('visibility')}><option>public</option><option>private</option></select></Field>
          <Field label="Format"><select value={f.format} onChange={set('format')}>{FORMATS.map((x) => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}</select></Field>
          <Field label="Teams"><input {...NUM} disabled={locked} value={f.teamsCount} onChange={set('teamsCount')} /></Field>
          <Field label="Players per team"><input {...NUM} disabled={locked} value={f.squadSize} onChange={set('squadSize')} /></Field>
          <Field label="Budget per team"><input {...NUM} disabled={locked} value={f.budget} onChange={set('budget')} /></Field>
          <Field label="Match duration (min)"><input {...NUM} value={f.matchDuration} onChange={set('matchDuration')} /></Field>
          <Field label="Break (min)"><input {...NUM} value={f.breakDuration} onChange={set('breakDuration')} /></Field>
        </div>
        <div className="mt-3 grid gap-3">
          <Field label="Description"><textarea rows={3} value={f.description} onChange={set('description')} /></Field>
          <Field label="Venues (one per line)"><textarea rows={3} value={f.venues} onChange={set('venues')} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            {[['logo', 'Logo'], ['banner', 'Banner']].map(([k, l]) => (
              <div key={k} className="flex items-center gap-3 rounded-xl bg-surface2/60 p-3">
                {f[k] ? <img src={f[k]} alt="" className={clsx('shrink-0 object-cover object-top', k === 'logo' ? 'h-14 w-14 rounded-xl' : 'h-14 w-24 rounded-lg')} /> : <Avatar name={l} size={56} />}
                <label className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold"><ImagePlus size={16} aria-hidden />{f[k] ? `Change ${l.toLowerCase()}` : `Upload ${l.toLowerCase()}`}
                  <input type="file" accept="image/*" hidden onChange={upload(k)} /></label>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Dates" hint="Registration, auction and tournament window">
        <div className="grid gap-3 sm:grid-cols-2">
          {[['regStart', 'Registration opens'], ['regEnd', 'Registration closes'], ['auctionAt', 'Auction'], ['start', 'Tournament starts'], ['end', 'Tournament ends']].map(([k, l]) => (
            <Field key={k} label={l}><input type="datetime-local" value={f.dates?.[k] || ''} onChange={sub('dates', k)} /></Field>
          ))}
        </div>
      </Section>

      <Section title="Categories" hint={`${cats.length} categories · ${problems.length ? `${problems.length} problem${problems.length > 1 ? 's' : ''}` : 'OK'}`}>
        {locked && <p className="mb-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning" role="note">The auction has started, so category codes, prices, minimums, maximums and the active flag are locked. Names and descriptions can still be edited.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {cats.map((c, i) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <div className="grid grid-cols-[88px_1fr] gap-3">
                <Field label="Code"><input disabled={locked} value={c.code} onChange={(e) => setCat(i, 'code', e.target.value)} /></Field>
                <Field label="Name"><input value={c.name} onChange={(e) => setCat(i, 'name', e.target.value)} /></Field>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[['price', 'Price'], ['min', 'Min per team'], ['max', 'Max per team']].map(([k, l]) => (
                  <Field key={k} label={l}><input {...NUM} min="0" disabled={locked} value={c[k]} onChange={(e) => setCat(i, k, e.target.value)} /></Field>
                ))}
              </div>
              <Field className="mt-3" label="If unsold: base price goes up by" hint="0 = off. The player comes back at the end of this category's turn."><input {...NUM} min="0" value={c.unsoldBump ?? 0} onChange={(e) => setCat(i, 'unsoldBump', e.target.value)} /></Field>
              <div className="mt-2 flex items-center justify-between">
                <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={c.active !== false} onChange={(e) => setCat(i, 'active', e.target.checked)} />Active</label>
                <Button variant="ghost" size="md" icon={Trash2} className="!text-danger" disabled={locked} aria-label={`Remove category ${c.code}`} onClick={() => setF({ ...f, categories: cats.filter((_, j) => j !== i) })}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
        <Button variant="secondary" icon={Plus} className="mt-3" disabled={locked} onClick={() => setF({ ...f, categories: [...cats, { code: '', name: '', price: 0, min: 0, max: 0, active: true }] })}>Add category</Button>
        {problems.map((p) => <p key={p} className="mt-2 flex items-start gap-2 text-sm text-danger"><XCircle size={16} className="mt-0.5 shrink-0" aria-hidden />{p}</p>)}
        {!problems.length && <p className="mt-2 flex items-center gap-2 text-sm text-success"><Check size={16} aria-hidden />Category setup can fill a squad of {f.squadSize}</p>}
      </Section>

      <Section title="Points and ranking" hint="Win / draw / loss and tie-breaks">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {['win', 'draw', 'loss'].map((k) => <Field key={k} label={`Points for ${k}`}><input {...NUM} value={f.pointsRule?.[k]} onChange={sub('pointsRule', k)} /></Field>)}
        </div>
        <Field className="mt-3" label="Tie-break order" hint={`Comma separated: ${TIEBREAKS.join(', ')}`}><input value={f.tiebreak} onChange={set('tiebreak')} /></Field>
      </Section>

      <Section title="Auction" hint="Increment, timer and unsold handling">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bid increment"><input {...NUM} value={f.auction?.increment} onChange={sub('auction', 'increment')} /></Field>
          <Field label="Timer (sec)"><input {...NUM} value={f.auction?.timerSec} onChange={sub('auction', 'timerSec')} /></Field>
          <Field label="Extend if bid in last (sec)"><input {...NUM} value={f.auction?.extendWithinSec} onChange={sub('auction', 'extendWithinSec')} /></Field>
          <Field label="…extend timer to (sec)"><input {...NUM} value={f.auction?.extendToSec} onChange={sub('auction', 'extendToSec')} /></Field>
          <Field label="Unsold policy"><select value={f.auction?.unsoldPolicy} onChange={sub('auction', 'unsoldPolicy')}><option value="manual">manual</option><option value="return_to_pool">return to pool</option><option value="reduce_base">reduce base</option></select></Field>
          <Field label="Reduce base by %"><input {...NUM} value={f.auction?.unsoldReducePct} onChange={sub('auction', 'unsoldReducePct')} /></Field>
          <Field label="Who allocates the player" hint="Admin picks the team after bidding (bids only suggest), or the system sells to the top bidder."><select value={f.auction?.allocation || 'admin'} onChange={sub('auction', 'allocation')}><option value="admin">Admin decides</option><option value="auto">Automatic (top bidder)</option></select></Field>
          <Field label="Player selection" hint="Category order: D to A, each category fully sold before the next. Players inside a category come at random."><select value={f.auction?.selection} onChange={sub('auction', 'selection')}><option value="random">random (any category)</option><option value="category">auctioneer picks category</option><option value="sequence">category by category (in order)</option></select></Field>
          {f.auction?.selection === 'sequence' && <Field label="Category order" hint="Comma separated category codes, first to last"><input value={Array.isArray(f.auction?.categoryOrder) ? f.auction.categoryOrder.join(', ') : f.auction?.categoryOrder || ''} onChange={sub('auction', 'categoryOrder')} /></Field>}
        </div>
        <label className="mt-2 flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={!!f.auction?.autoClose} onChange={sub('auction', 'autoClose')} />Auto-close lot when timer ends</label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={!!f.auction?.publicPrices} onChange={sub('auction', 'publicPrices')} />Show prices and budgets publicly</label>
      </Section>

      <Section title="Rules" hint="Rules text and document link">
        <div className="grid gap-3">
          <Field label="Rules"><textarea rows={5} value={f.rules} onChange={set('rules')} /></Field>
          <Field label="Rules document URL"><input type="url" value={f.rulesDocUrl} onChange={set('rulesDocUrl')} /></Field>
        </div>
      </Section>

      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom)+12px)] z-20 mt-4 grad-border rounded-2xl p-3 shadow-card backdrop-blur md:bottom-4">
        <Msg {...msg} />
        <Button icon={Save} size="lg" className="w-full" onClick={save}>Save settings</Button>
      </div>
    </>
  );
}
