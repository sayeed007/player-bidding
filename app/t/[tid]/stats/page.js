'use client';
import Link from 'next/link';
import { use, useState } from 'react';
import { useApi } from '@/lib/client';
import { Avatar, Empty, PageHeader, Segmented, Table } from '@/components/ui';
import { arr, byId, Load, SectionTitle, label } from '../ops';

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
                <div key={a.type + i} className="rounded-2xl border border-line bg-surface p-3 shadow-card">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label(a.type)}</div>
                  <div className="mt-1 flex items-center gap-3"><Avatar src={pm[String(a.playerId)]?.photo} name={a.name || '?'} size={44} />
                    <div className="min-w-0"><div className="truncate font-semibold">{a.name}</div>{a.note && <div className="text-xs text-muted">{a.note}</div>}</div></div>
                </div>))}</div>
            ) : <Empty>No awards yet.</Empty>
          ) : arr(d[tab], '').length ? (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              {arr(d[tab], '').slice(0, 20).map((x, i) => (
                <Link key={x.playerId} href={`/t/${tid}/players/${x.playerId}`}
                  className="flex min-h-[60px] items-center gap-3 border-b border-line px-3 py-2 text-fg no-underline last:border-0 hover:bg-surface2 hover:no-underline">
                  <span className={`w-6 text-center font-display text-lg font-bold tabular-nums ${i < 3 ? 'text-accent' : 'text-muted'}`}>{i + 1}</span>
                  <Avatar src={x.photo || pm[String(x.playerId)]?.photo} name={x.name} size={44} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{x.name}</span><span className="block truncate text-xs text-muted">{x.teamName}</span></span>
                  <span className="text-right"><span className="block font-display text-xl font-bold tabular-nums">{x.value}</span><span className="block text-[11px] text-muted">{cur.unit}</span></span>
                </Link>
              ))}
            </div>
          ) : <Empty>No data yet.</Empty>}
        </div>
      )}</Load>
      <SectionTitle>Team rankings</SectionTitle>
      <div className="rounded-2xl border border-line bg-surface p-3 shadow-card">
        <Table rowKey="teamId" rows={teams} empty="No data yet." cols={[
          { key: 'name', label: 'Team', render: (x) => <Link href={`/t/${tid}/teams/${x.teamId}`}>{x.rank ? `${x.rank}. ` : ''}{x.name}</Link> },
          ...['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts', 'cleanSheets', 'yellow', 'red'].map((k) => ({ key: k, label: k === 'cleanSheets' ? 'CS' : k === 'yellow' ? 'YC' : k === 'red' ? 'RC' : k }))]} />
      </div>
    </>
  );
}
