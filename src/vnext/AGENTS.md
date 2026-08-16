# vNext frontend instructions

These instructions apply to work under `src/vnext/`.

It holds the vNext design workshop: a Storybook-reviewed presentation lane running on deterministic fixtures, with no Supabase, provider, routing or application-state dependency. It is not wired into the running product.

## Read first

1. [`../../docs/product/ui.md`](../../docs/product/ui.md) — vNext product/presentation direction.
2. [`../../docs/product/vnext-workshop.md`](../../docs/product/vnext-workshop.md) — current workshop hypotheses and the questions left open.
3. [`../../AGENTS.md`](../../AGENTS.md) — repository-wide invariants and task routing.
4. The exact domain/service contract for the data the component actually needs.

## What is here

| Directory | Holds |
| --- | --- |
| `foundations/` | tokens, typography, surfaces, layout primitives, motion, formatting |
| `components/` | `football/`, `game/`, `social/`, `navigation/` |
| `models/` | the typed presentation model (`football.ts`, `home.ts`) |
| `fixtures/` | one deterministic fictional matchday and the Home model built on it |
| `workshop/` | the responsive canvas and the throwaway sketch composition |
| `stories/` | the `vNext/*` Storybook groups, which are the review surface |

Tokens are declared on `[data-vnext]` by `VNextRoot` and nowhere else, so no vNext value can reach a legacy screen. Layout responds to its **container**, never the viewport, so a 375px frame inside a wide monitor is an honest review.

**There is no approved Home screen here.** `workshop/WorkshopHomeSketch.tsx` is a rig that proves the primitives fit together; it is not a design and must not be propagated.

Do not load database, provider, AI Lab or deployment history for ordinary component/layout work unless the surface genuinely crosses one of those boundaries.

## vNext rules

- vNext is a parallel frontend lane, not a gradual reskin of the legacy production UI.
- Home is the first gold-standard screen and should establish the quality bar before broad propagation.
- Early workshop/concept work uses realistic mocked data. Do not create a Supabase dependency just to make a concept feel real.
- Preserve existing backend/domain/scoring/auth/service infrastructure. Integration should use bounded read models/services when the real-data phase begins.
- Desktop may use substantially more information and a different composition from mobile; do not simply stretch a phone stack across a wide screen.
- Prioritise football state, prediction action, social/rival comparison and useful context over decorative dashboard furniture.
- Motion should explain hierarchy/state or add deliberate delight, with reduced-motion behaviour designed at the same time.
- Storybook/browser review, responsive states, keyboard/focus behaviour, text scaling and accessibility are part of frontend acceptance.
- Presentation may not invent scoring, locks, reveal, settlement, progression, membership or provider authority.
- Do not broadly restyle legacy components as a shortcut. If shared infrastructure is worth reusing, separate infrastructure reuse from visual inheritance.
- Use the dependencies the repository already has. Do not add a router, a state library, a CSS framework, a component library, an icon set, an animation library or a data-fetching layer to vNext.
- Fixtures are deterministic. Nothing under `fixtures/` or `foundations/format.ts` may read the clock; components take `now` as an input.
- Mocked values are presentation inputs, never game rules. Provisional points are labelled provisional, and optional fields stay optional honestly.
- Every motion primitive ships its reduced-motion pair in the same change. Resolve motion through `useVNextMotion`, never by reading variants directly.

## Context budget

For a local component change, the expected context is normally this file + `docs/product/ui.md` + `docs/product/vnext-workshop.md` + the component/test/read-model involved. Escalate to broader authorities only when the task itself requires them.
