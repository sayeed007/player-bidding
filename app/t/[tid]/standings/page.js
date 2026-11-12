'use client';
import Link from 'next/link';
import { use, useState, Fragment } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useApi } from '@/lib/client';
import { Button, Empty, PageHeader } from '@/components/ui';
import { TeamBadge } from '@/components/cards';
import { arr, byId, Load, label } from '../ops';

const TB = { points: 'points', gd: 'goal difference', gf: 'goals for', h2h: 'head-to-head', fairplay: 'fair play' };
const EXTRA = ['W', 'D', 'L', 'GF', 'GA'];
const DISC = { CS: 'cleanSheets', YC: 'yellow', RC: 'red' }; // team discipline / clean sheets come from /stats
const HIDDEN = ['GF', 'GA', 'GD', ...Object.keys(DISC)]; // P/W/D/L/Pts stay visible on phones; the rest sit behind the toggle
const COLS = 2 + 1 + EXTRA.length + 1 + Object.keys(DISC).length + 1 + 1; // # team P W D L GF GA GD CS YC RC Pts history

const when = (s) => (s ? new Date(s).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const isFinal = (m) => m.resultState === 'final' && ['completed', 'forfeited'].includes(m.status);

/** One team's matches, oldest first, seen from that team's side. */
function historyOf(matches, id) {
  return matches
    .filter((m) => [m.homeTeamId, m.awayTeamId].map(String).includes(String(id)))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
    .map((m) => {
      const home = String(m.homeTeamId) === String(id);
      const gf = home ? m.score?.home : m.score?.away, ga = home ? m.score?.away : m.score?.home;
      const fin = isFinal(m);
      return { m, home, opp: (home ? m.awayName : m.homeName) || 'TBD', gf, ga, fin, res: fin ? (gf > ga ? 'W' : gf < ga ? 'L' : 'D') : null };
    });
}

const RES = { W: 'bg-success/20 text-success ring-1 ring-success/40', D: 'bg-warning/15 text-warning ring-1 ring-warning/40', L: 'bg-danger/20 text-danger ring-1 ring-danger/40' };

function History({ id, name, rows }) {
  const rec = { W: 0, D: 0, L: 0 };
  rows.forEach((h) => h.res && rec[h.res]++);
  return (
    <div id={`hist-${id}`} className="overflow-hidden p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 font-display text-base uppercase tracking-wide">Match history · {name}</h3>
        <span className="text-xs tabular-nums text-muted">W {rec.W} · D {rec.D} · L {rec.L}</span>
      </div>
      {!rows.length ? <p className="m-0 text-sm text-muted">No fixtures published for this team yet.</p> : (
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {rows.map(({ m, home, opp, gf, ga, fin, res }) => {
            const live = ['live', 'half_time'].includes(m.status);
            return (
              <li key={m._id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-surface2/50 px-3 py-2">
                <span aria-label={res ? { W: 'Win', D: 'Draw', L: 'Loss' }[res] : 'Not played'} className={clsx('grid h-9 w-9 place-items-center rounded-lg font-display text-lg font-bold', res ? RES[res] : 'bg-surface2 text-muted')}>{res || '–'}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{home ? 'vs' : '@'} {opp}</span>
                  <span className="block truncate text-xs text-muted">{[m.label || (m.round ? `${label(m.stage)} · round ${m.round}` : label(m.stage)), when(m.start), m.venue].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="text-right font-display text-xl font-bold tabular-nums">
                  {fin || live ? <>{gf ?? 0}<span className="mx-1 text-muted">–</span>{ga ?? 0}</> : <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label(m.status)}</span>}
                  {live && <span className="block text-[10px] uppercase tracking-wider text-accent">live</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Standings({ params }) {
  const { tid } = use(params);
  const r = useApi(`/api/t/${tid}/standings`, { poll: 30000 });
  const mt = arr(useApi(`/api/t/${tid}/matches`, { poll: 30000 }).data, 'matches');
  const ts = byId(arr(useApi(`/api/t/${tid}/stats`).data?.teams ?? null, 'teams'), 'teamId');
  const t = useApi(`/api/t/${tid}`).data;
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState({}); // teamId -> true: history is hidden until asked for
  const tour = t?.tournament || t;
  const tb = (tour?.tiebreak || ['points', 'gd', 'gf']).map((k) => TB[k] || k).join(' > ');
  const q = tour?.qualifyCount ?? tour?.qualifiers; // optional qualification cut-off, highlighted if the API provides it
  const hide = (k) => (HIDDEN.includes(k) && !more ? 'hidden md:table-cell' : '');
  const val = (x, k) => (DISC[k] ? ts[String(x.teamId)]?.[DISC[k]] ?? 0 : x[k]);
  const toggle = (id) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  return (
    <>
      <PageHeader title="Standings" subtitle="League table · tap a team's arrow for its match history"
        right={<div className="flex gap-2">
          <Button variant="secondary" size="sm" className="md:hidden" aria-pressed={more} onClick={() => setMore(!more)}>{more ? 'Fewer columns' : 'More columns'}</Button>
          <Button variant="secondary" size="sm" onClick={() => setOpen((o) => (Object.values(o).some(Boolean) ? {} : Object.fromEntries(arr(r.data, 'rows').map((x) => [x.teamId, true]))))}>
            {Object.values(open).some(Boolean) ? 'Hide all history' : 'Show all history'}</Button>
        </div>} />
      <Load r={r}>{(d) => {
        const rows = arr(d, 'rows');
        if (!rows.length) return <Empty>The table appears after the first result is finalized.</Empty>;
        return (
          <div className="grad-card overflow-x-auto rounded-2xl shadow-card">
            <table className="[&_td]:px-1 [&_td]:py-2.5 [&_th]:px-1 [&_td]:tabular-nums sm:[&_td]:px-2 sm:[&_th]:px-2">
              <caption className="sr-only">Tournament standings and team records</caption>
              <thead><tr>
                <th className="w-6 text-center sm:w-8">#</th><th>Team</th>
                {['P', ...EXTRA, 'GD', ...Object.keys(DISC), 'Pts'].map((h) => <th key={h} className={clsx('text-center', hide(h))}>{h}</th>)}
                <th className="w-9"><span className="sr-only">Match history</span></th>
              </tr></thead>
              <tbody>{rows.map((x, i) => {
                const rank = x.rank ?? i + 1, lead = rank === 1 && x.P, qual = q && rank <= q, isOpen = !!open[x.teamId];
                return (
                  <Fragment key={x.teamId}>
                    <tr className={clsx(lead && 'bg-primary/10 font-semibold')}>
                      <td className={clsx('text-center font-display text-base text-muted', (lead || qual) && 'border-l-4', lead ? 'border-l-primary' : qual && 'border-l-primary')}>{rank}</td>
                      <td className="max-w-[8rem] pr-2 sm:max-w-none"><Link href={`/t/${tid}/teams/${x.teamId}`} className="text-fg no-underline hover:no-underline"><TeamBadge team={x} size={28} /></Link></td>
                      {['P', ...EXTRA, 'GD', ...Object.keys(DISC)].map((k) => <td key={k} className={clsx('text-center', hide(k))}>{val(x, k)}</td>)}
                      <td className={clsx('text-center font-display text-lg font-bold', lead && 'neon-text')}>{x.Pts}</td>
                      <td className="text-center">
                        <button type="button" aria-expanded={isOpen} aria-controls={`hist-${x.teamId}`} aria-label={`${isOpen ? 'Hide' : 'Show'} match history for ${x.name}`}
                          onClick={() => toggle(x.teamId)} className="!min-h-[40px] !w-9 !rounded-lg !bg-transparent !p-0 !text-muted !shadow-none hover:!bg-surface2">
                          <ChevronDown size={18} aria-hidden className={clsx('transition-transform', isOpen && 'rotate-180 text-primary')} />
                        </button>
                      </td>
                    </tr>
                    {isOpen && <tr><td colSpan={COLS} className="!max-w-0 !p-0 bg-surface2/30"><History id={x.teamId} name={x.name} rows={historyOf(mt, x.teamId)} /></td></tr>}
                  </Fragment>
                );
              })}</tbody>
            </table>
            <p className="m-0 border-t border-line p-3 text-xs leading-relaxed text-muted">{q ? 'Qualification places are highlighted. ' : ''}Final results only. Tie-break order: {tb}.{tour?.pointsRule && ` Win ${tour.pointsRule.win}, draw ${tour.pointsRule.draw}, loss ${tour.pointsRule.loss}.`} CS = clean sheets, YC/RC = yellow/red cards.</p>
          </div>
        );
      }}</Load>
    </>
  );
}
