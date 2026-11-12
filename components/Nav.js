'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Goal, Home, CalendarDays, Gavel, Trophy, User, Shield, LogIn, LogOut, BarChart3, Users } from 'lucide-react';
import { call, useApi } from '@/lib/client';
import Bell from '@/components/Bell';

export default function Nav() {
  const path = usePathname();
  const isAdmin = path === '/admin' || path.startsWith('/admin/');
  const me = useApi(isAdmin ? null : '/api/auth/me').data?.user;
  if (isAdmin || path.endsWith('/live')) return null; // admin and projector use their own chrome
  const tid = path.match(/^\/(?:t|admin|team)\/([a-f0-9]{24})/)?.[1] || me?.tournamentId;
  const staff = me && ['super', 'organizer', 'auctioneer'].includes(me.role);

  // Same list drives the desktop top bar and the phone bottom tab bar.
  const items = tid ? [
    { href: `/t/${tid}`, label: 'Home', icon: Home, exact: true },
    { href: `/t/${tid}/fixtures`, label: 'Fixtures', icon: CalendarDays },
    { href: `/t/${tid}/auction`, label: 'Auction', icon: Gavel, hot: true },
    { href: `/t/${tid}/standings`, label: 'Table', icon: Trophy },
    { href: `/t/${tid}/stats`, label: 'Stats', icon: BarChart3, desktopOnly: true },
  ] : [{ href: '/', label: 'Home', icon: Home, exact: true }];
  const who = !me ? { href: '/login', label: 'Login', icon: LogIn }
    : staff ? { href: tid ? `/admin/${tid}` : '/admin', label: 'Admin', icon: Shield }
    : ['owner', 'captain'].includes(me.role) && tid ? { href: `/team/${tid}`, label: 'My team', icon: Users }
    : { href: '/me', label: 'Me', icon: User };
  const all = [...items, who];
  const active = (i) => (i.exact ? path === i.href : path.startsWith(i.href));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wider text-fg no-underline hover:no-underline">
            <span className="grid h-8 w-8 place-items-center rounded-lg grad-volt glow-primary"><Goal size={18} aria-hidden /></span>
            <span className="hidden sm:inline">NFTMS</span>
          </Link>
          <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
            {all.map((i) => (
              <Link key={i.href} href={i.href}
                className={clsx('rounded-lg px-3 py-2 text-sm font-medium no-underline hover:no-underline',
                  active(i) ? 'bg-primary/10 text-primary shadow-[inset_0_-2px_0_rgb(var(--primary))]' : 'text-muted hover:bg-surface2 hover:text-fg')}>{i.label}</Link>
            ))}
          </nav>
          <span className="flex-1 md:hidden" />
          {me ? (
            <div className="flex items-center gap-2">
              {tid && <Bell tid={tid} />}
              <span className="hidden max-w-[140px] truncate text-sm text-muted lg:inline">{me.name || me.username}</span>
              <button className="sec !min-h-[40px] !px-3" aria-label="Log out"
                onClick={() => call('/api/auth/logout', {}).then(() => (location.href = '/'))}><LogOut size={16} /><span className="hidden sm:inline">Logout</span></button>
            </div>
          ) : <Link href="/login" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg no-underline hover:no-underline md:hidden">Login</Link>}
        </div>
      </header>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around">
          {all.filter((i) => !i.desktopOnly).map((i) => {
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
      </nav>
    </>
  );
}
