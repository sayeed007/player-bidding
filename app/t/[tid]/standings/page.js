'use client';
import Link from 'next/link';
import { use, useState } from 'react';
import clsx from 'clsx';
import { useApi } from '@/lib/client';
import { Button, Empty, PageHeader } from '@/components/ui';
import { TeamBadge } from '@/components/cards';
import { arr, Load } from '../ops';

const TB = { points: 'points', gd: 'goal difference', gf: 'goals for', h2h: 'head-to-head', fairplay: 'fair play' };
const EXTRA = ['W', 'D', 'L', 'GF', 'GA'];
const HIDDEN = ['GF', 'GA']; // W/D/L stay visible on phones; GF/GA behind the toggle

export default function Standings({ params }) {
  const { tid } = use(params);
  const r = useApi(`/api/t/${tid}/standings`, { poll: 30000 });
  const t = useApi(`/api/t/${tid}`).data;
  const [more, setMore] = useState(false);
  const tour = t?.tournament || t;
  const tb = (tour?.tiebreak || ['points', 'gd', 'gf']).map((k) => TB[k] || k).join(' > ');
  const q = tour?.qualifyCount ?? tour?.qualifiers; // optional qualification cut-off, highlighted if the API provides it
  const hide = (k) => (HIDDEN.includes(k) && !more ? 'hidden md:table-cell' : '');
  return (
    <>
      <PageHeader title="Standings" subtitle="League table · finalized results only" right={<Button variant="secondary" size="sm" className="md:hidden" aria-pressed={more} onClick={() => setMore(!more)}>{more ? 'Fewer columns' : 'More columns'}</Button>} />
      <Load r={r}>{(d) => {
        const rows = arr(d, 'rows');
        if (!rows.length) return <Empty>The table appears after the first result is finalized.</Empty>;
        return (
          <div className="grad-card overflow-x-auto rounded-2xl shadow-card">
            <table className="[&_td]:px-1.5 [&_td]:py-2.5 [&_th]:px-1.5 [&_td]:tabular-nums sm:[&_td]:px-2 sm:[&_th]:px-2">
              <caption className="sr-only">Tournament standings and team records</caption>
              <thead><tr>
                <th className="w-8 text-center">#</th><th>Team</th>
                {['P', ...EXTRA, 'GD', 'Pts'].map((h) => <th key={h} className={clsx('text-center', hide(h))}>{h}</th>)}
              </tr></thead>
              <tbody>{rows.map((x, i) => {
                const rank = x.rank ?? i + 1, lead = rank === 1 && x.P, qual = q && rank <= q;
                return (
                  <tr key={x.teamId} className={clsx(lead && 'bg-primary/10 font-semibold')}>
                    <td className={clsx('text-center font-display text-base text-muted', (lead || qual) && 'border-l-4', lead ? 'border-l-primary' : qual && 'border-l-primary')}>{rank}</td>
                    <td className="min-w-[110px]"><Link href={`/t/${tid}/teams/${x.teamId}`} className="text-fg no-underline hover:no-underline"><TeamBadge team={x} size={28} /></Link></td>
                    {['P', ...EXTRA, 'GD'].map((k) => <td key={k} className={clsx('text-center', hide(k))}>{x[k]}</td>)}
                    <td className={clsx('text-center font-display text-lg font-bold', lead && 'neon-text')}>{x.Pts}</td>
                  </tr>
                );
              })}</tbody>
            </table>
            <p className="m-0 border-t border-line p-3 text-xs leading-relaxed text-muted">{q ? 'Qualification places are highlighted. ' : ''}Final results only. Tie-break order: {tb}.{tour?.pointsRule && ` Win ${tour.pointsRule.win}, draw ${tour.pointsRule.draw}, loss ${tour.pointsRule.loss}.`}</p>
          </div>
        );
      }}</Load>
    </>
  );
}
