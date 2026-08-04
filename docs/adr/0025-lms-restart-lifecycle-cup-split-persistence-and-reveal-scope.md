# ADR 0025 — LMS restart lifecycle, Cup split-stage persistence and post-lock reveal scope

- **Status:** Accepted
- **Date:** 4 August 2026
- **Amends:** [ADR 0013](0013-last-man-standing-season-rules.md) (supplies the lifecycle its `restart_all_reentered` endgame implies but never described), [ADR 0014](0014-predictor-cup-season-formats.md) (supplies the split's persisted shape). Clarifies the scope of the post-lock reveal item in Appendix D.2 of [`../design/hub-architecture-and-modernisation-plan.md`](../design/hub-architecture-and-modernisation-plan.md) against contract 95. Every other rule in those records is unchanged.

## Context

Three questions blocked implementation and one apparent contradiction blocked a reconciliation. Each is recorded here rather than by editing the earlier records, per the repository convention that a substantive change to a decision gets a new record.

**The LMS restart.** ADR 0013's public endgame, when more than three entrants share a wipeout, is that everybody re-enters a fresh competition with selections reset. Contract 89's settlement job derives and reports `restart_all_reentered` and deliberately does not act on it, because "a new competition lifecycle rather than a settlement" was not a thing the ADR defined. What "a fresh competition" means was the missing decision.

**The Cup split.** Contract 79 widened two format constraints on the shared Cup stores but deliberately did **not** widen `bonus_cup_fixtures.stage`, because a season split stage would immediately violate `bonus_cup_fixtures_group_shape`: that constraint requires a non-group stage to carry neither `group_id` nor `matchday`, while split rounds need both. Whether the split is its own stage or a relabelled group stage was the missing decision.

**Two tournament-path defects.** The `entry_automatic_submission_outcomes` CHECK accepts an `invalid` outcome with no failure message at all, because its refusal branch ends in `char_length(btrim(null))`, which evaluates to NULL, and a CHECK rejects only FALSE. `REL-001` — score recomputation is not serialised — has been Open on the risk register since 23 July 2026. Both live on production-hosted structures, which is why they had been treated as blocked rather than as work.

**An apparent contradiction.** Appendix D.2 of the Hub plan lists "post-lock reveal — existing rival/profile RPCs still contain shared-league gates" as drift to remove, while contract 95 deliberately *applied* a co-member gate to the season leaderboard. Neither could move while it looked as though one of them must be wrong.

## Decision

### 1. The Last Man Standing restart creates a new competition row

**A `restart_all_reentered` endgame creates a new competition row. It does not wipe and reuse the existing one.**

Reusing the row would destroy the completed competition's picks, elimination history, audit evidence and correction trail — the record of the competition that produced the wipeout in the first place. The settlement job is therefore right as written: it derives and reports the outcome and performs no lifecycle transition.

The lifecycle is:

- complete the old row with a terminal outcome, `no_winner_restarted`;
- create a new row with a new id;
- link it to the old row through `predecessor_competition_id`, or a shared `series_id` plus sequence;
- copy the **immutable setup only**: public/private scope, preset, lives, Saves, draw rule;
- re-enter every previous entrant as a fresh entrant row;
- copy **no** selections, used-team cycles, entrant-state projections or completed windows;
- generate new windows beginning with the next eligible league round;
- record an immutable `public_wipeout_restart` lifecycle audit event.

Creation belongs in a **separate, idempotent lifecycle function or job protected by an advisory lock**, not inside settlement. Settlement continues only to derive and report.

**A prerequisite this exposes.** The current `unique (tournament_id, game_key)` shape cannot support repeating LMS competitions. It must be replaced by lifecycle-aware uniqueness — one *active* public LMS competition per season or series, with completed predecessors and private competitions coexisting freely. `bonus_competitions` is currently carrying two responsibilities at once: **game availability** ("this competition season offers Last Man Standing") and **competition instance** ("this particular running of it"). The change must explicitly separate or reconcile those two concepts. Dropping the unique constraint alone would leave the ambiguity in place and make it worse, because nothing would then distinguish the live competition from its predecessors.

### 2. The Cup split is a distinct persisted stage

**`stage = 'split'`. The split is not an ordinary group stage under another label.**

ADR 0014 treats the split as a genuine phase transition: the field divides into halves, points carry forward, nobody is eliminated, and new round-robin fixtures are played within each half. Storing that as `stage = 'group'` would make the stored model less expressive than the competition it records, and would complicate the interface, the audit trail and any reconstruction of past state.

The fixture shape becomes:

```
(stage in ('group', 'split') and group_id is not null and matchday is not null)
or
(stage in ('playoff', 'knockout') and group_id is null and matchday is null)
```

**Widening that constraint alone is not sufficient.** Split membership must be persisted without overwriting the league-phase membership that preceded it:

- add a phase marker to groups — `phase_kind in ('initial', 'split')`;
- add `parent_group_id`, so each half points back at the single group it came from;
- create two split-phase group rows, top half and bottom half;
- permit one entrant to hold an initial-phase membership **and** a later split-phase membership;
- preserve the original membership rows permanently;
- derive continuing standings from initial **and** split fixtures, so points genuinely carry forward rather than being copied into a new starting total;
- keep `matchday` as the competition's overall Cup round number rather than resetting it at the split.

The present `(competition_id, user_id)` membership key forbids phase-specific duplicate memberships, so it must become phase-aware or be supplemented by a dedicated phase-membership relation. Contract 79 was correct not to widen `stage` before this was settled.

### 3. Both tournament-path defects are corrected now

**Fix both in the repository and in development now. Do not defer them because production also contains the affected structures.** Production rollout stays separately controlled, as it is for every other contract.

**The automatic-submission outcome CHECK.** The refusal branch gains an explicit non-null requirement:

```
outcome = 'invalid'
and submitted_at is null
and failure_code is not null
and failure_message is not null
and char_length(btrim(failure_message)) between 1 and 500
```

Before validating the replacement, audit development and production for existing `invalid` rows carrying a null or blank message. **An immutable audit row must not be silently rewritten.** If such rows exist they are preserved as known historical exceptions and remediated by an explicit decision, rather than the corrected constraint being weakened to accommodate them. This stays a narrow correction; it does not become a wider outcome-schema change.

**REL-001.** A transaction-scoped advisory lock keyed by tournament id goes around the tournament delete-and-rederive scoring path. Use a **blocking** transaction lock for an administrator result mutation unless the existing command contract already has a typed retry/busy outcome: result confirmation and correction are low-frequency, and returning success while silently skipping recomputation is worse than briefly serialising them.

Required evidence:

- two concurrent result writes for one tournament cannot interleave recomputation;
- different tournaments remain independently writable;
- a correction followed by recomputation produces exactly one coherent derived score state;
- rollback releases the lock automatically;
- no session-scoped lock is introduced.

Contracts 89 and 93 demonstrate the transaction-scoped pattern on the season path. REL-001 is a distinct **tournament** defect and closes independently of the later incremental-versus-full-recomputation performance decision (`DEC-009`, ADR 0003).

### 4. Appendix D.2 and contract 95 are different scopes

**Confirmed: there is no behavioural conflict, and neither privacy boundary changes.**

**Appendix D.2** governs the **Euro Original Predictor post-lock reveal**. Once the Euro entry is frozen, any authenticated player may view another frozen tournament entry or profile. A shared private-league relationship must not be the general reveal gate. The authoritative server-side tournament lock remains mandatory. Reads specifically presented *inside* a private-league or match-pick context may remain league scoped.

**Contract 95** governs the **season Main Predictor leaderboard**. The caller must hold an `entries` row in that competition season. It does not require caller and target to share a private league. It stops an entrant in one domestic competition browsing player identities in an unrelated competition season.

Therefore: **contract 95 is unchanged.** The obsolete shared-private-league gates are removed only from the relevant Euro post-lock entry and profile RPCs, and Appendix D.2 is restated to say so explicitly:

> Remove shared-league membership as the general gate for frozen Euro Original Predictor entry and profile reveal after lock. This does not alter season-leaderboard entrant scoping under contract 95 or league-context match-pick reads.

## Consequences

- The LMS restart becomes buildable, and it becomes a **schema** change before it is a job: the `bonus_competitions` availability/instance conflation has to be resolved first, and that is the larger half of the work.
- A completed LMS competition and its successor coexist permanently. Any read that assumed one competition per `(tournament_id, game_key)` must be re-examined — that assumption is being deliberately removed, not accidentally broken.
- The Cup split becomes buildable, and it too is a schema change first: `bonus_cup_groups` gains phase and parentage, and the membership key changes shape.
- Standings across a split must be **derived** from both phases. A design that copies carried points into a starting total is explicitly rejected: it makes the stored total a second opinion about arithmetic that the fixtures already determine.
- The two tournament defects stop being blocked. They are ordinary contracts with ordinary evidence, and production promotion remains a separate, approved milestone as it already is for contracts 64 onward.
- The audit required before the CHECK correction is a **precondition, not a formality**. It ran on 4 August 2026 against both development and production: `entry_automatic_submission_outcomes` is empty in both, so no historical exception exists and the corrected constraint can be added fully validated.
- The D.2 reconciliation closes without either boundary moving, which is the outcome the two records should always have had.

## Rejected alternatives

- **Wiping and reusing the LMS competition row.** Rejected: it destroys the completed competition's picks, elimination history and audit trail to save creating a row, and it makes "what happened in the competition that produced the wipeout" unanswerable.
- **Performing the restart inside the settlement job.** Rejected: settlement runs on a cron tick and must stay a derivation. A lifecycle transition that creates rows belongs behind its own idempotent, lock-protected entry point where a repeat run is provably harmless.
- **Simply dropping `unique (tournament_id, game_key)`.** Rejected: it removes the symptom and leaves the cause. Without lifecycle-aware uniqueness nothing distinguishes the active competition from its predecessors, and every existing "the LMS competition for this season" read silently becomes ambiguous.
- **Storing the split as `stage = 'group'`.** Rejected: the stored model would be less expressive than the competition, and the split's defining properties — carried points, no elimination, halves derived from a parent group — would have to be reconstructed by inference at every read.
- **Copying carried points into a new starting total at the split.** Rejected: it duplicates a fact the fixtures already determine, and duplicated arithmetic drifts.
- **Deferring the two tournament defects until the production promotion milestone.** Rejected: they are defects in committed code, and leaving a known three-valued-logic hole and an unserialised recomputation in the repository until an unrelated milestone means every later contract is built on top of them.
- **Changing contract 95 to match Appendix D.2.** Rejected on the facts: they address different competitions and different reads, and the appearance of conflict came from two records describing different scopes in similar words.
