# Active delivery backlog

**Status date:** 19 August 2026  
**Purpose:** a short index of work that is genuinely still live. An unchecked item here means work remains.  
**Historical snapshot before this reconciliation:** [`docs/history/context-reset-2026-08-19/MASTER-TODO.pre-reconciliation.txt`](docs/history/context-reset-2026-08-19/MASTER-TODO.pre-reconciliation.txt)

This file is **not** implementation truth and does not restate moving contract numbers. Start with [`NOW.md`](NOW.md), then use the authority linked for the task.

| Question | Authority |
| --- | --- |
| Current repository/hosted facts | [`NOW.md`](NOW.md) → [`docs/quality/current-status.md`](docs/quality/current-status.md) |
| Current vNext stage | [`config/vnext-programme.json`](config/vnext-programme.json) |
| vNext stage scope/completion | [`docs/product/vnext-stage-contracts.md`](docs/product/vnext-stage-contracts.md) |
| Accepted product gaps | [`docs/quality/accepted-requirements.md`](docs/quality/accepted-requirements.md) |
| Current risks | [`docs/quality/risk-register.md`](docs/quality/risk-register.md) |
| Decisions | [`docs/adr/README.md`](docs/adr/README.md), [`docs/quality/deferred-decisions.md`](docs/quality/deferred-decisions.md) |
| Hosted migration state | [`docs/ops/ops-pending-migrations.md`](docs/ops/ops-pending-migrations.md) |
| GitHub work | Open issues/PRs — re-read before starting work |

## 1. vNext programme

- [ ] Complete the stage named by `config/vnext-programme.json`; do not infer progress from this file.
- [ ] Before the Stage 13 supporting-surface sweep grows further, close or deliberately schedule the vNext quality foundations: `TEST-002`, `CI-002`, `UX-006`, `TEST-003`, `DOC-004`, `OPS-012`.
- [ ] Stage 13 — migrate/support Account, onboarding, discovery, private-play entry, help and generic failure/empty/loading states using existing working capabilities rather than rebuilding them.
- [ ] Stage 14 — Football Hub production cutover, only after its route, accessibility, performance, rollback and explicit Production gates pass.
- [ ] Stage 15 — Euro 2028 vNext adoption and final convergence audit.

**Do not duplicate the route matrix here.** [`docs/product/vnext-route-migration-matrix.md`](docs/product/vnext-route-migration-matrix.md) owns route fate. The active Championship/Stage 12 branch already carries its Stage 12 correction.

## 2. Accepted product gaps still requiring delivery

Read the register for the actual requirement and acceptance evidence; these identifiers are an index, not a second specification.

- [ ] Domestic frontend: `DFA-001`, `DFA-004`, `DFA-006`–`DFA-012` where still open in the register.
- [ ] Product/data consumers and extensions: `MIG-UI-15`, `MIG-UI-16`, `MIG-UI-18`–`MIG-UI-20`, `INNOV-011a`, `INNOV-012a`, `INNOV-017a`, `INNOV-019a`, `PROF-001`.
- [ ] Capacity/lifecycle: `CAP-006`, `CAP-007`.
- [ ] Two-site/account/launch requirements that remain open under `SITE-*` and `ACCOUNT-*`.

Completed rows stay in the accepted-requirements register for traceability, but they do **not** stay as unchecked work here.

## 3. Active issue work outside the sequential vNext programme

Re-check GitHub before acting; issue bodies may contain dated evidence, while comments/current source can move the state forward.

- [ ] **#27** — finish retirement proof for the exact legacy `euro28-predictor-dev` surface.
- [ ] **#28** — Development Turnstile/CAPTCHA configuration and real auth-journey evidence.
- [ ] **#33** — verify the effective Protect Main/ruleset controls and required contexts.
- [ ] **#272** — independent qualified UK data-protection review; engineering cannot self-approve it.
- [ ] **#854** — AI Lab first-weekend/operational completion; do not close on one bug fix.
- [ ] **#863 / PROF-001** — same-season bounded player-profile visibility implementation.
- [ ] **#865** — optional native Supabase passkey Development pilot, subject to current provider capability and RP/domain gates.
- [ ] **#866** — available-provider anomaly corroboration sentinel.
- [ ] **#867 / INNOV-012a** — deterministic League Side Honours.
- [ ] **#868** — Predictor Hub external clearance/domain/DNS/Auth/sender operations.

## 4. Decisions and external gates

- [ ] `DEC-017` — icon infrastructure decision before Stage 13 needs a general icon vocabulary.
- [ ] `DEC-016` — vNext light-theme/persisted-theme decision before Stage 13 closes and before Stage 14 cutover.
- [ ] #272 external review before the blocked account-erasure ownership/schema path.
- [ ] #868 external brand/domain clearance and registration before public Hub launch.
- [ ] Any Production database/application mutation requires explicit authority for that exact action and target; a repository gap is not authorisation.

## 5. Release-quality debt that remains real

- [ ] **Apply contract 206 to Development, then confirm the provider lane is alive again.** Until it is applied, Development has imported nothing since 10 August: `ING-001` in the risk register. Confirm by the next `provider_response_consumption` row reading outcome `applied`, and by a postponed fixture appearing as postponed on Matches without anyone touching it. The 13 already-consumed responses do not replay — the recovery arrives with the next poll.
- [ ] **`ING-002`** — measure SportMonks status tokens `14`–`21` against real payloads, or remove the guessed rows so they fail closed to `unknown`.
- [ ] **`ING-005`** — decide whether the published prediction deadline is per fixture or per matchweek. Enforcement has been per fixture since contract 119; the card read still publishes the matchweek instant, so a rescheduled fixture reads as locked while the trigger would accept the write.
- [ ] **`ING-006`** — decide the provider poll window width and idle cadence against the prediction-deadline horizon rather than against matchday. The proposed policy is in the risk register.
- [ ] Manual assistive-technology/accessibility checks and the vNext contrast/geometry gaps named in the risk register.
- [ ] Full-volume/performance and rollback rehearsals at the release stage that owns them.
- [ ] Remaining security/operations work such as CSP inline-style removal, residual rate-limit coverage, monitoring/alerting and recovery ownership where still open in the risk register.
- [ ] Repository hygiene still intentionally partial: release/version metadata, licence/changelog policy and historical component-gallery cleanup where still open.

## 6. Parked — valid future scope, not today's backlog

Euro 2028 official-data/final-release work remains parked until the tournament return window. It includes final qualified teams/draw, regulations, fixtures/kickoffs/venues, official squads/player references, final lock, tournament operations rehearsal and remaining tournament-only presentation work.

Do **not** surface those parked checkboxes beside current Hub/vNext work. The pre-reconciliation inventory is preserved in the historical snapshot linked at the top, and the recoverable `euro-2028-baseline` tag remains the tournament reference.

## Closure rule

When work completes:

1. update the canonical requirement/risk/issue with evidence;
2. remove or check off the corresponding live item here;
3. never copy historical completion narratives into this file;
4. never delete the historical snapshot merely to make the backlog look shorter.

The goal is simple: **if an AI sees an unchecked item in this file, it should be able to assume that meaningful work still remains.**
