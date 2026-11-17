'use client';
import clsx from 'clsx';
import { Avatar, Badge } from '@/components/ui';

// Category = neon colour. `glow` is the shadow used on big cards.
export const CAT = {
  A: { chip: 'bg-[#fbbf24] text-black', from: '#f59e0b', to: '#ef4444', glow: 'shadow-[0_0_30px_-6px_#f59e0b]' },
  'B+': { chip: 'bg-[#bef264] text-black', from: '#a3ff47', to: '#22e3ff', glow: 'shadow-[0_0_30px_-6px_#a3ff47]' },
  B: { chip: 'bg-[#67e8f9] text-black', from: '#22e3ff', to: '#3b82f6', glow: 'shadow-[0_0_30px_-6px_#22e3ff]' },
  C: { chip: 'bg-[#a78bfa] text-black', from: '#8b5cf6', to: '#ff2e97', glow: 'shadow-[0_0_30px_-6px_#8b5cf6]' },
  D: { chip: 'bg-[#cbd5e1] text-black', from: '#94a3b8', to: '#475569', glow: 'shadow-[0_0_30px_-6px_#94a3b8]' },
};
// no category (hidden from the public): one neutral look for every player
const NEUTRAL = { chip: 'bg-[#cbd5e1] text-black', from: '#1d4ed8', to: '#0f172a', glow: 'shadow-[0_0_30px_-6px_#3b82f6]' };
export const catOf = (code) => (code ? CAT[code] || CAT.D : NEUTRAL);
export const CAT_COLOR = Object.fromEntries(Object.entries(CAT).map(([k, v]) => [k, v.chip]));
export const CatChip = ({ code, className }) => code ? (
  <span className={clsx('inline-flex min-w-[28px] items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-extrabold', catOf(code).chip, className)}>{code}</span>
) : null;

/** Team logo or coloured initials + name. */
export const TeamBadge = ({ team, size = 28, className, nameClass }) => (
  <span className={clsx('inline-flex min-w-0 items-center gap-2', className)}>
    <Avatar src={team?.logo} name={(team?.name || '').replace(/^Team\s+/i, '')} size={size} color={team?.color} />
    <span className={clsx('truncate font-semibold', nameClass)}>{team?.name || '—'}</span>
  </span>
);

/**
 * BIG player photo: full-bleed portrait in a category-coloured gradient frame.
 * size: 'md' (4/5) | 'xl' (taller hero). Initials on the gradient when there is no photo.
 * Children render inside the frame (overlays: name, chips, price).
 */
export function PlayerPhoto({ player, size = 'md', className, children }) {
  const c = catOf(player?.category);
  const initials = (player?.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className={clsx('relative w-full overflow-hidden rounded-2xl', size === 'xl' ? 'aspect-[5/6] sm:aspect-[4/5]' : 'aspect-[4/5]', c.glow, className)}
      style={{ background: `linear-gradient(155deg, ${c.from}, ${c.to})` }}>
      {player?.photo
        ? <img src={player.photo} alt={player.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" />
        : <span aria-hidden className="absolute inset-0 grid place-items-center font-display text-7xl font-bold text-white/80">{initials}</span>}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
      {children}
    </div>
  );
}

/** Trading-card tile for grids: big photo, name over gradient, category ribbon, optional price. */
export function PlayerTile({ player, team, price, href, className }) {
  const Wrap = href ? 'a' : 'div';
  return (
    <Wrap href={href} className={clsx('group block overflow-hidden rounded-2xl text-fg no-underline hover:no-underline', href && 'transition hover:-translate-y-0.5', className)}>
      <PlayerPhoto player={player}>
        {player.category && <span className={clsx('absolute left-2 top-2 rounded-md px-2 py-0.5 text-xs font-extrabold', catOf(player.category).chip)}>{player.category}</span>}
        {price != null && <span className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-bold text-primary backdrop-blur">{price}</span>}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="font-display text-lg font-semibold uppercase leading-tight tracking-wide drop-shadow">{player.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-white/80">
            <span className="truncate">{player.position || '—'}</span>{team && <span className="truncate">· {team.name}</span>}
          </div>
        </div>
      </PlayerPhoto>
    </Wrap>
  );
}

/** Compact player row (lists, pickers): photo thumbnail, name, chips. */
export function PlayerCard({ player, team, price, href, right, className }) {
  const Wrap = href ? 'a' : 'div';
  return (
    <Wrap href={href} className={clsx('grad-card flex items-center gap-3 rounded-xl p-2.5 text-fg no-underline hover:no-underline', href && 'hover:border-primary/60', className)}>
      <Avatar src={player.photo} name={player.name} size={56} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{player.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <CatChip code={player.category} />{player.position || '—'}{team && <> · {team.name}</>}
        </span>
      </span>
      {price != null && <Badge color="blue">{price}</Badge>}
      {right}
    </Wrap>
  );
}
