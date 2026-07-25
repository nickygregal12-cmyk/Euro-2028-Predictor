# Deferred decision register

This register records decisions deliberately postponed because of timing, missing authoritative information or unresolved architecture. It is not a general backlog.

Normal defects belong in [`risk-register.md`](risk-register.md) and GitHub Issues. Planned implementation remains in [`../roadmap.md`](../roadmap.md) and [`../build-todo.md`](../build-todo.md).

The contract-35 production rollout completed on 25 July 2026 and is not a deferred decision. Future monitoring, administrator, Auth/CAPTCHA, official-data and launch-readiness work remains in current status, the risk register, roadmap and TODO. The product/rules decisions below remain deliberately deferred.

| ID | Decision or deferred item | Context | Reason deferred | Dependency | Decision owner | Review trigger | Status | Last reviewed |
| -- | ------------------------- | ------- | --------------- | ---------- | -------------- | -------------- | ------ | ------------- |
| DEC-001 | Authoritative resolution for fully unresolved actual group ties | SQL scoring currently has a deterministic fallback when modelled criteria cannot separate an actual group tie. | Official Euro 2028 regulations and the administrative override workflow must be confirmed before implementation. | Official competition regulations and result-administration design | Project owner | When official regulations are published, and no later than the pre-launch rules gate | Deferred | 2026-07-25 |
| DEC-002 | Exact tournament lock instant and official fixture data | The application lock must correspond to the first official tournament kickoff and reference data must be refreshed authoritatively. | Official draw, teams, fixtures and kickoff times are not final. | Official UEFA tournament data | Project owner | When official draw/fixtures are released and again before production launch | Deferred | 2026-07-25 |
| DEC-003 | Final leaderboard tie-break activation | Final tie-break rules are documented/pure-tested while the running leaderboard uses shared points ranks. | It remains unclear whether final tie-breaks activate automatically at tournament completion or through an administrative calculation. | Owner decision and end-state product design | Project owner | Before the full tournament dress rehearsal | Deferred | 2026-07-25 |
| DEC-004 | Minimum cohort and privacy rules for prediction aggregates | Match-centre/reveal RPCs expose cross-user or aggregate predictions after eligibility checks. | Acceptable disclosure thresholds for small leagues require an explicit privacy/product decision. | Privacy policy and expected public-user model | Project owner | Before public beta or broader public signup promotion | Deferred | 2026-07-25 |
| DEC-005 | Separate KO Predictor architecture and launch phase | KO Predictor is documented as a future separate competition with no route, schema or service implementation. | Original Predictor correctness and shared competition typing must be established first. | Original integrity and approved bonus-game architecture | Project owner | Before any KO Predictor implementation branch opens | Deferred | 2026-07-25 |
| DEC-006 | Last Man Standing implementation phase | Last Man Standing appears only in future competition documentation. | It is intentionally outside current Original Predictor launch scope. | Approved bonus-game roadmap phase | Project owner | When the project enters the approved bonus-game build phase | Deferred | 2026-07-25 |
| DEC-007 | Predictor Cup implementation phase | Predictor Cup rules/design exist, but no runtime route, schema or service is present. | It is intentionally outside current Original Predictor launch scope. | Original launch confidence and competition architecture | Project owner | Before Predictor Cup implementation begins | Deferred | 2026-07-25 |
| DEC-008 | Fan Duels direct-challenge concept | Earlier Fan Duels concept was superseded by Predictor Cup; direct challenges are parked. | Current product direction deliberately excludes it. | Future owner product decision | Project owner | Only if the owner explicitly reopens direct-challenge design | Superseded | 2026-07-25 |
| DEC-009 | Incremental versus full-tournament score recomputation | Full delete-and-rederive scoring is simple/recoverable but may be expensive at target capacity. | Performance impact is unmeasured; premature optimization could add risk. | Correct serialized scorer and 250-user capacity benchmark | Project owner / technical lead | After target-capacity load testing | Deferred | 2026-07-25 |
| DEC-010 | Public crawlability, marketing landing and route-specific SEO | Current product is an authenticated SPA with global metadata and soft-404 behavior. | Public marketing/SEO is optional and not approved current launch scope. | Public acquisition strategy | Project owner | Before public sharing/search-acquisition campaign | Deferred | 2026-07-25 |
| DEC-011 | Production player and squad data administration | Golden Boot selection requires reliable production player data and a safe update process. | Official qualified teams/squads and operational ownership are unavailable. | Official squads and safe admin/result workflow | Project owner | When official squads are available and before predictions open | Deferred | 2026-07-25 |

## Register rules

- Use this register only for conscious postponement, not as a general backlog.
- Every item must explain why it cannot or should not be decided now.
- Every item must have a decision owner and concrete review trigger.
- Deferred items must not disappear without a recorded decision.
- Completed, rejected and superseded decisions remain for traceability.
- An item here must not be described as implemented behavior.
- Where a decision affects an open finding, retain the finding in the risk register.
- Product sequencing remains in the roadmap; implementation work remains in GitHub Issues.