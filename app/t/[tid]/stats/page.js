'use client';
import Link from 'next/link';
import { use } from 'react';
import { ArrowRight, Award, Goal, HandHelping, ShieldCheck, Star } from 'lucide-react';
import { useApi } from '@/lib/client';
import { Avatar, Card, Empty, PageHeader } from '@/components/ui';
import { arr, byId, LeaderBoard, Load, label } from '../ops';

// All leaderboards are visible at once (no tabs). Team table lives on /standings.
const BOARDS = [
  { key: 'scorers', title: 'Top scorers', unit: 'Goals', icon: Goal },
  { key: 'assists', title: 'Top assists', unit: 'Assists', icon: HandHelping },
  { key: 'cleanSheets', title: 'Clean sheets', unit: 'CS', icon: ShieldCheck },
  { key: 'potm', title: 'Player of the match', unit: 'Awards', icon: Star },
];
export default function Stats({ params }) {
  const { tid } = use(params);
  const r = useApi(`/api/t/${tid}/leaderboards`, { poll: 30000 });
  const pm = byId(arr(useApi(`/api/t/${tid}/players`).data, 'players'));
  return (
    <>
      <PageHeader title="Statistics" subtitle="Player leaderboards and awards" />
      <Load r={r}>{(d) => {
        const awards = arr(d.awards, '');
        return (
          <>
            <div className="grid gap-4 md:grid-cols-2 md:gap-6">
              {BOARDS.map((b) => <LeaderBoard key={b.key} tid={tid} title={b.title} icon={b.icon} unit={b.unit} rows={arr(d[b.key], '')} pm={pm} />)}
            </div>

            <Card title={<span className="flex items-center gap-2"><Award size={18} className="text-primary" aria-hidden />Tournament awards</span>} className="!mt-6">
              {awards.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{awards.map((a, i) => (
                  <div key={a.type + i} className="grad-card rounded-2xl p-3 shadow-card">
                    <div className="text-xs font-semibold uppercase tracking-wider text-primary">{label(a.type)}</div>
                    <div className="mt-2 flex items-center gap-3"><Avatar src={pm[String(a.playerId)]?.photo} name={a.name || '?'} size={52} />
                      <div className="min-w-0"><div className="break-words font-semibold">{a.name}</div>{a.note && <div className="text-xs text-muted">{a.note}</div>}</div></div>
                  </div>))}</div>
              ) : <Empty>No awards yet.</Empty>}
            </Card>

            <Link href={`/t/${tid}/standings`} className="grad-card mt-6 flex min-h-[64px] items-center justify-between gap-3 rounded-2xl px-4 py-3 text-fg no-underline hover:border-primary/60 hover:no-underline">
              <span><span className="block font-display text-lg uppercase tracking-wide">Team table</span>
                <span className="block text-sm text-muted">Standings, clean sheets, cards and each team&apos;s match history</span></span>
              <ArrowRight aria-hidden className="shrink-0 text-primary" />
            </Link>
          </>
        );
      }}</Load>
    </>
  );
}
