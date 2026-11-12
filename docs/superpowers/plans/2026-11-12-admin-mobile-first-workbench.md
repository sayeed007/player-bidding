# Admin Mobile-First Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Redesign the super-admin and tournament-admin experience as a mobile-first operational workbench while preserving current product behavior.

**Architecture:** Use the existing Next.js App Router, shared UI kit, CSS tokens, and endpoints. Route-aware admin chrome replaces public navigation on `/admin/**`; admin dashboard and module pages keep their current feature logic and mutations.

**Tech Stack:** Next.js 15, React 19, JavaScript, Tailwind CSS 3, existing house UI components.

**Spec:** `docs/superpowers/specs/2026-11-12-admin-mobile-first-workbench-design.md`

## Global Constraints

- Follow `docs/DESIGN.md`; no new dependencies.
- Preserve `/admin`, `/admin/[tid]`, and all existing tournament-admin routes.
- Preserve backend authority, API contracts, RBAC checks, business rules, audit behavior, and mutation feedback.
- Keep shared UI token-driven for light and dark themes; maintain touch targets and visible focus states.
- Do not change public, team, player, or projector surfaces.

## Review Focus

- Admin route matching must not hide public navigation on non-admin pages; inspect `/`, `/t/[tid]`, `/team/[tid]`, and `/admin/**` after shell changes.
- Nested admin links must remain active only for their own section; navigate between same-prefix sections and verify `aria-current`.
- On 375px layouts, bottom navigation must not cover the settings save bar, auction controls, or result actions; inspect each sticky/fixed surface.
- Logged-out and wrong-role users must continue to get the existing gate behavior; inspect the admin shell before and after loading `/api/auth/me`.
- Dashboard attention items must link only to supported routes and use values from existing dashboard/readiness APIs; inspect pending, empty, and error branches in source and UI.

---

### Task 1: Route-aware admin shell and navigation

**Files:**
- Modify: `app/layout.js`
- Modify: `components/Nav.js`
- Modify: `app/admin/layout.js`
- Modify if needed: `components/ui.js`, `app/globals.css`

**Interfaces:**
- Preserve the existing public `Nav` behavior outside admin routes.
- Admin shell owns tournament context, module links, responsive navigation, and existing role gates.
- `/admin` root presents global super-admin navigation; `/admin/[tid]/**` presents tournament-scoped navigation.

- [ ] Hide public chrome only for `/admin` paths and provide one admin navigation system per viewport.
- [ ] Build the mobile tournament bar (Overview, Players, Teams, Auction, More) and More sheet for the remaining six destinations.
- [ ] Group desktop navigation into Overview, Operations, Competition, and Administration; retain the super-admin return-to-directory link.
- [ ] Give `/admin` global Tournaments and Users destinations without adding routes or changing permission checks.
- [ ] Inspect active-route, logged-out, wrong-role, and non-admin navigation behavior in browser at 375px and desktop widths.

### Task 2: Workbench dashboards

**Files:**
- Modify: `app/admin/[tid]/page.js`
- Modify: `app/admin/page.js`

**Interfaces:**
- Tournament overview consumes `/api/t/[tid]/dashboard`, `/api/t/[tid]`, and `/api/t/[tid]/readiness` only.
- Global super-admin view keeps `/api/tournaments` and `/api/users` flows and current mutation endpoints.

- [ ] Put pending player/team reviews and readiness blockers above secondary tournament counts; link each item to its existing destination.
- [ ] Keep lifecycle status, current summary widgets, upcoming fixtures, and all loading/error/empty states.
- [ ] Reorganize `/admin` into Tournaments and Users destinations while keeping create, clone, one-time password, disable/enable, and password-reset flows.
- [ ] Inspect dashboard links and the global tournament/user views with existing data and empty states; add no fixture or metrics.

### Task 3: Mobile-first layout across tournament modules

**Files:**
- Modify as needed: `app/admin/[tid]/settings/page.js`
- Modify as needed: `app/admin/[tid]/players/page.js`
- Modify as needed: `app/admin/[tid]/teams/page.js`
- Modify as needed: `app/admin/[tid]/auction/page.js`
- Modify as needed: `app/admin/[tid]/fixtures/page.js`
- Modify as needed: `app/admin/[tid]/results/page.js`
- Modify as needed: `app/admin/[tid]/reports/page.js`
- Modify as needed: `app/admin/[tid]/announcements/page.js`
- Modify as needed: `app/admin/[tid]/audit/page.js`

**Interfaces:**
- Keep each page’s existing endpoint calls, form fields, validation, confirmation dialogs, and mutation actions.
- Reuse shared `PageHeader`, `Card`, `Table`, `Sheet`, `Button`, and token styles.

- [ ] Align page title/action spacing and usable content width with the admin shell.
- [ ] Fix mobile control placement and bottom offsets where existing sticky/fixed bars would overlap the new navigation.
- [ ] Improve scan order and wrapping for filters, tables, approvals, fixture controls, and result entry without removing actions.
- [ ] Inspect the nine modules at 375px and desktop widths, including dark theme, keyboard focus, empty/loading/error states, and full-page scroll reachability.

### Task 4: Responsive acceptance pass

**Files:**
- No new files expected.

- [ ] Walk the flow from `/admin` through tournament selection, approvals, auction, fixtures/results, and reports.
- [ ] Confirm all ten tournament destinations are reachable within two taps on mobile and the `/admin` Tournaments/Users views remain reachable.
- [ ] Confirm public, team, player, and projector navigation remains unchanged.
- [ ] Do not add or run automated tests unless separately requested; report any unverified states or real API limitations.
