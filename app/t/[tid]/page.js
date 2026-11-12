'use client';
import Link from 'next/link';
import { use } from 'react';
import { Gavel, ChevronRight, Megaphone } from 'lucide-react';
import { useApi } from '@/lib/client';
import { Avatar, Card, Empty, dt } from '@/components/ui';
import { TeamBadge } from '@/components/cards';
import { arr, byId, Countdown, DONE, Hero, LIVE, Load, Live, MatchCard, SectionTitle, label } from './ops';

function StandingsPreview({ tid, rows }) {
  if (!rows.length) return <Empty>The table appears after the first result.</Empty>;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="grid grid-cols-[28px_1fr_32px_36px_40px] gap-2 border-b border-line px-3 py-2 text-xs font-semibold uppercase text-muted">
        <span>#</span><span>Team</span><span className="text-center">P</span><span className="text-center">GD</span><span className="text-right">Pts</span>
      </div>
      {rows.map((x, i) => (
        <Link key={x.teamId} href={`/t/${tid}/teams/${x.teamId}`}
          className="grid min-h-[48px] grid-cols-[28px_1fr_32px_36px_40px] items-center gap-2 border-b border-line px-3 text-sm text-fg no-underline last:border-0 hover:bg-surface2 hover:no-underline">
          <span className="tabular-nums text-muted">{x.rank ?? i + 1}</span>
          <TeamBadge team={x} size={26} />
          <span className="text-center tabular-nums">{x.P}</span><span className="text-center tabular-nums">{x.GD}</span>
          <span className="text-right font-bold tabular-nums">{x.Pts}</span>
        </Link>
      ))}
    </div>
  );
}

export default function Home({ params }) {
  const { tid } = use(params);
  const r = useApi(`/api/t/${tid}`);
  const ms = arr(useApi(`/api/t/${tid}/matches`, { poll: 30000 }).data, 'matches');
  const sd = arr(useApi(`/api/t/${tid}/standings`, { poll: 30000 }).data, 'rows');
  const scorers = arr(useApi(`/api/t/${tid}/leaderboards`).data?.scorers ?? null, 'scorers');
  const teams = arr(useApi(`/api/t/${tid}/teams`).data, 'teams');
  const players = arr(useApi(`/api/t/${tid}/players`).data, 'players');
  const ann = arr(useApi(`/api/t/${tid}/announcements`, { poll: 30000 }).data, 'announcements');
  const tm = byId(teams), pm = byId(players);
  return (
    <Load r={r}>{(d) => {
      const t = d.tournament || d;
      const sorted = [...ms].sort((a, b) => String(a.start).localeCompare(String(b.start)));
      const featured = sorted.find((m) => LIVE.includes(m.status)) || sorted.find((m) => !DONE.includes(m.status) && !['cancelled', 'postponed'].includes(m.status) && new Date(m.start) >= new Date());
      const latest = sorted.filter((m) => DONE.includes(m.status)).pop();
      const auctionLive = t.status === 'auction_in_progress';
      const pre = ['draft', 'registration_open', 'registration_closed', 'auction_ready'].includes(t.status);
      return (
        <div className="pb-4">
          <Hero t={t}>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold capitalize">{label(t.status)}</span>
              {pre && t.dates?.auctionAt && <Countdown light to={t.dates.auctionAt} label="Auction starts in" />}
              {(pre || t.status === 'auction_completed') && t.dates?.start && <Countdown light to={t.dates.start} label="Tournament starts in" />}
              {t.dates?.start && <span className="text-xs text-white/85">Starts {dt(t.dates.start)}{t.dates.end && ` · ends ${dt(t.dates.end)}`}</span>}
              <nav aria-label="Tournament pages" className="flex w-full flex-wrap gap-2 pt-1">
                {[[`/t/${tid}/fixtures`, 'Fixtures'], [`/t/${tid}/teams`, 'Teams'], [`/t/${tid}/players`, 'Players'], [`/t/${tid}/standings`, 'Standings']].map(([href, text]) => (
                  <Link key={href} href={href} className="inline-flex min-h-10 items-center rounded-full border border-white/35 bg-black/10 px-3 text-sm font-medium text-white no-underline hover:bg-white/15 hover:no-underline">{text}<span aria-hidden className="ml-1.5">→</span></Link>
                ))}
              </nav>
            </div>
          </Hero>

          {auctionLive && (
            <Link href={`/t/${tid}/auction`} className="mt-3 flex min-h-[64px] items-center gap-3 rounded-2xl bg-danger px-4 py-3 text-white no-underline shadow-card hover:no-underline">
              <Gavel size={26} aria-hidden />
              <span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-display text-lg font-bold"><Live>LIVE</Live> Auction in progress</span>
                <span className="text-sm text-white/90">Watch bids as they happen</span></span>
              <ChevronRight aria-hidden />
            </Link>
          )}

          <div className="grid gap-x-4 md:grid-cols-2">
            <div>
              <SectionTitle href={`/t/${tid}/fixtures`}>{featured && LIVE.includes(featured.status) ? 'Live now' : 'Next match'}</SectionTitle>
              {featured ? <MatchCard tid={tid} m={featured} teams={tm} /> : <Empty>No upcoming fixture.</Empty>}
            </div>
            <div>
              <SectionTitle href={`/t/${tid}/fixtures`}>Latest result</SectionTitle>
              {latest ? <MatchCard tid={tid} m={latest} teams={tm} /> : <Empty>No results yet.</Empty>}
            </div>
          </div>

          {ann.length > 0 && (
            <>
              <SectionTitle>Announcements</SectionTitle>
              <div className="grid gap-2">
                {ann.slice(0, 3).map((a) => (
                  <div key={a._id} className="flex gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card">
                    <Megaphone size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                    <div className="min-w-0"><div className="font-semibold">{a.title}</div>
                      <p className="m-0 whitespace-pre-wrap break-words text-sm">{a.text}</p>
                      <div className="mt-1 text-xs text-muted">{dt(a.at)}</div></div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="grid gap-x-4 md:grid-cols-2">
            <div>
              <SectionTitle href={`/t/${tid}/standings`} linkText="Full table">Standings</SectionTitle>
              <StandingsPreview tid={tid} rows={sd.slice(0, 6)} />
            </div>
            <div>
              <SectionTitle href={`/t/${tid}/stats`} linkText="All stats">Top scorers</SectionTitle>
              {scorers.length ? (
                <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                  {scorers.slice(0, 5).map((x, i) => (
                    <Link key={x.playerId} href={`/t/${tid}/players/${x.playerId}`}
                      className="flex min-h-[56px] items-center gap-3 border-b border-line px-3 py-2 text-fg no-underline last:border-0 hover:bg-surface2 hover:no-underline">
                      <span className="w-4 text-sm tabular-nums text-muted">{i + 1}</span>
                      <Avatar src={x.photo || pm[String(x.playerId)]?.photo} name={x.name} size={40} />
                      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{x.name}</span><span className="block truncate text-xs text-muted">{x.teamName}</span></span>
                      <span className="font-display text-xl font-bold tabular-nums">{x.value}</span>
                    </Link>
                  ))}
                </div>
              ) : <Empty>No goals yet.</Empty>}
            </div>
          </div>

          <SectionTitle href={`/t/${tid}/teams`} linkText="All teams">Teams</SectionTitle>
          {teams.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {teams.map((x) => (
                <Link key={x._id} href={`/t/${tid}/teams/${x._id}`} className="flex min-h-[56px] items-center rounded-xl border border-line bg-surface px-3 py-2 text-fg no-underline hover:border-primary/50 hover:no-underline">
                  <TeamBadge team={x} size={32} />
                </Link>
              ))}
            </div>
          ) : <Empty>No teams yet.</Empty>}

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href={`/t/${tid}/players`} className="inline-flex min-h-[44px] items-center">Players</Link>
            {t.rulesDocUrl && <a href={t.rulesDocUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center">Rules document</a>}
          </div>
          {t.rules && <Card title="Rules"><p className="m-0 whitespace-pre-wrap text-sm">{t.rules}</p></Card>}
        </div>
      );
    }}</Load>
  );
}
