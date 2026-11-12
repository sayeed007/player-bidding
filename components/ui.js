'use client';
// Shared UI kit (mobile-first, token-driven; tokens live in app/globals.css, Tailwind maps them).
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { X, Inbox } from 'lucide-react';

export const cx = clsx;

// ---------- primitives ----------
const btn = {
  primary: 'bg-primary text-primary-fg shadow-[0_0_22px_-4px_rgb(var(--primary)/.7)] hover:brightness-110', secondary: 'border border-line bg-surface2/60 text-fg hover:bg-surface2',
  danger: 'bg-danger text-white shadow-[0_0_18px_-4px_rgb(var(--danger)/.7)]', success: 'bg-success text-black', ghost: 'bg-transparent text-fg hover:bg-surface2',
};
export function Button({ variant = 'primary', size = 'md', icon: Icon, className, children, ...p }) {
  return (
    <button {...p} className={clsx(
      'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45',
      size === 'sm' ? 'min-h-[36px] px-3 text-sm' : size === 'lg' ? 'min-h-[56px] px-6 text-lg' : 'min-h-[44px] px-4 text-[15px]',
      btn[variant], className)}>
      {Icon && <Icon size={size === 'sm' ? 15 : 18} aria-hidden />}{children}
    </button>
  );
}

export const Input = ({ className, ...p }) => <input {...p} className={className} />;
export const Select = ({ className, children, ...p }) => <select {...p} className={className}>{children}</select>;

export const Field = ({ label, hint, children, className }) => (
  <label className={clsx('grid gap-1', className)}>
    <span className="text-xs font-medium text-muted">{label}</span>{children}
    {hint && <span className="text-xs text-muted">{hint}</span>}
  </label>
);

export const Card = ({ title, children, right, className, flush }) => (
  <section className={clsx('ui-card grad-card my-3 rounded-2xl shadow-card', flush ? '' : 'p-4 md:p-5', className)}>
    {(title || right) && (
      <div className={clsx('mb-3 flex flex-wrap items-center gap-2', flush && 'px-4 pt-4 md:px-5 md:pt-5')}>
        <h2 className="m-0 flex-1 text-lg font-semibold">{title}</h2>{right}
      </div>
    )}
    {children}
  </section>
);

const tone = { neutral: 'bg-surface2 text-fg', green: 'bg-success/15 text-success ring-1 ring-success/30', red: 'bg-danger/15 text-danger ring-1 ring-danger/30', amber: 'bg-warning/15 text-warning ring-1 ring-warning/30', blue: 'bg-primary/15 text-primary ring-1 ring-primary/30' };
export const Badge = ({ children, color = 'neutral' }) => (
  <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tone[color])}>{children}</span>
);
const STATUS_TONE = { approved: 'green', sold: 'green', final: 'green', completed: 'green', live: 'red', in_auction: 'amber', pending: 'amber', hold: 'amber', unsold: 'red', withdrawn: 'red', rejected: 'red', disqualified: 'red' };
export const StatusBadge = ({ status }) => <Badge color={STATUS_TONE[status] || 'neutral'}>{String(status || '—').replace(/_/g, ' ')}</Badge>;

export const Stat = ({ label, value, href, icon: Icon }) => {
  const inner = (
    <div className="grad-card rounded-2xl p-4 shadow-card transition hover:border-primary/60 hover:shadow-[0_0_24px_-8px_rgb(var(--primary)/.8)]">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">{label}{Icon && <Icon size={16} className="text-primary" aria-hidden />}</div>
      <div className="text-grad mt-1 font-display text-4xl font-bold tabular-nums">{value ?? '—'}</div>
    </div>
  );
  return href ? <a href={href} className="no-underline hover:no-underline text-fg">{inner}</a> : inner;
};

export function PageHeader({ title, subtitle, right }) {
  return (
    <div className="page-header mb-4 mt-1 flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1"><h1 className="m-0">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}</div>
      {right && <div className="page-header-actions">{right}</div>}
    </div>
  );
}

export const Empty = ({ children = 'Nothing here yet.' }) => (
  <div role="status" className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center text-sm text-muted"><Inbox size={22} aria-hidden />{children}</div>
);
export const Skeleton = ({ className }) => <div aria-hidden="true" className={clsx('animate-pulse rounded-xl bg-surface2', className)} />;
export const Loading = () => <div role="status" aria-label="Loading" className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;

export function Avatar({ src, name = '', size = 44, color, className }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const s = { width: size, height: size, fontSize: size * 0.38 };
  return src
    ? <img src={src} alt={name} loading="lazy" style={s} className={clsx('shrink-0 rounded-full bg-surface2 object-cover object-top', className)} />
    : <span aria-hidden style={{ ...s, background: color || undefined }} className={clsx('inline-grid shrink-0 place-items-center rounded-full bg-surface2 font-bold text-fg', color && 'text-white', className)}>{initials || '?'}</span>;
}

/** Segmented control / tabs. options: [{value,label}] */
export function Segmented({ value, onChange, options, className }) {
  return (
    <div role="group" className={clsx('inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface2 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={clsx('!min-h-[36px] shrink-0 whitespace-nowrap rounded-lg !px-3 text-sm font-medium',
            value === o.value ? 'bg-primary text-primary-fg shadow-[0_0_14px_-3px_rgb(var(--primary)/.7)]' : 'bg-transparent text-muted hover:text-fg')}>{o.label}</button>
      ))}
    </div>
  );
}

/** Bottom sheet on mobile, centered dialog on desktop. */
export function Sheet({ open, onClose, title, children }) {
  const dialog = useRef(null), close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement, root = dialog.current;
    const selector = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusable = () => [...root.querySelectorAll(selector)];
    (focusable()[0] || root).focus();
    const k = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) { e.preventDefault(); root.focus(); }
      else if (e.shiftKey && (document.activeElement === items[0] || !root.contains(document.activeElement))) { e.preventDefault(); items.at(-1).focus(); }
      else if (!e.shiftKey && (document.activeElement === items.at(-1) || !root.contains(document.activeElement))) { e.preventDefault(); items[0].focus(); }
    };
    window.addEventListener('keydown', k);
    return () => {
      window.removeEventListener('keydown', k);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={(e) => e.stopPropagation()}
        className="grad-border max-h-[90vh] w-full overflow-y-auto rounded-t-2xl p-4 shadow-card md:max-w-lg md:rounded-2xl">
        <div className="mb-3 flex items-center"><h2 className="m-0 flex-1 text-base font-semibold">{title}</h2>
          <button className="sec !min-h-[36px] !px-2" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

// ---------- table ----------
/** cols: [{key,label,render?(row),className?}]. On phones each row becomes a stacked card (mobile="cards", default). */
export function Table({ cols, rows, rowKey = '_id', empty = 'Nothing here yet.', mobile = 'cards' }) {
  if (!rows?.length) return <Empty>{empty}</Empty>;
  const val = (c, r) => (c.render ? c.render(r) : r[c.key]);
  return (
    <>
      {mobile === 'cards' && (
        <ul className="grid gap-2 md:hidden">
          {rows.map((r, i) => (
            <li key={r[rowKey] ?? i} className="rounded-xl border border-line bg-surface2/50 p-3">
              {cols.map((c, j) => (
                <div key={c.key} className={clsx('flex items-start justify-between gap-3 py-0.5 text-sm', j === 0 && 'mb-1 font-semibold')}>
                  {j === 0 && <span className="sr-only">{c.label}</span>}
                  {j > 0 && <span className="shrink-0 text-xs text-muted">{c.label}</span>}
                  <span className={clsx('min-w-0 break-words', j > 0 && 'text-right')}>{val(c, r)}</span>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
      <div className={clsx('-mx-1 overflow-x-auto px-1', mobile === 'cards' && 'hidden md:block')}>
        <table>
          <thead><tr>{cols.map((c) => <th key={c.key} className={c.className}>{c.label}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={r[rowKey] ?? i}>{cols.map((c) => <td key={c.key} className={c.className}>{val(c, r)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </>
  );
}

// ---------- feedback ----------
/** const [msg, flash] = useFlash(); await flash(() => call(...), 'Saved'); <Msg {...msg}/> */
export function useFlash() {
  const [m, setM] = useState({});
  const flash = async (fn, ok = 'Done') => {
    try { const r = await fn(); setM({ ok: typeof ok === 'function' ? ok(r) : ok }); return r; }
    catch (e) { setM({ err: e.message }); }
  };
  return [m, flash];
}
export const Msg = ({ ok, err }) =>
  err ? <p role="alert" className="my-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>
    : ok ? <p role="status" className="my-2 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{ok}</p> : null;

export const money = (n) => (n ?? 0).toLocaleString();
export const dt = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');
