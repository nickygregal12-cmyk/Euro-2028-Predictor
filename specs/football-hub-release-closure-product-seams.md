# Football Hub release closure — product seams batch

## Objective

Close three independent first-release seams that became free after the vNext completion/cutover work merged:

1. publish truthful public Privacy and Terms pages and wire every existing legal-link surface to them;
2. bound Match Centre private-league prediction fan-out without hiding requested league information;
3. settle `PROF-002` for first release by deciding whether the merged server-backed Rival Watch/pinned-rival experience already covers the product need.

This batch changes no scoring, lock, reveal, settlement, progression or provider truth.

## Governing authorities

- `AGENTS.md`
- `NOW.md`
- `docs/product/ui.md`
- `src/vnext/AGENTS.md`
- `docs/product/vnext-matches.md`
- `docs/product/vnext-player-profiles.md`
- `docs/quality/accepted-requirements.md`
- `MASTER-TODO.md`
- ADR 0017 for the public non-affiliation position
- current auth/observability/analytics/notification implementation for statements of service reality

Current contract and hosted values stay owned by the machine records; this spec intentionally states none.

## In scope

### Privacy and Terms

- `/privacy` and `/terms` are real public routes, readable signed in or signed out.
- They use the current vNext public-document presentation language rather than a detached legacy/legal shell.
- Privacy describes only current service reality, including account/profile/game data, public display name, browser storage, hosting/Auth, Turnstile where configured, Sentry where enabled, analytics only where configured, notification records/delivery where enabled, football-data providers, data-rights contact and the absence of a promised fixed retention period where none exists.
- Terms describe the current football prediction service, account/display-name responsibilities, game-rule/server authority, third-party football data limitations, fair-use/security expectations, no wagering/cash-prize claim where the existing About authority already states it, and the existing non-affiliation position.
- Neither page claims a qualified legal review has occurred.
- Neither page claims account erasure/pseudonymisation functionality that is still externally blocked.
- Landing and About legal links point to the real routes once they exist.

### Match Centre fan-out

- Private-league prediction panels remain complete for every league returned by the existing server read.
- Per-league prediction reads run with an explicit small concurrency ceiling instead of one request per league starting at once.
- Result order remains the server league-list order.
- One league read may fail without discarding successful league panels.
- No new RPC or database contract is introduced.

### `PROF-002`

- Re-assess the merged Rival Watch implementation rather than automatically building a follower graph.
- First-release decision: server-backed pinned rivals are sufficient for the intended "people I care about" journey.
- Record that decision in the live backlog/authority and remove stale expectations of a separate follower graph for first release.
- Do not add follower counts, global people search, popularity, social feed or follower notifications.

## Out of scope

- account erasure/pseudonymisation schema or closing external issue #272;
- Google OAuth;
- web push;
- provider enrichment;
- hosted database/Netlify/Production mutation;
- new social graph tables/RPCs;
- hiding league panels as a performance shortcut;
- changing private-profile visibility boundaries.

## Acceptance scenarios

1. A signed-out visitor can open `/privacy` and `/terms` directly and from the landing footer.
2. A signed-in player can open the same pages without losing the current app visual language; public policy content does not depend on player data loading.
3. About links to Privacy and Terms, with no dead/null legal links remaining for those documents.
4. Privacy copy does not claim analytics, notifications or external processors are always active when the code makes them conditional.
5. Match Centre with more leagues than the concurrency ceiling never has more than that many per-league prediction loads in flight, still returns one panel per league in original order, and preserves successful panels if one load fails.
6. `PROF-002` is no longer an ambiguous first-release engineering item: the repository records pinned Rival Watch as sufficient for first release and leaves a larger social graph as future scope only if later demanded.

## Test/evidence plan

- route/link/content tests for Privacy and Terms;
- source/content assertions that prohibited legal claims are absent;
- a pure bounded-concurrency loader test proving maximum in-flight count, stable order and partial failure behaviour;
- existing vNext Match Centre integration tests remain green;
- current Rival Watch tests remain the executable product evidence for the `PROF-002` decision;
- PR-triggered CI/browser/architecture gates are the broad evidence because this environment cannot run a local checkout.

## Hosted impact

None. No migration, provider request, deploy, environment-variable write or Production mutation.

## Completion predicate

The batch is complete when the two public routes and legal links exist, Match Centre fan-out is deliberately bounded without data loss, `PROF-002` is recorded as satisfied for first release by the merged pinned-rival experience, focused guards are present, and the exact PR head passes the applicable repository gates.
