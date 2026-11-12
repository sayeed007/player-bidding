// Who sees which "shell". Pure: safe on server and client.
//   public   -> top navbar + tab bar   (/, /t/**)
//   staff    -> admin sidebar          (/admin/**)  roles: super | organizer | auctioneer
//   team     -> team area              (/team/**)   roles: owner | captain
//   player   -> /me
export const STAFF = ['super', 'organizer', 'auctioneer'];
export const TEAM = ['owner', 'captain'];
export const isStaff = (u) => !!u && STAFF.includes(u.role);

/** Where a signed-in user belongs. Anonymous visitors stay on the public site. */
export function homeFor(u) {
  if (!u) return '/';
  if (isStaff(u)) return '/admin';
  if (TEAM.includes(u.role) && u.tournamentId) return `/team/${u.tournamentId}`;
  if (u.role === 'player') return '/me';
  return '/';
}
