'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import clsx from 'clsx';
import { CalendarDays, Gavel, Trophy, User, Shield, LogOut, BarChart3, Users, UsersRound, Shirt } from 'lucide-react';
import { call, useApi } from '@/lib/client';
import Bell from '@/components/Bell';

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  const me = useApi(isAdmin ? null : '/api/auth/me').data?.user;
  const pathTid = path.match(/^\/(?:t|admin|team)\/([a-f0-9]{24})/)?.[1];
  // On `/` and /login there is no tournament in the URL: if exactly one is public, use it so the bar looks the same everywhere.
  const list = useApi(isAdmin ? null : '/api/tournaments').data?.tournaments;
  const tid = pathTid || me?.tournamentId || (list?.length === 1 ? list[0]._id : undefined);
  const hidden = isAdmin || path.endsWith('/live'); // admin and projector use their own chrome
  const hasTabs = !hidden && !!tid;
  // the phone tab bar needs bottom padding on the page, but only when it is actually there
  useEffect(() => { document.body.classList.toggle('has-tabbar', hasTabs); return () => document.body.classList.remove('has-tabbar'); }, [hasTabs]);
  if (hidden) return null;
  const staff = me && ['super', 'organizer', 'auctioneer'].includes(me.role);

  // One list drives the desktop top bar and the phone tab bar. Order: live event, then the competition, then the people.
  // Home is the logo; Login is the header button; the logged-in account link (Admin / My team / Me) is `who`.
  const items = tid ? [
    { href: `/t/${tid}/auction`, label: 'Auction', icon: Gavel, hot: true },
    { href: `/t/${tid}/fixtures`, label: 'Fixtures', icon: CalendarDays },
    { href: `/t/${tid}/standings`, label: 'Table', icon: Trophy },
    { href: `/t/${tid}/stats`, label: 'Stats', icon: BarChart3 },
    { href: `/t/${tid}/teams`, label: 'Teams', icon: Shirt },
    { href: `/t/${tid}/players`, label: 'Players', icon: UsersRound },
  ] : [];
  const who = !me ? null
    : staff ? { href: '/admin', label: 'Admin', icon: Shield }
    : ['owner', 'captain'].includes(me.role) && tid ? { href: `/team/${tid}`, label: 'My team', icon: Users }
    : { href: '/me', label: 'Me', icon: User };
  const active = (i) => path === i.href || path.startsWith(`${i.href}/`);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 md:px-6">
          <Link href={tid ? `/t/${tid}` : '/'} className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wider text-fg no-underline hover:no-underline">
            <img src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
            <span className="hidden sm:inline"><span className="font-display text-xl font-bold uppercase tracking-wider">Bid<span className="text-grad">Arena</span></span></span><span className="sr-only sm:hidden">BidArena</span>
          </Link>
          <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
            {[...items, ...(who ? [who] : [])].map((i) => (
              <Link key={i.href} href={i.href}
                className={clsx('rounded-lg px-3 py-2 text-sm font-medium no-underline hover:no-underline',
                  active(i) ? 'bg-primary/10 text-primary shadow-[inset_0_-2px_0_rgb(var(--primary))]' : 'text-muted hover:bg-surface2 hover:text-fg')}>{i.label}</Link>
            ))}
          </nav>
          <span className="flex-1 md:hidden" />
          {list?.length > 1 && tid && (
            <select aria-label="Switch tournament" value={tid} className="!min-h-[40px] max-w-[9.5rem] truncate !rounded-lg !px-2.5 !py-1 text-sm font-semibold sm:max-w-[14rem]"
              onChange={(e) => router.push(pathTid ? path.replace(pathTid, e.target.value) : `/t/${e.target.value}`)}>
              {list.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          )}
          {me ? (
            <div className="flex items-center gap-2">
              {who && <Link href={who.href} aria-label={who.label} className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface2/60 text-fg no-underline hover:no-underline md:hidden"><who.icon size={18} aria-hidden /></Link>}
              {tid && <Bell tid={tid} />}
              <span className="hidden max-w-[140px] truncate text-sm text-muted lg:inline">{me.name || me.username}</span>
              <button className="sec !min-h-[40px] !px-3" aria-label="Log out"
                onClick={() => call('/api/auth/logout', {}).then(() => (location.href = '/'))}><LogOut size={16} /><span className="hidden sm:inline">Logout</span></button>
            </div>
          ) : <Link href="/login" className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-fg no-underline shadow-[0_0_18px_-4px_rgb(var(--primary)/.7)] hover:no-underline">Login</Link>}
        </div>
      </header>

      {hasTabs && <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around">
          {items.map((i) => {
            const on = active(i), Icon = i.icon;
            return (
              <li key={i.href} className="flex-1">
                <Link href={i.href} aria-current={on ? 'page' : undefined}
                  className={clsx('flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium no-underline hover:no-underline',
                    on ? 'text-primary' : 'text-muted')}>
                  <span className={clsx('grid h-7 w-12 place-items-center rounded-full transition', on && 'bg-primary/15 shadow-[0_0_16px_-2px_rgb(var(--primary)/.7)]', i.hot && !on && 'text-accent')}>
                    <Icon size={20} aria-hidden />
                  </span>{i.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>}
    </>
  );
}
