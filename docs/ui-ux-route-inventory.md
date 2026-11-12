# UI/UX Route Inventory

**Updated:** 2026-11-12  
**Scope:** App Router pages and API handlers currently present under `app/`.

This is the route inventory and polish ledger for the mobile-first app-wide UI/UX pass.

## Page routes and polish status

The remaining page families have now received a mobile-first UX pass using the existing design tokens and components. **Polished** means the route received page-specific layout, control, feedback, or navigation improvements while preserving its existing actions and API behavior. It does not mean the route has completed live browser QA.

### Admin and organizer

| Route | Status | Polish delivered |
|---|---|---|
| `/admin` | Polished | Clearer tournament and user management layout, longer action labels, responsive controls, and retry/error states. |
| `/admin/[tid]` | Polished | Existing workbench: attention queue, readiness, tournament progress, and summary links. |
| `/admin/[tid]/announcements` | Polished | Announcement count, readable message cards, explicit load/error states, and retry action. |
| `/admin/[tid]/auction` | Polished | Readiness/summary retry feedback and clearer control hierarchy while preserving safety confirmations. |
| `/admin/[tid]/audit` | Polished | Filtered empty state, retry behavior, readable audit entries, and paging controls. |
| `/admin/[tid]/fixtures` | Polished | Responsive fixture actions and explicit data/error feedback. |
| `/admin/[tid]/players` | Polished | Review controls, touch-friendly row actions, clearer filters, retry behavior, and sheet feedback. |
| `/admin/[tid]/reports` | Polished | Responsive report selector/actions, row count, horizontal-scroll hint, and retry behavior. |
| `/admin/[tid]/results` | Polished | Clearer score/action layout, detail-load retry, and reachable mobile action bar. |
| `/admin/[tid]/settings` | Polished | Grouped responsive settings, readiness retry, and reachable save action. |
| `/admin/[tid]/teams` | Polished | Responsive team cards/actions, clearer labels, and load retry behavior. |

### Public and spectator

| Route | Status | Polish delivered |
|---|---|---|
| `/` | Polished | Clearer tournament discovery cards and tap affordance. |
| `/t/[tid]` | Polished | Better section hierarchy and counts for tournament content. |
| `/t/[tid]/auction` | Polished | Clearer spectator controls and projector-view navigation. |
| `/t/[tid]/auction/live` | Polished | Full-screen projector hierarchy, horizontally scrollable sales ticker, and scrollable team summaries on short screens. |
| `/t/[tid]/fixtures` | Polished | Mobile filter card, match count, clear-filter action, and round counts. |
| `/t/[tid]/players` | Polished | Responsive search/filter controls, active-filter reset, and clearer result count. |
| `/t/[tid]/players/[pid]` | Polished | Shorter responsive photo area and clear team navigation. |
| `/t/[tid]/register` | Polished | Mobile-stacked form groups and clearer field hierarchy. |
| `/t/[tid]/standings` | Polished | Mobile-friendly column control, table caption, and qualification/tie-break explanation. |
| `/t/[tid]/stats` | Polished | Scrollable mobile statistic selector and clearer leaderboard sections. |
| `/t/[tid]/teams` | Polished | Team count, accessible card labels, and clearer squad progress. |
| `/t/[tid]/teams/[teamId]` | Polished | Clearer team profile, standings, squad, and fixture hierarchy. |

### Team owner and captain

| Route | Status | Polish delivered |
|---|---|---|
| `/team/[tid]` | Polished | Team workspace identity, budget hierarchy, and tournament/fixture shortcuts. |
| `/team/[tid]/auction` | Polished | Team return link, auction status, clearer budget metrics, and bid controls. |
| `/team/[tid]/lineup` | Polished | Return navigation, readable match metadata, selection guidance, and safe-area-aware save bar. |

### Account

| Route | Status | Polish delivered |
|---|---|---|
| `/login` | Polished | Mobile sign-in hierarchy, clearer action state, and tournament browsing link. |
| `/me` | Polished | Profile heading, tournament shortcuts, registration/team status, and labeled performance section. |

**Page totals:** 28 routes — **28 polished, 0 currently unpolished**. The workbench dashboard was completed in the earlier pass. All other route statuses changed from partial/unpolished after the current page-family pass. Browser rendering and live responsive behavior remain unverified.

## API routes

These handlers support page behavior and are not visual pages. They are listed so the route inventory is complete; this redesign did not change their contracts.

### Authentication

| Methods | Route |
|---|---|
| POST | `/api/auth/login` |
| POST | `/api/auth/logout` |
| GET | `/api/auth/me` |

### Global administration

| Methods | Route |
|---|---|
| GET, POST | `/api/tournaments` |
| POST | `/api/tournaments/[tid]/clone` |
| GET, POST | `/api/users` |
| PATCH | `/api/users/[id]` |

### Tournament administration and readiness

| Methods | Route |
|---|---|
| GET, PATCH | `/api/t/[tid]` |
| POST | `/api/t/[tid]/status` |
| GET | `/api/t/[tid]/dashboard` |
| GET | `/api/t/[tid]/readiness` |
| GET, POST | `/api/t/[tid]/users` |

### Players

| Methods | Route |
|---|---|
| GET, POST | `/api/t/[tid]/players` |
| GET, PATCH | `/api/t/[tid]/players/[pid]` |
| POST | `/api/t/[tid]/players/[pid]/[action]` |
| POST | `/api/t/[tid]/players/register` |
| GET | `/api/t/[tid]/players/export` |
| POST | `/api/t/[tid]/players/import` |

### Teams

| Methods | Route |
|---|---|
| GET, POST | `/api/t/[tid]/teams` |
| GET, PATCH | `/api/t/[tid]/teams/[teamId]` |
| POST | `/api/t/[tid]/teams/[teamId]/[action]` |
| GET | `/api/t/[tid]/teams/[teamId]/budget` |

### Auction

| Methods | Route |
|---|---|
| POST | `/api/t/[tid]/auction/[action]` |
| POST | `/api/t/[tid]/auction/reopen/[pid]` |
| GET | `/api/t/[tid]/auction/state` |
| GET | `/api/t/[tid]/auction/summary` |

### Fixtures and matches

| Methods | Route |
|---|---|
| POST | `/api/t/[tid]/fixtures/generate` |
| POST | `/api/t/[tid]/fixtures/publish` |
| GET | `/api/t/[tid]/matches` |
| GET, PATCH, DELETE | `/api/t/[tid]/matches/[mid]` |
| POST | `/api/t/[tid]/matches/[mid]/correct` |
| POST | `/api/t/[tid]/matches/[mid]/events` |
| DELETE | `/api/t/[tid]/matches/[mid]/events/[eid]` |
| POST | `/api/t/[tid]/matches/[mid]/finalize` |
| PUT | `/api/t/[tid]/matches/[mid]/lineup` |
| POST | `/api/t/[tid]/matches/[mid]/submit` |

### Standings, stats, and awards

| Methods | Route |
|---|---|
| GET | `/api/t/[tid]/standings` |
| GET | `/api/t/[tid]/stats` |
| GET | `/api/t/[tid]/leaderboards` |
| PUT | `/api/t/[tid]/awards` |

### Announcements, notifications, reports, and audit

| Methods | Route |
|---|---|
| GET, POST | `/api/t/[tid]/announcements` |
| GET | `/api/t/[tid]/notifications` |
| POST | `/api/t/[tid]/notifications/read` |
| GET | `/api/t/[tid]/reports/[name]` |
| GET | `/api/t/[tid]/audit` |

**API totals:** 45 route handlers (`route.js` files), grouped above by feature. Dynamic segments such as `[tid]`, `[pid]`, and `[action]` represent runtime path values.

## Remaining UI/UX work

The goal is polish across every page. Suggested sequence:

1. Finish the admin module pages: players, teams, auction, fixtures, results, settings, reports, announcements, audit, then global `/admin`.
2. Polish the public tournament and spectator pages, including the auction projector as its own full-screen experience.
3. Polish team owner/captain pages and the account pages (`/login`, `/me`).
4. Revisit each page at phone and desktop widths, including loading, empty, error, permission, validation, and success states.

This sequence is a work list, not a claim that those pages are currently complete. Keep existing routes, API behavior, permissions, and business rules while improving the UI.


