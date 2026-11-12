'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import { Goal, LayoutDashboard, Settings, Users, Shield, Gavel, CalendarDays, ClipboardList, FileBarChart, Megaphone, ScrollText, MoreHorizontal, LogOut, Trophy, Globe, Tv } from 'lucide-react';
import { call, useApi } from '@/lib/client';
import { isStaff } from '@/lib/roles';
import { Sheet, Skeleton } from '@/components/ui';
import Bell from '@/components/Bell';

// Admin shell: its own chrome, separate from the public navbar. Everything navigational lives in the sidebar:
// Platform (super) -> Tournament (switcher + sections) -> Site links -> account. Same shape on /admin and /admin/[tid].
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
const GROUPS = ['Overview', 'Operations', 'Competition', 'Administration'];
const PRIMARY = new Set(['', '/players', '/teams', '/auction']);
const GLOBAL_LINKS = [
  { href: '/admin', label: 'Tournaments', Icon: Trophy },
  { href: '/admin/users', label: 'Users', Icon: Users },
];

const Group = ({ title, children }) => (
  <section className="grid grid-cols-[minmax(0,1fr)] gap-1">
    <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[.14em] text-muted">{title}</div>
    {children}
  </section>
);

export default function AdminLayout({ children }) {
  const path = usePathname();
  const router = useRouter();
  const tid = path.match(/^\/admin\/([a-f0-9]{24})/)?.[1];
  const { data, error } = useApi('/api/auth/me');
  const u = data?.user;
  const { data: tournament } = useApi(tid ? `/api/t/${tid}` : null);
  const { data: tl } = useApi(isStaff(u) ? '/api/tournaments' : null);
  const [more, setMore] = useState(false);
  if (!data && !error) return <div className="grid gap-3"><Skeleton className="h-12" /><Skeleton className="h-40" /></div>;
  const gate = (m) => <div className="mx-auto mt-10 max-w-sm grad-border rounded-2xl p-5 text-center text-sm shadow-card">{m}</div>;
  if (!u) return gate(<>Please <Link href="/login">log in</Link> as staff to use the admin area.</>);
  if (!isStaff(u)) return gate(<span className="text-danger">Staff access only.</span>);
  if (tid && u.role !== 'super' && String(u.tournamentId) !== tid) return gate(<><span className="text-danger">You do not manage this tournament.</span> <Link href="/admin">Back</Link></>);

  const tournaments = tl?.tournaments ?? [];
  const siteTid = tid || tournaments[0]?._id; // `/` redirects staff to /admin, so "public site" must point at a tournament
  const items = tid ? LINKS.map((i) => ({ ...i, href: `/admin/${tid}${i.href}`, exact: i.href === '' })) : [];
  const primary = items.filter((i) => PRIMARY.has(i.href.slice(`/admin/${tid}`.length)));
  const secondary = items.filter((i) => !PRIMARY.has(i.href.slice(`/admin/${tid}`.length)));
  const on = (i) => (i.exact ? path === i.href : path.startsWith(i.href));
  const moreActive = secondary.some(on);
  const linkClass = (active) => clsx('flex min-h-10 min-w-0 items-center gap-2.5 rounded-lg px-3 text-sm font-medium no-underline hover:no-underline',
    active ? 'bg-primary/15 text-primary shadow-[inset_3px_0_0_rgb(var(--primary))]' : 'text-fg/80 hover:bg-white/10 hover:text-white');
  const signOut = () => call('/api/auth/logout', {}).then(() => { location.href = '/'; });

  return (
    <div className="admin-workspace -mt-4">
      <header className="sticky top-0 z-40 -mx-4 border-b border-line bg-bg/80 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
        <div className="mx-auto flex min-h-11 max-w-[1440px] items-center gap-3">
          <Link href="/admin" className="flex shrink-0 items-center gap-2 font-display font-bold text-fg no-underline hover:no-underline">
            <span className="grid h-8 w-8 place-items-center rounded-lg grad-volt glow-primary"><Goal size={18} aria-hidden /></span>
            <span className="hidden font-display uppercase tracking-wider sm:inline">NFTMS <span className="font-sans text-xs font-medium text-accent">ADMIN</span></span>
          </Link>
          <div className="min-w-0 flex-1 border-l border-line pl-3">
            <div className="truncate text-sm font-semibold">{tid ? tournament?.name || 'Tournament workspace' : 'Platform workspace'}</div>
            {tid && tournament?.season && <div className="truncate text-xs text-muted">{tournament.season}</div>}
          </div>
          {tid && <Bell tid={tid} />}
          <button className="sec !min-h-10 !px-3 md:hidden" aria-label="Log out" onClick={signOut}><LogOut size={16} /></button>
        </div>
        {!tid && u.role === 'super' && (
          <nav aria-label="Platform sections" className="mx-auto flex max-w-[1440px] gap-1 pt-2 md:hidden">
            {GLOBAL_LINKS.map(({ href, label, Icon }) => <Link key={href} href={href} className={clsx('inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium no-underline', path === href ? 'bg-primary/15 text-primary' : 'bg-surface2 text-fg')}><Icon size={15} aria-hidden />{label}</Link>)}
          </nav>
        )}
      </header>

      <div className="mx-auto md:flex md:max-w-[1440px] md:items-start md:gap-5 md:pt-5">
        <aside className="noprint sticky top-20 hidden w-60 shrink-0 grad-card rounded-2xl p-3 text-fg shadow-card md:block">
          <nav aria-label="Admin" className="grid grid-cols-[minmax(0,1fr)] gap-1">
            {u.role === 'super' && (
              <Group title="Platform">
                {GLOBAL_LINKS.map(({ href, label, Icon }) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} className={linkClass(path === href)}><Icon size={17} aria-hidden />{label}</Link>)}
              </Group>
            )}

            <Group title="Tournament">
              {tournaments.length > 1 && (
                <select aria-label="Switch tournament" value={tid || ''} className="!min-h-10 !rounded-lg !px-2.5 !py-1 text-sm font-semibold"
                  onChange={(e) => router.push(e.target.value ? `/admin/${e.target.value}${path.replace(/^\/admin(\/[a-f0-9]{24})?/, '')}` : '/admin')}>
                  {!tid && <option value="">Select a tournament…</option>}
                  {tournaments.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
              )}
              {tid && tournaments.length <= 1 && <div className="min-w-0 truncate px-3 py-1 text-sm font-semibold">{tournament?.name || 'Tournament'}</div>}
              {!tid && (tournaments.length
                ? tournaments.slice(0, 8).map((t) => <Link key={t._id} href={`/admin/${t._id}`} className={linkClass(false)}><Trophy size={17} aria-hidden /><span className="truncate">{t.name}</span></Link>)
                : <p className="m-0 px-3 py-1 text-xs text-muted">No tournaments yet.</p>)}
            </Group>

            {tid && GROUPS.map((group) => (
              <Group key={group} title={group}>
                {items.filter((i) => i.group === group).map((i) => <Link key={i.href} href={i.href} aria-current={on(i) ? 'page' : undefined} className={linkClass(on(i))}><i.Icon size={17} aria-hidden />{i.label}</Link>)}
              </Group>
            ))}

            <Group title="Public site">
              {siteTid && <Link href={`/t/${siteTid}`} className={linkClass(false)}><Globe size={17} aria-hidden />View public site</Link>}
              {siteTid && <Link href={`/t/${siteTid}/auction/live`} target="_blank" rel="noreferrer" className={linkClass(false)}><Tv size={17} aria-hidden />Live display</Link>}
            </Group>

            <div className="mt-3 grid gap-2 border-t border-line pt-3">
              <div className="px-1"><div className="truncate text-sm font-semibold">{u.name || u.username}</div><div className="text-xs capitalize text-muted">{u.role}</div></div>
              <button className="sec !min-h-10 w-full" onClick={signOut}><LogOut size={16} />Logout</button>
            </div>
          </nav>
        </aside>
        <div className="admin-content min-w-0 flex-1">{children}</div>
      </div>

      {tid && <>
        <nav aria-label="Admin sections" className="noprint fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <ul className="mx-auto flex max-w-lg items-stretch justify-around">
            {primary.map((i) => {
              const active = on(i), Icon = i.Icon;
              return <li key={i.href} className="flex-1"><Link href={i.href} aria-current={active ? 'page' : undefined} className={clsx('flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium no-underline hover:no-underline', active ? 'text-primary' : 'text-muted')}>
                <span className={clsx('grid h-7 w-12 place-items-center rounded-full', active && 'bg-primary/15 shadow-[0_0_16px_-4px_rgb(var(--primary)/.8)]')}><Icon size={20} aria-hidden /></span>{i.label}
              </Link></li>;
            })}
            <li className="flex-1"><button type="button" aria-expanded={more} className={clsx('!h-16 !w-full !flex-col !gap-0.5 !rounded-none !bg-transparent !px-0 !py-0 !text-[11px] !font-medium', moreActive || more ? '!text-primary' : '!text-muted')} onClick={() => setMore(true)}>
              <span className={clsx('grid h-7 w-12 place-items-center rounded-full', (moreActive || more) && 'bg-primary/15 shadow-[0_0_16px_-4px_rgb(var(--primary)/.8)]')}><MoreHorizontal size={20} aria-hidden /></span>More
            </button></li>
          </ul>
        </nav>
        <Sheet open={more} onClose={() => setMore(false)} title="More admin sections">
          <nav aria-label="More admin sections" className="grid gap-1">
            {secondary.map((i) => <Link key={i.href} href={i.href} aria-current={on(i) ? 'page' : undefined} onClick={() => setMore(false)} className={clsx('flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-fg no-underline hover:bg-surface2 hover:no-underline', on(i) && 'bg-primary/10 text-primary')}><i.Icon size={18} aria-hidden />{i.label}</Link>)}
            {u.role === 'super' && <Link href="/admin" onClick={() => setMore(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-fg no-underline hover:bg-surface2 hover:no-underline"><Trophy size={18} aria-hidden />All tournaments</Link>}
            <Link href={`/t/${tid}`} onClick={() => setMore(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-fg no-underline hover:bg-surface2 hover:no-underline"><Globe size={18} aria-hidden />View public site</Link>
          </nav>
        </Sheet>
      </>}
    </div>
  );
}
