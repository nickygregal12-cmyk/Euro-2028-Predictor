# vNext workshop note

**Status:** working note for the vNext design workshop
**Scope:** presentation hypotheses, mocked-data capability and open design questions
**Does not govern:** scoring, locks, reveal, settlement, membership, progression, provider truth, database lifecycle or the legacy production UI

This is a short note, not a second authority. Product direction stays in
[`ui.md`](ui.md); implementation boundaries stay in
[`../../src/vnext/AGENTS.md`](../../src/vnext/AGENTS.md). What is recorded here
is what the workshop is currently *testing*, so the next stage can argue with it.

## What the workshop is

`src/vnext/` is an isolated design workshop reviewed through Storybook. It runs
entirely on deterministic fixtures: no Supabase, no provider calls, no routing,
no application state. Nothing in it is wired into the running product.

**There is one approved Home, in `src/vnext/home/`, and a second page beside it in
`src/vnext/predictor/`.** Home is the Gold Standard surface and the quality bar the
rest of vNext inherits from; the Match Predictor is the first page to inherit it. The three
Stage 3 concepts have been removed — git history holds them — along with
`AppFrame`, `Rail` and the `AppFrameProbe` rig that existed to measure the
frame. What remains in `workshop/` is `WorkshopCanvas`, the container-framed
device board every review runs in.

**The reusable half of that language is now `src/vnext/app/`.** The shell owns
the canvas, the page bounds, the masthead band, the two navigations, the `<main>`
landmark and mobile bottom spacing; a page owns everything inside `<main>`.
Home was migrated onto it as a structural extraction and measured before and
after at every reviewed width and emphasis: the only difference in the whole
comparison was the fifteen characters of the new skip link. The contract a
future page needs is in
[`../../src/vnext/AGENTS.md`](../../src/vnext/AGENTS.md), not here.

The `vNext/Shell` Storybook group is neutral placeholder content proving the
shell hosts a page that is not Home. It is deliberately dull and it is **not a
visual authority** — Home is.

## Visual principles being tested

1. **Broadcast, not dashboard.** A near-black canvas with two soft washes, large
   soft radii and real depth, so cards read as graphics on a football broadcast
   rather than as panels in an admin tool.
2. **Hierarchy without new fonts.** Only the faces the repository already hosts
   (Inter 400/500, Space Grotesk 400/500/700). Range comes from scale, casing,
   tracking, colour and the display/text split. No font dependency was added.
3. **Colour means state, and never carries it alone.** Live, hit, deadline, miss
   and rank movement each have a colour, and each is always paired with a word or
   a shape.
4. **Football colour comes from football.** Club colours arrive as inline custom
   properties per team, never as theme tokens, with the legible text colour
   stated by the fixture rather than guessed.
5. **Desktop is a different composition, not a wider phone.** The frame has four
   compositions and they differ structurally — bottom bar to nav rail, personal
   state below to personal state beside, competition context earning its own
   column only when taking one does not squeeze the football.
6. **Container queries, not viewport queries — and no viewport UNITS either.**
   Every layout decision is made against the container. This is what makes a
   375px frame on a 1440px monitor an honest review rather than a desktop layout
   wearing a phone's width. The rule covers lengths as well as queries: `vh`,
   `vw`, `vmin` and `vmax` all measure the browser showing the workshop rather
   than the frame being reviewed, and two of them survived the first build
   inside otherwise container-driven layouts. A frame that has a definite height
   declares it as `--vnext-frame-block`; a frame that has not bounds nothing.
   `tests/vnext/workshopFixtures.test.ts` holds the ban, and
   `e2e/vnext-home.spec.ts` and `e2e/vnext-shell.spec.ts` measure the result in
   Chromium at all five widths, because jsdom evaluates no container query.
   The shell states the page bounds as `--vnext-page-inset` rather than padding
   its content region, so a page reads one number for its margins and still
   measures its own thresholds against the full width.

## Token and motion hypotheses

- One surface ramp of four steps (`surface`, `raised`, `interactive`, `sunken`),
  each paired with a hairline *and* a shadow because a hairline alone disappears
  on this canvas.
- Three text steps. A fourth becomes "slightly greyer" rather than a decision,
  and the muted step already sits at the contrast floor.
- Nine motion primitives, each tied to a job: entrance, list order, hover lift,
  press, nav indicator, live pulse, rank movement, points emphasis, disclosure
  and rail travel. Anything that moves without a job is decoration.
- Every primitive is a **pair** — full and reduced — resolved by
  `useVNextMotion`, or by `useVNextTransition` where the movement is a layout
  animation and therefore cannot live in a variant. Components consume the
  resolved value and never reach for a raw one; a test holds that.
- The reduced path is never "no feedback"; it is the same state change without
  travel, scale or pulsing. **Collapsing a duration is not enough on its own** —
  a 1ms `transform: scale(0.99)` still moves — so a reduced path removes the
  transform and answers in colour instead. CSS duration tokens collapse in
  parallel so a hover transition cannot slip past the preference either.
- Dark only for now. A light theme is a real question, deliberately unanswered.

## What the mocked data can represent

`src/vnext/models/` describes what the interface wants to display — not a mirror
of any table, and not a rule authority. `src/vnext/fixtures/` holds one designed
matchday: five matches covering live, half-time, an unmet deadline, a prediction
against a 76% crowd and a settled exact score, plus two private leagues, four
rivals and an activity feed. Every instant is fixed; nothing reads the clock.

A sixth fixture, `postponedMatch`, sits deliberately OUTSIDE the matchday so the
scenario every story is judged against stays five matches. It exists because the
model declares a `postponed` status, and a status the card treats as an ordinary
upcoming fixture is a card offering a prediction on a game that is not happening.
Presentation states the status and stops: whether a prediction survives a
postponement, when a rearranged lock opens and what becomes of a joker are
backend rules, and the workshop does not answer them.

Social comparison is first-class in the model rather than a card: private-league
windows around the user, gap-to-leader, rivals with signed differences and
movement, and per-match community *and* friends consensus.

**Mocked values are not game rules.** Points, ranks, accuracy, lock times and
settlement in the fixtures are presentation inputs. Optional fields are optional
honestly: `crestUrl` is null everywhere because no crest source is agreed, and
provisional points are flagged as provisional because the backend awards points.

## What Home is

**One shell, three emphases.** Home does not give the same content equal
prominence at all times. `selectHomeEmphasis(model)` answers one question —
what should be biggest — from state the model already supplied, and the shell
reorders around the answer:

| Emphasis | When | Dominant zone |
| --- | --- | --- |
| **Live** | the model has live matches | the featured live fixture |
| **Decision** | nothing live, and a pressing prediction decision | a cinematic next-decision hero |
| **Competition** | neither | the league race and the season figures |

The masthead, score bar, navigation, typography, spacing, surfaces,
team-colour language and motion are identical in all three. Same stadium,
different match state — not three Homes.

**That selector is presentation and nothing else.** It reads
`model.liveMatches` rather than comparing kick-offs against the clock, and
`primaryAction.urgency` rather than deciding whether a prediction is still
editable. It is not an authority for locks, scoring, settlement, reveal,
official match status or progression, and a test holds that by feeding it a
model whose "live" fixture kicks off in 2099.

**Selected: Matchday Arena**, with competitive intelligence borrowed from Game
Command Centre and selective cinematic emphasis from Cinematic Football. The
full decision, including what was deliberately left behind, the navigation
terminology and the `AppFrame` removal, is in
[`vnext-home-concepts.md`](vnext-home-concepts.md).

## Scenarios

Home is reviewed against four deterministic states, all one `HomeModel` schema:
the canonical live matchday, the same matchday four hours earlier (decision),
the Tuesday after (competition), and a new user with no private league looking
at fixtures that carry no venue, head to head or consensus. They are visual
fixtures; none of them invents a rule.

## Deliberately unresolved

Home settled the questions about Home. These are still open:

- Whether a light theme is in scope for the alpha. **ANSWERED 19 August 2026 —
  yes, and it is not optional.** vNext stays dark by default because the product
  is aiming at a broadcast-feeling football game, but the live application has
  persisted a user theme choice since long before this lane existed, and Stage
  14 makes vNext that application; shipping dark-only would have removed a
  setting from every player who had chosen it. The light ramp is designed rather
  than inverted and every pairing in both themes is measured by
  `tests/vnext/vnextTokenContrast.test.ts`. See `DEC-016`.
- Time zone handling. The workshop pins Europe/London for determinism; the real
  product must use the user's zone.
- Whether score changes should be announced to assistive technology while a
  match is live, and how. `LiveIndicator` is `aria-live="off"` on purpose; a
  polite region on a minute that changes constantly would talk over everything
  else. Designing the announcement properly is its own piece of work.
- How much of Home's language survives contact with Match Centre, Matches,
  Leagues, Predictor Championship and Last Man Standing. The Match Predictor has
  now answered the question for one content shape — see below — but a match page,
  a table and a knockout are still untested.
- Whether `Match.score` needs a provisional marker. A fixture a provider calls
  `final` before the platform settles it currently shows the provider's scoreline
  as its full-time score, because `Match` has one score field. The POINTS beside
  it are labelled correctly — contract 175 states the basis — but the score is
  not. No Home zone draws the distinction today, so nothing was changed for it.

## What real data settled, and what it did not

Home is now connected, through one adapter, at `src/vnext/integration/home/`.
The contract is in [`../../src/vnext/AGENTS.md`](../../src/vnext/AGENTS.md) and is
not repeated here.

**The design survived contact.** No zone, threshold, type step, motion or colour
decision changed. What changed is that six model fields became nullable, because
real reads proved the mock had made them look mandatory: the competition palette,
the season rank and its field size, rank movement in three places, points banked
today and points on the pitch. Every one of those nulls is a missing capability
rather than a loading state, and each renders as less information rather than a
zero.

**The mocked richness is not all there.** Venue, head to head, broadcast, crests,
a live minute, league position, a prediction's exact/result/missed verdict, a
friends consensus and an activity feed have no application source on this path.
Club colours, club form and community consensus DO — from the domain identity
registry and contracts 141 and 130 — which was the pleasant surprise.

**Storybook is unchanged as the visual authority.** A fifth scenario, `reduced`,
was added beside the four approved ones rather than editing any of them, so the
nullable states have a deterministic screenshot of their own.

## What the second real page settled

The Match Predictor is the second page on the shell, and it was built to disagree
with Home where the task differs. It does.

- **`VNextPageHeader.trailing` is settled and stays a slot.** Home puts a standing
  block there, the predictor puts a deadline chip; they share nothing but their
  position, and neither needed a prop, a variant or a shell change. The slot also
  earned the predictor something real — the masthead is already sticky, so a page
  can keep one status permanently on screen without spending viewport on a second
  sticky band of its own.
- **The shell needed no change at all.** Not one line under `app/` moved, and Home
  is byte-identical: the only files Stage 7 touched outside `predictor/` are the
  fixture index, `foundations/format.ts` (two new formatters), `WorkshopCanvas`'s
  viewport list (a 1024 frame added; every existing story names its own frames, so
  none gained one) and the boundary test.
- **The CONTENT half of the language travelled.** The type ramp, the surface ramp,
  the spacing steps, the club-colour idiom, the motion pairs, the state-in-words
  rule and the container-query discipline all carried over unchanged. What did NOT
  travel is Home's composition: no emphasis selector, no stage, no featured
  fixture, no ticker, no Around the Grounds, no social zone. That is the extraction
  working rather than failing.
- **A row must measure itself, not the column that placed it.** At 1920 the
  predictor's working column takes two fixtures across, so each row has about
  730px of a 1480px column. This is the fifth time the lane has met the
  size-against-the-wrong-thing defect and the first time the answer was structural:
  the row declares its own container.
- **Do not truncate a club name anywhere.** Home stopped at two lines and then
  ellipsised. The browser suite caught that cutting "Strathallan Caledonian
  Thistle" in a ~150px scoreboard column, so the predictor clamps a club name at
  no lines at all and lets the row grow.
- **A DEADLINE PAGE NEEDS A DISPLAY INSTANT, AND IT IS NOT THE MODEL'S.** A model
  is stamped with the instant the application answered at and rebuilt only when its
  inputs change, so a countdown drawn straight against it freezes the moment a
  player stops typing — and nothing notices when wall-clock time crosses the
  deadline on a tab left open across kickoff. The predictor's answer is
  `predictor/useDeadlineClock.ts`: one presentation instant, anchored to
  `model.generatedAt` and advanced by observed elapsed time, shared by the masthead
  chip, the brief and every kickoff label so they cannot drift apart. Reaching an
  open card's `lock.at` requests the existing `reload` — once per distinct
  authoritative instant — and the answer that comes back is the new state. **The
  clock may refresh presentation and may ask; it may never answer.** Editability,
  the lock, the Joker and settlement stay the application's, and `lock.urgency`
  stays the model's: the escalation beat still waits for an authoritative rebuild,
  because how loudly the page shouts is a decision presentation does not own.

### Settled by Home, and no longer open

How cinematic Home should be (once, on the next decision — not everywhere); how
dominant live football is when matches are in play (it takes the stage); what
Home looks like on a Tuesday (the competition emphasis); how much league and
rival context belongs above the fold (the gap and the two adjacent rivals, not a
table); the desktop and mobile navigation treatments (a masthead band and a
bottom bar, four destinations, terminology "Home"); and how strongly team colour
influences a fixture (loud on the featured moment, a spine elsewhere, never
semantic).

## What the exploration settled by measurement

**A dense zone must be sized against its own column, never against the page.**
The same mistake appeared three times across the three concepts — a row that
fitted at one width starved club names to "Ca…" and "E" at another.

Home hit it a fourth time, at 768px, where "Inver Caledonian" clipped in a
296px grounds column. The fix this time was not another threshold: the row
**stops truncating**. A club name wraps to a second line and only then
ellipsises, so no future composition can reopen it. A row that is occasionally
two lines tall is worth more than a club called "Inver Caledonia…".

The browser spec now measures this directly — any text clipped by its own box,
in any zone, at any width, in any emphasis — rather than trusting a stylesheet
to be read correctly. It found the 768px clip on the first run.

## Stage 7.5 — the method changes

**Everything above settled the design of SURFACES. Stage 7.5 asks a question no
surface can answer: what is the mental model of the product?**

Up to Stage 7 the programme designed Home, then the Match Predictor, and the
obvious next move was Matches, then Leagues, then Last Man Standing, then the
Championship — in the order the current navigation happens to list them. That
move produces the old product structure, beautifully redesigned, and Last Man
Standing is the evidence that the risk is real: a complete domain that had been
treated as one more page in a queue because nothing had forced an inventory.

The lab, its three concepts, the capability audits, the interaction-feedback
prototype and the open questions are in
[`vnext-ia-lab.md`](vnext-ia-lab.md). Every user-facing route now has an explicit
fate in [`vnext-route-migration-matrix.md`](vnext-route-migration-matrix.md).

**Three things it establishes that are independent of which concept wins:**

- **Football context, game and people are three dimensions, not one selector.**
  They are modelled apart in `src/vnext/models/ia.ts`, so a surface that wants to
  draw a competition, a game and a private league in one list has to reach into
  three types to do it.
- **A player's name is a control only where an address exists.** The global
  season leaderboard read returns a display name and **no identifier**, so a
  clickable row there is not a permission a frontend could widen — it is a route
  that does not exist. All three concepts render it as text rather than as a
  control that would refuse.
- **A game a competition does not run is ABSENT, not disabled.** "This league has
  no Last Man Standing", "you have not joined the one it runs" and "registration
  has closed" are three different sentences, and a disabled tab says none of them.

**Three things it establishes that survived the selection unchanged** — the list
above is exactly what Stage 7.6 carried into `src/vnext/models/shell.ts`.

## Stage 7.6 — the selection becomes the shell

**Concept A, the Competition Deck, was selected as the primary vNext information
architecture.** Cross-competition attention was retained from Concept B as a
SECONDARY layer and Jump was retained from Concept C as an OPTIONAL accelerator.
That is a hierarchy and not a blend: A is the mental model, B is a layer over it
and C is a shortcut past it.

The decision, its rationale, the `Games` versus `Play` naming comparison and the
binding one-competition and scale contracts are in
[`vnext-shell-ia.md`](vnext-shell-ia.md). The lab is kept as the evidence for it.

**What changed in the workshop.** `app/VNextShell` is now the Competition Deck:
`Home · Matches · Games · Leagues`, belonging to the ACTIVE COMPETITION rather
than to the platform, as a bottom bar below 1120px and a 264px competition rail
at and above it. `vNext/Shell` stopped being three neutral placeholders and
became ten deterministic worlds — one competition through twenty published, a
quiet day, urgent work elsewhere, an unsupported game, names far too long — plus
the Gold Standard Home and the Stage 7 Match Predictor rendered unmodified
inside it.

**What did not change.** Home's composition, zones, emphasis system and masthead;
the Match Predictor's brief, rows, score entry and deadline clock. Both pages
lost only the application-level props they should never have owned — a
`navItems` array with a count on it — and the count now arrives on the shell
model from the host that knows it.
