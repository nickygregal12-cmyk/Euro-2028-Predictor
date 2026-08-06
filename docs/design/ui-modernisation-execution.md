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
| Lenis smooth scrolling | **Discard** — a whole-page scroll hijack fights the browser's own scrolling and the accessibility behaviour that depends on it. (It was also named a suspect in the performance finding below; measurement cleared it, and the disposition stands on its own merits.) No production surface may adopt it without route-level performance evidence |

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

**Foundations landed.** The twelve-step neutral ramp, three surface levels, separate border ramp, six-step type scale with tracking, tabular-numeral token, motion contract, stacking order and the third radius are in `src/styles/tokens.css`, documented in [`../design-system.md`](../design-system.md) and rendered in the gallery. `tests/design-system/foundationTokens.test.ts` holds the properties that make them a system: every ramp step further from the page background than the last, every text step above AA on every surface, borders never drawn from a text or accent value, routine motion under 300ms, and one ordered stacking scale.

Two decisions worth carrying forward. First, **nothing in production consumed the new tokens at the time they landed** — they sat beside the palette in force so the target could be reviewed on screen before components adopted it, and adoption then proceeded one reviewable change at a time rather than as a single unreviewable re-skin. *(That sentence described 5 August and no longer describes today: UI-11 repointed the seven neutral tokens at the ramp, and UI-06 → UI-09 took the type scale through every stylesheet. The staging worked as intended and the note is kept because the reasoning still governs what is left.)* Second, the derivation is genuinely new rather than a rename of the current values, as §11.1's re-derivation rule requires; the live palette is untouched precisely so that its documented WCAG remediation is not disturbed while brand selection remains deferred under ADR 0019. The full re-hue, if the brand decision calls for one, replaces the ramp's values and inherits its structure.

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

## The performance finding that gated prototype adoption — measured, and it was not the code

The design-authority PR's deploy preview recorded a Lighthouse performance score of **20 — down 76 points from production — while accessibility remained 100.** This section originally listed the likely suspects: the full-page animation load, the Lenis smooth-scroll loop, the oversized prototype stylesheet, font loading, and how much Framer Motion code loads on the landing route. **Every one of them was wrong**, and the reason is worth keeping rather than quietly deleting.

Three measurements settle it:

| What was measured | Performance | Accessibility |
| --- | ---: | ---: |
| Deploy preview of the design-authority PR (documentation only, no runtime code) | 20 | 100 |
| Deploy preview of the Knip baseline PR (tooling and documentation only, no runtime code) | 21 | 100 |
| The same production build, served locally and audited directly | **86** | 100 |

Two consecutive pull requests that change **no runtime code whatsoever** score ~20, while the identical bundle scores 86 when audited outside the preview environment, with best practices and SEO at 100, total blocking time at 80ms and cumulative layout shift at zero. A runaway animation loop, a scroll hijack or a heavyweight motion bundle would show up as blocking time and layout instability; neither is present. The suspects also could not have been responsible in the first place, because none of them ship — the prototype is unreachable from the application and the Knip baseline confirmed its dependencies are unreferenced by the production graph.

So the deploy-preview score is a property of **where it is measured**, not of what was built. It is not a regression, it never gated anything real, and no prototype pattern is blocked by it.

What this changes for the Lighthouse CI work: audit **locally built, fixture-backed routes** rather than the deploy preview, or the tool measures preview infrastructure and reports it as product quality — the exact mistake this section made until it was measured. That is now how it is configured, and the recorded baseline is `/auth/login` 89, `/auth/signup` 94 and `/auth/reset` 95, with accessibility 100 on all three: [`../quality/lighthouse-baseline.md`](../quality/lighthouse-baseline.md).

The gate this section used to impose on prototype adoption is therefore **closed**. Nothing is blocked by it. What survives is the route budget work itself, where the two opportunities worth carrying forward are render-blocking resources and unused JavaScript, at roughly 450ms each.

Lighthouse budgets are route-specific, not one universal score. Performance starts advisory; broken routes, inaccessible names and severe structural/accessibility failures block immediately.

## Acceptance criteria and ownership

| Artefact | Acceptance | Owner of record |
| --- | --- | --- |
| Visual baselines | Playwright screenshots against stable `ComponentsPreview` anchors, fixed time and fixture data, covering light/dark, phone/desktop and reduced motion; diffs published on failure; baseline changes reviewed like code | The PR that changes the rendered surface |
| Lighthouse reports | Deterministic locally built fixture-backed routes; route-specific budgets recorded with the baseline; performance advisory until stable, severe functional/accessibility failures blocking from the start | The PR that adds or regresses a route |
| Generated flags | Flag subset generated from configured team/venue data, 4:3 corrected, unknown-code fallback rendered and coverage-tested; no silent missing flag | The PR that changes team/venue configuration |
| Knip report | Report-only; every finding classified into the six categories above; intentional ignores narrow and justified in place | The baseline PR, then any PR that adds an entry point |

Each first reversible product slice (step 3 onward) additionally carries the design plan's §13.4 release gate: typed page read model, explicit commands, no raw Supabase access from components, layout-shaped skeletons, optimistic save state, conflict and unknown-outcome recovery, authoritative lock explanation, MSW-driven failure scenarios, telemetry distinguishing old and new UI, and immediate rollback to the old route.

## Progress against this sequence

| Step | State |
| --- | --- |
| Activation: reconciled order, prototype classification, harness and approved systems | **Done** — this document, with `tests/design/premiumPrototypeBoundary.test.ts` |
| Knip report-only baseline with a classified report | **Done** — [`../quality/knip-baseline.md`](../quality/knip-baseline.md) |
| Visual foundations in the production design system, rendered in the gallery | **Done** — `src/styles/tokens.css`, `tests/design-system/foundationTokens.test.ts` |
| Performance evidence and the preview-score investigation | **Done** — [`../quality/lighthouse-baseline.md`](../quality/lighthouse-baseline.md); the gate is closed, see above |
| Playwright visual screenshot contracts | **Harness built; baselines outstanding by design** (UI-19). `playwright.visual.config.ts` and `e2e/visual-gallery.spec.ts` photograph thirteen curated gallery sections at two pinned widths in both themes, addressed by `data-section` anchors derived from section titles rather than by hashed CSS module class names. The gallery gained the pinned widths this needs: `?width=phone` and `?width=desktop` fix the panels at 390px and 1280px, because their normal `flex: 1 1 340px` photographs the window rather than the component. `.github/workflows/visual-contracts.yml` is dispatch-only and carries the bootstrap: one run with `update_baselines` renders the images **on the runner that will later compare them** and uploads them for review and commit; adding the `pull_request` trigger is the step after that. It is deliberately absent from `ci.yml` and the browser suite, since a screenshot suite with no baselines fails on contact. `tests/design-system/visualContractHarness.test.ts` holds the determinism decisions — pinned widths, disabled animations, `deviceScaleFactor: 1`, no retries, a tolerance tight enough to catch a structural change — so relaxing one is a visible edit |
| Adopt the foundations component by component | **Done for the ramp, the type scale and the stacking order; one transition and the DEV harnesses remain.** The type scale reached every stylesheet (UI-06 → UI-09), the seven neutral tokens were repointed at the target ramp (UI-11), and UI-15 took the stacking scale into the five places that are genuinely application layers, the last 21 off-scale font sizes in product surfaces, and the one micro transition. `tests/design-system/foundationAdoption.test.ts` is the control that was missing: it relates the tokens to their consumers, so an unadopted literal now fails rather than passing quietly, and each remaining exclusion is listed there with its reason — crest monograms, a movement triangle sized as an icon, two local sibling stacks, the DEV harness stylesheets and `ProgressBar`'s 300ms width transition |
| Close the gallery's missing states | **Done** (UI-16, UI-17). All six states the harness could not reach now have sections of their own — offline, unavailable and conflict, then refreshing, stale and the blocking error page. `tests/design-system/galleryStateCoverage.test.ts` relates the harness to the §9.1/§9.2 matrix, which is the control that was missing and the reason states could stay absent while seventy sections made the gallery look complete; it holds the matrix count, so a state added to the authority without a section fails. It earned itself immediately, catching a section titled "error, blocking" against a matrix key of "error blocking" |
| Thin competition shell and the phone-first season Match Predictor, behind a route-level flag | **Registered at `/competitions/:competitionSlug/:seasonSlug/main-predictor`, still behind `VITE_UI_SEASON_MATCH_PREDICTOR`, which is off everywhere.** The page, shell, state machine, save/conflict recovery, lock-explanation layer and telemetry category were production code already; what was missing was the two facts a route needs and no browser can obtain — which season two URL slugs mean, and which matchweek that season opens at. Contract 120's `get_season_play_context` answers both in one read, `SeasonMatchPredictorRoute` composes it with the card gateway, and the route table, Netlify status rule, route title, telemetry category and hub dashboard link all name it. The flag is not set in `netlify.toml`, deliberately: contract 120 is applied to no hosted environment, so a preview with the flag on would render a failed read rather than a card. **Flipping the flag therefore waits on the migration reaching development, not on the UI.** The axe matrix defers it with the two harness blockers named — the flag, and a seeded season entry for the harness user |
| Matchweek standings (step 4) and LMS weekly selection (step 5) | **Done** — `SeasonStandingsPage` (UI-10) over `get_season_leaderboard`, and `SeasonLmsPage` (UI-13) over contract 116. Like the Match Predictor above, both are production code reachable only from their DEV harnesses until the routes are registered |
| Public acquisition landing page (Appendix E) | **Done, behind `VITE_UI_PUBLIC_LANDING`.** Brought forward from step 8 on owner direction: until this shipped, an anonymous visitor at `/` was redirected to `/auth/login`, so the first thing anyone saw of the product was a password field for an account they did not have. `src/features/landing/` renders E.3's eight surfaces in order, in the production design system rather than the prototype's deferred Touchline brand. Guards: `tests/features/landing/`, `tests/app/publicLandingRoute.test.tsx`, and `/` added to `e2e/axe-unauthenticated.spec.ts` — the only harness that can see the signed-out root |

Keep this table in step with [`../../MASTER-TODO.md`](../../MASTER-TODO.md), which holds the same items at task granularity. A sequence document that stops recording what has happened becomes a plan nobody believes.
