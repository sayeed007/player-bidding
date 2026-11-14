'use client';
import { use, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, MapPin, Plus, Sparkles, X } from 'lucide-react';
import { call, useApi } from '@/lib/client';
import { dayLabel, groupMatches } from '@/lib/fixtures-view';
import { isPlayedMatch, slotsPerDay } from '@/lib/fixtures';
import { Badge, Button, Card, Empty, Field, Loading, Msg, PageHeader, Segmented, Sheet, StatusBadge, cx, dt, useFlash } from '@/components/ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FORMATS = { single: 'Single round-robin', double: 'Double round-robin', knockout: 'Knockout', group_knockout: 'Groups + knockout', league_playoff: 'League + playoffs' };
const STEPS = [{ value: 0, label: '1 Format' }, { value: 1, label: '2 Schedule' }, { value: 2, label: '3 Rules' }];

const Chip = ({ on, onClick, children }) => (
  <button type="button" aria-pressed={on} onClick={onClick}
    className={cx('!min-h-[44px] !rounded-full !px-4 border', on ? '!bg-primary !text-primary-fg border-primary glow-primary' : '!bg-surface !text-fg border-line')}>{children}</button>
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

function MatchCard({ m, bad, right, showRound }) {
  return (
    <li className={cx('grad-card rounded-2xl p-3', bad && '!border-accent glow-accent')}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="rounded-md bg-violet/20 px-2 py-0.5 font-display font-semibold uppercase tracking-wider text-violet">{m.stage}{m.group ? ` ${m.group}` : ''}{showRound ? ` · ${m.label || `R${m.round}`}` : ''}</span>
        {bad && <AlertTriangle size={14} className="text-accent" aria-label="Has a problem" />}
        <span className="ml-auto">{right}</span>
      </div>
      <div className="mt-2 font-display text-lg font-semibold uppercase leading-tight tracking-wide">{m.homeName} <span className="neon-text-accent px-1 text-sm">vs</span> {m.awayName}</div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1 tabular-nums"><CalendarDays size={13} aria-hidden className="text-cyan" />{m.start ? dt(m.start) : 'Unscheduled'}</span>
        {m.venue && <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden className="text-cyan" />{m.venue}</span>}
      </div>
    </li>
  );
}

/** Matches grouped by calendar day (by="date") or by round (by="round"). Always date/time-ordered inside a group, so an edited match moves itself. */
function Rounds({ matches, renderRight, badIds, by = 'round' }) {
  const groups = groupMatches(matches, by);
  if (!groups.length) return <Empty>No matches.</Empty>;
  return (
    <div className="flex flex-col gap-4">
      {groups.map(([k, ms]) => (
        <section key={k || 'none'}>
          <h3 className="mb-2 mt-0 flex items-baseline gap-2 font-display text-sm font-semibold uppercase tracking-widest text-cyan">
            {by === 'date' ? dayLabel(k) : k}<span className="text-xs font-medium normal-case tracking-normal text-muted">{ms.length} {ms.length === 1 ? 'match' : 'matches'}</span>
          </h3>
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2">
            {ms.map((m, i) => <MatchCard key={m._id || i} m={m} showRound={by === 'date'} bad={badIds?.has(m.key) || badIds?.has(m._id)} right={renderRight?.(m)} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Capacity({ f, perDay, total }) {
  const days = total && perDay ? Math.ceil(total / perDay) : null;
  return (
    <p role="status" className={cx('m-0 rounded-xl px-3 py-2 text-sm', perDay ? 'bg-surface2/60 text-muted' : 'bg-danger/10 text-danger')}>
      {perDay
        ? <>With {f.matchDuration}-minute matches this fits <b className="text-fg">{perDay}</b> match{perDay === 1 ? '' : 'es'} per day{f.venues.filter(Boolean).length > 1 ? ` across ${f.venues.filter(Boolean).length} venues` : ''}{days ? <>, so {total} matches need about <b className="text-fg">{days}</b> match day{days === 1 ? '' : 's'}</> : ''}.</>
        : <>A {f.matchDuration}-minute match does not fit between {f.dayStart} and {f.dayEnd}.</>}
    </p>
  );
}

export default function Fixtures({ params }) {
  const { tid } = use(params);
  const [gen, setGen] = useState(false); // the generator lives in a popup so this page stays a simple list
  const [view, setView] = useState('date'); // saved list: group by day (default) or by round
  const base = `/api/t/${tid}`;
  const [step, setStep] = useState(0);
  const { data, error, reload } = useApi(`${base}/matches?all=1`);
  const matches = data?.matches || [];
  const [f, setF] = useState({ format: 'single', startDate: '', days: [6, 0], dates: [], venues: ['Main Ground'], timeSlots: [], dayStart: '16:00', dayEnd: '20:00', matchDuration: 50, breakDuration: 10, maxMatchesPerTeamPerDay: 1, minRestMinutes: 60, groups: 2, advance: 2, playoffTeams: 4, double: false });
  const [prev, setPrev] = useState(null);
  const [replace, setReplace] = useState(false);
  const [ed, setEd] = useState(null);
  const [msg, flash] = useFlash();
  const [gmsg, gflash] = useFlash(); // generate/save messages: shown beside the buttons, where you are looking
  const [tried, setTried] = useState(false);
  const startRef = useRef(null), errRef = useRef(null);
  const teamCount = (useApi(`${base}/teams`).data?.teams || []).length;
  useEffect(() => { if (gmsg.err) errRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [gmsg]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const num = (k, label, hint) => <Field label={label} hint={hint}><input type="number" inputMode="numeric" value={f[k]} onChange={set(k)} /></Field>;
  const params_ = () => ({
    format: f.format, startDate: f.startDate || undefined, matchDays: f.days, dates: f.dates, venues: f.venues, timeSlots: f.timeSlots,
    dayStart: f.dayStart, dayEnd: f.dayEnd, matchDuration: +f.matchDuration, breakDuration: +f.breakDuration,
    maxMatchesPerTeamPerDay: +f.maxMatchesPerTeamPerDay, minRestMinutes: +f.minRestMinutes, groups: +f.groups, advance: +f.advance, playoffTeams: +f.playoffTeams, double: f.double,
  });
  // Problems are computed live once you have tried, so they disappear the moment you fix them.
  const perDay = slotsPerDay(params_());
  const total = f.format === 'single' ? (teamCount * (teamCount - 1)) / 2 : f.format === 'double' ? teamCount * (teamCount - 1) : null;
  const errs = !tried ? {} : {
    startDate: !f.startDate && !f.dates.length ? 'Pick a start date (or add explicit dates) so the matches can be placed.' : '',
    window: !perDay ? `A ${f.matchDuration}-minute match does not fit between ${f.dayStart} and ${f.dayEnd}. Widen the window or shorten the match.` : '',
  };
  const validate = () => {
    setTried(true);
    const bad = (!f.startDate && !f.dates.length) || !slotsPerDay(params_());
    if (bad) { setStep(1); setTimeout(() => (startRef.current && !f.startDate && !f.dates.length ? startRef.current : errRef.current)?.focus?.(), 60); }
    return !bad;
  };
  const played = matches.filter(isPlayedMatch).length, replaceable = matches.length - played;
  const send = (extra) => call(`${base}/fixtures/generate`, { ...params_(), keepPlayed: true, ...extra });
  const preview = () => { if (validate()) gflash(async () => { const r = await send(); setPrev(r); return r; }, (r) => `${r.count} matches to schedule${r.kept ? `, ${r.kept} played kept` : ''}, ${r.violations.length} problem(s)`); };
  const save = (force) => {
    if (!validate()) return;
    if (replaceable && !replace) return gflash(async () => { throw new Error(`Tick "Replace the ${replaceable} unplayed fixture${replaceable === 1 ? '' : 's'}" first, then save.`); });
    gflash(async () => { const r = await send({ save: true, replace, force }); setPrev(null); setGen(false); reload(); return r; },
      (r) => `Saved ${r.count} draft matches${r.kept ? ` (${r.kept} played kept)` : ''}. Publish fixtures to make them visible.`);
  };
  const act = (fn, ok) => flash(async () => { const r = await fn(); reload(); return r; }, ok);
  const patch = (id, b) => act(() => call(`${base}/matches/${id}`, b, 'PATCH'), 'Updated');
  const saveEdit = () => patch(ed._id, { start: ed.start || null, venue: ed.venue, referee: ed.referee, reason: ed.reason, force: ed.force }).then(() => setEd(null));
  const postpone = () => patch(ed._id, { status: 'postponed', reason: ed.reason }).then(() => setEd(null));
  const cancel = () => confirm('Cancel this match?') && act(() => call(`${base}/matches/${ed._id}?reason=${encodeURIComponent(ed.reason || '')}`, undefined, 'DELETE'), 'Cancelled').then(() => setEd(null));

  const viol = prev?.violations || [];
  const badIds = new Set(viol.flatMap((v) => v.ids || []));
  const knock = ['group_knockout', 'league_playoff'].includes(f.format);

  return (
    <div className="flex flex-col">
      <PageHeader title="Fixtures" subtitle="Generate, review and publish the match schedule" right={<Button icon={Sparkles} onClick={() => setGen(true)}>Generate fixtures</Button>} />
      <Msg {...msg} />
      {!gen && <Msg {...gmsg} />}
      <Card title={`Tournament matches (${matches.length})`}
        right={<div className="flex flex-wrap items-center gap-2"><Segmented value={view} onChange={setView} options={[{ value: 'date', label: 'By date' }, { value: 'round', label: 'By round' }]} /><Button size="md" variant="secondary" onClick={() => confirm('Publish all draft matches and notify everyone?') && act(() => call(`${base}/fixtures/publish`, {}), (r) => `Published ${r.published}`)}>Publish fixtures</Button></div>}>
        {error ? <div role="alert" className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger"><span className="min-w-0 break-words">{error}</span><Button variant="secondary" onClick={reload}>Retry</Button></div> : !data ? <Loading /> : (
          <Rounds matches={matches} by={view} renderRight={(m) => (
            <span className="inline-flex flex-wrap items-center justify-end gap-2">
              <StatusBadge status={m.status} />{!m.published && <Badge>draft</Badge>}
              {m.resultState === 'final'
                ? <span className="font-display text-xl font-bold tabular-nums text-fg">{m.score.home}-{m.score.away}</span>
                : <Button size="md" variant="secondary" onClick={() => setEd({ _id: m._id, name: `${m.homeName} vs ${m.awayName}`, start: m.start || '', venue: m.venue || '', referee: m.referee || '', reason: '', force: false, status: m.status })}>Edit</Button>}
            </span>
          )} />
        )}
      </Card>

      <Sheet open={gen} onClose={() => setGen(false)} title="Generate fixtures" wide>
      <ol aria-label="Progress" className="m-0 mb-3 flex list-none gap-2 p-0">
        {STEPS.map((s) => (
          <li key={s.value} className={cx('h-1.5 flex-1 rounded-full transition', s.value <= step ? 'grad-volt glow-primary' : 'bg-surface2')} aria-current={s.value === step ? 'step' : undefined}><span className="sr-only">{s.label}</span></li>
        ))}
      </ol>
      <div className="mb-3"><Segmented value={step} onChange={setStep} options={STEPS} /></div>
        <div className="flex flex-col gap-4">
          {matches.length > 0 && (
            <p role="note" className="m-0 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
              <b>{matches.length} fixtures already exist</b>{played ? ` — ${played} played (kept as they are)` : ''}{replaceable ? `, ${replaceable} unplayed (replaced when you save)` : ''}.
              {played > 0 && ' Played matches are never deleted; only the rest is re-scheduled with the settings below.'}
            </p>
          )}
          {step === 0 && <>
            <Field label="Format"><select value={f.format} onChange={set('format')}>{Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            {f.format === 'group_knockout' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{num('groups', 'Groups')}{num('advance', 'Advance per group')}</div>}
            {f.format === 'league_playoff' && num('playoffTeams', 'Playoff teams')}
            {knock && <label className="flex min-h-[44px] items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={f.double} onChange={set('double')} />Home and away legs in league/group stage</label>}
          </>}
          {step === 1 && <>
            <Field label="Start date (required)" hint="Not needed if you add explicit dates below." error={errs.startDate}><input ref={startRef} type="date" aria-invalid={!!errs.startDate} className={errs.startDate ? '!border-danger' : ''} value={f.startDate} onChange={set('startDate')} /></Field>
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
              <Field label="Window end" error={errs.window}><input type="time" aria-invalid={!!errs.window} className={errs.window ? '!border-danger' : ''} value={f.dayEnd} onChange={set('dayEnd')} /></Field>
            </div>
            <Capacity f={f} perDay={perDay} total={total} />
          </>}
          {step === 2 && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {num('matchDuration', 'Match duration (min)')}
            {num('breakDuration', 'Break (min)')}
            {num('maxMatchesPerTeamPerDay', 'Max matches per team per day')}
            {num('minRestMinutes', 'Min rest between matches (min)')}
            <div className="sm:col-span-2"><Capacity f={f} perDay={perDay} total={total} /></div>
          </div>}
          <div className="flex flex-wrap items-center gap-3">
            {step < 2 ? <Button variant="secondary" onClick={() => setStep(step + 1)}>Next</Button> : null}
            <Button onClick={preview}>Preview fixtures</Button>
            {replaceable > 0 && <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={replace} onChange={(e) => setReplace(e.target.checked)} />Replace the {replaceable} unplayed fixture{replaceable === 1 ? '' : 's'}</label>}
          </div>
          <div ref={errRef} tabIndex={-1} className="outline-none"><Msg {...gmsg} /></div>
        </div>
      {prev && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="m-0 min-w-0 flex-1 font-display text-base uppercase tracking-wide">Preview ({prev.count} matches{prev.kept ? `, ${prev.kept} played kept` : ''})</h3>
            <Segmented value={view} onChange={setView} options={[{ value: 'date', label: 'By date' }, { value: 'round', label: 'By round' }]} />
            <Badge color={viol.length ? 'amber' : 'green'}>{viol.length ? `${viol.length} problem(s)` : 'No problems'}</Badge>
          </div>
          {viol.length > 0 && (
            <ul role="alert" className="mb-4 flex list-none flex-col gap-1 rounded-xl border border-accent/50 bg-accent/10 p-3 text-sm text-warning shadow-[0_0_24px_-8px_rgb(var(--accent)/.7)]">
              {viol.map((v, i) => <li key={i} className="flex gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />{v.message}</li>)}
            </ul>
          )}
          <Rounds matches={prev.matches} by={view} badIds={badIds} />
          <div className="sticky bottom-0 -mx-4 mt-4 border-t border-primary/40 bg-surface/95 p-3 backdrop-blur">
            {gmsg.err && <p role="alert" className="mb-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{gmsg.err}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPrev(null)}>Discard</Button>
              {viol.length > 0 && <Button variant="danger" className="flex-1" onClick={() => confirm('Save despite problems?') && save(true)}>Save anyway</Button>}
              <Button className="flex-1" disabled={viol.length > 0} onClick={() => save(false)}>Save as draft</Button>
            </div>
          </div>
        </div>
      )}
      </Sheet>

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
