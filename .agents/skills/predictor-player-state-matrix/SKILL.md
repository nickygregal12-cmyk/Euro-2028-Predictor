---
name: predictor-player-state-matrix
description: Use when a player-facing feature needs loading, empty, partial, error, permission, open, locked, live, settled, first-use, long-content, responsive, or other meaningful state-completeness work.
---

# Predictor player state matrix architect

Use this as the **specialist for state completeness**, not as permission to invent backend states.

## Derive the real matrix

1. Read the routed authority/source/read model and list the state axes the product actually exposes.
2. Typical axes include data lifecycle, membership/permission, game phase, write status, reveal/settlement, content extremes, viewport/input mode and reduced motion. Include only axes that materially change player behaviour or presentation.
3. Remove impossible combinations before implementation. A smaller truthful matrix is better than a giant Storybook catalogue of fictional states.
4. Rank the remaining combinations by player risk/frequency and ensure the highest-value states have executable fixtures/evidence.
5. Prefer deterministic scenario builders shared by component/browser tests over ad-hoc mock objects that disagree about football/game state.

## Acceptance questions

For each important state ask:

- What can the player understand?
- What can they do next?
- Is the action truthful for the server state?
- Does retry/reload preserve or recover correctly?
- Does phone/desktop composition remain usable?
- Are focus, keyboard, announcements and reduced motion appropriate?
- Do long team/player/league names and missing optional enrichment remain layout-safe?

Use Storybook for representative presentation states and Playwright for journeys/interaction where those tools already fit. Do not add snapshots that cannot distinguish a real regression.