# vNext frontend instructions

These instructions apply to work under `src/vnext/`.

It holds the vNext design workshop: a Storybook-reviewed presentation lane running on deterministic fixtures, with no Supabase, provider, routing or application-state dependency. It is not wired into the running product.

**`home/` is the Gold Standard surface.** It is the approved vNext Home and the quality bar every later vNext page inherits from. Treat it as the reference for composition, density, motion, team colour and accessibility — and do not propagate it to another page without that page's own brief.

## Read first

1. [`../../docs/product/ui.md`](../../docs/product/ui.md) — vNext product/presentation direction.
2. [`../../docs/product/vnext-workshop.md`](../../docs/product/vnext-workshop.md) — current workshop hypotheses and the questions left open.
3. [`../../AGENTS.md`](../../AGENTS.md) — repository-wide invariants and task routing.
4. The exact domain/service contract for the data the component actually needs.

## What is here

| Directory | Holds |
| --- | --- |
| `app/` | **the application shell** — `VNextShell`, `VNextPageHeader` |
| `foundations/` | tokens, typography, surfaces, layout primitives, motion, formatting |
| `components/` | `football/`, `game/`, `social/`, `navigation/` |
| `models/` | the typed presentation model (`football.ts`, `home.ts`) |
| `fixtures/` | one deterministic fictional matchday and the Home model built on it |
| `home/` | **the approved Home** — zones, emphasis selector, stylesheet |
| `workshop/` | `WorkshopCanvas`, the container-framed device board reviews run in |
| `stories/` | the `vNext/*` Storybook groups, which are the review surface |

## The shell contract

Start a vNext page with `app/VNextShell`. Do not copy Home.

**The shell owns** the canvas and its competition atmosphere, the page bounds,
the sticky masthead band, both navigations and the width at which they swap, the
single `<main>` landmark, the skip link, and the bottom spacing that makes mobile
content clear the bar. **The page owns** everything inside `<main>`: its own
composition, its own container thresholds, its own zones, and its single `<h1>`.

```tsx
<VNextShell destination="fixtures" header={<VNextPageHeader … />}>
  <YourPage />
</VNextShell>
```

- **Global navigation is `Home · Fixtures · Leagues · Season`,** settled by the
  Gold Standard Home. Four destinations is the most that clears a 44px target
  across a 375px bar. A bottom bar below 1120px, a masthead band at and above it,
  and exactly one of them is ever real. Competition and matchweek are CONTEXT and
  are stated in words in the page header — they never take a navigation slot, and
  page-local tabs are a page's business, not the shell's.
- **`<main>` is the shell's and `<h1>` is the page's.** The shell hands the
  header an id through context and points `aria-labelledby` at it, so neither
  side invents one. A page that renders its own `<main>` has two.
- **The page bounds arrive as `--vnext-page-inset`** (16/24/32px by band). Apply
  it where the page wants it rather than hard-coding a number, and a page that
  wants to bleed to the bounds simply does not apply it. `<main>` itself carries
  no inline padding and no maximum width: a standings table at 1920 is meant to
  use the workspace.
- **`<main>` declares the container `vnext-page`.** Every page sizes itself
  against that, never against the viewport. The shell's own bands are 760 and
  1120; a page's thresholds are its own and need not agree.
- Shell motion is the masthead entrance and the navigation indicator. Content
  entrance belongs to the page — two entrances competing is a page arriving
  twice — and route transitions are not built yet.

`vNext/Shell` stories are neutral placeholders that prove the shell hosts a page
that is not Home. **They are not designs and not authorities.** Where they and
`vNext/Home` disagree about type, colour, density or motion, Home is right.

Tokens are declared on `[data-vnext]` by `VNextRoot` and nowhere else, so no vNext value can reach a legacy screen. Layout responds to its **container**, never the viewport, so a 375px frame inside a wide monitor is an honest review.

**Home is state-adaptive.** One shell, three emphases — live, decision, competition — chosen by `home/selectHomeEmphasis.ts` from state the model already supplied. That function answers "what should Home make biggest?" and nothing else: it is not an authority for locks, scoring, settlement, reveal, official match status or progression, and it must never become one.

`AppFrame`, `Rail` and the `AppFrameProbe` rig were removed in Stage 4. Four out of four real compositions wrote their own shell rather than bending to the frame, and a layout primitive nothing chooses is dead architecture. `app/VNextShell` is not that primitive returning: it was extracted from a shipped page rather than designed ahead of one, it takes a page as children rather than a composition as slots, and Home was migrated onto it without moving a pixel.

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
- A dense zone sizes itself against its OWN container, never against the shell. The same column is 690px wide at one composition and 440px at another, so a shell-width rule is right in one place and starving club names in the other.
- Home is ONE surface with three emphases, not three pages. The stable frame — masthead, score bar, navigation, type, spacing, surfaces, team colour, motion — does not change between them; only the dominant zone and the order beneath it do.
- The application shell may not learn anything about a page. Nothing under `app/` may import from `home/` or `fixtures/`, and a prop named after Home's content — a hero, a ticker, a rank — is the shell becoming Home under a general name. `tests/vnext/shell.test.tsx` holds the import direction.
- Presentation-selection logic may read the model's own partitions and flags. It may never re-derive them: read `liveMatches`, not `kickoff` against `now`; read `urgency`, not a deadline against a clock.
- A dense zone sizes itself against its own column — and where a name can still be cut, let it wrap rather than adding another threshold. `e2e/vnext-home.spec.ts` measures clipped text at every width and emphasis.

## Context budget

For a local component change, the expected context is normally this file + `docs/product/ui.md` + `docs/product/vnext-workshop.md` + the component/test/read-model involved. Escalate to broader authorities only when the task itself requires them.
