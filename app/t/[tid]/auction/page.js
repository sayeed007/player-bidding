'use client';
import { use } from 'react';
import Link from 'next/link';
import { Tv } from 'lucide-react';
import { Card, Loading, PageHeader } from '@/components/ui';
import { useAuction, LotHero, TeamStrip, BidsList, SalesList, ProgressBar } from '@/lib/auction-ui';

export default function Spectator({ params }) {
  const { tid } = use(params);
  const { data: d, error } = useAuction(tid);
  return (
    <main>
      <PageHeader title="Live auction" subtitle="Current lot, bids, and team budgets" right={<Link href={`/t/${tid}/auction/live`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-fg"><Tv size={16} aria-hidden />Projector view</Link>} />
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">Connection issue: {error} (retrying...)</p>}
      {!d ? <Loading /> : <>
        <Card title="Auction progress" className="!my-0"><ProgressBar d={d} /></Card>
        <div className="grid gap-x-4 lg:grid-cols-[1.2fr_1fr]">
          <LotHero d={d} />
          <div>
            <Card title="Recent bids"><BidsList d={d} /></Card>
            <Card title="Recent sales"><SalesList d={d} /></Card>
          </div>
        </div>
        <h2 className="mt-6">Team budgets & squad progress</h2>
        <TeamStrip d={d} />
      </>}
    </main>
  );
}
