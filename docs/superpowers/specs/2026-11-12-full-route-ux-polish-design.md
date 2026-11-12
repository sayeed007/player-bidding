# Full Route UI/UX Polish

## Intent

Finish the mobile-first redesign across all app pages after the organizer workbench, so each route feels deliberate and usable on a phone and desktop. The user selected the workbench visual direction (A) and explicitly expanded the scope to the remaining routes.

## Goals

- Give every existing page a clear task-first hierarchy, readable content, and touch-friendly controls.
- Keep the established token palette, shared UI components, routes, auth/permission gates, API contracts, and business behavior.
- Preserve explicit loading, error, empty, permission, validation, and success feedback.
- Improve keyboard access, focus states, and responsive behavior where route code reveals gaps.

## Non-goals

- No backend or API changes, route renames, new product features, invented workflow states, dependencies, or unrelated refactors.
- No visual redesign of API handlers; the route inventory documents them for completeness.

## Approaches

1. **Route-family polish on the existing system (selected):** improve pages in public/spectator, team/account, and admin families using existing components and token styles; add only small shared primitives/styles where they improve all callers. This retains the current product identity while allowing each task flow to differ.
2. **Replace the whole frontend shell/design system:** would make all pages look uniform quickly but risks breaking route behavior and requires broad rewrites and new conventions.
3. **Global CSS restyle only:** has a small diff but cannot resolve page-specific hierarchy, filters, action flows, and feedback.

## Constraints

- Mobile-first layout, preserving the previously selected workbench direction.
- Follow `docs/DESIGN.md`; keep current Next.js/React/Tailwind stack and do not add dependencies.
- Keep API calls in existing frontend API/client paths and preserve all existing business flows, actions, confirmation behavior, and role checks.
- Maintain light/dark tokens, accessible focus, touch-sized controls, safe-area spacing, and full-page scroll reachability.
- Original admin design spec remains authoritative for the existing admin shell/dashboard; this extension covers its previously partial pages and the routes it listed as non-goals.

## Acceptance

- All 28 current page routes receive a page-specific UX pass and are marked polished in `docs/ui-ux-route-inventory.md` only after source review.
- Every existing user action, route, API request, validation, role gate, and data source remains intact.
- Shared changes remain additive and compatible with their existing callers.
- No automated tests/build are run in this session; report this verification limitation explicitly.

## Builder decisions

- Use the existing design tokens and primitives; no new dependencies.
- Route families are edited in disjoint page files, with shared CSS/components coordinated separately.
- The mobile target remains 375px before desktop scaling.
