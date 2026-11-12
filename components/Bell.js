'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Bell as BellIcon, CheckCheck, X } from 'lucide-react';
import { call, useApi } from '@/lib/client';
import { dt } from '@/components/ui';

// Popover under the bell on desktop; full-width bottom sheet on phones.
export default function Bell({ tid }) {
  const { data, reload } = useApi(`/api/t/${tid}/notifications`, { poll: 15000 });
  const [open, setOpen] = useState(false);
  const box = useRef(null), panel = useRef(null);
  const [mobile, setMobile] = useState(false);
  useEffect(() => { const m = matchMedia('(max-width: 767px)'); const f = () => setMobile(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  const items = data?.items || [], unread = data?.unread || 0;
  const mark = (ids) => call(`/api/t/${tid}/notifications/read`, ids ? { ids } : {}).then(reload).catch(() => {});
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    const out = (e) => box.current && !box.current.contains(e.target) && !panel.current?.contains(e.target) && setOpen(false);
    window.addEventListener('keydown', esc); document.addEventListener('mousedown', out);
    return () => { window.removeEventListener('keydown', esc); document.removeEventListener('mousedown', out); };
  }, [open]);
  // Header uses backdrop-blur, which would trap a fixed sheet; portal it to <body> on phones.
  const wrap = (n) => (mobile ? createPortal(n, document.body) : n);
  return (
    <span ref={box} className="relative">
      <button className="sec relative !min-h-[44px] !min-w-[44px] !px-3" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <BellIcon size={18} aria-hidden />
        {unread > 0 && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-accent px-1 text-center shadow-[0_0_10px_rgb(var(--accent))] text-[11px] font-bold leading-[18px] text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && wrap(
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />
          <div ref={panel} role="dialog" aria-label="Notifications"
            className={clsx('grad-border z-50 flex flex-col overflow-hidden shadow-[0_20px_60px_rgb(0_0_0/.6)]',
              'fixed inset-x-0 bottom-0 max-h-[75vh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]',
              'md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:max-h-[70vh] md:w-96 md:rounded-2xl md:pb-0')}>
            <div className="flex items-center gap-2 border-b border-line px-4 py-2">
              <b className="flex-1 font-display text-lg uppercase tracking-wide">Notifications</b>
              {unread > 0 && <button className="sec !min-h-[36px] !px-3 text-sm" onClick={() => mark()}><CheckCheck size={15} aria-hidden />Mark all read</button>}
              <button className="sec !min-h-[36px] !px-2 md:hidden" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            <div className="overflow-y-auto">
              {!items.length && <p className="m-0 p-6 text-center text-sm text-muted">No notifications.</p>}
              {items.map((n) => (
                <div key={n._id} onClick={() => !n.read && mark([n._id])}
                  className={clsx('cursor-pointer border-b border-line px-4 py-3 text-sm last:border-0', !n.read && 'border-l-4 border-l-primary bg-primary/10')}>
                  <b>{n.title}</b>{n.text && <div>{n.text}</div>}<div className="mt-0.5 text-xs text-muted">{dt(n.at)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </span>
  );
}
