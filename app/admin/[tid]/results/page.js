'use client';
import { use, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, CircleDot, Footprints, Square, Target, Trash2, Undo2 } from 'lucide-react';
import { call, useApi } from '@/lib/client';
import { Badge, Button, Card, Empty, Field, Loading, Msg, PageHeader, Segmented, Sheet, StatusBadge, cx, dt, useFlash } from '@/components/ui';
import { PlayerCard, TeamBadge } from '@/components/cards';

const LIVE = ['upcoming', 'live', 'half_time', 'completed', 'forfeited'];
const TABS = [{ value: 'upcoming', label: 'Upcoming' }, { value: 'live', label: 'Live' }, { value: 'toFinalize', label: 'Needs approval' }, { value: 'final', label: 'Completed' }];
const FILTERS = {
  upcoming: (m) => ['scheduled', 'upcoming'].includes(m.status), live: (m) => ['live', 'half_time'].includes(m.status),
  toFinalize: (m) => ['completed', 'forfeited'].includes(m.status) && m.resultState !== 'final', final: (m) => m.resultState === 'final',
};
const QUICK = [
  { type: 'goal', label: 'Goal', icon: Target, tone: 'bg-success text-white' },
  { type: 'assist', label: 'Assist', icon: Footprints },
  { type: 'yellow', label: 'Yellow', icon: Square, tone: 'bg-amber-400 text-black', fill: true },
  { type: 'red', label: 'Red', icon: Square, tone: 'bg-danger text-white', fill: true },
  { type: 'sub', label: 'Sub', icon: ArrowLeftRight },
  { type: 'own_goal', label: 'Own goal', icon: Undo2 },
  { type: 'penalty_goal', label: 'Penalty', icon: CircleDot },
];
const LABEL = Object.fromEntries(QUICK.map((q) => [q.type, q.label]));
const score = (m) => (m.resultState !== 'open' || m.events.length ? `${m.score.home}-${m.score.away}` : 'vs');
const teamOf = (m, id) => ({ name: String(id) === String(m.homeTeamId) ? m.homeName : m.awayName });

export default function Results({ params }) {
  const { tid } = use(params);
  const base = `/api/t/${tid}`;
  const [tab, setTab] = useState('upcoming');
  const [mid, setMid] = useState(null);
  const [msg, flash] = useFlash();
  const { data, error, reload } = useApi(`${base}/matches?all=1`);
  const matches = (data?.matches || []).filter(FILTERS[tab]);
  const counts = (k) => (data?.matches || []).filter(FILTERS[k]).length;

  if (mid) return (
    <div className="flex flex-col">
      <Msg {...msg} />
      <MatchPanel key={mid} base={base} mid={mid} flash={flash} onChange={reload} close={() => setMid(null)} />
    </div>
  );
  return (
    <div className="flex flex-col">
      <PageHeader title="Results" subtitle="Score matches live, approve results and give awards" />
      <Msg {...msg} />
      <Segmented value={tab} onChange={setTab} options={TABS.map((t) => ({ ...t, label: `${t.label} (${counts(t.value)})` }))} className="mb-3 self-start" />
      {error ? <div role="alert" className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger"><span className="min-w-0 break-words">{error}</span><Button variant="secondary" onClick={reload}>Retry</Button></div> : !data ? <Loading /> : !matches.length ? <Empty>No matches here.</Empty> : (
        <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2">
          {matches.map((m) => (
            <li key={m._id}>
              <button disabled={!m.homeTeamId || !m.awayTeamId} onClick={() => setMid(m._id)}
                className="!flex !h-auto w-full !flex-col !items-stretch !justify-start gap-2 !rounded-2xl border border-line !bg-surface !p-3 !text-left !font-normal !text-fg">
                <span className="flex items-center gap-2 text-xs text-muted"><span>{m.label}</span><span className="ml-auto"><StatusBadge status={m.status} /></span></span>
                <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  <TeamBadge team={{ name: m.homeName }} />
                  <span className="font-display text-xl font-bold tabular-nums">{score(m)}</span>
                  <TeamBadge team={{ name: m.awayName }} className="justify-end" />
                </span>
                <span className="text-xs tabular-nums text-muted">{dt(m.start)}{m.venue ? ` · ${m.venue}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Awards base={base} flash={flash} />
    </div>
  );
}

function MatchPanel({ base, mid, flash, onChange, close }) {
  const { data, error, reload } = useApi(`${base}/matches/${mid}`);
  const [sheet, setSheet] = useState(null); // { type, playerId, assistPlayerId, inPlayerId, minute, period }
  const [reason, setReason] = useState('');
  const [fscore, setFscore] = useState({ home: 3, away: 0 });
  const [winner, setWinner] = useState('');
  const [potm, setPotm] = useState('');
  if (!data) return <div className="grid gap-3"><Button variant="secondary" icon={ArrowLeft} className="justify-self-start" onClick={close}>All matches</Button>{error ? <div role="alert" className="my-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger"><span className="min-w-0 break-words">{error}</span><Button variant="secondary" onClick={reload}>Retry</Button></div> : <Loading />}</div>;
  const { match: m, squads } = data;
  const all = [...squads.home.map((p) => ({ ...p, side: m.homeName })), ...squads.away.map((p) => ({ ...p, side: m.awayName }))];
  const byId = (id) => all.find((x) => x._id === id);
  const final = m.resultState === 'final';
  const mate = (pid) => all.filter((p) => String(p.teamId) === String(byId(pid)?.teamId) && p._id !== pid);
  const run = (fn, ok) => flash(async () => { const r = await fn(); reload(); onChange(); return r; }, ok);
  const u = `${base}/matches/${mid}`;
  const strip = (e) => ({ type: e.type, minute: e.minute, period: e.period, playerId: e.playerId, assistPlayerId: e.assistPlayerId, inPlayerId: e.inPlayerId });
  const needReason = () => { if (reason.trim().length < 3) { flash(async () => { throw new Error('Enter a correction reason first'); }); return false; } return true; };
  const add = (ev) => {
    if (final) { if (!needReason()) return; return run(() => call(`${u}/correct`, { reason, events: [...m.events.map(strip), ev] }), 'Corrected'); }
    return run(() => call(`${u}/events`, ev), 'Event added');
  };
  const remove = (e) => {
    if (final) { if (!needReason()) return; return run(() => call(`${u}/correct`, { reason, events: m.events.filter((x) => x.id !== e.id).map(strip) }), 'Corrected'); }
    return run(() => call(`${u}/events/${e.id}`, undefined, 'DELETE'), 'Removed');
  };
  const submitEvent = () => { add(sheet); setSheet(null); };
  const open = (type) => setSheet({ type, playerId: '', assistPlayerId: '', inPlayerId: '', minute: '', period: m.status === 'half_time' ? '2H' : '1H' });

  // sheet step: player -> (assist | in) -> details
  const needsSecond = sheet && (['goal', 'penalty_goal'].includes(sheet.type) || sheet.type === 'sub');
  const secondKey = sheet?.type === 'sub' ? 'inPlayerId' : 'assistPlayerId';
  const stepName = !sheet ? '' : !sheet.playerId ? 'player' : needsSecond && !sheet.second ? 'second' : 'details';
  const pickRows = (list, onPick, skip) => (
    <div className="flex flex-col gap-2">
      {skip}
      {list.map((p) => (
        <button key={p._id} onClick={() => onPick(p._id)} className="!block !h-auto w-full !rounded-xl !bg-transparent !p-0 text-left !font-normal">
          <PlayerCard player={p} team={{ name: p.side || teamOf(m, p.teamId).name }} />
        </button>
      ))}
    </div>
  );
  const sheetTitle = !sheet ? '' : stepName === 'player' ? `${LABEL[sheet.type]}: who?` : stepName === 'second' ? (sheet.type === 'sub' ? 'Who comes on?' : 'Assist (optional)') : `Confirm ${LABEL[sheet.type].toLowerCase()}`;

  return (
    <div className={cx('flex flex-col', !final && 'pb-24')}>
      <button onClick={close} className="sec !min-h-[44px] self-start"><ArrowLeft size={18} aria-hidden />All matches</button>

      <section className="my-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{m.label} · {dt(m.start)} · {m.venue || 'no venue'}</span>
          <span className="ml-auto flex gap-1"><StatusBadge status={m.status} /><StatusBadge status={m.resultState} /></span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <div className="flex min-w-0 flex-col items-center gap-1 text-center"><TeamBadge team={{ name: m.homeName }} size={44} className="!flex-col" nameClass="text-sm" /></div>
          <div className="font-display text-3xl font-extrabold sm:text-5xl tabular-nums md:text-6xl" aria-label={`Score ${m.score.home} to ${m.score.away}`}>{m.score.home}<span className="px-1 text-muted">-</span>{m.score.away}</div>
          <div className="flex min-w-0 flex-col items-center gap-1 text-center"><TeamBadge team={{ name: m.awayName }} size={44} className="!flex-col" nameClass="text-sm" /></div>
        </div>
      </section>

      {final ? (
        <Card title="Correct a final result">
          <p className="mt-0 text-sm text-muted">Result is final. Any change is a correction, audited, and teams are notified.</p>
          <div className="flex flex-col gap-3">
            <Field label="Correction reason (required)"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            <Field label="Player of the match">
              <select value={m.potmPlayerId || ''} onChange={(e) => needReason() && run(() => call(`${u}/correct`, { reason, potmPlayerId: e.target.value || null }), 'Corrected')}>
                <option value="">- none -</option>{all.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.side})</option>)}
              </select>
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <input type="number" inputMode="numeric" aria-label="Home forfeit score" className="!w-20" value={fscore.home} onChange={(e) => setFscore({ ...fscore, home: +e.target.value })} />-
              <input type="number" inputMode="numeric" aria-label="Away forfeit score" className="!w-20" value={fscore.away} onChange={(e) => setFscore({ ...fscore, away: +e.target.value })} />
              <Button variant="secondary" onClick={() => needReason() && run(() => call(`${u}/correct`, { reason, status: 'forfeited', score: fscore }), 'Corrected')}>Convert to forfeit</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card title="Match status">
          <div className="flex flex-wrap gap-2">
            {LIVE.map((s) => (
              <button key={s} disabled={m.status === s} aria-pressed={m.status === s} onClick={() => run(() => call(u, { status: s }, 'PATCH'), `Status: ${s}`)}
                className={cx('!min-h-[44px] border capitalize', m.status === s ? '!bg-primary !text-primary-fg border-primary !opacity-100' : '!bg-surface !text-fg border-line')}>{s.replace('_', ' ')}</button>
            ))}
          </div>
        </Card>
      )}

      <Card title="Add event">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {QUICK.map((q) => (
            <button key={q.type} onClick={() => open(q.type)}
              className={cx('!min-h-[64px] !flex-col !gap-1 !rounded-xl !text-sm', q.tone || '!bg-surface2 !text-fg')}>
              <q.icon size={20} aria-hidden fill={q.fill ? 'currentColor' : 'none'} />{q.label}
            </button>
          ))}
        </div>
      </Card>

      <Card title={`Timeline (${m.events.length})`}>
        {!m.events.length ? <Empty>No events yet.</Empty> : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {m.events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <span className="w-12 shrink-0 font-display font-bold tabular-nums">{e.minute}&apos;<span className="block text-xs font-normal text-muted">{e.period}</span></span>
                <span className="min-w-0 flex-1 text-sm">
                  <Badge color={['red', 'own_goal'].includes(e.type) ? 'red' : e.type === 'yellow' ? 'amber' : ['goal', 'penalty_goal'].includes(e.type) ? 'green' : 'neutral'}>{LABEL[e.type] || e.type}</Badge>
                  <span className="mt-1 block truncate font-semibold">{e.playerName}</span>
                  {(e.assistName || e.inName) && <span className="block truncate text-xs text-muted">{e.assistName ? `Assist: ${e.assistName}` : `On: ${e.inName}`}</span>}
                </span>
                <button aria-label="Delete event" onClick={() => confirm('Delete this event?') && remove(e)} className="sec !min-h-[44px] !w-11 !px-0 text-danger"><Trash2 size={18} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!final && (
        <Card title="Finish match">
          <div className="flex flex-col gap-3">
            {m.status === 'forfeited' && (
              <div className="flex items-center gap-2">
                <input type="number" inputMode="numeric" aria-label="Home score" className="!w-20" value={fscore.home} onChange={(e) => setFscore({ ...fscore, home: +e.target.value })} />-
                <input type="number" inputMode="numeric" aria-label="Away score" className="!w-20" value={fscore.away} onChange={(e) => setFscore({ ...fscore, away: +e.target.value })} />
              </div>
            )}
            {['knockout', 'playoff'].includes(m.stage) && (
              <Field label="Winner if drawn (penalties)"><select value={winner} onChange={(e) => setWinner(e.target.value)}><option value="">- none -</option><option value={m.homeTeamId}>{m.homeName}</option><option value={m.awayTeamId}>{m.awayName}</option></select></Field>
            )}
            <Field label="Player of the match"><select value={potm} onChange={(e) => setPotm(e.target.value)}><option value="">- none -</option>{all.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.side})</option>)}</select></Field>
          </div>
        </Card>
      )}

      {m.history?.length > 0 && (
        <Card title="History">
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-muted">{m.history.map((h, i) => <li key={i}>{dt(h.at)} · {h.by} · {h.reason}</li>)}</ul>
        </Card>
      )}

      {!final && (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 p-3 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-6xl gap-2">
            <Button variant="secondary" className="flex-1" disabled={m.resultState !== 'open'} onClick={() => run(() => call(`${u}/submit`, {}), 'Submitted')}>Submit result</Button>
            <Button variant="success" className="flex-1" onClick={() => confirm('Finalize? Standings and stats update immediately.') && run(() => call(`${u}/finalize`, { score: m.status === 'forfeited' ? fscore : undefined, winnerTeamId: winner || undefined, potmPlayerId: potm || undefined }), 'Finalized')}>Finalize</Button>
          </div>
        </div>
      )}

      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheetTitle}>
        {sheet && stepName === 'player' && pickRows(all, (id) => setSheet({ ...sheet, playerId: id }))}
        {sheet && stepName === 'second' && pickRows(mate(sheet.playerId), (id) => setSheet({ ...sheet, [secondKey]: id, second: true }),
          sheet.type !== 'sub' && <Button variant="secondary" onClick={() => setSheet({ ...sheet, second: true })}>No assist</Button>)}
        {sheet && stepName === 'details' && (
          <div className="flex flex-col gap-3">
            <Msg {...msg} />
            <PlayerCard player={byId(sheet.playerId)} team={{ name: byId(sheet.playerId)?.side }} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Minute"><input type="number" inputMode="numeric" autoFocus value={sheet.minute} onChange={(e) => setSheet({ ...sheet, minute: e.target.value })} /></Field>
              <Field label="Period"><select value={sheet.period} onChange={(e) => setSheet({ ...sheet, period: e.target.value })}>{['1H', '2H', 'ET', 'PEN'].map((p) => <option key={p}>{p}</option>)}</select></Field>
            </div>
            <Button size="lg" onClick={submitEvent}>Add {LABEL[sheet.type].toLowerCase()}</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

const AWARDS = [['golden_boot', 'Golden Boot'], ['best_goalkeeper', 'Best Goalkeeper'], ['mvp', 'Tournament MVP']];

function Awards({ base, flash }) {
  const { data, reload } = useApi(`${base}/leaderboards`);
  const stats = useApi(`${base}/stats`).data;
  const [note, setNote] = useState({});
  if (!data) return null;
  const put = (b, ok) => flash(async () => { const r = await call(`${base}/awards`, b, 'PUT'); reload(); return r; }, ok);
  return (
    <>
      <h2>Awards</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {AWARDS.map(([type, label]) => {
          const cur = data.awards.find((a) => a.type === type), sug = data.suggestions?.[type];
          return (
            <Card key={type} title={label} className="!my-0">
              <div className="flex flex-col gap-3">
                <select aria-label={`${label} winner`} value={cur?.playerId || ''} onChange={(e) => put({ type, playerId: e.target.value || null, note: note[type] }, 'Saved')}>
                  <option value="">- none -</option>
                  {(stats?.players || []).map((p) => <option key={p.playerId} value={p.playerId}>{p.name} ({p.teamName})</option>)}
                </select>
                <input aria-label={`${label} note`} placeholder="Note" value={note[type] ?? cur?.note ?? ''} onChange={(e) => setNote({ ...note, [type]: e.target.value })} />
                {sug && <Button variant="secondary" size="md" onClick={() => put({ type, auto: true, note: note[type] }, 'Saved')}>Use suggestion: {sug.name}</Button>}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
