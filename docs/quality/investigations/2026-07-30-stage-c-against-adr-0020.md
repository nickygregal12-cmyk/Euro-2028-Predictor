# Stage C schema design assessed against ADR 0020

**Date:** 30 July 2026
**Assessed:** [`../../architecture/stage-c-competition-season-schema.md`](../../architecture/stage-c-competition-season-schema.md) — the merged Stage C design baseline (PR #236).
**Against:** [`../../adr/0020-account-erasure-and-competitive-history.md`](../../adr/0020-account-erasure-and-competitive-history.md).
**Outcome:** the design satisfies **path A in full** and **does not address path B at all**. Path B is not partly built or built weakly — the design's decision statement excludes it by construction. Two further findings sit underneath that.

**Report only.** Nothing here is applied. The Stage C design is unmodified and no migration is written.

## A correction to the premise before anything else

ADR 0020 and the instructions that accompany it both refer to *"draft PR #236"*. **PR #236 merged on 30 July 2026.** The Stage C design is the approved baseline on `main`, not a proposal under review.

That makes this reconciliation more urgent, not less. A draft can absorb a constraint during review. A merged baseline needs a deliberate amendment, and anyone reading the design today has no signal that a later ADR constrains it.

## The five questions

| # | Question | Verdict |
| --- | --- | --- |
| 1 | Does the design support path A — anonymise and remain in standings? | **Satisfied** |
| 2 | Does it support path B — remove completely? | **Not addressed** |
| 3 | Does anything prevent settled outcomes standing when an entrant is removed? | **Partly — and one landed constraint actively collides** |
| 4 | Does it replace the mixed foreign-key actions, or inherit them? | **Satisfied, with one unspecified action** |
| 5 | What must change? | See below |

---

### 1 · Path A — satisfied

§6.2 is path A, essentially clause for clause. Not inferred from the summary — the table and sequence say it directly:

| ADR 0020 path A requires | Design provides (§6.2) |
| --- | --- |
| Identifying fields removed | `display_name` *"pseudonymised on account deletion"*; preference fields *"clear/reset when personal"* |
| Records persist under a neutral label | *"settled entries, predictions, scores, ranks, membership and outcomes remain"* |
| Other players unaffected | competitive ownership repointed to `profiles(id)` *"without changing stored UUIDs"* |
| Auth credentials destroyed | `auth_user_id uuid null` — unique FK `ON DELETE SET NULL`; *"credentials/email/auth metadata are erased"* |
| Audited | `anonymized_at timestamptz null` records when |

The `profiles`-as-anchor choice is the right structural answer and ADR 0020 says so. No change needed for path A.

### 2 · Path B — not addressed

This is the gap, and it is cleaner than "incomplete".

**§6.2's decision statement forecloses it:**

> **Decision:** erase the auth identity **while preserving** a pseudonymised competitive record.

Singular. There is no branch, no alternative, no user choice. Every one of the nine implementation steps assumes preservation — step 4 repoints competitive ownership to `profiles(id)`, which is precisely the row path B must be able to *delete*.

**Textual confirmation:** the words *removal*, *recomputation*, *placeholder* and *withdraw* do not appear anywhere in the 422-line design in this sense. The only matches for "remove" are unrelated — a removed `activeLock` property, removing the viewer fallback.

**§10 does not cover it.** "Deletion and archival" is about **competitions and seasons**, not users: `competitions` RESTRICT while seasons exist; a season hard-deleted only while draft and empty. Nothing addresses removing one entrant from a populated season.

**What is structurally missing**, beyond the wording:

- no `removed_at` or equivalent sibling to `anonymized_at`;
- no specified trigger, RPC or job that recomputes dependent standings after an entrant is removed;
- no statement that such recomputation must be deterministic and auditable, which ADR 0020 requires explicitly;
- no neutral-placeholder concept for opponents' retained results.

**One mechanism already exists and the design does not reference it.** `public.recompute_tournament_scores(p_tournament_id uuid)` deletes and rederives every score event for a tournament, and `capture_rank_history` snapshots ranks from canonical data. Between them, deterministic recomputation after an entrant is removed is largely *available* — the cost is measured at ~33 s and ~266 MB of WAL for a full tournament at 250 entries ([ACQ-R03 evidence](2026-07-30-acq-r03-result-write-cost.md)), which is tolerable for a rare, user-initiated, non-interactive operation.

So path B is not architecturally hard here. It is simply absent.

### 3 · Settled outcomes — partly, and one landed constraint collides

ADR 0020 is specific:

> Settled competition outcomes stand; only the removed player's own records go. Their former opponents' results remain as recorded, against a neutral placeholder.

Nothing in the design *prevents* this, because the design does not contemplate removal at all. But nothing provides for it either, and there is a concrete collision worth naming.

**§6.2 step 6 says:** *"replace Predictor Cup's implicit winner action with an explicit profile-owned action."* It does not say **which** action. That single unspecified word decides whether ADR 0020 is satisfiable:

| If step 6 chooses | Consequence under path B |
| --- | --- |
| `CASCADE` | A settled cup tie is destroyed because a participant left. **Directly violates ADR 0020.** |
| `RESTRICT` | The removal is blocked. **Path B becomes impossible** for anyone who ever won a tie. |
| `SET NULL` | Blocked by `bonus_cup_fixtures_settle_shape`, which asserts `(winner_user_id is null) = (settled_at is null)` — nulling the winner while `settled_at` is set violates the check. |

**None of the three ordinary actions satisfies ADR 0020.** A neutral placeholder profile is not a nicety here; it is the only option that leaves the tie settled, the opponent's record intact and the leaver's identity gone.

This is not hypothetical. PR #271 landed contract 64 making `bonus_cup_fixtures_winner_user_id_fkey` an explicit `RESTRICT`, and the composite entrant foreign keys already `RESTRICT`. **Today, a player who has won a Predictor Cup tie cannot be deleted at all** — measured, not assumed. Last Man Standing needs the same treatment for an entrant who eliminated another player.

### 4 · Mixed foreign-key actions — satisfied, with the step 6 hole

ADR 0020 requires the mixed actions be *"replaced by one deliberate model"*. §6.2 steps 3–9 do exactly that:

| Reference class | Post-Stage-C model |
| --- | --- |
| Competitive ownership | → `profiles(id)`, the durable anchor |
| `profiles.auth_user_id` | → `auth.users` `ON DELETE SET NULL` — the single point where auth erasure enters |
| `rate_limit_events` | `CASCADE` retained — disposable housekeeping, deliberate |
| Audit actors | `SET NULL` retained — attributable-or-null, deliberate |
| League ownership | transfer-first preserved |

That is one model with two documented exceptions, which is what ADR 0020 asks for. The only hole is step 6's unspecified Cup action, covered above.

**One correction for whoever amends the design:** §2.2 and ADR 0020 both describe the before-state as mixed `cascade` / `restrict` / `set null` / **`no action`**. PR #271 removed the last undeclared action, so `no action` no longer appears — the current mix is three behaviours, verified by `accountDeletionSemantics.test.ts`, whose assertion now reads *"leaves no reference with an undeclared action"*. Three, not four. Still the defect; the count is stale.

### 5 · What must change

Recommended, **not applied**. The design is a merged baseline and its amendment is the author's call.

1. **Rewrite §6.2's decision statement to two paths.** *"Erase the auth identity while preserving a pseudonymised competitive record"* becomes the description of path A, not of account deletion. This is the load-bearing change; everything else follows.
2. **Add path B's storage and mechanism.** A `removed_at` sibling to `anonymized_at`, and a named, deterministic, audited recomputation path. `recompute_tournament_scores` plus `capture_rank_history` are the obvious foundation and should be referenced rather than re-invented.
3. **Specify step 6's action as a neutral placeholder**, not `CASCADE`/`RESTRICT`/`SET NULL` — none of which satisfies ADR 0020 (see §3). Apply the same treatment to Last Man Standing eliminations.
4. **State the settled-outcome invariant as a safeguard with an ID**, per engineering principle 11. `CS-020` is the next free number in the `CS-001`–`CS-019` range the design already uses. It belongs in §4 alongside the other stable safeguards, so the migration comments and pgTAP can cite it.
5. **Add path B to §12's required evidence.** Removing an entrant mid-season and proving that dependent standings recompute deterministically, settled ties stand, and eliminations are not reversed — that is a pgTAP case, and the seven pre-migration contracts do not include it.
6. **Correct §2.2's four-action description to three.**
7. **Record in §6.2 that the data-protection dependency is discharged.** §6.2 currently ends *"obtain a data-protection review of the erasure/pseudonymisation boundary"*. ADR 0020 is that decision. Leaving the line unqualified will read as an open blocker to the next person, which is now wrong.

## What this assessment does not establish

- **Not a legal review.** ADR 0020 states it is not legal advice and has not been reviewed by a solicitor. Nothing here changes that, and the re-identification judgement underpinning the two-path decision is untested.
- **No migration was written or run**, and no hosted schema was inspected. This is a document-against-document assessment plus verification of the landed constraints it depends on.
- **Path B's cost was not measured** at season scale. The ACQ-R03 figures cited are tournament-shaped, and a thirty-eight-week season with more accumulated history will be larger.
- **Last Man Standing and league membership were assessed less thoroughly than Predictor Cup**, which had a concrete landed constraint to test against.

## Disposition

The Stage C design is **not ready to become a migration** under ADR 0020, and the reason is narrow: one decision statement, one storage field, one recomputation path and one placeholder concept. Everything else in the design survives.

The sequencing point matters more than the list. ADR 0020 exists precisely because *"a deletion path retrofitted onto a scoring system with rank histories is materially harder than one designed in"*. That is still true, and the design has not yet absorbed it.
