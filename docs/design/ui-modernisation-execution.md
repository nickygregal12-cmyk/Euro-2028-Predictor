# UI modernisation — execution authority

**Status:** active delivery sequence, adopted 5 August 2026.
**What it governs:** how the target design ([`hub-architecture-and-modernisation-plan.md`](hub-architecture-and-modernisation-plan.md), rev 1.5) and the approved tooling plan ([`../quality/open-source-improvements/`](../quality/open-source-improvements/README.md)) become production code.
**What it does not govern:** any scoring, lock, membership, settlement, progression or reveal rule. Like the design plan it sits under, this is presentation and delivery only, and it sits below the ADRs.

## Why this document exists

The design authority answered "what should the finished product look like" and the tooling plan answered "which quality systems are approved" — but neither was an owned item in the live work queue, and they disagreed about order:

- the design plan's §13.2 recommends foundations → public/auth → Hub shell → competition shell → Play inbox → Match Predictor;
- the roadmap's next executable sequence reads provider rehearsal → Match Predictor → LMS → Championship → Hub shell.

Left unreconciled, a future session could reasonably choose either route. This document records the deliberate reconciliation, so the two plans stop being passive documentation and become one delivery chain. The roadmap and [`../../MASTER-TODO.md`](../../MASTER-TODO.md) point here; if this document and the roadmap ever disagree again, fix the disagreement rather than picking silently.

## The reconciled order

The design plan's §13.2 order is adopted for *foundations*, and the roadmap's product priority is adopted for the *first functional journey*. Concretely:

1. Visual foundations and component gallery — tokens, primitives and states in the production design system, proven in `src/dev/ComponentsPreview.tsx` before any product risk.
2. Thin global and competition shell foundations — enough navigation and context to host one new journey, not the full Hub experience.
3. Phone-first season Match Predictor — the first reversible product slice, behind a route-level feature flag with immediate rollback (§13.3).
4. Matchweek, monthly and form standings.
5. LMS weekly selection.
6. Predictor Championship surfaces.
7. Full Hub action and social experience.
8. Public acquisition (Appendix E) and remaining journey migration.
9. Legacy route retirement, by journey and only after the rollback window closes (§13.5).

The §13.2 phases the reconciliation *moves later* are the public/auth/onboarding shell and the full Hub Home: they build acquisition and hierarchy before any player can do anything new, whereas the season Match Predictor is where the backend is already ahead of the surface and where recurring save/lock behaviour — the highest-risk interaction pattern — gets proven earliest.

**Provider rehearsal runs in parallel, not in front.** The roadmap's provider rehearsal blocks provider-fed production behaviour; it does not block tokens, components, fixture-backed UI states or shell work, and the design plan expressly allows frontend design work to overlap backend stabilisation. Every journey built before rehearsal completes must render its fixture-backed and unavailable states honestly rather than assuming a feed.

## The premium prototype is a reference, not a starting point

`src/premium/` (`PremiumApp.tsx`, `premium.css`, `store.tsx`, `data.ts`, `types.ts`) is a parallel mock application: its own router, mock store, mock data, modal system and Lenis smooth-scroll loop. Nothing outside `src/premium/` imports it — `src/main.tsx` mounts the production `App`, so the prototype is unreachable from the real application. `tests/design/premiumPrototypeBoundary.test.ts` pins that boundary.

It must not be wired into production. Doing so would introduce a second router, a second component language and — because it uses the provisional Touchline brand while brand selection remains deferred under ADR 0019 — an unauthorised brand decision. Its value is as a visual reference from which selected patterns are extracted into the production design system.

| Prototype pattern | Disposition |
| --- | --- |
| Neutral surface/border ramps, radii, type scale, spacing, tabular numerals | **Extract** — re-derive as production tokens in step 1; do not copy `premium.css` wholesale |
| Card, row, status, alert, modal and navigation compositions | **Extract** — rebuild as production primitives against the existing token system |
| Framer Motion sheet/state transitions | **Extract selectively** — shared motion tokens with reduced-motion behaviour; ordinary hover and colour changes stay CSS |
| Lucide icon usage | **Extract** — behind project icon wrappers, per the tooling plan |
| Touchline brand marks, names and copy | **Discard** — brand selection is deferred (ADR 0019) |
| Prototype router, mock store, mock data, modal manager | **Discard** — production journeys use the real application architecture, typed read models and commands |
| Lenis smooth scrolling | **Discard** — a whole-page scroll hijack is a prime suspect in the performance finding below, and no production surface may adopt it without route-level performance evidence |

`lenis` is currently a production dependency imported only by the unreachable prototype; the Knip baseline below is expected to surface it, and it must not ship in the production bundle.

## The component and state contract harness

`src/dev/ComponentsPreview.tsx` is the declared harness for component and state contracts. No second component workshop (Storybook or similar) is introduced. The first-gallery scope for step 1:

- app and competition navigation;
- action/deadline cards;
- prediction fixtures;
- standings rows;
- loading, empty, partial, locked, offline, unavailable, conflict and error states;
- hostile long names and three-digit values;
- phone, desktop, light, dark and reduced-motion modes.

The existing static prototype contract (`tests/design/landingPrototypeContract.test.ts`) protects the HTML landing prototype; the gallery work extends equivalent protection to the production React design system, which the prototype contract does not cover.

## Approved systems and prohibited duplicates

Approved — already present, formalised by the tooling plan's source register:

- **Lucide** — the only generic icon family, behind project wrappers; bespoke Predictor marks stay.
- **`flag-icons`** — generated configured subset, corrected to 4:3, with fallback and coverage tests.
- **Framer Motion** — sheets, layout/state transitions and signature moments only.

Prohibited, deliberately, to prevent a second UI language: Heroicons, Bootstrap Icons, Ionicons, Hover.css, Animate.css, any second component workshop, any second motion system. The tooling plan evaluated these and did not approve them.

## Tool phasing

**Use now** (steps 1–2): Playwright visual contracts against stable `ComponentsPreview` anchors with fixed time and fixture data; Knip in report-only mode; Lighthouse CI baseline and ratchet.

**Use with the first functional journey** (step 3): MSW fixture scenarios for loading, offline, unauthorised, malformed and delayed requests; Better Specs conventions for new Vitest/Playwright tests (guidance, not a dependency); fast-check for scoring, ranking and state invariants the new application contracts touch.

**Add later, separately:** Stryker (narrow scheduled mutation checks on pure scoring/lock/ranking code); k6 (before closed-cohort exposure or recruitment increase); Renovate, Dependency Review, Scorecard and SBOM as repository-hygiene PRs that must not delay the first UI slice.

The tooling plan's [`05-implementation-sequence.md`](../quality/open-source-improvements/05-implementation-sequence.md) remains the per-PR detail; this section fixes *when* each phase runs relative to the UI sequence.

## Knip baseline before extraction

The report-only Knip baseline runs before significant pattern extraction, because it will expose the unreachable premium files, prototype-only dependencies such as `lenis`, unused exports, duplicate icon implementations, obsolete transition code and — just as important — the genuine entry points that must be protected. The setup PR deletes nothing. Its deliverable is a classified report: production entry point; development/test harness; reference prototype; historical evidence; confirmed dead code; requires investigation. Cleanup follows as separate, reviewable changes.

**Done.** [`../quality/knip-baseline.md`](../quality/knip-baseline.md) holds the classified findings; `knip.json` holds the entry points and `tests/scripts/knipConfiguration.test.ts` keeps them honest. It confirmed the prototype's unreachability independently, confirmed `lenis` as a production dependency shipping for nothing, and found one real defect en route — the accessibility suites were importing `axe-core` as an undeclared transitive dependency. Its most useful output for the work that follows is a caution: most "unused exports" are barrel re-exports or module-local constants carrying a needless `export`, not dead logic, so the raw report is not a deletion list.

## The performance finding that gates prototype adoption

The design-authority PR's deploy preview recorded a Lighthouse performance score of **20 — down 76 points from production — while accessibility remained 100.** That must be investigated before any prototype pattern becomes a production primitive. Likely suspects, none yet proven: the full-page animation load, the Lenis smooth-scroll loop, the oversized prototype stylesheet, font loading, and how much Framer Motion code loads on the landing route. The score alone does not identify the cause; the Lighthouse CI baseline exists to answer it with route-specific evidence.

Lighthouse budgets are route-specific, not one universal score. Performance starts advisory; broken routes, inaccessible names and severe structural/accessibility failures block immediately.

## Acceptance criteria and ownership

| Artefact | Acceptance | Owner of record |
| --- | --- | --- |
| Visual baselines | Playwright screenshots against stable `ComponentsPreview` anchors, fixed time and fixture data, covering light/dark, phone/desktop and reduced motion; diffs published on failure; baseline changes reviewed like code | The PR that changes the rendered surface |
| Lighthouse reports | Deterministic locally built fixture-backed routes; route-specific budgets recorded with the baseline; performance advisory until stable, severe functional/accessibility failures blocking from the start | The PR that adds or regresses a route |
| Generated flags | Flag subset generated from configured team/venue data, 4:3 corrected, unknown-code fallback rendered and coverage-tested; no silent missing flag | The PR that changes team/venue configuration |
| Knip report | Report-only; every finding classified into the six categories above; intentional ignores narrow and justified in place | The baseline PR, then any PR that adds an entry point |

Each first reversible product slice (step 3 onward) additionally carries the design plan's §13.4 release gate: typed page read model, explicit commands, no raw Supabase access from components, layout-shaped skeletons, optimistic save state, conflict and unknown-outcome recovery, authoritative lock explanation, MSW-driven failure scenarios, telemetry distinguishing old and new UI, and immediate rollback to the old route.

## Immediate next actions

1. ~~Land this activation change (roadmap, MASTER-TODO, design index and the premium boundary guard).~~ This document.
2. Knip report-only baseline with the classified report.
3. Visual foundations and component gallery in the production architecture.
4. Visual and performance evidence around that foundation, including the Lighthouse investigation above.
5. The thin shells and the phone-first season Match Predictor behind a route-level flag.
