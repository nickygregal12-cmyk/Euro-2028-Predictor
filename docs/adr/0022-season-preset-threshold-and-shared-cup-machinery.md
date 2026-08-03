# ADR 0022 — Season presets, Cup launch threshold and shared Cup machinery

- **Status:** Accepted
- **Date:** 3 August 2026
- **Amends:** [ADR 0013](0013-last-man-standing-season-rules.md) (supplies the three preset compositions it mandated but left undefined), [ADR 0014](0014-predictor-cup-season-formats.md) (supplies the launch threshold it left undefined and settles where its reused machinery lives). Every other rule in both records is unchanged.

## Context

Three questions blocked implementation because the existing records deliberately named a decision without settling its value. Each was left open in good faith — the earlier records fixed the *shape* of the rule and left a number or a location to be chosen with more information — and each has now been decided by the owner. They are recorded here rather than by editing ADRs 0013 and 0014, per the repository convention that substantive changes to a decision get a new record.

**Presets.** ADR 0013 requires "three named presets with custom behind them", and bounds the axes: lives 0–3, Saves 0–2, draws eliminate or survive, and the endgame rule. It does not say what the three presets are. Without them the setup surface cannot be built and the "presets keep the tested surface at three configurations plus custom rather than seventy-two" consequence cannot be honoured.

**Cup launch.** ADR 0014 says the first public Cup opens "once the field justifies it — a defined entrant threshold or a scheduled start some months into the season", because "a transparent draw is a fine product with two hundred entrants and a thin one with twenty". It never defines the threshold.

**Cup machinery.** ADR 0014 records that the draw, qualification, seeding, bracket and Penalty Number machinery "already exist and are production-hosted", and that the new season work is only the format selector, the split and the matchweek points source. ADR 0011's separation law, however, forbids the season implementation importing the tournament implementation. Taken together those two statements have no legal implementation: the machinery cannot be both reused and un-importable.

## Decision

### Last Man Standing presets

Three named presets, with custom behind them:

| Preset | Lives | Saves | Draws | Wipeout endgame |
| --- | ---: | ---: | --- | --- |
| **Classic** | 0 | 0 | eliminate | play on |
| **Second Chance** | 1 | 1 | eliminate | play on |
| **Relaxed** | 2 | 2 | survive | shared win |

Classic is the traditional game with nothing softening it, and is the preset the public competition uses. The three spread the axes deliberately so they feel like different games rather than three points on one dial: Classic tests pure selection, Second Chance forgives one mistake and one draw, Relaxed is for groups who want the competition to last.

Custom remains available and unchanged — the axes and their bounds are ADR 0013's, not this record's. Presets are immutable once the first round locks, exactly as ADR 0013 already requires of the underlying options.

### Public Cup launch threshold

**The first public Cup of a competition season opens when 100 entrants have joined.** No time-based fallback: a season that never reaches 100 does not open a public Cup, and the Predictor and Last Man Standing carry the week.

One hundred is chosen against the format arithmetic rather than as a round number. It produces five balanced groups of twenty at the cap, a qualification target of `round(100 × 2 ÷ 3) = 67`, and a seeded playoff reducing 67 to a 64-bracket — a full competition with a bracket worth following. It is also comfortably above the field size at which the transparent draw, which is the game's distinguishing feature, reads as thin.

Private Cups are unaffected: they open at their creator's chosen matchweek at any field size ADR 0014's selector accepts.

### Cup qualification, seeding and bracket machinery

**The shared arithmetic becomes one implementation rather than two. Where that implementation lives is settled by the correction below, not by the original text of this record.**

> **Correction — 3 August 2026 (owner-verified).** As accepted, this section directed an extraction into `src/domain/competition/` and justified heavy differential evidence by the tournament Cup carrying live entrant history. **Both premises were wrong, and the direction they produced was unbuildable.**
>
> 1. **There is no live entrant history.** The owner confirms the only account exercising the hosted tournament Cup is their own, used for testing. The data-risk argument for capture-first differential fixtures therefore does not apply; the committed test suites are sufficient behaviour evidence.
> 2. **The machinery is not TypeScript.** Qualification, seeding, group finalisation, bracket ordering and the draw are implemented in PostgreSQL — `predictor_internal.cup_bracket_order`, `cup_seed_group`, `cup_final_group_tables`, `cup_window_scores`, `cup_window_settled`, behind the `admin_draw_predictor_cup`, `admin_finalise_predictor_cup_groups` and `admin_settle_predictor_cup_round` RPCs. Nothing in `src/domain/` implements them; `src/services/supabase/cup.ts` and `cupModel.ts` are read wrappers only. **There is nothing in the TypeScript domain to extract.**
>
> Consequently **ADR 0011's separation law was never at risk here** — it governs imports within `src/domain/**`, and the machinery has never been there. The contradiction this record set out to resolve did not exist in the form described.
>
> **The corrected decision:** sharing happens **in the database**. The existing `predictor_internal.cup_*` functions are generalised from tournament scope to competition-season scope, so one implementation serves both, rather than a second season-specific set being written. That work is **database work sequenced after C1b (contract 66)**, which is what introduces competition-season game scoping in the first place — it cannot sensibly precede it.
>
> The season-side TypeScript already landed (`cupFormat.ts`, `cupTieSettlement.ts`, `cupSchedule.ts`, `cupGroupTable.ts`, `cupLaunch.ts`) covers what ADR 0014 calls the genuinely new work — the format selector, the split and the matchweek points source — and has no SQL counterpart today. When the generalised SQL lands, those modules require **TypeScript/PostgreSQL parity coverage** under `tests/database-parity/`, matching the pattern ADR 0012 already requires for season scoring. No such Cup parity suite exists yet.
>
> What does **not** change: no qualification, seeding, bye, playoff-pairing or Penalty Number rule may be altered while relocating or rescoping the implementation, and the points source continues to cross through the neutral contract in `cupTieSettlement.ts`.

## Consequences

- The LMS preset compositions become executable rule data with their own coverage; the setup surface renders three presets plus custom rather than four independent toggles.
- The public competition is pinned to Classic, so the acquisition surface is one known configuration rather than whichever preset an organiser picked.
- A season below 100 entrants runs without a public Cup. That is an accepted outcome, and it is a **measurable signal about cohort size**, not a defect to engineer around.
- The threshold is a launch rule, not a format rule: ADR 0014's selector still decides structure from whatever field actually enters.
- ~~The extraction touches production-hosted tournament code and therefore requires differential evidence before consumers move.~~ **Superseded by the 3 August correction:** there is no live entrant history, and the machinery is SQL rather than TypeScript. The rescoping is a database change sequenced after C1b (contract 66), evidenced by the committed pgTAP and parity suites like any other schema work.
- The season Cup TypeScript modules currently have **no SQL counterpart and no parity coverage**. That gap is real and must close when the generalised `predictor_internal.cup_*` functions land, per the ADR 0012 parity requirement.
- No season Cup surface may import the tournament implementation as a shortcut. That constraint stands on its own under ADR 0011, independently of where the Cup machinery lives.

## Rejected alternatives

- **Softer preset compositions** (a life in every preset, draws surviving by default). Rejected: it removes the traditional game from the menu entirely, and Last Man Standing's tension comes from selections actually costing something.
- **A public competition on a forgiving preset.** Rejected: lives and Saves in a large free-to-play public field extend competitions past the point where they resolve, and the three-winner cap already handles the wipeout case.
- **A lower threshold of 50, or a time-based start.** Rejected: both open the platform's most distinctive competition on a field that makes a transparent draw look thin, which is precisely the risk ADR 0014 identified. A hybrid "100 or matchweek 12, whichever first" was also considered and rejected for the same reason — the time limb defeats the size test.
- **Duplicating the qualification and bracket machinery for the season.** Rejected: it would create two implementations of arithmetic that is genuinely identical, and the Penalty Number and seeding rules are exactly the kind of thing that drifts silently between copies. This rejection survives the 3 August correction unchanged — it applies to a second set of `predictor_internal.cup_*` functions exactly as it applied to a second TypeScript copy.
- **Deferring the machinery question until a Cup surface needs it.** Rejected: the contradiction between ADR 0014 and the separation law is already live, and leaving it open invites whoever builds first to resolve it by importing across the boundary.
