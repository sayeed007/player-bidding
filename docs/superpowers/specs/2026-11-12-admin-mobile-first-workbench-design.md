# Admin Mobile-First Tournament Workbench

## Intent

Give tournament organizers and super admins a clearer, faster admin experience on phones and desktop. The current admin pages share a generic shell with public tournament navigation; on mobile, public bottom tabs and a second horizontal admin menu compete for space. The dashboard shows counts and upcoming fixtures, but does not make approvals and readiness blockers the first operational tasks.

## Goals

- Make the admin portal feel like one focused workspace, separate from spectator and team navigation.
- Keep the common organizer tasks easy to reach on a phone while preserving direct access to all modules.
- Put real pending work and auction readiness ahead of general metrics on the dashboard.
- Make existing forms, tables, actions, and feedback easier to scan and operate at mobile widths.
- Preserve current paths, API contracts, business rules, permissions, audit behavior, and light/dark theme support.

## Non-goals and anti-goals

- Redesign public spectator, team owner/captain, player, or projector surfaces.
- Change backend behavior, APIs, role permissions, tournament lifecycle, auction, fixture, or result rules.
- Add new dashboard metrics or pretend workflow states without an existing API source.
- Hide existing admin modules or remove actions to make mobile layouts simpler.
- Add dependencies or replace the existing component and token system.

## Constraints

- Follow the project design contract in `docs/DESIGN.md`: Next.js 15 App Router, JavaScript, current house components, no new dependencies, APIs remain authoritative.
- Preserve the existing admin routes: dashboard, settings, players, teams, auction, fixtures, results, reports, announcements, and audit.
- Include the global `/admin` tournament directory and user management used by super admins; retain its current route and permission behavior.
- Reuse `components/ui.js`, `components/Nav.js`, and the existing token-driven styles where they fit.
- Dashboard data may come only from existing tournament, dashboard, and readiness endpoints. Keep loading, error, empty, success, and permission-denied states.
- Mobile-first means design for a 375px-wide screen before scaling up. Fixed/sticky controls must not cover navigation or page content.

## Approaches considered

1. **Tournament workbench (selected):** one admin shell with grouped navigation, a prioritized attention queue, and an overview of tournament progress. Staff can move directly between modules. This best supports recurring operational work and matches the selected mockup.
2. **Stage-led workspace:** organize the portal around setup → auction → matches → wrap-up with guided checklists. This helps first-time setup, but makes direct module access less prominent for staff who switch tasks often.
3. **Cosmetic restyle only:** keep the existing shared navigation and dashboard information order, changing colors, typography, and cards. This is the smallest patch, but leaves the duplicate mobile navigation and task prioritization problems unresolved.

## Selected design

### Admin shell and navigation

- Admin routes use an admin-specific shell instead of rendering the public global navigation as well as admin navigation.
- At `/admin`, provide two global destinations, Tournaments and Users, within the existing route. Keep tournament creation/cloning and user creation/disable/password-reset flows intact; do not add routes.
- On phones, show a compact tournament header and a five-destination bottom bar: Overview, Players, Teams, Auction, and More. `More` opens the existing sheet pattern and exposes Settings, Fixtures, Results, Reports, Announcements, and Audit.
- On desktop, use a persistent side rail grouped as Overview, Operations (Players, Teams, Auction), Competition (Fixtures, Results), and Administration (Settings, Reports, Announcements, Audit).
- On `/admin`, adapt the global Tournaments and Users navigation to phone and desktop without showing tournament-scoped navigation.
- Keep the current route names and role checks. Navigation is a UX aid; server/API permissions remain authoritative.
- Ensure settings save and match action bars sit above the mobile navigation, remain reachable, and do not cover content.

### Overview dashboard

- Show tournament identity, season, status, and lifecycle progress.
- Put a “Needs attention” section near the top, linking to pending player/team reviews and actual readiness blockers. Use existing dashboard counts and readiness results; do not infer missing business rules.
- Show the next operational milestone/readiness state and existing upcoming fixtures.
- Retain the existing summary widgets as secondary information, with each count linking to its current destination.
- Loading, error, empty, and permission states remain explicit and do not show fabricated data.

### Existing admin pages

- Keep each module’s current task flow and mutations. Apply the same page title, content width, spacing, and mobile control placement across admin pages.
- Prioritize readable approval queues, filters, and action controls on Players and Teams; auction controls remain rapid and unambiguous; fixture/results controls keep their current validation and confirmations.
- Do not change what actions are available or when they are allowed.

### Visual direction

- Use a calm, high-contrast tournament workbench: deep green admin rail, neutral page canvas, existing green primary token, and amber/red reserved for warnings and errors.
- Keep surfaces and text driven by existing CSS tokens so light/dark behavior remains intact.
- Use compact but touch-friendly controls and preserve visible focus states.

## Acceptance criteria

- At 375px width, admin pages show one admin navigation system, with all ten destinations reachable within two taps and no horizontal page overflow.
- At 375px width, `/admin` keeps tournament creation/cloning and user management usable without horizontal overflow.
- Mobile bottom navigation does not overlap sticky save, auction, or match controls; page content can scroll fully above it.
- Desktop shows the grouped side rail and a wider, uncluttered content area.
- Dashboard attention items link to real existing pages, and readiness warnings come from the current endpoint.
- Existing form validation, destructive confirmations, API calls, mutation feedback, role gates, and audit requirements are unchanged.
- Super-admin one-time password, reset, and user activation behaviors remain unchanged.
- Light and dark themes both use the existing token system.
- Public, team, player, and projector experiences are unchanged.

## Builder decisions

- Use the selected workbench mockup as the layout reference, adapting it for the requested mobile-first behavior.
- Keep existing page-level interactions and use the current `Sheet` component for the mobile `More` menu. The shared sheet must move focus inside, contain keyboard focus, and restore focus when dismissed.
- If an attention item has no safe destination or its data source is unclear, omit it and flag the gap rather than inventing workflow behavior.
