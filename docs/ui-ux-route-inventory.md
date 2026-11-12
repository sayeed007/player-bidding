# UI/UX Route Inventory

**Updated:** 2026-11-12  
**Scope:** App Router pages and API handlers currently present under `app/`.

This is the route inventory and polish ledger for the mobile-first app-wide UI/UX pass.

## Review ledger (revalidated 2026-11-12, after the "Match Night" restyle)

Inventory check: **28 page routes and 45 API handlers on disk — both match this document exactly.**

"Polished" below means *restyled*. It is **not** QA. The ledger records what was actually looked at in a browser (390px phone width unless noted, local build, Next 15.5.29). Everything not marked ✅ is restyled but **unreviewed**, so treat it as unverified until we go through it.

| Route | Browser-checked | Finding |
|---|---|---|
| `/t/[tid]` | ✅ | Hero, live banner, scoreboard cards look right. |
| `/t/[tid]/players` | ✅ | Photo tiles good; names wrap. |
| `/t/[tid]/players/[pid]` | ✅ | Large portrait hero OK; empty-stats state OK. |
| `/t/[tid]/auction` | ✅ | Big portrait + bid OK. |
| `/t/[tid]/auction/live` | ✅ (1280×720) | Projector layout good at 16:9. Not checked at 1920×1080 or on a phone. |
| `/t/[tid]/standings` | ✅ | Fits 390px; leader highlighted. |
| `/t/[tid]/stats` | ✅ | Tabs + empty states OK. |
| `/team/[tid]` | ✅ | Budget hero, CTA, quota bars OK. |
| `/team/[tid]/auction` | ✅ | Photo is huge, bid bar sticky. **Open issue:** at ~660px viewport height the bar covers the top of the bid card (fine at 844px). |
| `/` `/login` `/me` `/t/[tid]/register` | ❌ | Unreviewed. |
| `/t/[tid]/fixtures` `/teams` `/teams/[teamId]` | ❌ | Unreviewed. |
| `/team/[tid]/lineup` | ❌ | Unreviewed. |
| All 11 `/admin/**` pages | ❌ | Unreviewed. Admin has its own chrome (hand-polished); check it after the theme change. |

Known data/UX issues found while reviewing:
- Auction progress "6/60 sold" counts the 6 pre-assigned captains as sold.
- Some tournament status text can look wrong right after a reseed (status is real DB state, not a bug).

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

All 28 pages are restyled; the remaining work is **verification and fixes, route by route**. Suggested order (highest event-day risk first):

1. Auction path: `/admin/[tid]/auction` (auctioneer console), then re-check `/team/[tid]/auction` on a real phone and the projector at 1920×1080.
2. Results path: `/admin/[tid]/results` (scorekeeper), `/admin/[tid]/fixtures`, `/team/[tid]/lineup`.
3. Setup path: `/admin/[tid]/players` (bulk photos), `/admin/[tid]/teams`, `/admin/[tid]/settings`, `/admin/[tid]/page`, `/admin`.
4. Public remainder: `/`, `/t/[tid]/fixtures`, `/teams`, `/teams/[teamId]`, `/register`.
5. Account: `/login`, `/me`; then reports, announcements and audit.

For each route check phone (390px) and desktop widths, plus loading, empty, error, permission, validation and success states. Keep existing routes, API behavior, permissions and business rules while improving the UI. Record the result in the review ledger above.


