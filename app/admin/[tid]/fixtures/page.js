'use client';
import { use, useState } from 'react';
import { AlertTriangle, CalendarDays, MapPin, Plus, X } from 'lucide-react';
import { call, useApi } from '@/lib/client';
import { Badge, Button, Card, Empty, Field, Loading, Msg, PageHeader, Segmented, Sheet, StatusBadge, cx, dt, useFlash } from '@/components/ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FORMATS = { single: 'Single round-robin', double: 'Double round-robin', knockout: 'Knockout', group_knockout: 'Groups + knockout', league_playoff: 'League + playoffs' };
const STEPS = [{ value: 0, label: '1 Format' }, { value: 1, label: '2 Schedule' }, { value: 2, label: '3 Rules' }];

const Chip = ({ on, onClick, children }) => (
  <button type="button" aria-pressed={on} onClick={onClick}
    className={cx('!min-h-[44px] !rounded-full !px-4 border', on ? '!bg-primary !text-primary-fg border-primary' : '!bg-surface !text-fg border-line')}>{children}</button>
);

/** Editable list of chips (venues, dates, time slots). */
function ChipList({ items, onChange, type = 'text', placeholder }) {
  const [v, setV] = useState('');
  const add = () => { const x = v.trim(); if (x && !items.includes(x)) onChange([...items, x]); setV(''); };
  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((x) => (
            <span key={x} className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-surface2 pl-3 pr-1 text-sm tabular-nums">
              {x}
              <button type="button" aria-label={`Remove ${x}`} onClick={() => onChange(items.filter((y) => y !== x))} className="!min-h-[44px] !w-11 !rounded-full !bg-transparent !px-0 !text-muted"><X size={14} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input aria-label={placeholder || `Add ${type}`} className="min-w-0" type={type} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        <Button variant="secondary" icon={Plus} onClick={add} aria-label="Add" className="shrink-0" />
      </div>
    </div>
  );
}

function MatchCard({ m, bad, right }) {
  return (
    <li className={cx('rounded-xl border bg-surface p-3', bad ? 'border-warning bg-warning/10' : 'border-line')}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="font-medium uppercase">{m.stage}{m.group ? ` ${m.group}` : ''}</span>
        {bad && <AlertTriangle size={14} className="text-warning" aria-label="Has a problem" />}
        <span className="ml-auto">{right}</span>
      </div>
      <div className="mt-1 font-semibold">{m.homeName} <span className="font-normal text-muted">vs</span> {m.awayName}</div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1 tabular-nums"><CalendarDays size={13} aria-hidden />{m.start ? dt(m.start) : 'Unscheduled'}</span>
        {m.venue && <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden />{m.venue}</span>}
      </div>
    </li>
  );
}

const roundKey = (m) => `${m.stage}${m.group ? ' ' + m.group : ''} · ${m.label || 'R' + m.round}`;
function Rounds({ matches, renderRight, badIds }) {
  const groups = [];
  const idx = {};
  matches.forEach((m) => { const k = roundKey(m); if (!(k in idx)) { idx[k] = groups.length; groups.push([k, []]); } groups[idx[k]][1].push(m); });
  if (!groups.length) return <Empty>No matches.</Empty>;
  return (
    <div className="flex flex-col gap-4">
      {groups.map(([k, ms]) => (
        <section key={k}>
          <h3 className="mb-2 mt-0 text-sm font-semibold text-muted">{k}</h3>
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2">
            {ms.map((m, i) => <MatchCard key={m._id || i} m={m} bad={badIds?.has(m.key) || badIds?.has(m._id)} right={renderRight?.(m)} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function Fixtures({ params }) {
  const { tid } = use(params);
  const base = `/api/t/${tid}`;
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ format: 'single', startDate: '', days: [6, 0], dates: [], venues: ['Main Ground'], timeSlots: [], dayStart: '16:00', dayEnd: '20:00', matchDuration: 50, breakDuration: 10, maxMatchesPerTeamPerDay: 1, minRestMinutes: 60, groups: 2, advance: 2, playoffTeams: 4, double: false });
  const [prev, setPrev] = useState(null);
  const [replace, setReplace] = useState(false);
  const [ed, setEd] = useState(null);
  const [msg, flash] = useFlash();
  const { data, error, reload } = useApi(`${base}/matches?all=1`);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const num = (k, label, hint) => <Field label={label} hint={hint}><input type="number" inputMode="numeric" value={f[k]} onChange={set(k)} /></Field>;
  const params_ = () => ({
    format: f.format, startDate: f.startDate || undefined, matchDays: f.days, dates: f.dates, venues: f.venues, timeSlots: f.timeSlots,
    dayStart: f.dayStart, dayEnd: f.dayEnd, matchDuration: +f.matchDuration, breakDuration: +f.breakDuration,
    maxMatchesPerTeamPerDay: +f.maxMatchesPerTeamPerDay, minRestMinutes: +f.minRestMinutes, groups: +f.groups, advance: +f.advance, playoffTeams: +f.playoffTeams, double: f.double,
  });
  const preview = () => flash(async () => { const r = await call(`${base}/fixtures/generate`, params_()); setPrev(r); return r; }, (r) => `${r.count} matches, ${r.violations.length} problem(s)`);
  const save = (force) => flash(async () => { const r = await call(`${base}/fixtures/generate`, { ...params_(), save: true, replace, force }); setPrev(null); reload(); return r; }, (r) => `Saved ${r.count} draft matches`);
  const act = (fn, ok) => flash(async () => { const r = await fn(); reload(); return r; }, ok);
  const patch = (id, b) => act(() => call(`${base}/matches/${id}`, b, 'PATCH'), 'Updated');
  const saveEdit = () => patch(ed._id, { start: ed.start || null, venue: ed.venue, referee: ed.referee, reason: ed.reason, force: ed.force }).then(() => setEd(null));
  const postpone = () => patch(ed._id, { status: 'postponed', reason: ed.reason }).then(() => setEd(null));
  const cancel = () => confirm('Cancel this match?') && act(() => call(`${base}/matches/${ed._id}?reason=${encodeURIComponent(ed.reason || '')}`, undefined, 'DELETE'), 'Cancelled').then(() => setEd(null));

  const matches = data?.matches || [];
  const viol = prev?.violations || [];
  const badIds = new Set(viol.flatMap((v) => v.ids || []));
  const knock = ['group_knockout', 'league_playoff'].includes(f.format);

  return (
    <div className={cx('flex flex-col', prev && 'pb-24')}>
      <PageHeader title="Fixtures" subtitle="Generate, review and publish the match schedule" />
      <Msg {...msg} />
      <Card title="Generate fixtures" right={<Segmented value={step} onChange={setStep} options={STEPS} />}>
        <div className="flex flex-col gap-4">
          {step === 0 && <>
            <Field label="Format"><select value={f.format} onChange={set('format')}>{Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            {f.format === 'group_knockout' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{num('groups', 'Groups')}{num('advance', 'Advance per group')}</div>}
            {f.format === 'league_playoff' && num('playoffTeams', 'Playoff teams')}
            {knock && <label className="flex min-h-[44px] items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={f.double} onChange={set('double')} />Home and away legs in league/group stage</label>}
          </>}
          {step === 1 && <>
            <Field label="Start date"><input type="date" value={f.startDate} onChange={set('startDate')} /></Field>
            <Field label="Match days">
              <div className="flex flex-wrap gap-2">{DAYS.map((d, i) => (
                <Chip key={d} on={f.days.includes(i)} onClick={() => setF({ ...f, days: f.days.includes(i) ? f.days.filter((x) => x !== i) : [...f.days, i] })}>{d}</Chip>
              ))}</div>
            </Field>
            <Field label="Explicit dates" hint="Optional. Overrides the weekdays above."><ChipList type="date" items={f.dates} onChange={(dates) => setF({ ...f, dates })} /></Field>
            <Field label="Venues"><ChipList items={f.venues} onChange={(venues) => setF({ ...f, venues })} placeholder="Add a venue" /></Field>
            <Field label="Time slots" hint="Optional. Leave empty to derive from the window below."><ChipList type="time" items={f.timeSlots} onChange={(timeSlots) => setF({ ...f, timeSlots })} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Window start"><input type="time" value={f.dayStart} onChange={set('dayStart')} /></Field>
              <Field label="Window end"><input type="time" value={f.dayEnd} onChange={set('dayEnd')} /></Field>
            </div>
          </>}
          {step === 2 && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {num('matchDuration', 'Match duration (min)')}
            {num('breakDuration', 'Break (min)')}
            {num('maxMatchesPerTeamPerDay', 'Max matches per team per day')}
            {num('minRestMinutes', 'Min rest between matches (min)')}
          </div>}
          <div className="flex flex-wrap items-center gap-3">
            {step < 2 ? <Button variant="secondary" onClick={() => setStep(step + 1)}>Next</Button> : null}
            <Button onClick={preview}>Preview fixtures</Button>
            <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={replace} onChange={(e) => setReplace(e.target.checked)} />Replace existing fixtures</label>
          </div>
        </div>
      </Card>

      {prev && (
        <Card title={`Preview (${prev.count} matches)`} right={<Badge color={viol.length ? 'amber' : 'green'}>{viol.length ? `${viol.length} problem(s)` : 'No problems'}</Badge>}>
          {viol.length > 0 && (
            <ul role="alert" className="mb-4 flex list-none flex-col gap-1 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              {viol.map((v, i) => <li key={i} className="flex gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />{v.message}</li>)}
            </ul>
          )}
          <Rounds matches={prev.matches} badIds={badIds} />
        </Card>
      )}

      <Card title={`Tournament matches (${matches.length})`}
        right={<Button size="md" variant="secondary" onClick={() => confirm('Publish all draft matches and notify everyone?') && act(() => call(`${base}/fixtures/publish`, {}), (r) => `Published ${r.published}`)}>Publish fixtures</Button>}>
        {error ? <div role="alert" className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger"><span className="min-w-0 break-words">{error}</span><Button variant="secondary" onClick={reload}>Retry</Button></div> : !data ? <Loading /> : (
          <Rounds matches={matches} renderRight={(m) => (
            <span className="inline-flex flex-wrap items-center justify-end gap-2">
              <StatusBadge status={m.status} />{!m.published && <Badge>draft</Badge>}
              {m.resultState === 'final'
                ? <span className="font-semibold tabular-nums text-fg">{m.score.home}-{m.score.away}</span>
                : <Button size="md" variant="secondary" onClick={() => setEd({ _id: m._id, name: `${m.homeName} vs ${m.awayName}`, start: m.start || '', venue: m.venue || '', referee: m.referee || '', reason: '', force: false, status: m.status })}>Edit</Button>}
            </span>
          )} />
        )}
      </Card>

      {prev && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 p-3 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-6xl gap-2">
            <Button variant="secondary" onClick={() => setPrev(null)}>Discard</Button>
            {viol.length > 0 && <Button variant="danger" className="flex-1" onClick={() => confirm('Save despite problems?') && save(true)}>Save anyway</Button>}
            <Button className="flex-1" disabled={viol.length > 0} onClick={() => save(false)}>Save as draft</Button>
          </div>
        </div>
      )}

      <Sheet open={!!ed} onClose={() => setEd(null)} title="Edit / reschedule match">
        {ed && (
          <div className="flex flex-col gap-3">
            <Msg {...msg} />
            <p className="m-0 break-words font-semibold">{ed.name}</p>
            <Field label="Start"><input type="datetime-local" value={ed.start} onChange={(e) => setEd({ ...ed, start: e.target.value })} /></Field>
            <Field label="Venue"><input value={ed.venue} onChange={(e) => setEd({ ...ed, venue: e.target.value })} /></Field>
            <Field label="Referee"><input value={ed.referee} onChange={(e) => setEd({ ...ed, referee: e.target.value })} /></Field>
            <Field label="Reason" hint="Logged if the match is published."><input value={ed.reason} onChange={(e) => setEd({ ...ed, reason: e.target.value })} /></Field>
            <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={ed.force} onChange={(e) => setEd({ ...ed, force: e.target.checked })} />Save even if it conflicts</label>
            <Button onClick={saveEdit}>Save changes</Button>
            <div className="grid grid-cols-2 gap-2">
              {ed.status !== 'postponed' ? <Button variant="secondary" onClick={postpone}>Postpone</Button> : <span />}
              {ed.status !== 'cancelled' && <Button variant="danger" onClick={cancel}>Cancel match</Button>}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
