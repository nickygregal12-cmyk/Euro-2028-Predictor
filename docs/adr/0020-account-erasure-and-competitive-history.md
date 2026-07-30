# ADR 0020 — Account erasure and competitive history

- **Status:** Accepted
- **Date:** 30 July 2026
- **Related:** ADR 0011 (competition-season scoping) · Stage C schema design (draft PR #236) · `DEC-004`

## Context

`docs/quality/current-status.md` records account deletion as **unsafe current behaviour, fully characterised**: competitive rows use mixed `cascade`, `restrict`, `set null` and `no action` references to `auth.users`. PR #246 pins the before-state as an effective foreign-key action matrix but does not change it. Deleting an account today therefore does four different things depending on which table is examined — the worst available outcome, because it is neither erasure nor preservation.

The data-protection review is listed as an open platform gap: *auth erasure versus pseudonymised competitive history*.

Stage C's design proposes `profiles` as a durable, pseudonymisable competitive anchor. That is the right structural answer. **This record settles what the anchor must support**, because the answer changes the schema and must be decided before the migration is written.

### The tension

A player's competitive history is not solely their own record. Their entry determines every other player's rank, every head-to-head result, every Cup fixture outcome and every league table they appeared in. Deleting it retrospectively alters other people's history and breaks the reproducibility requirement that leaderboards and rank histories be derivable from canonical data.

The obvious resolution is anonymisation rather than deletion: strip identifying fields, retain the entry under a neutral label, leave everyone else's records intact.

### Why the obvious resolution is incomplete

**In a small private league, an anonymised entry may remain re-identifiable.** A six-person mates' competition has five people who know who was in it and may recall who backed which team. "Player 3" with a full season of predictions is plausibly identifiable to them.

Under UK GDPR that distinction matters. Data that can be attributed to an individual with additional information is **pseudonymised**, and pseudonymised data remains personal data. Only genuinely anonymised data — where re-identification is not reasonably possible — falls outside scope. An erasure request satisfied by pseudonymisation in a context where re-identification is straightforward has arguably not been satisfied.

This is a judgement about a specific league's size and social context, and it is not one the platform can make reliably on a user's behalf.

## Decision

**Offer the user the choice. Support both paths in the schema.**

On requesting account deletion, the user selects:

**A · Anonymise and remain in standings.** Identifying fields are removed — display name, email, avatar, profile content. Entries, predictions, points, rank history and competition results persist under a neutral label. Other players' records are unaffected. The account and its authentication credentials are destroyed.

**B · Remove completely.** Entries and predictions are deleted. The user disappears from standings, and affected leaderboards and head-to-head records are recomputed without them.

**Defaults and presentation:**

- **A is presented first and as the default**, because it preserves other players' records and satisfies most requests.
- **B is offered plainly**, not buried. A user exercising erasure must not have to argue for it.
- **The consequence of B is stated before it is chosen**: your results will be removed from the tables you appeared in, and other players' historical positions will change accordingly.
- Neither path is reversible, and both say so.

**Both paths are irrevocable and audited.** The audit records which path was chosen and when, without retaining the identifying data the request removed.

## Consequences

- **The Stage C schema must support both.** This is the reason for deciding now. `profiles` as a pseudonymisable anchor covers path A; path B additionally requires that a competitive record can be removed and dependent standings recomputed deterministically. A schema built for A alone would need reworking.
- **Recomputation after path B must be deterministic and auditable.** Rank histories are already required to be reproducible from canonical data; removing an entrant is a legitimate input change, not a rewrite, and must be recorded as such.
- **Cup and Last Man Standing need explicit treatment.** A removed entrant may have won a Cup fixture or eliminated another player. Removing them cannot retrospectively resurrect an eliminated player or reverse a settled tie. **Settled competition outcomes stand; only the removed player's own records go.** Their former opponents' results remain as recorded, against a neutral placeholder.
- **The mixed foreign-key actions must be replaced by one deliberate model** as part of the same work. Four different behaviours across four tables is the current defect.
- **The privacy notice must describe both paths**, including that path A retains competitive records in pseudonymised form and that path B alters other users' historical standings.
- Managed entrants (ADR 0013) hold a display name only, with no account. Their deletion is the organiser's action and follows a separate, simpler path — one-step removal on request, per ADR 0013.
- This closes the deferred item recorded as `DEC-004` in respect of erasure, and should be cited when that register entry is updated.

## Rejected alternatives

- **Anonymisation only, with no removal path.** Rejected: in a small league it may amount to pseudonymisation rather than anonymisation, leaving an erasure request unsatisfied. It also has the platform deciding, on the user's behalf, that re-identification is not reasonably possible — a judgement it cannot make from the outside.
- **Removal only, with no anonymisation path.** Rejected: it silently rewrites other players' recorded history on one user's request, and would be the default outcome for every deletion rather than a deliberate choice.
- **Retaining the entry with identifying fields intact, refusing erasure on legitimate-interest grounds.** Rejected: the exemptions in Article 17(3) are narrow and do not plausibly cover a free-to-play prediction game.
- **Deferring until real users exist.** Rejected: this is precisely the decision that becomes expensive after the schema is written, and Stage C is being designed now. A deletion path retrofitted onto a scoring system with rank histories is materially harder than one designed in.
- **Deciding by league size** — anonymising in large competitions and removing in small ones. Rejected: it makes the platform the judge of re-identification risk, produces inconsistent outcomes for the same request, and would need a threshold nobody can defend.

## Note on scope

This record addresses erasure of a user's own account. It does not address retention periods, data export, or the small-cohort aggregate disclosure question, which remain separate. It is not legal advice and has not been reviewed by a solicitor; the position should be confirmed before public launch, per the compliance checkpoints in ADR 0015.
