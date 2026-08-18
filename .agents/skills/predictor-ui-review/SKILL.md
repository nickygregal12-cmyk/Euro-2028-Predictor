---
name: predictor-ui-review
description: Review Football Prediction Hub frontend work against the correct vNext or legacy production UI authority, using the repository's behavioural, visual, accessibility and performance tools without letting diagnostics replace product authority.
---

# Predictor UI review

Use this skill when designing, implementing or reviewing frontend work.

## Route by frontend lane first

### vNext

Read:

1. `docs/product/ui.md`;
2. `src/vnext/AGENTS.md`;
3. the local component/read-model/test being changed;
4. a governing ADR only when the surface crosses a product/rule boundary.

Do **not** preload the legacy design history for ordinary vNext work. vNext is a parallel frontend direction, not a reskin, and the current production token/component language does not automatically become its visual authority.

### Legacy/current production UI

Read `docs/design/README.md`, then only the legacy design document it routes to for the surface. Broad cosmetic redesign of legacy production UI requires explicit authorisation; routine work should remain bounded to the requested bug, accessibility issue or functional change.

## External references are critics, never authorities

FPL, Sky Bet, Netflix, UI UX Pro Max and other galleries/catalogues may inform hierarchy, browsing, density, responsive composition, motion, tables/charts and interaction patterns. They may not silently change a decided journey, game rule or backend authority, and they should not be copied wholesale.

Context7 may answer a **current external UI-library API question**. It does not decide how this product should look or behave.

## Review dimensions

Evaluate the affected surface on:

- **information hierarchy** — the next prediction/action and most important football state are obvious;
- **football usefulness** — form, head-to-head, venue, live state, consensus, team identity and other context earn their space by helping the player understand or compare;
- **social/rival quality** — league, rival and comparison information feels first-class where the product direction calls for it;
- **desktop composition** — wide screens gain useful density, persistent context or navigation rather than stretching a phone stack;
- **mobile action quality** — primary prediction/game actions remain thumb-friendly and direct;
- **state completeness** — loading, empty, stale, locked, error, partial-data, offline/retry and permission states are designed rather than incidental;
- **accessibility** — semantic controls, visible focus, contrast, reflow/text scaling, zoom, reduced motion, screen-reader labels and suitable touch targets;
- **interaction feedback** — saves, locks, retries and destructive actions produce immediate, unambiguous feedback;
- **motion discipline** — animation reinforces hierarchy, state change or delight without constant distraction and has a reduced-motion path;
- **responsive divergence** — desktop and mobile may use materially different compositions when that serves the task better;
- **boundary clarity** — presentation never invents scoring, locks, reveal, settlement, progression, membership or provider truth.

## Use each UI tool for one job

- **Storybook** — deterministic component/composition review surface.
- **Playwright** — user journeys, interaction, responsive behaviour, keyboard/focus and executable acceptance.
- **Playwright + axe** — accessibility interaction evidence.
- **Playwright visual contracts** — the repository's blocking approved-pixel regression contract. Deliberate baseline changes are runner-generated and reviewed like code.
- **Lost Pixel OSS** — optional extra Storybook screenshot/export view only. It is not the release visual authority and its managed service is not a repository dependency.
- **React Scan** — manual diagnosis of unnecessary React renders; it is not bundled into the application.
- **Chrome DevTools MCP** — console/network/trace/rendering/Core Web Vitals diagnosis when the browser needs explaining.
- **Lighthouse CI** — page performance budget/gate.

The distinctions matter. A screenshot cannot prove a save journey. A passing journey cannot prove the page did not visually regress. React Scan can reveal rerenders but cannot prove product correctness. A DevTools trace diagnoses why something is slow; it is not an acceptance test.

Exact commands are in `docs/ops/developer-toolchain.md`.

## Review sequence for implementation work

Use only the levels the change justifies:

1. static/unit tests for the affected model/component;
2. Storybook review for designed states where relevant;
3. targeted Playwright journey/accessibility evidence;
4. Playwright visual contract if a protected pixel surface can move;
5. React Scan or Chrome DevTools only when a performance/rendering question exists;
6. Lighthouse where the page performance budget is affected.

Do not add a visual baseline merely because a page exists. Curated contracts should protect deliberate, stable visual decisions rather than snapshot every transient implementation detail.

## Output contract for review-only work

Return findings in this order:

1. **must fix** — violates the governing UI/product authority, accessibility, required state or existing visual/behaviour contract;
2. **high-value polish** — materially improves comprehension, football usefulness, density, performance or interaction;
3. **optional exploration** — aesthetic alternatives that do not alter behaviour.

Name the affected surface/file and the authority, executable evidence or measurable heuristic behind each finding.

## Boundary

This skill is presentation-only. It may not invent or alter scoring, locks, reveal rules, membership, settlement, progression, privacy, model logic, provider truth or hosted configuration. UI diagnostic output never becomes permission to cross those boundaries.
