'use client';
import Link from 'next/link';
import { use } from 'react';
import { Gavel, ChevronRight, Megaphone } from 'lucide-react';
import { useApi } from '@/lib/client';
import { Avatar, Card, Empty, dt } from '@/components/ui';
import { TeamBadge, PlayerTile } from '@/components/cards';
import { arr, byId, Countdown, DONE, Hero, LIVE, LeaderHero, Load, Live, MatchCard, SectionTitle, label, price } from './ops';

function StandingsPreview({ tid, rows }) {
  if (!rows.length) return <Empty>The table appears after the first result.</Empty>;
  return (
    <div className="grad-card overflow-hidden rounded-2xl shadow-card">
      <div className="grid grid-cols-[28px_1fr_28px_28px_28px_40px] gap-2 border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
        <span>#</span><span>Team</span><span className="text-center">P</span><span className="text-center">W</span><span className="text-center">L</span><span className="text-right">Pts</span>
      </div>
      {rows.map((x, i) => {
        const lead = i === 0 && x.P;
        return (
          <Link key={x.teamId} href={`/t/${tid}/teams/${x.teamId}`}
            className={`grid min-h-[48px] grid-cols-[28px_1fr_28px_28px_28px_40px] items-center gap-2 border-b border-line px-3 text-sm text-fg no-underline last:border-0 hover:bg-surface2 hover:no-underline ${lead ? 'bg-primary/10 shadow-[inset_3px_0_0_rgb(var(--primary))]' : ''}`}>
            <span className="font-display tabular-nums text-muted">{x.rank ?? i + 1}</span>
            <TeamBadge team={x} size={28} />
            <span className="text-center tabular-nums">{x.P}</span><span className="text-center tabular-nums">{x.W}</span><span className="text-center tabular-nums">{x.L}</span>
            <span className={`text-right font-display text-lg font-bold tabular-nums ${lead ? 'neon-text' : ''}`}>{x.Pts}</span>
          </Link>
        );
      })}
    </div>
  );
}

const CAT_ORDER = { A: 0, 'B+': 1, B: 2, C: 3, D: 4 };

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
  const featuredPlayers = [...players].sort((a, b) => (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9)).slice(0, 12);
  return (
    <Load r={r}>{(d) => {
      const t = d.tournament || d;
      const sorted = [...ms].sort((a, b) => String(a.start).localeCompare(String(b.start)));
      const featured = sorted.find((m) => LIVE.includes(m.status)) || sorted.find((m) => !DONE.includes(m.status) && !['cancelled', 'postponed'].includes(m.status) && new Date(m.start) >= new Date());
      const latest = sorted.filter((m) => DONE.includes(m.status)).pop();
      const auctionLive = t.status === 'auction_in_progress';
      const pre = ['draft', 'registration_open', 'registration_closed', 'auction_ready'].includes(t.status);
      return (
        <div className="pb-8">
          <Hero t={t}>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <span className="rounded-full bg-black/40 px-3 py-1.5 text-xs font-bold uppercase tracking-widest ring-1 ring-white/30 backdrop-blur">{label(t.status)}</span>
              {pre && t.dates?.auctionAt && <Countdown light to={t.dates.auctionAt} label="Auction starts in" />}
              {(pre || t.status === 'auction_completed') && t.dates?.start && <Countdown light to={t.dates.start} label="Tournament starts in" />}
              {t.dates?.start && <span className="text-xs text-white/90">Starts {dt(t.dates.start)}{t.dates.end && ` · ends ${dt(t.dates.end)}`}</span>}
            </div>
          </Hero>

          {auctionLive && (
            <Link href={`/t/${tid}/auction`} className="pulse-live glow-accent mb-4 mt-8 flex min-h-[72px] items-center gap-3 rounded-2xl bg-gradient-to-r from-accent to-violet px-4 py-3 text-white no-underline hover:no-underline">
              <Gavel size={30} aria-hidden />
              <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 font-display text-xl font-bold uppercase tracking-wide"><Live>LIVE</Live> Auction in progress</span>
                <span className="text-sm text-white/90">Watch bids as they happen</span></span>
              <ChevronRight aria-hidden />
            </Link>
          )}

          <div className="grid gap-x-6 md:grid-cols-2">
            <div>
              <SectionTitle href={`/t/${tid}/fixtures`}>{featured && LIVE.includes(featured.status) ? 'Live now' : 'Next match'}</SectionTitle>
              {featured ? <MatchCard big tid={tid} m={featured} teams={tm} /> : <Empty>No upcoming fixture.</Empty>}
            </div>
            <div>
              <SectionTitle href={`/t/${tid}/fixtures`}>Latest result</SectionTitle>
              {latest ? <MatchCard big tid={tid} m={latest} teams={tm} /> : <Empty>No results yet.</Empty>}
            </div>
          </div>

          {ann.length > 0 && (
            <>
              <SectionTitle>Announcements</SectionTitle>
              <div className="grid gap-3">
                {ann.slice(0, 3).map((a) => (
                  <div key={a._id} className="grad-card flex gap-3 rounded-2xl p-3 shadow-card">
                    <Megaphone size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                    <div className="min-w-0"><div className="font-semibold">{a.title}</div>
                      <p className="m-0 whitespace-pre-wrap break-words text-sm">{a.text}</p>
                      <div className="mt-1 text-xs text-muted">{dt(a.at)}</div></div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="grid gap-x-6 md:grid-cols-2">
            <div>
              <SectionTitle href={`/t/${tid}/standings`} linkText="Full table">Standings</SectionTitle>
              <StandingsPreview tid={tid} rows={sd.slice(0, 6)} />
            </div>
            <div>
              <SectionTitle href={`/t/${tid}/stats`} linkText="All stats">Top scorers</SectionTitle>
              {scorers.length ? (
                <div className="grid gap-3">
                  <LeaderHero tid={tid} x={scorers[0]} pm={pm} unit="Goals" />
                  {scorers.length > 1 && (
                    <div className="grad-card overflow-hidden rounded-2xl">
                      {scorers.slice(1, 5).map((x, i) => (
                        <Link key={x.playerId} href={`/t/${tid}/players/${x.playerId}`}
                          className="flex min-h-[64px] items-center gap-3 border-b border-line px-3 py-2 text-fg no-underline last:border-0 hover:bg-surface2 hover:no-underline">
                          <span className="w-5 text-center font-display text-lg tabular-nums text-muted">{i + 2}</span>
                          <Avatar src={x.photo || pm[String(x.playerId)]?.photo} name={x.name} size={52} />
                          <span className="min-w-0 flex-1"><span className="block break-words font-semibold">{x.name}</span><span className="block break-words text-xs text-muted">{x.teamName}</span></span>
                          <span className="font-display text-2xl font-bold tabular-nums">{x.value}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : <Empty>No goals yet.</Empty>}
            </div>
          </div>

          {featuredPlayers.length > 0 && (
            <>
              <SectionTitle href={`/t/${tid}/players`} linkText="All players">Featured players</SectionTitle>
              <div className="-mx-4 flex snap-x gap-6 overflow-x-auto px-4 pb-4 pt-1 md:mx-0 md:px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {featuredPlayers.map((p) => (
                  <PlayerTile key={p._id} player={p} team={tm[String(p.teamId)]} price={price(p.price)} href={`/t/${tid}/players/${p._id}`} className="w-40 shrink-0 snap-start sm:w-48" />
                ))}
              </div>
            </>
          )}

          <SectionTitle href={`/t/${tid}/teams`} linkText="All teams">Teams</SectionTitle>
          {teams.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {teams.map((x) => (
                <Link key={x._id} href={`/t/${tid}/teams/${x._id}`} className="grad-card flex min-h-[56px] items-center rounded-xl px-3 py-2 text-fg no-underline hover:border-primary/60 hover:no-underline">
                  <TeamBadge team={x} size={32} />
                </Link>
              ))}
            </div>
          ) : <Empty>No teams yet.</Empty>}

          {t.rulesDocUrl && <div className="mt-4 text-sm"><a href={t.rulesDocUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center">Rules document</a></div>}
          {t.rules && <Card title="Rules"><p className="m-0 whitespace-pre-wrap text-sm">{t.rules}</p></Card>}
        </div>
      );
    }}</Load>
  );
}
