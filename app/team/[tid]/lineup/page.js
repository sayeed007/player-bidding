'use client';
import Link from 'next/link';
import { use, useState } from 'react';
import { Check, ArrowLeft, CalendarDays, MapPin } from 'lucide-react';
import { call, useApi, useMe } from '@/lib/client';
import { Button, Card, Empty, Loading, Msg, PageHeader, cx, dt, useFlash } from '@/components/ui';
import { PlayerTile } from '@/components/cards';

export default function Lineup({ params }) {
  const { tid } = use(params);
  const me = useMe();
  const { data, error, reload } = useApi(`/api/t/${tid}/matches`);
  if (error) return <p role="alert" className="text-danger">{error}</p>;
  if (!me?.teamId) return <Empty>Log in as a team captain or owner to set a lineup.</Empty>;
  const mine = (data?.matches || []).filter((m) => [m.homeTeamId, m.awayTeamId].some((t) => String(t) === String(me.teamId))
    && !['completed', 'forfeited', 'cancelled'].includes(m.status) && m.resultState !== 'final');
  return (
    <div className="flex flex-col">
      <Link href={`/team/${tid}`} className="mb-3 inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-line bg-surface px-3 text-sm font-medium text-fg no-underline hover:bg-surface2 hover:no-underline"><ArrowLeft size={16} aria-hidden />Team overview</Link>
      <PageHeader title="Match lineups" subtitle="Choose your starters for each upcoming match" />
      {!data ? <Loading /> : !mine.length && <Empty>No upcoming published matches for your team.</Empty>}
      {mine.map((m) => <Editor key={m._id} tid={tid} m={m} teamId={me.teamId} reload={reload} />)}
    </div>
  );
}

function Editor({ tid, m, teamId, reload }) {
  const [sq, setSq] = useState(null);
  const [sel, setSel] = useState(null);
  const [msg, flash] = useFlash();
  const side = String(m.homeTeamId) === String(teamId) ? 'home' : 'away';
  const open = () => flash(async () => {
    const r = await call(`/api/t/${tid}/matches/${m._id}`);
    setSq(r.squads[side]); setSel(new Set((m.lineups?.[side] || []).map(String)));
  }, 'Loaded');
  const toggle = (id) => { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); setSel(s); };
  const save = () => flash(async () => { await call(`/api/t/${tid}/matches/${m._id}/lineup`, { teamId, players: [...sel] }, 'PUT'); reload(); }, 'Lineup saved');
  return (
    <Card title={`${m.homeName} vs ${m.awayName}`} right={<span className="rounded-full bg-primary/15 px-3 py-1 font-display text-sm font-semibold tabular-nums text-primary">{m.lineups?.[side]?.length || 0} picked</span>}>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted"><span className="inline-flex items-center gap-1.5 tabular-nums"><CalendarDays size={15} aria-hidden />{dt(m.start)}</span>{m.venue && <span className="inline-flex items-center gap-1.5"><MapPin size={15} aria-hidden />{m.venue}</span>}</div>
      <Msg {...msg} />
      {!sq ? <Button onClick={open} className="w-full sm:w-auto">Pick lineup</Button> : (
        <>
          <p className="mb-3 rounded-xl border border-line bg-surface2/60 px-3 py-2 text-sm text-muted">Select players to include in this match lineup.</p>
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4">
            {sq.map((p) => {
              const on = sel.has(String(p._id));
              return (
                <li key={p._id}>
                  <label className="relative block cursor-pointer">
                    <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(String(p._id))} />
                    <PlayerTile player={p} className={cx('border-2 transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary', on ? 'border-primary glow-primary' : 'border-transparent opacity-80')} />
                    <span aria-hidden className={cx('pointer-events-none absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full border-2 transition', on ? 'pop border-primary bg-primary text-primary-fg glow-primary' : 'border-white/50 bg-black/40')}>{on && <Check size={18} strokeWidth={3} />}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 -mx-4 mt-3 border-t border-primary/40 bg-bg/90 p-3 shadow-[0_-8px_32px_-8px_rgb(var(--primary)/.45)] backdrop-blur md:bottom-0 md:mx-0 md:rounded-xl md:border">
            <Button className="w-full" onClick={save}>Save lineup ({sel.size} selected)</Button>
          </div>
        </>
      )}
    </Card>
  );
}
