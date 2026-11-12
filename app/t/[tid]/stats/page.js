'use client';
import Link from 'next/link';
import { use, useState } from 'react';
import { useApi } from '@/lib/client';
import { Avatar, Empty, PageHeader, Segmented, Table } from '@/components/ui';
import { arr, byId, LeaderHero, Load, SectionTitle, label } from '../ops';

const TABS = [
  { value: 'scorers', label: 'Scorers', unit: 'Goals' }, { value: 'assists', label: 'Assists', unit: 'Assists' },
  { value: 'cleanSheets', label: 'Clean sheets', unit: 'CS' }, { value: 'potm', label: 'POTM', unit: 'Awards' }, { value: 'awards', label: 'Awards' },
];

export default function Stats({ params }) {
  const { tid } = use(params);
  const r = useApi(`/api/t/${tid}/leaderboards`, { poll: 30000 });
  const st = useApi(`/api/t/${tid}/stats`).data;
  const pm = byId(arr(useApi(`/api/t/${tid}/players`).data, 'players'));
  const [tab, setTab] = useState('scorers');
  const teams = [...arr(st?.teams ?? null, 'teams')].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const cur = TABS.find((x) => x.value === tab);
  return (
    <>
      <PageHeader title="Statistics" subtitle="Player leaderboards and team performance" />
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <Segmented value={tab} onChange={setTab} options={TABS} />
      </div>
      <Load r={r}>{(d) => (
        <div className="mt-3">
          <SectionTitle>{tab === 'awards' ? 'Tournament awards' : `Top ${cur.label.toLowerCase()}`}</SectionTitle>
          {tab === 'awards' ? (
            arr(d.awards, '').length ? (
              <div className="grid gap-2 sm:grid-cols-2">{arr(d.awards, '').map((a, i) => (
                <div key={a.type + i} className="grad-card rounded-2xl p-3 shadow-card">
                  <div className="text-xs font-semibold uppercase tracking-wider text-primary">{label(a.type)}</div>
                  <div className="mt-1 flex items-center gap-3"><Avatar src={pm[String(a.playerId)]?.photo} name={a.name || '?'} size={44} />
                    <div className="min-w-0"><div className="truncate font-semibold">{a.name}</div>{a.note && <div className="text-xs text-muted">{a.note}</div>}</div></div>
                </div>))}</div>
            ) : <Empty>No awards yet.</Empty>
          ) : arr(d[tab], '').length ? (
            <div className="grid gap-3">
              <LeaderHero tid={tid} x={arr(d[tab], '')[0]} pm={pm} unit={cur.unit} />
              {arr(d[tab], '').length > 1 && (
                <div className="grad-card overflow-hidden rounded-2xl">
                  {arr(d[tab], '').slice(1, 20).map((x, i) => (
                    <Link key={x.playerId} href={`/t/${tid}/players/${x.playerId}`}
                      className="flex min-h-[64px] items-center gap-3 border-b border-line px-3 py-2 text-fg no-underline last:border-0 hover:bg-surface2 hover:no-underline">
                      <span className={`w-7 text-center font-display text-xl font-bold tabular-nums ${i < 2 ? 'neon-text-accent' : 'text-muted'}`}>{i + 2}</span>
                      <Avatar src={x.photo || pm[String(x.playerId)]?.photo} name={x.name} size={52} />
                      <span className="min-w-0 flex-1"><span className="block break-words font-semibold">{x.name}</span><span className="block break-words text-xs text-muted">{x.teamName}</span></span>
                      <span className="text-right"><span className="block font-display text-2xl font-bold tabular-nums">{x.value}</span><span className="block text-[11px] uppercase tracking-wider text-muted">{cur.unit}</span></span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : <Empty>No data yet.</Empty>}
        </div>
      )}</Load>
      <SectionTitle>Team rankings</SectionTitle>
      <div className="grad-card rounded-2xl p-3 shadow-card">
        <Table rowKey="teamId" rows={teams} empty="No data yet." cols={[
          { key: 'name', label: 'Team', render: (x) => <Link href={`/t/${tid}/teams/${x.teamId}`}>{x.rank ? `${x.rank}. ` : ''}{x.name}</Link> },
          ...['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts', 'cleanSheets', 'yellow', 'red'].map((k) => ({ key: k, label: k === 'cleanSheets' ? 'CS' : k === 'yellow' ? 'YC' : k === 'red' ? 'RC' : k }))]} />
      </div>
    </>
  );
}
