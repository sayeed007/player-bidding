'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import { Goal, LayoutDashboard, Settings, Users, Shield, Gavel, CalendarDays, ClipboardList, FileBarChart, Megaphone, ScrollText, ArrowLeft, MoreHorizontal, LogOut } from 'lucide-react';
import { call, useApi } from '@/lib/client';
import { Sheet, Skeleton } from '@/components/ui';
import Bell from '@/components/Bell';

const LINKS = [
  { href: '', label: 'Overview', Icon: LayoutDashboard, group: 'Overview' },
  { href: '/players', label: 'Players', Icon: Users, group: 'Operations' },
  { href: '/teams', label: 'Teams', Icon: Shield, group: 'Operations' },
  { href: '/auction', label: 'Auction', Icon: Gavel, group: 'Operations' },
  { href: '/fixtures', label: 'Fixtures', Icon: CalendarDays, group: 'Competition' },
  { href: '/results', label: 'Results', Icon: ClipboardList, group: 'Competition' },
  { href: '/settings', label: 'Settings', Icon: Settings, group: 'Administration' },
  { href: '/reports', label: 'Reports', Icon: FileBarChart, group: 'Administration' },
  { href: '/announcements', label: 'Announcements', Icon: Megaphone, group: 'Administration' },
  { href: '/audit', label: 'Audit', Icon: ScrollText, group: 'Administration' },
];
const PRIMARY = new Set(['', '/players', '/teams', '/auction']);
const GLOBAL_LINKS = [
  { href: '/admin#tournaments', label: 'Tournaments', Icon: LayoutDashboard },
  { href: '/admin#users', label: 'Users', Icon: Users },
];

export default function AdminLayout({ children }) {
  const path = usePathname();
  const tid = path.match(/^\/admin\/([a-f0-9]{24})/)?.[1];
  const { data, error } = useApi('/api/auth/me');
  const { data: tournament } = useApi(tid ? `/api/t/${tid}` : null);
  const [more, setMore] = useState(false);
  const u = data?.user;
  if (!data && !error) return <div className="grid gap-3"><Skeleton className="h-12" /><Skeleton className="h-40" /></div>;
  const gate = (m) => <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-line bg-surface p-5 text-center text-sm shadow-card">{m}</div>;
  if (!u) return gate(<>Please <Link href="/login">log in</Link> as staff to use the admin area.</>);
  if (!['super', 'organizer', 'auctioneer'].includes(u.role)) return gate(<span className="text-danger">Staff access only.</span>);
  if (tid && u.role !== 'super' && String(u.tournamentId) !== tid) return gate(<><span className="text-danger">You do not manage this tournament.</span> <Link href="/admin">Back</Link></>);

  const items = tid ? LINKS.map((i) => ({ ...i, href: `/admin/${tid}${i.href}`, exact: i.href === '' })) : [];
  const primary = items.filter((i) => PRIMARY.has(i.href.slice(`/admin/${tid}`.length)));
  const secondary = items.filter((i) => !PRIMARY.has(i.href.slice(`/admin/${tid}`.length)));
  const on = (i) => (i.exact ? path === i.href : path.startsWith(i.href));
  const moreActive = secondary.some(on);
  const linkClass = (active) => clsx('flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium no-underline hover:no-underline',
    active ? 'bg-emerald-900 text-emerald-50 md:bg-emerald-900' : 'text-emerald-50/80 hover:bg-white/10 hover:text-white');
  const signOut = () => call('/api/auth/logout', {}).then(() => { location.href = '/'; });

  return (
    <div className="admin-workspace -mt-4">
      <header className="sticky top-0 z-40 -mx-4 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
        <div className="mx-auto flex min-h-11 max-w-[1440px] items-center gap-3">
          <Link href="/admin" className="flex shrink-0 items-center gap-2 font-display font-bold text-fg no-underline hover:no-underline">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-fg"><Goal size={18} aria-hidden /></span>
            <span className="hidden sm:inline">NFTMS <span className="font-sans text-xs font-medium text-muted">ADMIN</span></span>
          </Link>
          <div className="min-w-0 flex-1 border-l border-line pl-3">
            <div className="truncate text-sm font-semibold">{tid ? tournament?.name || 'Tournament workspace' : 'Platform workspace'}</div>
            {tid && tournament?.season && <div className="truncate text-xs text-muted">{tournament.season}</div>}
          </div>
          {tid && <Bell tid={tid} />}
          <span className="hidden max-w-36 truncate text-sm text-muted lg:inline">{u.name || u.username}</span>
          <button className="sec !min-h-10 !px-3" aria-label="Log out" onClick={signOut}><LogOut size={16} /><span className="hidden sm:inline">Logout</span></button>
        </div>
        {!tid && (
          <nav aria-label="Platform sections" className="mx-auto flex max-w-[1440px] gap-1 pt-2 md:hidden">
            {GLOBAL_LINKS.map(({ href, label, Icon }) => <a key={href} href={href} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-surface2 px-3 text-sm font-medium text-fg no-underline"> <Icon size={15} aria-hidden />{label}</a>)}
          </nav>
        )}
      </header>

      <div className="mx-auto md:flex md:max-w-[1440px] md:items-start md:gap-5 md:pt-5">
        <aside className="noprint sticky top-20 hidden w-56 shrink-0 rounded-2xl bg-emerald-950 p-3 text-emerald-50 shadow-card md:block">
          {tid ? <nav aria-label="Admin sections" className="grid gap-1">
            {u.role === 'super' && <Link href="/admin" className="mb-2 flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-emerald-50/70 no-underline hover:bg-white/10 hover:text-white hover:no-underline"><ArrowLeft size={16} aria-hidden />All tournaments</Link>}
            {['Overview', 'Operations', 'Competition', 'Administration'].map((group) => (
              <section key={group} className="grid gap-1">
                <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[.14em] text-emerald-50/50">{group}</div>
                {items.filter((i) => i.group === group).map((i) => <Link key={i.href} href={i.href} aria-current={on(i) ? 'page' : undefined} className={linkClass(on(i))}><i.Icon size={17} aria-hidden />{i.label}</Link>)}
              </section>
            ))}
          </nav> : <nav aria-label="Platform sections" className="grid gap-1">
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[.14em] text-emerald-50/50">Platform</div>
            {GLOBAL_LINKS.map(({ href, label, Icon }) => <a key={href} href={href} className={linkClass(false)}><Icon size={17} aria-hidden />{label}</a>)}
          </nav>}
        </aside>
        <div className="admin-content min-w-0 flex-1">{children}</div>
      </div>

      {tid && <>
        <nav aria-label="Admin sections" className="noprint fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <ul className="mx-auto flex max-w-lg items-stretch justify-around">
            {primary.map((i) => {
              const active = on(i), Icon = i.Icon;
              return <li key={i.href} className="flex-1"><Link href={i.href} aria-current={active ? 'page' : undefined} className={clsx('flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium no-underline hover:no-underline', active ? 'text-primary' : 'text-muted')}>
                <span className={clsx('grid h-7 w-12 place-items-center rounded-full', active && 'bg-primary/10')}><Icon size={20} aria-hidden /></span>{i.label}
              </Link></li>;
            })}
            <li className="flex-1"><button type="button" aria-expanded={more} className={clsx('!h-16 !w-full !flex-col !gap-0.5 !rounded-none !bg-transparent !px-0 !py-0 !text-[11px] !font-medium', moreActive || more ? '!text-primary' : '!text-muted')} onClick={() => setMore(true)}>
              <span className={clsx('grid h-7 w-12 place-items-center rounded-full', (moreActive || more) && 'bg-primary/10')}><MoreHorizontal size={20} aria-hidden /></span>More
            </button></li>
          </ul>
        </nav>
        <Sheet open={more} onClose={() => setMore(false)} title="More admin sections">
          <nav aria-label="More admin sections" className="grid gap-1">{secondary.map((i) => <Link key={i.href} href={i.href} aria-current={on(i) ? 'page' : undefined} onClick={() => setMore(false)} className={clsx('flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-fg no-underline hover:bg-surface2 hover:no-underline', on(i) && 'bg-primary/10 text-primary')}><i.Icon size={18} aria-hidden />{i.label}</Link>)}</nav>
        </Sheet>
      </>}
    </div>
  );
}
