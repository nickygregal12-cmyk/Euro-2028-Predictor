# vNext frontend instructions

These instructions apply to work under `src/vnext/`.

It holds the vNext design workshop: a Storybook-reviewed presentation lane running on deterministic fixtures, plus **one integration adapter** under `integration/` that connects Home to real application reads. The presentation lane still has no Supabase, provider or routing dependency; the adapter is the only place that does, and vNext is still not wired into the running product — the connected Home is reachable only from the dev-only `/dev/vnext-home` harness.

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
| `models/` | the typed presentation model (`football.ts`, `home.ts`, `predictor.ts`) |
| `fixtures/` | one deterministic fictional matchday, the Home model, and one designed matchweek |
| `home/` | **the approved Home** — zones, emphasis selector, stylesheet |
| `predictor/` | **the Match Predictor** — the brief, the decision row, score entry, the deadline clock |
| `integration/` | **the only application-facing code** — one adapter per connected page |
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

- **`VNextPageHeader.trailing` SURVIVED THE SECOND PAGE UNCHANGED.** Stage 5 left
  the slot unsettled and said the second real page would decide it. Home puts a
  standing block there; the Match Predictor puts a deadline chip. The two have
  nothing in common but their position, which is exactly what the slot's own
  comment predicted, and neither needed a prop, a variant or a shell change. It
  also earned the predictor something real: the masthead is already sticky, so a
  page can keep one status on screen without spending viewport on a second sticky
  band. **Treat the slot as settled and keep it a slot.**

`vNext/Shell` stories are neutral placeholders that prove the shell hosts a page
that is not Home. **They are not designs and not authorities.** Where they and
`vNext/Home` disagree about type, colour, density or motion, Home is right.

Tokens are declared on `[data-vnext]` by `VNextRoot` and nowhere else, so no vNext value can reach a legacy screen. Layout responds to its **container**, never the viewport, so a 375px frame inside a wide monitor is an honest review.

**Home is state-adaptive.** One shell, three emphases — live, decision, competition — chosen by `home/selectHomeEmphasis.ts` from state the model already supplied. That function answers "what should Home make biggest?" and nothing else: it is not an authority for locks, scoring, settlement, reveal, official match status or progression, and it must never become one.

`AppFrame`, `Rail` and the `AppFrameProbe` rig were removed in Stage 4. Four out of four real compositions wrote their own shell rather than bending to the frame, and a layout primitive nothing chooses is dead architecture. `app/VNextShell` is not that primitive returning: it was extracted from a shipped page rather than designed ahead of one, it takes a page as children rather than a composition as slots, and Home was migrated onto it without moving a pixel.

Do not load database, provider, AI Lab or deployment history for ordinary component/layout work unless the surface genuinely crosses one of those boundaries.

## The integration contract

`integration/` is the ONE place vNext knows the application exists. There is one
adapter per connected page — `home/` and `predictor/` — and each has the same four
parts, because the split is the point:

| File | Job |
| --- | --- |
| `*Source.ts` | what the application hands over — existing read models, nothing reshaped |
| `useVNext*Source.ts` / `useVNextPredictorContext.ts` | acquisition only, through existing services; no mapping |
| `build*Model.ts` | **pure** `Source → Model`; no network, storage, clock or React |
| `VNext*Screen.tsx` | loading/signed-out/no-competition/failed, then the surface |

- **`VNextHome({ model })` stays usable without any of it.** Storybook, the
  deterministic visual matrix and every render test hand Home a model directly.
  The approved surface did not become network-dependent; it gained a caller.
- **The direction is `components → models` and `integration → services`,** never
  `components → services`. `tests/vnext/vnextProductionBoundary.test.ts` holds
  all of it: the presentation lane cannot reach `src/features/`,
  `src/services/` or the legacy design system, no visual component can reach
  Supabase or the generated database types, and `VNextHome` cannot reach
  `integration/`.
- **The adapter consumes truth; it never computes it.** Live is
  `live.kind === 'in_play'` (contract 135), editability is
  `presentCard(...).editable`, rank is contracts 151 and 128, and whether a point
  value is awarded or provisional is contract 175's per-fixture `basis`. The
  mapper does no arithmetic beyond subtracting two numbers already on the same
  screen — a gap, a points difference, an accuracy split over one denominator.
- **Unavailable is `null`, and `null` is never zero.** `pointsToday`,
  `provisionalPoints`, season `rankMovement`, `venue`, `headToHead`, `broadcast`,
  `clock`, `leaguePosition`, `crestUrl`, prediction `outcome` and friends
  consensus are all absent from current reads. `fixtures/home/scenarios.ts`'s
  `reduced` scenario is the deterministic visual authority for that state; the
  four approved scenarios were not edited to make room for it.
- **Storybook stays deterministic.** Real-data review happens at `/dev/vnext-home`
  and `/dev/vnext-match-predictor`, both behind `import.meta.env.DEV`. A story must
  never change because somebody scored.
- **A COMMAND GOES OUT THROUGH THE APPLICATION'S OWN HOOK.** The predictor writes
  through `useSeasonMatchPredictor`, which already owns optimistic saving, save
  ordering, conflict classification and reload. vNext supplies an `actions` object
  over it and nothing more; a second save path here would be a weaker duplicate of
  a hook that has already been got right. `PredictorActions`' five members are the
  three `MatchPredictorCommand` cases plus that hook's two recovery controls, and
  `clearPrediction` is `setPrediction(id, null)` because that is how the RPC
  clears.
- **A PAYLOAD BELONGS TO THE IDENTITY THAT ASKED FOR IT** — Stage 6's rule, kept by
  whichever means the code allows. The predictor's own reads store the request
  identity with the payload; the card cannot, because the shared hook holds it, so
  the component that calls that hook is given a `key` of the identity and remounts
  instead. Either way, `old payload + new user` has no expression.
- **`partial` is the one presentation-owned prediction state,** and it exists
  because `save_season_prediction` refuses one score without the other. It lives in
  `predictor/ScoreEntry.tsx`, reaches no server, survives no reload, and
  `buildPredictorModel` cannot produce it. Do not grow it into a draft store —
  there is already a real one, `INNOV-020`'s, behind the same hook.

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
- **A LIVE COUNTDOWN IS PRESENTATION; A PERMISSION FROM ONE IS NOT.** A model's
  `generatedAt` is the instant the application answered at, and it moves only when
  the model is rebuilt — so a page that draws a countdown straight against it goes
  stale the moment the player stops interacting. The one sanctioned mechanism is
  `predictor/useDeadlineClock.ts`: a DISPLAY instant anchored to `generatedAt` and
  advanced by observed elapsed time, produced once per page and passed down, so
  every deadline and every kickoff label on that page is measured against the same
  moment. It may do exactly two things — make a countdown current, and decide it is
  time to call the application's own `reload` (once per distinct `lock.at`, on a
  card the application already says is `open`). It may not produce `locked`,
  `closed`, non-editability, a Joker refusal, a settlement or a reveal, and
  `urgency` stays the mapper's because it is a decision rather than a format. Do
  not put an interval in a visual component, and do not rebuild a model on a timer
  to fake a fresh answer.
- A dense zone sizes itself against its own column — and where a name can still be cut, let it wrap rather than adding another threshold. `e2e/vnext-home.spec.ts` measures clipped text at every width and emphasis.
- **A ROW MEASURES ITSELF, not the column that placed it.** Stage 7 is where this stopped being a slogan: at 1920 the predictor's working column takes two fixtures across, so a row has ~730px of a ~1480px column, and a row that had queried the column would compose as though it had all of it. A container query is answered by an ANCESTOR, so the row declares `container-name` and its own body asks the question. `e2e/vnext-predictor.spec.ts` measures the outcome per row.
- **Do not truncate a club name.** Home stopped at two lines then ellipsised; the browser suite caught that clipping "Strathallan Caledonian Thistle" in a ~150px scoreboard column. The predictor has no line clamp on a club name at all — the row grows, `overflow-wrap: anywhere` stops a long word widening it, and with nothing hiding overflow the defect cannot reopen.

## Context budget

For a local component change, the expected context is normally this file + `docs/product/ui.md` + `docs/product/vnext-workshop.md` + the component/test/read-model involved. Escalate to broader authorities only when the task itself requires them.
