# vNext frontend instructions

These instructions apply to work under `src/vnext/`.

It holds the vNext design workshop: a Storybook-reviewed presentation lane running on deterministic fixtures, plus **integration adapters** under `integration/` that connect Home, the Match Predictor, Matches, Leagues, player profiles and Last Man Standing to real application reads. The presentation lane still has no Supabase, provider or routing dependency; the adapters are the only place that does, and vNext is still not wired into the running product — the connected surfaces are reachable only from the dev-only `/dev/vnext-home`, `/dev/vnext-match-predictor`, `/dev/vnext-matches`, `/dev/vnext-leagues`, `/dev/vnext-player` and `/dev/vnext-lms` harnesses. **`/dev/vnext-lms` is the first one that WRITES: pressing a club there really spends it.**

**`home/` is the Gold Standard surface.** It is the approved vNext Home and the quality bar every later vNext page inherits from. Treat it as the reference for composition, density, motion, team colour and accessibility — and do not propagate it to another page without that page's own brief.

## Read first

1. [`../../docs/product/ui.md`](../../docs/product/ui.md) — vNext product/presentation direction.
2. [`../../docs/product/vnext-workshop.md`](../../docs/product/vnext-workshop.md) — current workshop hypotheses and the questions left open.
2b. [`../../docs/product/vnext-shell-ia.md`](../../docs/product/vnext-shell-ia.md) — **THE SELECTED INFORMATION ARCHITECTURE (Stage 7.6). Concept A, the Competition Deck, is the accepted vNext IA and the contract `app/VNextShell` implements. Read this before touching navigation, the shell or any destination.**
2c. [`../../docs/product/vnext-ia-lab.md`](../../docs/product/vnext-ia-lab.md) — Stage 7.5's three concepts and the capability audits, now the EVIDENCE for that decision. Concepts B and C are kept and are not primary architectures; do not build on either as though it had won.
2d. [`../../docs/product/vnext-matches.md`](../../docs/product/vnext-matches.md) — **THE MATCHES SYSTEM (Stage 8). The match-state contract, the live-data honesty rules, the combined-scope decision, which Match Centre modules may exist, and the TV Mode relationship. Read this before touching anything that draws a fixture.**
2e. [`../../docs/product/vnext-leagues.md`](../../docs/product/vnext-leagues.md) — **THE LEAGUES SYSTEM (Stage 9). The social identity rule — a row is openable because the SERVER said so, never because a display name matched — the two-tables-two-rank-authorities decision, and what a standings surface may never compute. Read this before touching anything that draws a player.**
2f. [`../../docs/product/vnext-player-profiles.md`](../../docs/product/vnext-player-profiles.md) — **THE PLAYER SYSTEM (Stage 10). Three reads with THREE DIFFERENT permission boundaries and therefore no page-level permission; the page is named by the server because nothing can pass it a display name; the chart plots a POSITION and its axis is inverted once, in one function; the head-to-head states its denominator because its window is truncated; and the reveal boundary is enforced by ABSENCE, so nothing may be inferred from a gap. Read this before touching anything that draws a person's season.**
2g. [`../../docs/product/vnext-lms.md`](../../docs/product/vnext-lms.md) — **THE SURVIVAL GAME (Stage 11), and the first vNext surface that WRITES. A club winning is not a player surviving — `LmsClubResult` and `LmsStanding` are different types with no conversion, because whether a draw eliminates is a stored rule only the settlement job runs. An ineligible club has NOTHING TO PICK WITH: `pick` is the only union case carrying a team id, so a used or shut club cannot be submitted by a component that decides to try. The lock is the SERVER'S answer (contract 164's `revealed`) and the instants are only the fallback — and it may only speak for the window it is actually about. Read this before touching anything that spends something a player cannot get back.**
3. [`../../AGENTS.md`](../../AGENTS.md) — repository-wide invariants and task routing.
4. The exact domain/service contract for the data the component actually needs.

**Known open findings against this lane** are recorded at
[`../../docs/quality/audits/2026-08-19-vnext-programme-review.md`](../../docs/quality/audits/2026-08-19-vnext-programme-review.md),
with their live status in
[`../../docs/quality/risk-register.md`](../../docs/quality/risk-register.md) and
[`../../docs/quality/deferred-decisions.md`](../../docs/quality/deferred-decisions.md):
`TEST-002` — the surface conformance checklist is duplicated across the eight
browser specs and has drifted between them; `UX-006` — this lane's palette has no
contrast matrix while the legacy one does; `TEST-003` — nothing states how drawn
geometry is verified; `DEC-016` and `DEC-017` — the light theme and the icon
system are undecided. They are **evidence and known defects, not authority.**
They add no scope to an ordinary task, and current code and tests outrank them.

## What is here

| Directory | Holds |
| --- | --- |
| `app/` | **the application shell** — `VNextShell`, `VNextPageHeader` |
| `foundations/` | tokens, typography, surfaces, layout primitives, motion, formatting |
| `components/` | `football/`, `game/`, `social/`, `navigation/` |
| `models/` | the typed presentation model (`football.ts`, `home.ts`, `predictor.ts`, **`shell.ts`**, **`matches.ts`**, **`leagues.ts`**, **`playerProfile.ts`**, **`lms.ts`**) |
| `fixtures/` | one deterministic fictional matchday, the Home model, one designed matchweek, ten deterministic shell worlds, **twelve Matches worlds plus twelve Match Centre worlds**, **twenty-one Leagues worlds**, **twenty-seven player-profile worlds** and **twenty-five Last Man Standing worlds** |
| `home/` | **the approved Home** — zones, emphasis selector, stylesheet |
| `predictor/` | **the Match Predictor** — the brief, the decision row, score entry, the deadline clock |
| `matches/` | **Matches and the Match Centre** — the fixture list, the row, the state marks, the Match Centre composition |
| `leagues/` | **Leagues** — the page, the two standings tables, and the one component that decides whether a player row may be opened |
| `player/` | **the player profile** — the page, the rank chart, the comparison table and the reveal-safe matchweek history |
| `lms/` | **Last Man Standing** — the page, the pick list, the pool counts and the organiser's rules. A club is pressable iff its action carries an id |
| `integration/` | **the only application-facing code** — one adapter per connected page (`home/`, `predictor/`, `matches/`, `leagues/`, `playerProfile/`, `lms/`). **`lms/` is the only one that writes.** |
| `ia/` | **Stage 7.5's information-architecture lab** — three navigation concepts and the interaction-feedback prototype. **Historical evidence for why the selected IA exists.** Nothing here is accepted, nothing under `app/` may import it, and it is not deleted |
| `workshop/` | `WorkshopCanvas`, the container-framed device board reviews run in |
| `stories/` | the `vNext/*` Storybook groups, which are the review surface |

## The shell contract

Start a vNext page with `app/VNextShell`. Do not copy Home.

**THE SHELL IS THE COMPETITION DECK, AND THAT IS SETTLED (Stage 7.6).** Stage
7.5 asked whether `Home · Fixtures · Leagues · Season` was the right permanent
navigation at all. It was not. The human selection is **Concept A, the
Competition Deck** — competition-context-first — with cross-competition
attention retained from Concept B as a SECONDARY layer and Jump retained from
Concept C as an OPTIONAL accelerator. `docs/product/vnext-shell-ia.md` records
the decision and the rationale; do not re-open it in a component.

> **I am inside a football competition. Everything beneath the shell belongs to
> that competition until I deliberately change it.**

```tsx
// A page, on its own. Renderable with no application behind it — Storybook,
// the visual matrix and every render test do exactly this.
<VNextShell destination="games" header={<VNextPageHeader … />}>
  <YourPage />
</VNextShell>

// A page inside a real world. The HOST wraps; the page never sees the model.
<VNextShellProvider model={shellModel} onIntent={…}>
  <VNextHome model={homeModel} />
</VNextShellProvider>
```

- **THE SHELL OWNS THE APPLICATION AND THE PAGE OWNS `<main>`.** The shell owns
  the active football context, competition switching, the discovery entry, the
  four destinations, the attention indicator, Jump, the account entry, the
  canvas and its atmosphere, the page bounds, the sticky masthead, the single
  `<main>`, the skip link, mobile safe-area clearance and the width at which the
  bar becomes a rail. **A PAGE OWNS NONE OF THAT.** Stage 5 let Home pass a
  `navItems` array with an open-prediction count on it; that prop is gone, and
  the count now arrives on the shell model from the host that knows it.
- **Global navigation is `Home · Matches · Games · Leagues`,** and they belong
  to the ACTIVE COMPETITION rather than to the platform. There is no global
  Matches, no global Games and no global Leagues. Four is still the most that
  clears a 44px target across a 375px bar, which is why the attention layer and
  Jump are not a fifth and a sixth.
- **`Games`, NOT `Play`.** This product already uses both words and they already
  mean different things: a *game* is a joinable format
  (`get_competition_games`, `CompetitionGameKey`, onboarding's "Choose your
  games"), and `/play` is the action inbox whose job the Competition Deck moves
  into Home. The full comparison is `docs/product/vnext-shell-ia.md` §3. The
  label is a field on the shell model, so revisiting it is a copy change.
- **A bottom bar below 1120px, a competition RAIL at and above it, and exactly
  one of them is ever real.** `display: none` takes the other out of the
  accessibility tree as well as off the page.
- **THE MODEL IS `models/shell.ts` AND THE SHELL REACHES NOTHING ELSE.** No
  Supabase type, no generated database type, no RPC shape and no route. Every
  control emits a `ShellIntent`; the host decides what it means, which is what
  makes the same shell work under `useState` in Storybook, a state hook in the
  dev harness and a router after cutover.
- **THREE DIMENSIONS, KEPT APART:** football context, game, people. No field
  derived from another, the same discipline
  `features/hub/playerCompetitions.ts` applies to Follow/Join/Favourite. A game
  drawn with a competition's furniture is a game masquerading as football
  context, which is how Last Man Standing became "another little tab".
- **THE PLATFORM MAY BE LARGE; THE PLAYER'S PRODUCT MUST FEEL SMALL.**
  `contexts` is the PLAYER's list and never the platform's. At one competition
  the switcher is a LABEL and not a control, there is no shortcut group, and no
  other competition's name appears in the permanent chrome — but Explore is
  still one press away, because the catalogue is not the player's competitions.
  At twenty published the rail still shows six and a count.
  `e2e/vnext-shell.spec.ts` MEASURES the chrome at one, four, twelve and twenty.
- **ATTENTION IS SECONDARY AND QUIET.** It renders nothing at all when nothing
  is waiting elsewhere — not a zero and not a greyed bell — it names the
  competition and the game separately, and it never reports work in the
  competition the player is already in, because Home answers that. It reads no
  clock: `urgency` is the application's decision and `detail` is its copy.
- **JUMP IS OPTIONAL AND GROUPED.** Offered only where the rail has stopped
  being complete (`shellJumpAvailable`), desktop only, three separate groups —
  competitions, games, leagues — and never a flat list. It searches the
  player's own world and never the catalogue. `Ctrl/⌘+K` is an accelerator, is
  guarded out of text fields, and is never the route.
- **`<main>` is the shell's and `<h1>` is the page's.** The shell hands the
  header an id through context and points `aria-labelledby` at it. A page that
  renders its own `<main>` has two — and so does a HOST that wraps a page in a
  second `VNextShell`. Use `VNextShellProvider`.
- **The page bounds arrive as `--vnext-page-inset`** (16/24/32px by band).
  `<main>` itself carries no inline padding and no maximum width: a standings
  table at 1920 is meant to use the workspace.
- **`<main>` declares the container `vnext-page`.** Every page sizes itself
  against that, never against the viewport. The shell's own bands are 760 and
  1120; a page's thresholds are its own.
- **`data-vnext-shell-zone` is the SHELL's structural marker and
  `data-vnext-zone` is a PAGE's.** The rail is `display: none` below 1120, and
  putting it in the page vocabulary hung every phone-width measurement in
  `e2e/vnext-home.spec.ts` on a selector that waits for the first zone to be
  visible.
- **Shell motion is the masthead entrance, the navigation indicator and the
  overlays' entrance.** Content entrance belongs to the page — two entrances
  competing is a page arriving twice. **A competition switch is never delayed by
  an animation:** the intent goes out and the sheet closes in the same tick.
- **`VNextPageHeader.trailing` SURVIVED THE SECOND PAGE UNCHANGED.** Home puts a
  standing block there; the Match Predictor puts a deadline chip. The two have
  nothing in common but their position, which is exactly what the slot's own
  comment predicted. **Treat the slot as settled and keep it a slot.**

`vNext/Shell` stories are the review surface for the ARCHITECTURE — ten
deterministic worlds from one competition to twenty published, plus the two real
pages inside it. **The `Games` and `Leagues` destination bodies are still stubs and
are NOT designs**; `Matches` is now a real surface and `vNext/Matches` is its review
group. Where a stub and `vNext/Home` disagree about type, colour, density or motion,
Home is right.

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
- **A MATCH CLOCK IS PROVIDER DATA OR IT DOES NOT EXIST.** Nothing in this lane may
  derive a live minute, a half, injury time, a full-time whistle, a postponement or
  an abandonment from `Date.now() - kickoff`. The platform's live projection
  (contract 135) carries a status, two optional scores and an observation instant,
  and **no minute at all** — so `LIVE` with no minute is a DESIGNED state and not a
  degradation. `models/matches.ts` puts a clock only inside `MatchObservation`, which
  exists only on the two states a provider has actually reported on, so a scheduled
  match has no field that could hold one. `docs/product/vnext-matches.md` §7.
- **A PROVIDER MAY REFINE A FIXTURE; IT MAY NOT POSTPONE ONE.** `season_fixtures.
  status` is the platform's administrative state and wins. `live.kind` may only turn
  a `scheduled` fixture into `live` or `awaitingResult`. A feed's `postponed`,
  `abandoned` or `cancelled` is discarded, because letting one through would empty a
  fixture list on a provider's say-so.
- **A PROVIDER SCORE IS NEVER A RESULT.** `matchScoreClaim()` is the ONE function
  that answers "is there a score, and what kind of claim is it", so the
  provisional/official distinction cannot be lost by a component reaching into an
  observation itself. `awaitingResult` exists precisely because a feed may say a
  match is over while the platform has not settled it.
- **A STAGE LABEL IS THE COMPETITION'S OWN WORD.** "Matchweek 7",
  "Quarter-finals", "Group A · Matchday 2" — printed verbatim from
  `competition_rounds.label`. Nothing builds a label from an ordinal and nothing
  reads a date to decide what stage a competition is at. Lists group by the DAY a
  match is played and label by stage, because a fixture postponed out of matchweek 5
  keeps its round on purpose.
- **A FIXTURE LIST MAY NOT CARRY A HEAD-TO-HEAD, A TABLE, A FORM RUN OR A
  PREDICTION.** `MatchListItem` has a field for none of them, which is how the N+1
  is prevented by the type rather than by discipline: a list of ten fixtures costs
  two round trips. Those belong to ONE fixture — `MatchCentreModel` — and the
  head-to-head read is pair-at-a-time by construction.
- **A MATCH CENTRE MODULE APPEARS ONLY WHERE ITS DATA EXISTS.** `matchCentreModules()`
  is the single answer, so no section decides for itself. There are no lineups, no
  event timeline, no match statistics, no injuries, no venue, no broadcast and no
  referee anywhere in this platform: every one of those fields is `null` from every
  mapper, and drawing an empty module or a row of zeroes would make the page look
  finished and make the product a liar.
- **Do not truncate a club name.** Home stopped at two lines then ellipsised; the browser suite caught that clipping "Strathallan Caledonian Thistle" in a ~150px scoreboard column. The predictor has no line clamp on a club name at all — the row grows, `overflow-wrap: anywhere` stops a long word widening it, and with nothing hiding overflow the defect cannot reopen.

## Context budget

For a local component change, the expected context is normally this file + `docs/product/ui.md` + `docs/product/vnext-workshop.md` + the component/test/read-model involved. Escalate to broader authorities only when the task itself requires them.
