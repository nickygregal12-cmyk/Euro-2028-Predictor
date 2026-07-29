# Euro 2028 Predictor — Current Risk Register

**Status date:** 29 July 2026  
**Live status authority:** [`current-status.md`](current-status.md)  
**Current baseline:** repository, development Supabase, production Supabase and every Netlify context aligned at the contract recorded in [`../../config/deployment-contract.json`](../../config/deployment-contract.json)  
**Current published application:** Netlify deploy `6a6a53af58a0a500096b7cb1`, ready from `ff633396e04eca77ed4456c5537ab361d9d259ee`  
**Recovery:** same-day encrypted production backup/restore evidence plus exact preflight and preserved-data postflight for the current promotion.  
**Merged 29 July 2026:** this register absorbed the acquisition risk register (`ACQ-R` findings, opened 27 July 2026). It is now the single live register. The source is archived at [`history/acquisition-risk-register-2026-07-27.md`](history/acquisition-risk-register-2026-07-27.md); every one of its 27 risks is accounted for in [§ Acquisition merge accounting](#acquisition-merge-accounting).

Current code, executable tests and verified hosted evidence override older classifications. Production remains a controlled future-tournament target rather than an active Euro 2028 service.

## Current contract movement

| ID | Current position |
| --- | --- |
| `OPS-006` | **Resolved.** Repository, both databases, all Netlify declarations and the published application are aligned at the recorded contract. |
| `POSTLOCK-001` | **Resolved and production-hosted.** Bounded post-lock consensus and the richer locked My Entry/Trends experience are published. |
| `LEAGUE-001` | **Resolved and production-hosted.** Final overall/private standings apply the approved five tie-breakers only after every result. |
| `PRIV-001` | **Resolved and production-hosted.** Tournament-wide consensus is suppressed below ten submitted entries; the caller counts and browser roles cannot execute the unsuppressed helper. |
| `REL-008` | **Reduced to historical evidence.** PRs #194/#195 showed inconsistent documentation-branch previews, but exact PR #193 preview publication, HTTP smoke and Chromium smoke passed. |
| `MIG-001` | **Resolved.** Pull-request CI fetches `origin/main`, rejects stale/colliding added migrations, enforces strict ordering and passes when no migration is added. |
| `DATA-003` | **Resolved and hosted.** Same-tournament/reference guards are present in both hosted environments. |
| `DOC-001` | **Resolved and actively maintained.** Current production evidence is recorded in the live authority documents. |
| `FUNC-003` | **Resolved in production.** Canonical Bonus Game cards and the repeatable catalogue prevent silent disappearance. |
| `TEST-GAP-01` | **Resolved by PR #187.** All three Bonus Games have authenticated desktop/phone browser lifecycle proof. |
| `TEST-GAP-02` | **Resolved by PR #189.** H2H rank-history capture has direct behavioural pgTAP. |
| `RESULT-AUDIT-01` | **Resolved by PR #191.** Confirm/correct/clear revision content is asserted exactly. |
| `TEST-001` | **Reduced.** Consensus/privacy/final standings have unit, pgTAP, desktop/phone and axe coverage; manual accessibility and later full-volume/rollback rehearsals remain. |
| `FUNC-002` | **Resolved and production-hosted; supersedes `ACQ-R05`.** See [§ FUNC-002 versus ACQ-R05](#func-002-versus-acq-r05). |

## Critical

| ID | Finding | Current status | Required closure |
| --- | --- | --- | --- |
| `OPS-006` | Uncontrolled production contract divergence | **Resolved** | Reopen on any unrecorded repository/database/application contract split. |
| `DATA-001` | Predicted group positions can be forged or drift | **Resolved** | Reopen on regression. |
| `SECURITY-001` | Browser roles can write server-owned position inputs | **Resolved** | Reopen on regression. |
| `SECURITY-002` | Submission boundary can be bypassed | **Resolved** | Reopen on regression. |
| `DATA-002` | Knockout winner/method lacks database authority | **Resolved** | Reopen on regression. |
| `OPS-001` | Environment rollback crosses database boundaries | **Resolved** | Preserve environment isolation and contract guards. |
| `OPS-002` | Administrator control room incomplete | **Resolved** | Result and qualification controls are browser-proven. Absorbs `ACQ-R04`; severity raised High → Critical to the source rating (see [§ Severity reconciliation](#severity-reconciliation)). |
| `ACQ-R01` | Unbounded global leaderboard and client-side ranking can make the home/default route unusable at scale | **Mitigated at the enforced cap** | Server-ranked keyset pagination and independent current-user context shipped; rollback-only 250-entry hosted evidence records single-digit-millisecond pages and bounded payloads. Reopen before increasing the operating cap materially. |
| `ACQ-R02` | Browser standings reads aggregate the scoring table through a derived totals view | **Open — verified still reproducing on `origin/main` (29 July 2026)** | `20260727183900_bounded_overall_leaderboard.sql` computes `coalesce(sum(se.points), 0)` via `left join public.score_events`; `entry_standings` exists in no migration or source file, and `entry_totals` remains a view (`20260720130000_add_scoring.sql`). Closure needs a maintained standings model with indexed reads and reconciliation against the derived oracle (ADR-0004). Not justified at the enforced cap on current 250-entry evidence; review on cap increase or adverse dress-rehearsal evidence. |

## High

| ID | Finding | Current status | Evidence / required closure |
| --- | --- | --- | --- |
| `DATA-003` | Same-tournament/reference constraints incomplete | **Resolved and hosted** | Private guards, privileges and valid/invalid hosted verification passed. |
| `DATA-006` | Wider fixture/source relationships insufficiently constrained | **No proven residual defect** | Reopen only with an exact uncovered relationship. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Resolved and production-hosted** | Scheduled submission with immutable owner outcomes remains aligned. Supersedes `ACQ-R05`; see [§ FUNC-002 versus ACQ-R05](#func-002-versus-acq-r05). |
| `DATA-004` | Actual tie resolution can use non-authoritative fallback | **Reduced** | Authorised exact-set resolution exists; official regulations/data verification remains a launch item. |
| `DATA-005` | Score/entry clearing lacks race-safe authority | **Resolved and production-hosted** | Non-resurrection of cleared entries is hosted and tested. |
| `POSTLOCK-001` | Locked entries lacked a crowd/trends experience | **Resolved and production-hosted** | Bounded post-lock aggregates with cohort suppression. |
| `LEAGUE-001` | Final standings did not apply the documented tie-break order | **Resolved and production-hosted** | The five-step order activates after all results and preserves live points-only ranks. |
| `TEST-001` | Critical rules lack complete end-to-end evidence | **Reduced** | Remaining: manual assistive-technology review, full-volume dress rehearsal and rollback rehearsal. Absorbs the E2E half of `ACQ-R14`. |
| `OPS-003` | Production observability operations incomplete | **Partial** | Name monitoring/backup/Cron owners, retention/escalation and incident procedure. Also carries the Auth/SMTP ownership dependency for reminder delivery (`FEAT-041`). |
| `AUTH-001` | Turnstile/CAPTCHA contexts not fully verified | **Open** | Absorbs the anti-bot half of `ACQ-R09`; severity raised Medium → High to the source rating, which treats production anti-bot fail-closed behaviour as a launch gate. |
| `AUTH-002` | Leaked-password protection disabled | **Open decision** | Absorbs the password/breach half of `ACQ-R09`; severity raised Medium → High for the same reason. |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | **Open** | Aggregate minimum cohort is implemented; broader invite/abuse review remains. Absorbs `ACQ-R10` (invite enumeration: cryptographic longer codes, preview throttling, reduced disclosure, code rotation); severity raised Medium → High to the source rating. |
| `TYPE-001` | Hand-written types/casts can hide schema drift | **Open** | Absorbs `ACQ-R08`; closure needs TypeScript strict mode plus generated, freshness-checked database types. Severity raised Medium → High to the source rating. |
| `A11Y-001` | Assistive-technology review incomplete | **Partial** | Automated axe and phone overflow coverage exist; manual keyboard/screen-reader/contrast review remains. Absorbs `ACQ-R18` and the accessibility half of `ACQ-R14`; severity raised Medium → High to the source rating. |
| `PERF-002` | Scoring recomputes whole tournament | **Open pending complete-volume measurement** | Absorbs `ACQ-R03`. Severity raised Medium → Critical-rated at source; **retained at High pending owner confirmation** because measured evidence (full recompute ≈354 ms at 250 entries with 12 results, `investigations/2026-07-28-stage-3c2-scale-read-recompute-evidence.md`) does not support the source's Critical rating at the enforced cap, and `DEC-009` defers the decision to full-result-volume measurement at the dress rehearsal. See [§ Severity reconciliation](#severity-reconciliation). |
| `ACQ-R06` | Prediction persistence uses many row-level requests and rate-limit events | **Open — verified still reproducing on `origin/main` (29 July 2026)** | `src/services/supabase/predictions.ts` `upsertMatchPrediction` performs a per-row `.upsert()`, and no batched save RPC appears in the RPC allowlist in `config/deployment-contract.json`. Closure needs a batched transactional save RPC and action-level rate limiting. Related: `DATA-007`. |
| `ACQ-R07` | Reference data is repeatedly fetched and one query is not explicitly tournament-scoped | **Open — verified still reproducing on `origin/main` (29 July 2026)** | In `src/services/supabase/tournamentData.ts` the `group_teams` select carries no tournament filter while its sibling `groups` and `matches` selects both use `.eq('tournament_id', …)`. `group_teams` has no `tournament_id` column (`20260719120000_init_v0_1.sql`), so it is scoped only transitively through `group_id`; a second tournament would return both tournaments' rows. No client query cache is present. Closure needs client/edge caching, an explicit tournament filter and fail-closed lock data (ADR-0007). |
| `ACQ-R11` | No accepted background-job tier supports scoring, submission, reconciliation and lifecycle work | **In progress** | A `pg_cron` tier carries the idempotent submission job; scoring drain, reconciliation/lifecycle jobs and failure observability remain unbuilt (ADR-0005). |
| `ACQ-R12` | No product analytics supports funnel or retention decisions | **Open** | Needs a privacy-conscious event taxonomy, approved provider, CSP/DPIA review and core dashboards (ADR-0009). |
| `ACQ-R13` | Large-scale behaviour at lock and result peaks is not evidenced | **In progress** | Separate rollback-only hosted tranches cover 250 submitted entries and a 250-member private league, including query plans, payload sizes, full cursor traversal and recomputation. Connection-pool/concurrent peak testing and full-result-volume evidence remain. Related: `TEST-001`, `PERF-002`. |

## Medium

| ID | Finding | Current status |
| --- | --- | --- |
| `OPS-008` | Legacy public development site remains | **Open — separate workstream; never use as current preview.** Absorbs `ACQ-R23`. |
| `REL-007` | Stale device can delete a newer bracket pick | **Implementation present; final controlled browser evidence pending** |
| `REL-008` | Netlify deploy-preview policy was inconsistent across documentation branches | **Reduced; final preview passed in Browser E2E `30473546011`. Historical #194/#195 evidence remains in the [`REL-008 investigation`](investigations/2026-07-29-rel-008-deploy-preview-reliability.md).** |
| `MIG-001` | Concurrent branches can add stale/colliding migration timestamps | **Resolved by the committed guard and focused tests.** |
| `PRIV-001` | Tournament-wide prediction consensus had no minimum cohort | **Resolved and production-hosted by [`20260729154931_prediction_consensus_minimum_cohort.sql`](../../supabase/migrations/20260729154931_prediction_consensus_minimum_cohort.sql).** Absorbs the suppression-threshold half of `ACQ-R16`. |
| `DB-001` | `public.enforce_joker_rules` has mutable search path | **Open advisor finding.** Absorbs the search-path half of `ACQ-R17`. |
| `DB-002` | Authenticated `SECURITY DEFINER` allowlist needs continued review | **Open assurance finding; intended RPCs remain explicitly granted.** Absorbs the enumeration half of `ACQ-R17`. |
| `DB-003` | Several foreign keys lack supporting indexes | **Open pending representative query evidence.** Absorbs the index half of `ACQ-R17`. |
| `PERF-001` | League summaries may scale serially | **Open** |
| `UX-001` | Trustworthy invite context before auth incomplete | **Partial; proposed next batch** |
| `UX-002` | Unavailable and empty data can be conflated | **Reduced; Trends has locked/loading/error/suppressed/populated states, secondary surfaces remain** |
| `FUNC-003` | Bonus Games rendered as absent when reference data was empty | **Resolved in production** |
| `DATA-007` | Rate limiting is count-then-insert | **Open.** Related: `ACQ-R06`. |
| `DOC-001` | Documentation authority can drift | **Resolved; reopen on contradiction** |
| `SEO-001` | SPA fallback produces soft 404s | **Open.** Absorbs the 404-semantics half of `ACQ-R22`; severity raised Low → Medium to the source rating. `DEC-010` records public crawlability as outside approved launch scope. |
| `SEO-002` | Metadata largely global | **Open.** Absorbs the share-route metadata half of `ACQ-R22`; severity raised Low → Medium for the same reason, subject to `DEC-010`. |
| `ACQ-R15` | Users must refresh for result and standing changes | **Open** — needs narrow Realtime invalidation plus bounded live polling fallback (ADR-0008). |
| `ACQ-R16` | Prediction distribution reads are live aggregates and can expose small samples | **Reduced** — the suppression-threshold half is resolved by `PRIV-001` for tournament-wide consensus. Residual: match-pick distributions are still live aggregates and are not materialised. |
| `ACQ-R19` | Dependency, SAST, secret-scanning and repository governance automation are incomplete | **Open** — needs Renovate/Dependabot, CodeQL, push protection, `CODEOWNERS`, PR template and `SECURITY.md`. `.github/` currently holds workflows only. Related: `REPO-001`. |
| `ACQ-R20` | Coverage and bundle budgets are not enforced | **Open** — needs domain/overall coverage thresholds and compressed bundle budgets in CI. |
| `ACQ-R21` | GDPR self-service, retention and processor records are incomplete | **Open** — needs export, deletion, retention schedule, processor register and DPIA. |
| `ACQ-R22` | Offline/PWA support is absent | **Open** — the share-metadata and 404 halves are absorbed by `SEO-002` and `SEO-001`; this row retains the offline/PWA residual, to be prioritised on commercial value after launch foundations. |

## Low

| ID | Finding | Status |
| --- | --- | --- |
| `HYGIENE-002` | Some pure modules may be test/reference-only | **Open; verify before deletion.** `src/domain/tournament/calculateLeagueRank.ts` is a confirmed no-caller module — authoritative ranking is database-owned by design. |
| `CODE-001` | Large orchestration files are hotspots | **Open.** Absorbs `ACQ-R25`: split only when related functional work changes them. |
| `UX-003` | Other-player profile action incomplete | **Resolved; secure co-member profile and H2H navigation are production-hosted** |
| `DATA-008` | Scores have no practical database maximum | **Open.** Absorbs `ACQ-R24`: constrain scores to 0–99 and test. |
| `DOC-002` | Package version remains `0.0.0` | **Open.** Absorbs the versioning half of `ACQ-R27`. |
| `DOC-003` | Component gallery large/partly historical | **Open; development-only** |
| `REPO-001` | Licence/changelog policy absent | **Partial.** Absorbs the contributor/security-policy half of `ACQ-R27`. Related: `ACQ-R19`. |
| `ACQ-R26` | Residual console/lint warnings and asset inefficiencies can regress quality | **Open** — route logs through observability, fail CI on agreed warnings and optimise assets. |

## FUNC-002 versus ACQ-R05

The two registers recorded the same underlying risk with opposite statuses: `FUNC-002` as **Resolved and production-hosted**, `ACQ-R05` as **In progress**. Resolved 29 July 2026 in favour of **`FUNC-002`**, verified against `origin/main`.

**The risk as stated** — "complete entries may remain unsubmitted at lock and score zero" — does not reproduce:

- `supabase/migrations/20260727174658_automatic_entry_submission.sql` provides the database-scheduled processor;
- `public.process_due_entry_submissions(timestamp with time zone)` and `public.get_entry_submission_status(uuid)` are both in the RPC allowlist in `config/deployment-contract.json`, so the capability is contract-declared and hosted;
- `feature-baseline.md` `FEAT-020` classifies automatic valid-entry submission as *Implemented and production-hosted*, with immutable outcomes and owner-visible status;
- closure evidence: PR #128 (implementation), pgTAP and unit coverage (validation), and the contract-declared RPCs (hosted).

**Why `ACQ-R05` read differently:** its mitigation text bundled a second deliverable — "user notification" — into the risk. That deliverable genuinely does not exist (no email dispatch under `src/services/`), but a missing *notification* does not cause a complete entry to score zero, which is the risk. Conflating them kept a resolved risk open.

**Disposition:** `FUNC-002` stands as Resolved and production-hosted. The notification remainder is **not** lost and needs no new identifier: it is tracked as `FEAT-041` (*Deadline reminder emails — Documented/planned; delivery awaits Auth/SMTP ownership*) in `feature-baseline.md`, and its blocking dependency is tracked here under `OPS-003`.

## Severity reconciliation

Where the two registers rated the same risk differently, the higher rating governs, per the merge rule. Applied 29 July 2026 by this merge — the escalations below come from the source register's 27 July ratings, not from new evidence, and per `README.md` § *Severity definitions* they remain flagged until the owner confirms them.

| ID | Was | Source rating | Merged | Why |
| --- | --- | --- | --- | --- |
| `OPS-002` | High | Critical (`ACQ-R04`) | **Critical** | Source rated credential exposure during live result operations as Critical impact. Already Resolved, so the change is to the recorded impact only. |
| `AUTH-001` | Medium | High (`ACQ-R09`) | **High** | Source treats production anti-bot fail-closed behaviour as a hard launch gate. |
| `AUTH-002` | Medium | High (`ACQ-R09`) | **High** | Same launch-gate reasoning for password floor and breach screening. |
| `SEC-001` | Medium | High (`ACQ-R10`) | **High** | Source rated invite enumeration as materially exploitable before launch. |
| `TYPE-001` | Medium | High (`ACQ-R08`) | **High** | Source rated undetected schema drift as a data-confidence risk. |
| `A11Y-001` | Medium | High (`ACQ-R14`) | **High** | Source rated missing assistive-technology evidence as a launch blocker. |
| `SEO-001` | Low | Medium (`ACQ-R22`) | **Medium** | Source rated public-route semantics above polish. Subject to `DEC-010`. |
| `SEO-002` | Low | Medium (`ACQ-R22`) | **Medium** | As above. |
| `PERF-002` | Medium | Critical (`ACQ-R03`) | **High, flagged** | The one place the higher rating was **not** taken in full. Measured evidence (≈354 ms full recompute at 250 entries with 12 results) contradicts a Critical rating at the enforced operating cap, and `DEC-009` defers the decision to full-result-volume measurement. Raised Medium → High rather than Critical, and flagged for owner confirmation either way. |

## Acquisition merge accounting

All 27 `ACQ-R` risks from the archived source, each merged into a destination identifier, carried across with its own identifier, or recorded as already covered. **No risk was closed as part of this merge** — closure requires implementation evidence, validation evidence and a linked commit or pull request, and no source risk met that bar that was not already resolved in this register.

| Source | Disposition | Destination |
| --- | --- | --- |
| `ACQ-R01` | Carried across, identifier retained | `ACQ-R01` — Critical, Mitigated at the enforced cap |
| `ACQ-R02` | Carried across, identifier retained; **verified still reproducing** | `ACQ-R02` — Critical, Open |
| `ACQ-R03` | Merged | `PERF-002` (severity reconciled) |
| `ACQ-R04` | Merged | `OPS-002` (severity reconciled) |
| `ACQ-R05` | Merged; contradiction resolved in favour of the destination | `FUNC-002`, with the notification remainder under `FEAT-041` and `OPS-003` |
| `ACQ-R06` | Carried across, identifier retained; **verified still reproducing** | `ACQ-R06` — High, Open |
| `ACQ-R07` | Carried across, identifier retained; **verified still reproducing** | `ACQ-R07` — High, Open |
| `ACQ-R08` | Merged | `TYPE-001` (severity reconciled) |
| `ACQ-R09` | Merged, split across two | `AUTH-001` and `AUTH-002` (severity reconciled) |
| `ACQ-R10` | Merged | `SEC-001` (severity reconciled) |
| `ACQ-R11` | Carried across, identifier retained | `ACQ-R11` — High, In progress |
| `ACQ-R12` | Carried across, identifier retained | `ACQ-R12` — High, Open |
| `ACQ-R13` | Carried across, identifier retained | `ACQ-R13` — High, In progress |
| `ACQ-R14` | Merged, split across two | `TEST-001` (E2E half) and `A11Y-001` (accessibility half, severity reconciled) |
| `ACQ-R15` | Carried across, identifier retained | `ACQ-R15` — Medium, Open |
| `ACQ-R16` | Partly merged, remainder carried | `PRIV-001` (suppression threshold) plus `ACQ-R16` for the un-materialised distributions |
| `ACQ-R17` | Merged, split across three | `DB-001`, `DB-002`, `DB-003` |
| `ACQ-R18` | Merged | `A11Y-001` |
| `ACQ-R19` | Carried across, identifier retained | `ACQ-R19` — Medium, Open; related `REPO-001` |
| `ACQ-R20` | Carried across, identifier retained | `ACQ-R20` — Medium, Open |
| `ACQ-R21` | Carried across, identifier retained | `ACQ-R21` — Medium, Open |
| `ACQ-R22` | Partly merged, remainder carried | `SEO-001` and `SEO-002` (severity reconciled) plus `ACQ-R22` for the offline/PWA residual |
| `ACQ-R23` | Merged | `OPS-008` |
| `ACQ-R24` | Merged | `DATA-008` |
| `ACQ-R25` | Merged | `CODE-001` |
| `ACQ-R26` | Carried across, identifier retained | `ACQ-R26` — Low, Open |
| `ACQ-R27` | Merged, split across two | `DOC-002` (versioning) and `REPO-001` (contributor/security policy) |

The source's *Completed repository foundations* section is not a risk list and was not merged as rows; it is preserved verbatim in the archived source, and its live equivalents are `current-status.md` and `feature-baseline.md`. The source's *Status values* vocabulary is preserved in the archive; this register uses the vocabulary in `README.md` § *Status definitions*.

## Register rules

- Repository implementation, database promotion and application publication are separate closure states.
- Do not call the whole product launch-ready because the baseline is tag-ready.
- Do not retain broad findings after the concrete defect is resolved.
- The current repository, database, environment and application baseline is the contract recorded in `config/deployment-contract.json`. This register names no contract number, so it cannot go stale against one.
- A guard blocking incompatible deployment is a safeguard, not a defect to bypass.
- Historical audits and reconciliations remain immutable.
- **Critical and High risks are hard launch gates** unless the owner records an explicit, dated acceptance with scope, expiry/review date and rollback or contingency position. *(Carried from the archived acquisition register's acceptance rule.)*
- **A merged pull request without hosted or load evidence moves a risk to In progress, not Mitigated or Resolved.** A process, a runbook or a prepared command is not evidence — this is the control `DOC-001` exists to protect. *(Carried from the archived acquisition register.)*
- `ACQ-R` identifiers are preserved exactly. Do not renumber them into the `PERF`/`SEC`/`OPS` series; regression comparison across the 27 July acquisition audit and later audits depends on them (`DOC-005`).
