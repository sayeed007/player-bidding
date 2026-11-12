# Full Route UI/UX Polish Implementation Plan

> **For agentic workers:** Direct implementation was requested. Work in the active workspace because this checkout has no `.git` directory. Do not run tests/build under the session instruction.

**Goal:** Polish every page route for mobile-first UX while retaining current product and workflow behavior.

**Architecture:** Keep the existing Next.js App Router and house UI. Improve each route family in disjoint page files and make small token-driven shared refinements only where they benefit all pages.

**Tech Stack:** Next.js 15, React 19, JavaScript, Tailwind CSS 3, existing house UI components.

**Spec:** `docs/superpowers/specs/2026-11-12-full-route-ux-polish-design.md`

## Global constraints

- Follow `docs/DESIGN.md`; do not add dependencies.
- Preserve current routes, API calls/contracts, permissions, audit behavior, validation, and mutation feedback.
- Keep light/dark theme tokens and keyboard focus behavior.
- Target 375px mobile layouts first; keep safe areas and sticky controls reachable.
- Existing user instruction prohibits running tests/build unless asked; make no automated verification claims.

## Review focus

- Account and role gates continue to distinguish logged-out, wrong-role, and unlinked users.
- Sticky auction, results, and lineup actions remain above mobile navigation and do not obscure content.
- Data-dependent pages keep error, loading, empty, and success states separate.
- Public pages expose only data already supplied by public APIs.
- UI changes do not alter one-time credential display or privileged confirmations.

---

### Task 1: Public and spectator pages

**Files:** `app/page.js`, `app/t/[tid]/**/page.js`

- [x] Polish tournament discovery/home, fixtures, standings, stats, players, player detail, teams, team detail, registration, spectator auction, and projector pages.
- [x] Preserve polling and only existing public data; handle mobile navigation/filters and page states clearly.

### Task 2: Team and account pages

**Files:** `app/team/[tid]/**/page.js`, `app/login/page.js`, `app/me/page.js`

- [x] Polish team dashboard, bid room, lineup selection, login, and player profile.
- [x] Preserve budget/quota guards, idempotent bidding, lineup submission, and account gates.

### Task 3: Admin module pages

**Files:** `app/admin/page.js`, `app/admin/[tid]/{announcements,auction,audit,fixtures,players,reports,results,settings,teams}/page.js`

- [x] Polish global administration and all nine previously partial tournament-admin pages.
- [x] Preserve forms, filters, approval actions, auction safety confirmations, fixture/result rules, reports, audit, and one-time secrets.

### Task 4: Shared refinements and route ledger

**Files:** `components/ui.js`, `app/globals.css`, `docs/ui-ux-route-inventory.md`

- [x] Make small additive component/token refinements required by the route work.
- [x] Review all 28 page route sources, mark actual polish scope, and ensure totals match the filesystem.
- [x] Record checks skipped and remaining risks in the final response.

