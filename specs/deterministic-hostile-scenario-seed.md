# Deterministic hostile scenario seed

Stage 4 of the player-value and reliability delivery programme
(`config/player-value-programme.json`).

## Problem

`docs/design-system.md` carries a binding rule:

> **Hostile-data design rule (applies to every page, starting here):** pages are
> designed and reviewed against worst-case realistic data — 20+ members, longest
> plausible names, tied scores, the user mid-table, non-submitters — at 360px, in
> both themes. Dev database is seeded with a fake mid-tournament so built pages
> are always reviewed populated, never empty.

The development seed satisfies part of that and **cannot express the rest**.
Measured on `scripts/seed-dev/`, not assumed:

| Rule clause | State today |
| --- | --- |
| 20+ members | Met — 20 hostile-named users. |
| Longest plausible names | Met — `HOSTILE_NAMES` runs to the 40-char column limit. |
| The user mid-table | Met — a 20-row leaderboard. |
| **Tied scores** | **Accidental.** No tie logic exists; the default seed's top two are 30 and 27, so the state a tie-break exists to resolve is not reviewable. |
| **Non-submitters** | **Impossible.** `index.ts:184` writes `submitted_at` unconditionally for every entry. |
| 1-entry and 2-entry pools (`docs/design-system.md`, "Only you") | **Impossible.** `seedTestLeague` creates exactly one league of up to 8. |

A reviewer therefore cannot see, on development, the three states the rule names
that most change what a page must say: a contested top, a player who never
submitted, and a pool too small for a leaderboard to mean anything.

## Outcome

`scripts/seed-dev` can produce **named scenarios** which each *guarantee* a
hostile property, deterministically, so those states can be reviewed on demand
rather than hoped for.

## In scope

- Named scenarios selected by `--scenario=<name>`, defaulting to today's behaviour.
- A guaranteed tie on the top total.
- Entries that were never submitted.
- A one-member and a two-member pool alongside the existing populated league.
- Executable assertions that each scenario actually exhibits its named property.

## Explicitly out of scope

- Any change to the presentation-layer scenarios in `src/vnext/fixtures/**/scenarios.ts`.
  Twenty-plus deterministic, offline scenario files already exist there and already
  cover their hostile axes; a second set would be a competing authority.
- Any change to the e2e local seeders. Their `randomUUID()` is a deliberate
  uniqueness device feeding only auth emails beside fixed display names, and their
  `Date.now()` offsets are *relative by necessity* because lock state is defined
  relative to now. Both were measured; both are correct and are left alone.
- Any new scoring, ranking or tie-break authority. The tie is created **by
  construction** — two entries with identical predictions necessarily score
  identically — and is then *verified* through the existing real pipeline
  (`scoreEntries` → `calculateScore`), never asserted from a reimplementation.
- Any generic scenario framework. The scenarios are concrete data in the existing
  seed module, not a new layer.

## Governing authorities

- `docs/design-system.md` — the hostile-data rule quoted above.
- `.agents/skills/predictor-player-state-matrix/SKILL.md` — "Prefer deterministic
  scenario builders shared by component/browser tests over ad-hoc mock objects."
- `scripts/seed-dev/seedPolicy.ts` — the fail-closed guard. Unchanged: scenarios
  select *what* is seeded, never *where*.

## Acceptance scenarios

1. `--scenario=contested` produces at least two entries sharing the highest total,
   as computed by the real scoring pipeline.
2. `--scenario=sparse` produces at least one entry with no submission, and the
   commit path writes `submitted_at: null` for exactly those entries.
3. `--scenario=sparse` produces a one-member and a two-member pool.
4. The default scenario is byte-identical to today's output, so nothing that
   depends on the current seed changes.
5. Every scenario remains deterministic: same scenario and seed, same output.

## Privacy, security and authority constraints

- Synthetic data only. No production player data is read, copied or referenced.
- `seedPolicy` still refuses anything that is not the pinned development project,
  and scenarios cannot weaken it — they are chosen after the policy decision.
- Instrumentation and seeding never become result, scoring, lock, membership or
  model-selection authority.

## Migration / provider / Production effects

**None.** No migration, no contract change, no provider call, no Production
effect. The deployment contract stays at 217.

## Completion predicate

The three states the design rule names and the seed could not previously express
are each produced by a named scenario, each proven by an assertion that fails when
the guarantee is removed, with the default scenario unchanged.
