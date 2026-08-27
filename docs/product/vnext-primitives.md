# The vNext primitives

**Authority class:** reference (an index, not a specification)
**Governs:** what the reusable half of `src/vnext/` IS, as a list
**Does not govern:** how any of them behaves — each module's own docblock is the
authority for that, and current source outranks this page
**Opened by:** `DOC-004`. Stage 15's completion predicate requires every major
Euro 2028 surface to be "audited against the vNext quality and system
primitives", and the primitives were not enumerated anywhere. They were
distributed through `src/vnext/AGENTS.md` alongside the shell contract, the
integration contract and roughly thirty invariants, so an auditor had to
re-derive the list by inferring which paragraphs described something reusable.

---

## How to use this page

For each Euro surface, Stage 15 decides **reuse → adapt → keep
tournament-specific**, and it decides that **on semantics, not on visual
similarity**. This page exists so the first column of that decision is a list
rather than a reconstruction.

A primitive is reusable when the tournament means the same thing by it. `FormRun`
is five results and a tournament has results, so it reuses. `LeagueLadder` ranks
people in a private league and a tournament league is a private league, so it
reuses. `ConsensusBar` compares one prediction to the crowd's and that is a
concept both products hold. `VNextNav`'s four destinations are a Football Hub
information architecture, and a tournament has one competition rather than
several — so that one is **adapted or rejected**, not reused, however similar it
looks.

**Being on this list is permission to consider a primitive, never permission to
assume it.** A tournament rule is never adopted from a Hub component.

---

## 1. Foundations — `src/vnext/foundations/`

The layer nothing renders without.

| Module | What it is |
| --- | --- |
| `tokens.css` | Every vNext value, declared on the `[data-vnext]` attribute so nothing reaches `:root` and the two frontends cannot bleed. Carries a dark ramp and a **designed** light ramp (`DEC-016`). |
| `VNextRoot.tsx` | The element that sets `data-vnext`, resolves theme (choice outranks device), and provides the reduced-motion and haptics contexts. Everything vNext renders inside one. |
| `surfaces.module.css` | The surface/elevation classes. |
| `typography.module.css` | The type scale, as classes rather than as ad-hoc sizes. |
| `motion.ts` | The motion language: `vnextMotion` presets (`riseIn`, `disclose`, `stagger`, `liftAndPress`, `livePulse`, `rankMove`, `pointsEmphasis`, `navIndicator`, `railItem`), `vnextTransition`, `vnextEase`, `vnextDuration`, and `useVNextMotion` / `useVNextTransition` / `useReducedMotionPreference`. **Reduced motion is built in**, not bolted on. |
| `feedback.ts`, `feedbackContext.ts` | The semantic interaction-feedback model — `selection`, `success`, `important`, `warning` — resolved against a device preference. |
| `VNextIcon.tsx` | The lane's own outline icon vocabulary (`DEC-017`). vNext may not import the legacy `src/design-system/icons`. |
| `teamColour.ts` | `teamColourStyle`, `fixtureColourStyle`, `competitionColourStyle` — club and competition identity as CSS custom properties. |
| `format.ts` | `formatKickoffLabel`, `formatCountdown`, `formatScoreline`, `formatOrdinal`, `formatSignedPoints`, `formatNumber`, `formatTime`, `formatDayHeading`, `formatDayKey`, `formatShare`, and `configureVNextTimeZone` — pinned for determinism in stories and pointed at the viewer in the application. |
| `focusReturn.ts` | `useFocusReturn` — where focus goes when an overlay closes, given that every shell control exists twice (bar and rail). |
| `useStickyScrollPadding.ts` | `UX-007`. Keeps the two sticky bars off whatever just took focus. |

## 2. Football — `src/vnext/components/football/`

The components that are about the match rather than about the game played over it.

| Component | What it is |
| --- | --- |
| `MatchCard` | A fixture in every state one match can be in. Not itself clickable — see its docblock. |
| `TeamCrest` | Club identity: colour, kit and monogram, with an official badge only where policy allows one. |
| `FormRun` | The last five results. Colour is never the only signal; each pill carries its letter. |
| `LiveIndicator` | The live mark, and the one piece of continuous motion in the language. |

## 3. The game — `src/vnext/components/game/`

| Component | What it is |
| --- | --- |
| `PrimaryActionCard` | The one thing the player is here to do. **Exactly one per surface.** |
| `PredictionChip` | What the player said, and what it is worth. |
| `StatTile` | One number, said once, with its unit. Tabular figures. |
| `RankMovementIndicator` | Rank movement as a shape and a number before it is a colour. |

## 4. People — `src/vnext/components/social/`

| Component | What it is |
| --- | --- |
| `LeagueLadder` | A private league as the thing the game is actually about. |
| `RivalStrip` | The people the player is playing against. |
| `ConsensusBar` | Where the crowd is, and whether the player is with it. |

## 5. Chrome and navigation — `src/vnext/app/`, `src/vnext/components/navigation/`

**This group is the one most likely to be ADAPTED rather than reused**, because
it encodes the Football Hub's multi-competition information architecture.

| Module | What it is |
| --- | --- |
| `VNextShell` | The application chrome, the single `<main>`, the competition switcher, the attention layer, Jump and the overlays. A page owns its content and its `<h1>`; the shell owns everything around them. |
| `VNextShellProvider` | How a host hands the shell its world, and the `onIntent` seam that is the shell's whole outward edge. Optional: a page stays renderable alone. |
| `VNextPageHeader` | The page's own heading, inside the shell. |
| `VNextNav` | The destination list, in bar and rail shapes. `defaultNavItems` is **four Football Hub destinations** and is an IA decision, not a primitive to inherit. |
| `ScopeMarker` | The travelling pill behind a segmented control's chosen option. |
| `VNextActionsProvider` | The durable action feed's context. |

## 6. States — `src/vnext/states/`

The states any surface is in when it is not showing its content. **Every one
renders `VNextShell`**, so a player who cannot see the content can still see
where they are and can still navigate.

| Export | What it is |
| --- | --- |
| `VNextNotice` | The general notice: title, body, the page's own heading, the destination it is in, an optional retry and an optional `onIntent`. |
| `VNextNotFound` | The `*` row. A deterministic parent, no destination lit, no guessing what the player meant. |
| `VNextAccessRefused` | Signed in, and this one is not theirs. Names nothing about what it is refusing. |
| `VNextLoadingRows` | A skeleton with no numbers and no names. |

The application-side companion is `src/app/vnext/VNextSurfaceBoundary.tsx`, which
catches a **throw** — the one failure an integration adapter cannot represent as
a value — and renders `VNextNotice` inside the shell rather than letting the
whole document go.

## 7. Models — `src/vnext/models/`

Typed presentation models. They are the boundary that keeps product truth out of
presentation: a surface consumes a model, and where the model has no field the
surface draws an honest unavailable state rather than deriving one.

`ShellDestinationId`, `ShellIntent` and `VNextShellModel` in `models/shell.ts`
are the shell's own contract and are named here because anything adapting the
chrome will meet them first.

---

## What is NOT a primitive

- **`src/vnext/integration/`** — the application-facing adapter boundary. Every
  surface has its own, and they are not shared between surfaces.
- **`src/vnext/fixtures/`** — deterministic review inputs for Storybook and
  tests. They are never game rules and never read a clock, a provider or a
  network.
- **`src/vnext/workshop/`, `src/vnext/ia/`** — review and decision surfaces, not
  product.
- **Any complete surface** — `home/`, `matches/`, `leagues/`, `player/`, `lms/`,
  `championship/`, `games/`, `account/`, `discovery/`, `create/`, `invite/`,
  `onboarding/`, `wrapped/`, `predictor/`, `rules/`, `about/`. Home in
  particular is the **visual quality reference and not a page template**; each
  surface still follows its own information hierarchy.

---

## Where the rules live

This page lists. It does not rule. The universal boundaries — presentation never
invents product truth, `integration/` is the application-facing edge, the shell
owns the single `<main>`, layout responds to its container, motion ships with
reduced-motion behaviour, no new dependency — are in
[`../../src/vnext/AGENTS.md`](../../src/vnext/AGENTS.md), and the direction is in
[`ui.md`](ui.md). Each module's own docblock outranks the one-line summary it has
here, and current source outranks both.
