---
name: predictor-ui-review
description: Review Football Prediction Hub frontend work against the correct vNext or legacy production UI authority, using external UI heuristics only as advisory evidence for hierarchy, density, responsiveness, accessibility and interaction quality.
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

## Tooling

Use Storybook, browser inspection and targeted interaction/accessibility testing when they materially improve confidence. A screenshot or visual comparison supplements executable behaviour tests; it does not replace them.

## Output contract for review-only work

Return findings in this order:

1. **must fix** — violates the governing UI/product authority, accessibility or required state;
2. **high-value polish** — materially improves comprehension, football usefulness, density or interaction;
3. **optional exploration** — aesthetic alternatives that do not alter behaviour.

Name the affected surface/file and the authority or measurable heuristic behind each finding.

## Boundary

This skill is presentation-only. It may not invent or alter scoring, locks, reveal rules, membership, settlement, progression, privacy, model logic, provider truth or hosted configuration.
