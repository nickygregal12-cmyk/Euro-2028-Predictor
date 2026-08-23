# vNext Admin Control Room

## Problem and intended outcome

The current administrator surface is a small route strip around separate tools. It does not provide a platform-wide operational picture, `/admin` assumes the `results` capability, and the signed-in vNext product has no privileged utility entry point. The intended outcome is one coherent, responsive Control Room that presents server-owned operational truth without becoming a second rules engine or leaking privileged credentials.

## Scope

This branch may:

- replace the admin route/navigation shell with the vNext-aligned Control Room shell;
- make `/admin` a capability-neutral overview for any trusted administrator;
- capability-gate each workspace independently;
- consolidate existing competition, result, provider, reminder and AI Lab authorities into clearer operational workspaces;
- add bounded presentation/service adapters over existing protected RPCs;
- expose truthful configuration, release, quota, capacity and connection states where an authority already exists;
- add a discreet Control Room utility entry in vNext only when trusted `app_metadata` grants administrative access;
- add targeted unit/browser coverage and representative visual fixtures.

## Explicitly out of scope

This branch must not:

- change scoring, ranking, LMS survival, Championship progression, reveal, lock, publication or provider-result authority in the browser;
- authorize from `user_metadata`, profile fields, local storage or route state;
- add an in-app make-admin or revoke-admin control;
- expose provider, Supabase, Sentry, Netlify, Novu, Metabase, database or GitHub credentials;
- make paid provider calls merely to discover quota state;
- enable notification delivery, Sentry Replay, automatic user context, broad breadcrumbs, PostHog replay or Metabase deployment;
- mutate hosted Development or Production while implementing this UI;
- present unknown, failed or disabled states as healthy.

## Authorities reconciled before implementation

- `NOW.md` — repository contract and hosted-environment state.
- `AGENTS.md` — business-rule, provider, migration and Production invariants.
- `docs/product/ui.md` and `src/vnext/AGENTS.md` — vNext design and integration boundaries.
- `src/services/supabase/adminAccess.ts` / `adminCapabilities.ts` — trusted browser discovery from Auth `app_metadata` only.
- `predictor_internal.require_result_admin()` — result mutation boundary.
- `predictor_internal.require_competition_admin()` — competition/provider/AI operational boundary.
- `predictor_internal.require_publication_owner()` — Euro publication is super-admin-only; the client `tournament` token is not a substitute for that server rule.
- existing admin RPCs for season operations, entrants, provider review/change queues, result revisions, reminder health and AI Lab.
- `public.admin_ai_odds_api_status()` — retained Odds API monthly allowance, usage, soft cap and provider-reported cost/remaining evidence. The Control Room must read this authority and must not issue a paid request for display purposes.
- `docs/ops/notification-delivery.md` — implemented but intentionally disabled delivery boundary.
- `docs/ops-sentry.md` — privacy-safe Sentry policy; browser auth tokens prohibited.
- `docs/ops/metabase-analytics.md` — repository tooling exists, hosted Metabase does not.

## Capability model

The browser capability check is convenience and discovery only. Every privileged command remains server-enforced.

- `results` → Results Centre.
- `competitions` → competition, provider, games and AI operational workspaces whose shipped RPCs enforce `require_competition_admin`.
- `users` / `leagues` → route vocabulary already present in the client, but no new privileged mutation is considered authorised until a matching bounded server authority exists.
- `super_admin` → all current capabilities and owner-only Euro publication.
- `/admin` → any trusted admin capability, read-only overview only.

## Delivery stages

1. **Access, IA and shell** — trusted access snapshot, capability-neutral `/admin`, per-workspace gates, vNext-aligned shell and overview.
2. **Football operations** — provider health/quota, competition readiness, games and Results consolidation using existing authorities.
3. **People and traceability** — bounded Users/Leagues presentation where authority exists, plus unified read-only audit presentation.
4. **Platform operations** — notifications, system/release/connections, analytics and capacity with explicit configured/disabled/unknown states.
5. **Discovery, responsive acceptance and closeout** — privileged vNext entry, mobile/accessibility/error-state tests, visual fixtures and documentation evidence.

## Acceptance scenarios

### Access

- A normal authenticated user sees no Control Room entry and a guessed `/admin/**` URL is refused.
- Any trusted administrator can open `/admin`, even without `results`.
- A narrow capability sees only its permitted destinations.
- `super_admin` sees all current workspaces.
- Refreshing Auth claims changes discovery after the normal token/session refresh; no local boolean grants access.

### Operational truth

- Loading, empty, not configured, no permission, failed, stale, healthy, warning and critical remain distinguishable.
- Failed reads never collapse to zero-problem states.
- Quota-unknown remains unknown.
- Opening Admin produces no paid provider request.
- Notifications state that delivery is disabled until deployment/configuration says otherwise.
- Sentry/Netlify/Metabase/PostHog summaries do not invent external health when no bounded read exists.

### Mutations

- Existing result confirm/correct/clear controls retain server authorization and reload authoritative state.
- Provider decisions and competition opening retain existing server ownership.
- High-risk actions identify the environment and require the existing deliberate/reason-bearing flows.
- No optimistic patch becomes authoritative state.

### Responsive/accessibility

- Desktop uses a persistent operational rail and wide information canvas.
- Compact widths use a section drawer/list and stacked records rather than squeezed desktop tables.
- Navigation, dialogs, statuses and forms retain keyboard/focus/text alternatives and reduced-motion behaviour.

## Completion predicate

The branch is complete when the five stages are committed, all added code is wired through production routes, targeted tests/build/lint evidence is green or an exact external-only blocker is recorded, AI Lab remains a separate lazy workspace, no paid/provider/Production mutation was made, and the branch is ready for independent PR review.