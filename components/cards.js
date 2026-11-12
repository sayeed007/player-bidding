'use client';
import clsx from 'clsx';
import { Avatar, Badge } from '@/components/ui';

export const CAT_COLOR = { A: 'bg-amber-500 text-black', 'B+': 'bg-emerald-500 text-black', B: 'bg-sky-500 text-black', C: 'bg-violet-500 text-white', D: 'bg-slate-500 text-white' };
export const CatChip = ({ code, className }) => (
  <span className={clsx('inline-flex min-w-[28px] items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-bold', CAT_COLOR[code] || 'bg-surface2 text-fg', className)}>{code}</span>
);

/** Team logo or coloured initials + name. */
export const TeamBadge = ({ team, size = 28, className, nameClass }) => (
  <span className={clsx('inline-flex min-w-0 items-center gap-2', className)}>
    <Avatar src={team?.logo} name={(team?.name || '').replace(/^Team\s+/i, '')} size={size} color={team?.color} />
    <span className={clsx('truncate font-medium', nameClass)}>{team?.name || '—'}</span>
  </span>
);

/** Compact player row/card. Photo falls back to initials. price shown only if provided. */
export function PlayerCard({ player, team, price, href, right, className }) {
  const Wrap = href ? 'a' : 'div';
  return (
    <Wrap href={href} className={clsx('flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-fg no-underline hover:no-underline', href && 'hover:border-primary/50', className)}>
      <Avatar src={player.photo} name={player.name} size={48} />
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
