# ADR 0011 — Multi-competition platform

- **Status:** Accepted direction — unimplemented
- **Date:** 29 July 2026

## Context

The application is built as a single-tournament product. Tournament rules live in `src/domain/tournament/`, entries and scoring are scoped by `tournament_id`, and the Original Predictor assumes one entry locked at one instant.

The approved product direction is a year-round hub running several prediction games across the Premier League, the Scottish Premiership and international tournaments, with Euro 2028 as one competition among them rather than the product itself.

The tournament-context engine in `docs/architecture-and-tournament-states.md` §3 is adopted design and **unbuilt**. The shipped state model remains `MatchTemporalState = 'before' | 'during' | 'after'` in `src/domain/tournament/matchCentre.ts`, with timing logic distributed across `entryLock.ts`, `matchCentre.ts`, `matchesTab.ts` and `homeDashboard.ts`.

This is the decision point. An engine built against a single-tournament assumption must be rebuilt to support a league season; an engine built with competition shape as an input is built once. The engine is also a prerequisite for the state-heavy surfaces already planned, so the choice cannot be deferred without those surfaces being built twice as well.

## Decision

**Competition shape becomes data, not code branches.** A competition season carries a kind — `tournament` (bounded, groups into knockout) or `league_season` (rolling matchweeks) — and the same engine resolves context for both. Parallel implementations per kind are prohibited.

**Lock state becomes a resolver, not a boolean.** `resolveLockState(scope, now)`, where a scope is an entry, a round, a matchweek or a match. Euro 2028 configures a single scope; a league season configures one per matchweek. No surface computes lock state itself.

> **Amended by [ADR 0020](0020-football-prediction-hub-product-model.md):** lock scope and buffer are owned by the **game**, not by the competition season, because a Main Predictor and a Last Man Standing inside one competition need different deadlines. Every rule in this section — derived locks, monotonicity, the per-match guard and fail-closed behaviour — applies unchanged to every game policy. A game policy chooses its scope and buffer; it cannot opt out of the integrity floor. ADR 0020 also reassigns a post-lock postponed fixture to its new round rather than reopening a locked round, which preserves the monotonicity rule below.

**Season games lock per matchweek**, at the round's first kickoff. Every fixture in a round locks together, before any of it is played.

**The lock instant is derived, never stored.** The effective round lock is the earliest kickoff among the fixtures currently assigned to that round, recomputed on every fixture ingestion. Broadcast rescheduling moves fixtures routinely; a stored lock instant would leave predictions open after a brought-forward fixture had kicked off, which is a complete loss of competition integrity.

**A per-match guard sits underneath the round lock.** No prediction may be accepted for any match after that match's own kickoff, enforced server-side, regardless of round state. The round lock expresses the product rule; the per-match guard is the integrity floor and is what makes stale fixture data non-catastrophic.

**Locks are monotonic and fail closed.** A locked round never reopens, whatever subsequently happens to the fixture list. Where fixture data is stale, unavailable or fails validation, the resolver returns locked — an unlocked state must never be the failure mode.

**Scoping broadens from tournament to competition season.** The same-tournament and authoritative-reference safeguards recorded as `SAFE-008` become same-competition-season safeguards. The safeguard is preserved in strength and widened in scope; it must not be weakened in the process.

**Leagues and games are both opt-in.** `docs/competition-structure.md` already requires that every competition be separately and voluntarily entered and that nothing auto-enrols anyone. That law is unchanged and now governs a wider matrix of leagues × games. A lightweight user preference governs *prominence* — what appears on Home, what the hub surfaces, what generates notifications — while *entry* remains per competition instance. Preference is a display filter over an unchanged enrolment model.

**Euro 2028 becomes a configuration, not a special case:** a competition season of kind `tournament` with a single lock scope, retaining its existing group, knockout, Golden Boot and progression rules unchanged.

## Consequences

- The context engine is built once, with competition shape as an input. Existing timing logic in `entryLock.ts`, `matchCentre.ts`, `matchesTab.ts` and `homeDashboard.ts` migrates onto it.
- **Euro 2028 behaviour must be provably unchanged.** The migration is behaviour-preserving and requires a differential test asserting identical context output before and after. The existing suite is the gate; a refactor that requires weakening a test is the wrong refactor.
- `MatchTemporalState` is superseded by the 12-state match contract in the architecture document §4.
- Every named state gets a deterministic fake-clock fixture, per §11 of that document.
- **Correction — 30 July 2026:** an earlier planning draft described authenticated Bonus Games Browser E2E coverage as absent. Direct verification disproved that claim: PR #187 provides desktop/phone lifecycle proof for KO Predictor, Last Man Standing and Predictor Cup, and `TEST-GAP-01` is resolved in the risk register. Existing tournament coverage remains regression evidence; new season/platform journeys are still required when those surfaces are built.
- **The automatic submission scheduler broadens from tournament to matchweek scope.** Tournament-wide automatic valid-entry submission is implemented; the recurring per-matchweek scheduler required for league seasons is unbuilt.
- **Fixture ingestion becomes a lock-critical path**, not merely a data feed. It must poll on a schedule, audit every kickoff time change with old and new values, and notify users when a round's lock instant moves materially.
- **A continuous reconciliation assertion is required:** no prediction may exist whose submission timestamp falls after its match's kickoff. Any row returned is a confirmed integrity breach. This follows the correctness-oracle pattern already used for scoring.
- The announced deadline and the derived lock are distinct concepts. The derived lock is authoritative; the announced deadline is a communication that must be corrected when it diverges.
- **No aggregate ranking may exist across leagues, games or seasons.** Entering more competitions must never buy a higher score. This requires a test asserting no such query path exists, not a documentation note.
- The KO Predictor becomes a competition kind available only where knockout rounds exist. It sits out league seasons and returns for Euro 2028; its tests remain in CI throughout the dormant period.
- Notification and picks surfaces group by competition season. A user in two leagues has two weekly deadlines; a user in one has one.
- Every new rule, safeguard and surface introduced under this direction receives a stable identifier at design time, per `DOC-005`.

## Rejected alternatives

- **Build the engine tournament-only and generalise later.** Rejected: the engine is unbuilt today, so the seam is free now and expensive after the state-heavy surfaces consume it. This is the specific cost the decision exists to avoid.
- **Parallel implementations per competition kind.** Rejected: duplicates business rules across competitions, which the layer laws already prohibit.
- **Per-individual-kickoff locking for season games.** Rejected. Note for traceability that this was initially recommended on the stated grounds that it removed an information advantage; **that reasoning was incorrect** and is recorded here so it is not reopened. Per-kickoff locking leaves a Sunday fixture open on Saturday night, so already-known results can inform the pick. Per-matchweek locking at the round's first kickoff removes the advantage entirely, and is simultaneously the simpler model.
- **Storing a round's lock instant as a fixed timestamp.** Rejected: broadcast rescheduling routinely moves fixtures earlier, and a stored instant would leave predictions open after a match had kicked off or finished. Deriving the lock from current fixture data makes the correct behaviour automatic rather than dependent on an operator remembering to update it.
- **Relying on the round lock alone, without a per-match guard.** Rejected: it makes correctness wholly dependent on fixture data being current, with no floor beneath it. The guard costs one server-side check and removes an entire class of catastrophic failure.
- **A combined cross-competition leaderboard.** Rejected: it breaks the separation law and rewards breadth of entry rather than accuracy.
- **Bundled enrolment — joining a set of players enrols them in every game that group plays.** Rejected: it contradicts the separation law directly. Competitions are offered by invitation, never imposed.
- **Rewriting the application around a new structure.** Rejected in line with `docs/architecture/acquisition-target-architecture.md`: evolve, do not rewrite.
