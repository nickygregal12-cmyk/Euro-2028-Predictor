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

**There is no approved Home screen in it.** `WorkshopHomeSketch` exists to prove
the foundations, the model and the components hold together at each width. It is
a rig, not a design, and the next stage exists to replace it with three
materially different Home concepts.

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
6. **Container queries, not viewport queries.** Every layout decision is made
   against the container. This is what makes a 375px frame on a 1440px monitor
   an honest review rather than a desktop layout wearing a phone's width.

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
  `useVNextMotion`. The reduced path is never "no feedback"; it is the same state
  change without travel, scale or pulsing. CSS duration tokens collapse to 1ms in
  parallel, so a hover transition cannot slip past the preference.
- Dark only for now. A light theme is a real question, deliberately unanswered.

## What the mocked data can represent

`src/vnext/models/` describes what the interface wants to display — not a mirror
of any table, and not a rule authority. `src/vnext/fixtures/` holds one designed
matchday: five matches covering live, half-time, an unmet deadline, a prediction
against a 76% crowd and a settled exact score, plus two private leagues, four
rivals and an activity feed. Every instant is fixed; nothing reads the clock.

Social comparison is first-class in the model rather than a card: private-league
windows around the user, gap-to-leader, rivals with signed differences and
movement, and per-match community *and* friends consensus.

**Mocked values are not game rules.** Points, ranks, accuracy, lock times and
settlement in the fixtures are presentation inputs. Optional fields are optional
honestly: `crestUrl` is null everywhere because no crest source is agreed, and
provisional points are flagged as provisional because the backend awards points.

## Deliberately unresolved

These are for the concept stage to decide, not for this note to settle:

- How cinematic should Home be — full-bleed featured match, or a dense board?
- How dominant should live football be when matches are in play, and what should
  Home look like on a Tuesday when nothing is on?
- How much league and rival context belongs above the fold?
- How much is visible at once versus progressively disclosed?
- The exact desktop navigation composition, and whether the context column is a
  navigation surface or a competition surface.
- The exact mobile navigation treatment, and whether the primary action lives in
  it.
- How strongly team colours should influence a fixture — accent only, or the
  whole card.
- Whether a light theme is in scope for the alpha.
- Time zone handling. The workshop pins Europe/London for determinism; the real
  product must use the user's zone.
- Whether score changes should be announced to assistive technology while a match
  is live, and how.

## What the next PR must decide

Build three materially different Home concepts on this workshop — for example
Matchday Arena, Game Command Centre and Cinematic Football — each answering the
questions above differently, each reviewable at 375/430/768/1440/1920 and each
with its reduced-motion path. Then choose one. Until that choice is made, no
composition in `src/vnext/workshop/` should be treated as Home.
