'use client';
import Link from 'next/link';
import { use, useState } from 'react';
import clsx from 'clsx';
import { ArrowLeft, Check } from 'lucide-react';
import { call, useApi, useMe } from '@/lib/client';
import { Empty, Loading, Msg, PageHeader, useFlash } from '@/components/ui';
import Builder from './Builder';

const day = (s) => (s ? new Date(s).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) : '');

export default function Lineup({ params }) {
  const { tid } = use(params);
  const me = useMe();
  const list = useApi(`/api/t/${tid}/matches`);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, flash] = useFlash();
  const teamId = me?.teamId;
  const mine = (list.data?.matches || [])
    .filter((m) => [m.homeTeamId, m.awayTeamId].some((t) => String(t) === String(teamId)) && !['completed', 'forfeited', 'cancelled'].includes(m.status) && m.resultState !== 'final')
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const cur = picked && mine.some((m) => m._id === picked) ? picked : mine[0]?._id;
  const detail = useApi(teamId && cur ? `/api/t/${tid}/matches/${cur}` : null);

  if (list.error) return <p role="alert" className="text-danger">{list.error}</p>;
  if (!me) return <Loading />;
  if (!teamId) return <Empty>Log in as a team captain or owner to set a lineup.</Empty>;

  const m = detail.data?.match && detail.data.match._id === cur ? detail.data.match : null;
  const side = m && String(m.homeTeamId) === String(teamId) ? 'home' : 'away';
  const save = (payload) => { setBusy(true); flash(() => call(`/api/t/${tid}/matches/${cur}/lineup`, { teamId, ...payload }, 'PUT').then(() => { list.reload(); detail.reload(); }), 'Lineup saved').finally(() => setBusy(false)); };

  return (
    <div className="flex flex-col pb-4">
      <Link href={`/team/${tid}`} className="mb-3 inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-line bg-surface2/60 px-3 text-sm font-medium text-fg no-underline hover:bg-surface2 hover:no-underline"><ArrowLeft size={16} aria-hidden />Team overview</Link>
      <PageHeader title="Lineup builder" subtitle="Choose a formation, then drag your players into position" />

      {!list.data ? <Loading /> : !mine.length ? <Empty>No upcoming published matches for your team.</Empty> : (
        <>
          <div role="tablist" aria-label="Upcoming matches" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {mine.map((x) => {
              const s = String(x.homeTeamId) === String(teamId) ? 'home' : 'away';
              const opp = s === 'home' ? x.awayName : x.homeName, on = x._id === cur, set = (x.lineups?.[s] || []).length;
              return (
                <button key={x._id} role="tab" aria-selected={on} onClick={() => setPicked(x._id)}
                  className={clsx('!h-auto shrink-0 !flex-col !items-start !gap-0.5 !rounded-xl !px-4 !py-2 text-left', on ? '!bg-primary !text-primary-fg' : 'sec !bg-surface2/60 !text-fg')}>
                  <span className="font-display text-base font-bold uppercase tracking-wide">{s === 'home' ? 'vs' : '@'} {opp}</span>
                  <span className={clsx('flex items-center gap-1.5 text-xs font-medium', on ? 'text-primary-fg/80' : 'text-muted')}>{day(x.start)}{set > 0 && <span className="inline-flex items-center gap-0.5"><Check size={12} aria-hidden />{set} set</span>}</span>
                </button>
              );
            })}
          </div>

          {detail.error && <p role="alert" className="text-danger">{detail.error}</p>}
          {!m ? !detail.error && <Loading /> : (
            <Builder key={`${cur}`} squad={detail.data.squads[side]} initial={{ meta: m.lineupMeta?.[side], ids: m.lineups?.[side] }} onSave={save} saving={busy} />
          )}
          <div className="mt-3"><Msg {...msg} /></div>
        </>
      )}
    </div>
  );
}
