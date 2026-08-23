# Adversarial failure-mode tests

Stage 5 of the player-value and reliability delivery programme
(`config/player-value-programme.json`). Depends on stage 4, whose `sparse`
scenario made the degenerate pools below reachable in a seeded database for the
first time.

## Problem

This is not an untested repository — 239 test files already exercise failure,
retry, timeout and conflict paths, and ties are covered thoroughly
(`rankLeaderboard` carries a `tied` flag; six service models consume it). Adding
volume would prove nothing.

The gap is a *kind* of test rather than a quantity. `docs/design-system.md`
records binding product rules as prose with numbers in them. Nothing asserts that
the code still agrees with those numbers, so a rule and its implementation can
disagree indefinitely and every test still passes — because the tests are written
against the implementation's own constants.

One such disagreement exists today, and it was found by asking the adversarial
question rather than by any failing test.

## The finding

`docs/design-system.md` §1, decided 2026-07-22 and restated in two further
sections:

> Anywhere the app shows an anonymous prediction distribution or a percentile,
> the pool being shown must contain **at least 50 players**; below that,
> distributions collapse to participation counts only … and percentiles are
> dropped in favour of the plain rank.

The rationale is privacy and dignity: "under ~50 players, 'anonymous' bars are
trivially de-anonymisable by league mates, and 'top 48%' reads as mockery."

`src/features/season/rankContext.ts` implements `MIN_FIELD_FOR_PERCENTILE = 25`.

So a pool of 25–49 players is shown a percentile the product authority says must
be dropped. The constant appears nowhere in `docs/`, so the divergence was never
recorded as a decision, and its own comment argues for *a* threshold without
mentioning the rule or justifying 25 over 50.

**Why no test caught it.** `tests/features/season/rankContext.test.ts` asserts the
boundary as `percentileLine(2, MIN_FIELD_FOR_PERCENTILE)` — in terms of the
constant. That goes red if somebody *changes* the constant, but it can never say
the constant was wrong to begin with, because the test and the code read the same
number.

### What was checked and found NOT to be a divergence

Measured before claiming a class rather than an instance:

- **Wrapped and profile percentiles** derive nothing in the browser — they render
  the server's percentile deliberately. Not affected.
- **Season consensus suppresses below ten entries**, not 50. This is *recorded*
  — `docs/quality/investigations/2026-07-29-priv-001-options.md` states it, dated
  after the 2026-07-22 rule and tied to `PRIV-001`. A later, deliberate decision
  for that surface, not drift.
- **The "How everyone called it" page** is explicitly exempt in §1 itself.

`rankContext` is therefore the only unrecorded divergence, and this stage does not
claim otherwise.

## Outcome

The threshold lives in **one** place — the authority — and the code is asserted
against it, so this class of drift fails a test instead of reaching a player.

## In scope

- A guard that reads the threshold out of `docs/design-system.md` and asserts the
  implementation matches, failing in either direction.
- Behaviour assertions at the rule's real boundary, written with the authority's
  number rather than the code's constant.
- The degenerate pools stage 4 made seedable: a field of one and a field of two.
- Aligning `MIN_FIELD_FOR_PERCENTILE` with the authority.

## Explicitly out of scope

- `TEST-001`'s residual full-volume dress rehearsal and rollback rehearsal. Both
  are hosted-environment activities outside this programme's authority; recorded,
  not attempted.
- `ING-002`'s residual token `4`. Measuring it needs a real provider payload from
  a stopped match, which means paid provider consumption. Recorded, not attempted.
- Re-testing ties, retries, timeouts or conflicts. Already covered.
- The season consensus threshold, which is a recorded decision (above).

## Governing authorities

- `docs/design-system.md` §1 — the small-numbers honesty rule.
- `docs/quality/risk-register.md` — where the finding is recorded.

## Acceptance scenarios

1. If the design system's number and the implementation's constant disagree, a
   test fails and names both.
2. A field of 49 gets no percentile; a field of 50 does. Asserted with literals
   derived from the authority, not from the constant under test.
3. A field of one and a field of two get no percentile and no crash.
4. The existing self-referential boundary assertions no longer launder the
   constant.

## Privacy, security and authority constraints

- No player data, synthetic or otherwise, is read. These are pure unit assertions
  over a pure function and one documentation file.
- The change makes disclosure **stricter**, never looser.
- Nothing here becomes result, scoring, lock, membership or model-selection
  authority; `percentileLine` presents two server numbers and orders nobody.

## Migration / provider / Production effects

**None.** No migration, no contract change, no provider call, no Production
effect.

## Behaviour change, flagged deliberately

Aligning the constant means players in pools of **25–49** stop seeing a
percentile and see their plain rank and field size instead — which is what §1
asks for. This is the only player-visible change in the stage and is a single
line, trivially revertible, should the owner decide 25 was intended and the
document should move instead.

## Completion predicate

The rule's number exists once, in the authority; the code is asserted against it;
and the degenerate pools behave.
