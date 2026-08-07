# Euro 2028 Predictor — Current Risk Register

**Status date:** 6 August 2026  
**Live status authority:** [`current-status.md`](current-status.md)  
**Current baseline:** stated in [`current-status.md`](current-status.md), not here — repository contract, hosted contracts and the deploy-gate position all live there. Production deploys are intentionally paused by the contract gate. This line used to restate those numbers and drifted ten contracts behind while doing it  
**Current published application:** last good Netlify production deploy recorded in [`current-status.md`](current-status.md)  
**Recovery:** same-day encrypted production backup/restore evidence plus exact 60→63 preflight and preserved-data postflight.

Current code, executable tests and verified hosted evidence override older classifications. Production remains a controlled future-tournament target rather than an active Euro 2028 service.

## Correction record — 6 August 2026

An external forensic project-state audit of repository commit `7a566a3` found this register presenting 30 July positions as current while the repository had moved substantially on. The register has been revalidated entry by entry against the audited repository state; the 30 July record below is preserved unchanged as history. What moved:

- The register rules restated "repository/development 64" as current contract truth — the exact restating-numbers drift the header already warns against. The rule now points at the live authorities instead of restating their values.
- `SEO-001` was still Open although the repository's Netlify configuration now answers 404 from the catch-all (the rule's comment names the finding) under test guard. Production publication of that fix remains outstanding because production deploys are paused.
- `DB-001` was still an open advisor finding although the Stage C1 and C1b migrations redefine `public.enforce_joker_rules()` with a pinned empty `search_path`, inside the migration range the development contract records as applied.
- `DOC-001`'s closure was conditional on the Stage C governance PR landing; the accepted governance amendment is on `main`, but documentation drift recurred — this register's own staleness is the evidence — so the finding stays open rather than closing.
- `OPS-009` is newly recorded: hosted development trails the repository contract, which blocks realistic end-to-end proof of the newest browser reads. **Superseded the same day — see the second 6 August record below.**
- `UX-002` gained a further reduction: the Account surface no longer collapses a failed standings read into pre-results copy, and a failed reminder-preference save now says so instead of silently reverting.

## Correction record — 6 August 2026, security and governance audit

A read-only security, outage and governance audit reported twelve findings. Each was reverified against the repository before being recorded here; the results are not uniform, and the differences matter more than the count.

**The audit's most urgent finding does not reproduce.** It reported the `Protect Main` ruleset targeting nothing — `include: []` — and GitHub's effective-rules endpoint returning an empty array for `main`, rated 8/10 and "urgent". Checked on 6 August 2026, ruleset `20508177` is `active` with `conditions.ref_name.include = ["~DEFAULT_BRANCH"]`, and `/rules/branches/main` returns **both** rules: `deletion` and `non_fast_forward`. That is exactly the state the audit's own fix instructions prescribe, so it was most likely applied between the audit and this verification. **No entry is opened for it.** It is recorded here so it is not re-raised from the audit text, and so the evidence of the check survives.

**Five findings were already tracked and are reconfirmed rather than new.** Unindexed foreign keys (`DB-003`), invite-code probing (`SEC-001`, `ACQ-R10`), leaked-password protection (`AUTH-002`), the count-then-insert rate limiter (`DATA-007`) and incomplete dependency scanning (`ACQ-R19`). Their entries gain the reconfirmation and any new specifics; none is duplicated under a new identifier.

**Five are new and are opened below:** `DB-004`, `DB-005`, `OPS-011`, `UX-004` and `SEC-002`.

**One could not be verified from the repository and is recorded as reported, not as confirmed.** The audit states production is several hundred commits behind `main`, naming the production source commit. That commit is not in this clone's history, so the count could not be reproduced here; the *direction* is not in doubt and is already the subject of `OPS-006`. The figure was also stale on arrival, because the `main` it was measured against is several merges old. Neither the count nor either commit is restated here — both move, and the live positions belong to [`current-status.md`](current-status.md) and the machine records.

What was verified in the repository, with the evidence:

| Finding | Verdict | Evidence |
| --- | --- | --- |
| Ruleset targets nothing | **Does not reproduce** | `include: ["~DEFAULT_BRANCH"]`; effective rules on `main` = `deletion`, `non_fast_forward` |
| Invite codes probeable | **Confirmed** | `20260719180000_add_leagues.sql` — six characters from `random()` over a 31-character alphabet |
| Rate limiter raceable | **Confirmed** | `20260720210000_rate_limits.sql` — `select count(*)` then insert, no advisory lock or atomic upsert |
| `rate_limit_events` over-granted | **Confirmed** | no `revoke` on that table exists in any migration |
| CSP allows inline styles | **Confirmed** | `netlify.toml` — `style-src 'self' 'unsafe-inline'` |
| Fatal fallback offers only reload | **Confirmed** | `src/app/ApplicationErrorBoundary.tsx` — `window.location.reload()` is the only recovery |
| Dependabot / CodeQL absent | **Confirmed (repository half)** | neither `.github/dependabot.yml` nor a CodeQL workflow exists |
| Unindexed foreign keys | **Confirmed as already tracked** | `DB-003`; the audit adds named production examples |
| Leaked-password protection | **Not repository-verifiable** | hosted Supabase Auth setting; `AUTH-002` already open |
| Netlify development contract stale | **Not repository-verifiable** | a Netlify environment variable, not in `netlify.toml` |
| `pg_net` residual privileges | **Confirmed as already recorded** | the contract-115 migration reports it cannot revoke platform-owned grants |
| Production commits behind | **Reported, not reproduced** | production source commit absent from this clone |

No finding was fixed in this pass. The audit's recommended fixes are recorded against each entry as required closure, not applied.

## Correction record — 6 August 2026, acting on the audit

The record above says "no finding was fixed in this pass", which was true when written: that pass logged only. This one acted, on the subset that needs no migration. The earlier record is left as it stands rather than edited, because it was accurate for the pass it describes.

- **`UX-004` reduced.** The fatal fallback now escalates from reload to a local sign-out once a fault has proved deterministic. Reload remains the first remedy. Open remainder: the correlation reference is displayed but not carried to Sentry or backed by a support route.
- **`ACQ-R19` partly closed.** Dependabot update requests and CodeQL analysis are in the repository. Open remainders: Dependabot *alerts* are a repository setting, and third-party actions are still on moving tags — SHA pinning could not be performed from the working environment, and inventing a hash would break CI rather than secure it.
- **`OPS-011` resolved for the current value.** The three non-production Netlify contexts were raised from a stale figure to the verified hosted value, confirmed by reading them back. Production was not touched. Open remainder: the value is still maintained by hand, so it drifts again after the next rollout.

**Deliberately not acted on, with the reason in each entry:** `DB-003`, `DB-005`, `DATA-007` and `SEC-001` all require a migration. `AUTH-002` is a hosted Supabase Auth setting. `SEC-002` is a gradual campaign across dozens of call sites rather than a change, and the audit says so itself.

Nothing here touched production, a migration, a scoring, lock, settlement or provider-truth rule.

## Correction record — 6 August 2026, second entry

Recorded hours after the first, and the gap between them is the point: `OPS-009` was written when hosted development was five contracts behind, and was already wrong when the ink dried. Fast-lane run 31083613351 applied contracts 116 to 120 that morning, so the database gap the entry described had closed before the entry was read by anyone.

What the episode actually exposed is narrower and more durable than the gap it replaced. The follow-up workflow produced a *correct* contract-120 record, pushed it to the automation branch the workflow names after its run, and then failed on pull-request creation because the repository forbids GitHub Actions from opening pull requests. Nothing was wrong except that nobody was told where the right answer was, and `main` went on stating the old number to every agent that read it.

- `OPS-009` is resolved as recorded, not deleted — it was true when written.
- `OPS-010` replaces it with the real exposure: a verified hosted record that cannot reach `main` on its own.
- The machine-readable record now states contract 120, with its evidence naming the run identity and conclusion verified through the Actions API, and stating plainly which object-level assertions it does *not* re-derive.
- The workflow can no longer fail silently in this way. A refused pull request no longer fails the run; it announces the branch through a job summary and an issue, so a stranded record is recoverable in a minute rather than discovered in an audit.
- The owner enabled the repository setting that permits GitHub Actions to create pull requests, on 6 August 2026, which removes the cause rather than only the symptom. **Neither the setting nor the fallback is proven yet** — the next fast-lane rollout is the first run to exercise either, and the entry stays open until one of them is observed working.

The general lesson is recorded because it will recur: **an automation that produces correct evidence and cannot deliver it is indistinguishable, to every downstream reader, from one that produced nothing.**

## Correction record — 30 July 2026

`DOC-001` was reopened when direct review found stale contract, PR-state and roadmap claims across live planning documents. The current-status, roadmap and this register now record the contract-64/63 split, the complete seven-contract Stage C inventory and the owner-approved C1/C2 governance boundary. Closure is conditional on the governance PR landing with green documentation and CI evidence.

## Current contract movement

| ID | Current position |
| --- | --- |
| `OPS-006` | **Controlled, not resolved by alignment.** Repository and development remain ahead of production (exact positions live in `config/deployment-contract.json`, `config/development-hosted-contract.json` and [`current-status.md`](current-status.md)). The production contract gate correctly pauses new deploys and keeps the last good application live. Reopen as Critical only if the guard is bypassed or the split becomes unrecorded. **Widened 6 August 2026 — the gap is not only schema.** The security audit reported production's live deployment built from a commit some hundreds behind `main`; the count could not be reproduced from this clone and is deliberately not restated, because it is stale the moment it is written. The contract gate is doing its job — deploying current `main` against the older hosted schema would fail compatibility immediately, so the lag is *correct* as a schema decision. What it also means is that production misses hundreds of later fixes, guards and resilience improvements, and that is not something the gate is protecting anyone from. Production should have a **defined supported version**, not an indefinite freeze. Required closure: identify security and crash fixes landed after the production source commit, backport those compatible with the hosted production schema, plan the database and application promotion as one verified release, rehearse against a production-like restore, and run authenticated smoke immediately after. |
| `OPS-009` | **Resolved as recorded; reopened in a different form as `OPS-010`.** Recorded earlier on 6 August as hosted development trailing the repository. The fast lane closed that gap the same day — run 31083613351 applied contracts 116 to 120 and hosted development is level with the repository. The database was never the durable problem; getting the *record* of it onto `main` was. |
| `OPS-010` | **Open, reduced.** A correct hosted-contract record can be produced and still not reach `main`: the follow-up workflow pushed the contract-120 record to an automation branch and then failed, because the repository forbids GitHub Actions from creating pull requests. `main` reported the previous contract for roughly ninety minutes while the correct record already existed. The stranding is now announced rather than silent (job summary plus an issue, and a refused pull request no longer fails the run), and the record itself has been landed by hand. What remains open is the repository setting, which no workflow can grant itself. |
| `POSTLOCK-001` | **Resolved and production-hosted.** Bounded post-lock consensus and the richer locked My Entry/Trends experience are published. |
| `LEAGUE-001` | **Resolved and production-hosted.** Final overall/private standings apply the approved five tie-breakers only after every result. |
| `PRIV-001` | **Resolved and production-hosted.** Tournament-wide consensus is suppressed below ten submitted entries. |
| `REL-008` | **Reduced to historical evidence.** Exact contract-63 preview publication, HTTP smoke and Chromium smoke passed. |
| `MIG-001` | **Resolved.** Pull-request CI rejects stale/colliding added migrations and enforces strict ordering. |
| `CI-001` | **Resolved.** Database parity watches `src/domain/**` and runs the complete parity directory. |
| `DATA-003` | **Resolved and hosted.** Same-tournament/reference guards are present in both hosted environments. |
| `DOC-001` | **Open — drift recurred.** The 30 July reconciliation landed with the accepted Stage C governance amendment, but the 6 August audit found fresh drift, including this register's own staleness. Structural fixes (a single small current-state surface with generated values) remain open. |
| `FUNC-003` | **Resolved in production.** Canonical Bonus Game cards and the repeatable catalogue prevent silent disappearance. |
| `TEST-GAP-01` | **Resolved by PR #187.** All three Bonus Games have authenticated desktop/phone browser lifecycle proof. |
| `TEST-GAP-02` | **Resolved by PR #189.** H2H rank-history capture has direct behavioural pgTAP. |
| `RESULT-AUDIT-01` | **Resolved by PR #191.** Confirm/correct/clear revision content is asserted exactly. |
| `TEST-001` | **Reduced.** Manual accessibility and later full-volume/rollback rehearsals remain. |

## Critical

| ID | Finding | Current status | Required closure |
| --- | --- | --- | --- |
| `OPS-006` | Uncontrolled production contract divergence | **Controlled by fail-closed deployment gate** | Keep production at 63 and paused until an intentional migration/release milestone; never bypass the guard merely to align numbers. |
| `DATA-001` | Predicted group positions can be forged or drift | **Resolved** | Reopen on regression. |
| `SECURITY-001` | Browser roles can write server-owned position inputs | **Resolved** | Reopen on regression. |
| `SECURITY-002` | Submission boundary can be bypassed | **Resolved** | Reopen on regression. |
| `DATA-002` | Knockout winner/method lacks database authority | **Resolved** | Reopen on regression. |
| `OPS-001` | Environment rollback crosses database boundaries | **Resolved** | Preserve environment isolation and contract guards. |

## High

| ID | Finding | Current status | Evidence / required closure |
| --- | --- | --- | --- |
| `PRIV-002` | Former-player retention, erasure and pseudonymisation boundary is not independently approved | **Open; Stage C2 blocked by issue #272.** The *product* direction was approved on 6 August 2026 — ordinary closure and formal erasure as two separate journeys, with no permanent cross-competition former-player identifier — and is recorded in [`../architecture/stage-c1-c2-governance.md`](../architecture/stage-c1-c2-governance.md) as `PRIV-003`–`PRIV-007`. **That is a product decision and changes nothing about this finding:** no independent approval exists, and none is claimed. | No profile ownership, account-erasure, pseudonymisation or related RLS implementation until the recorded independent review approves the boundary and required safeguards. Stage C1 must preserve current auth ownership. |
| `DATA-003` | Same-tournament/reference constraints incomplete | **Resolved and hosted** | Private guards, privileges and valid/invalid hosted verification passed. |
| `DATA-006` | Wider fixture/source relationships insufficiently constrained | **No proven residual defect** | Reopen only with an exact uncovered relationship. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Resolved and production-hosted** | Preserve scheduled submission and immutable outcomes. |
| `DATA-004` | Actual tie resolution can use non-authoritative fallback | **Reduced** | Official regulations/data verification remains a launch item. |
| `DATA-005` | Score/entry clearing lacks race-safe authority | **Resolved and production-hosted** | Contract 58 prevents stale autosave resurrection. |
| `OPS-002` | Administrator control room incomplete | **Resolved** | Result and qualification controls are browser-proven. |
| `POSTLOCK-001` | Locked entries lacked a crowd/trends experience | **Resolved and production-hosted** | Contracts 61 and 63 provide bounded aggregates with cohort suppression. |
| `LEAGUE-001` | Final standings did not apply the documented tie-break order | **Resolved and production-hosted** | Contract 62 activates the five-step order after all results. |
| `CI-001` | Database parity excluded new domain siblings | **Resolved** | Preserve the root `src/domain/**` trigger and complete parity directory. |
| `TEST-001` | Critical rules lack complete end-to-end evidence | **Reduced** | Remaining: manual assistive-technology review, full-volume dress rehearsal and rollback rehearsal. |
| `OPS-003` | Production observability operations incomplete | **Partial** | Name monitoring/backup/Cron owners, retention/escalation and incident procedure. |
| `OPS-009` | Hosted development trails the repository contract | **Resolved 6 August 2026** | Fast-lane run 31083613351 applied contracts 116–120; hosted development is level with the repository. Reopen only on a fresh divergence. |
| `OPS-011` | Netlify's non-production database-contract variable is stale, weakening preview evidence | **Resolved 6 August 2026 for the current value; the recurrence is not prevented.** `EURO28_DEPLOYED_DB_CONTRACT` read `97` in the `dev`, `branch-deploy` and `deploy-preview` contexts of the `euro28predictor` project while hosted development had moved well beyond it. All three were raised to the value the machine-readable hosted record verifies, and the change was confirmed by reading the variable back. **Production's value was deliberately not touched** — it still holds the figure the promotion gate expects, on the same value id and timestamp as before — and neither was the empty `dev-server` context, the legacy `euro28-predictor-dev` project, nor any other variable. No deploy was triggered. **What remains open is the reason it drifted:** the value is maintained by hand, so it goes stale again after the next rollout. Closure is the follow-up workflow updating it, or failing with an actionable mismatch — the same class of defect as `OPS-010`, where correct evidence existed and nothing carried it to where it was read. Original finding: Netlify sets `EURO28_DEPLOYED_DB_CONTRACT=97` for development, branch deploys and deploy previews while hosted development is verified at a far higher contract. This is a Netlify environment variable rather than a repository value, so it is **not repository-verifiable** and the audit reading is the evidence. It does not fail the build — the validator's non-production carve-out deliberately lets a trailing database report a gap instead — which is exactly why it is easy to miss: previews report a contract gap that does not exist, weakening release evidence and potentially suppressing useful database smoke coverage. Production must remain 63 until an authorised promotion. | Update the non-production contexts to the verified development contract after every successful rollout, and make the hosted-contract follow-up workflow either update this value or fail with an actionable mismatch — a number a human has to remember to change is the same failure class as `OPS-010`. |
| `OPS-010` | A verified hosted record can fail to reach `main` | **Open pending proof; both causes addressed** | The follow-up workflow can no longer strand a record silently, and the owner enabled the repository setting permitting GitHub Actions to create pull requests on 6 August 2026. Neither half is proven yet: the next fast-lane rollout is the first run that will exercise both. Close it on that run opening its pull request unaided; if it is refused again, the fallback should say so in a job summary and an issue rather than in silence. |

## Medium

| ID | Finding | Current status |
| --- | --- | --- |
| `AUTH-001` | Turnstile/CAPTCHA contexts not fully verified | **Partial.** Netlify non-production contexts use the Cloudflare always-pass test site key and production retains its real key. Matching development Supabase secret/toggle and preview sign-up/login/recovery evidence remain open in issue #28. |
| `AUTH-002` | Leaked-password protection disabled | **Open decision. Reconfirmed 6 August 2026** by the live Supabase security advisors in **both** environments — this is a hosted Auth setting and is not repository-verifiable, so the advisor reading is the evidence. Users may therefore choose passwords known from previous breaches, which is what makes credential stuffing worth attempting. Turnstile tokens are correctly threaded to Auth for login, signup and recovery. Required closure: enable leaked-password protection in both projects, set a sensible minimum length, retain Turnstile, consider MFA for administrators, and decide a deliberate policy for **existing** passwords — changing the setting does not force a reset. |
| `OPS-008` | Legacy public development site remains | **Reduced.** Anonymous public access was removed and Netlify team SSO is required. The hourly legacy function and missing/inaccessible Supabase ref remain open in issue #27. |
| `REL-007` | Stale device can delete a newer bracket pick | **Implementation present; final controlled browser evidence pending** |
| `REL-008` | Netlify deploy-preview policy was inconsistent across documentation branches | **Reduced; final contract-63 preview passed.** |
| `MIG-001` | Concurrent branches can add stale/colliding migration timestamps | **Resolved by the committed guard and focused tests.** |
| `PRIV-001` | Tournament-wide prediction consensus had no minimum cohort | **Resolved and production-hosted.** |
| `DB-001` | `public.enforce_joker_rules` has mutable search path | **Resolved in the repository chain and within the migrations the development contract records as applied** — the Stage C1 foundation migration redefines the function with `set search_path = ''` and the C1b redefinition preserves the pin. Production still runs the older definition until promotion. |
| `DB-002` | Authenticated `SECURITY DEFINER` allowlist needs continued review | **Open assurance finding; intended RPCs remain explicitly granted** |
| `DB-003` | Several foreign keys lack supporting indexes | **Open pending representative query evidence. Reconfirmed 6 August 2026** by the live Supabase performance advisors in both environments, which now name production examples: `matches.home_team_id`, `matches.away_team_id`, result-revision actor references, Cup participant/winner references, LMS team references and prediction/score-event team references. Development adds further unindexed relationships in the newer season tables. Not visible at the current data volume, which is why measured evidence is still the gate: capture slow-query and `EXPLAIN (ANALYZE, BUFFERS)` plans, prioritise keys used in joins, deletion checks and settlement jobs, then add indexes additively. Do not index every advisory row. |
| `DB-004` | `pg_net` privileges remain with browser roles, so a future exposed wrapper would become SSRF | **Open, latent and contained.** `anon` and `authenticated` retain usage on the `net` schema and execute on `net.http_get`, `http_post`, `http_delete` and the response functions, because the platform owns the extension and `postgres` cannot revoke them — the contract-115 migration reports this by notice rather than hiding it. **No presently reachable exploit was found:** `net` is not an exposed Data API schema, no browser-callable function in `public` or `graphql_public` invokes `net.*`, provider URLs are fixed HTTPS origins with redirects blocked and responses bounded. The danger is one future migration adding an innocent-looking exposed wrapper. | Add a hosted assertion, run against both environments, that `net` is never an exposed API schema; keep the existing guard rejecting exposed functions that call `net.*`; escalate to Supabase support to narrow the platform grants; consider moving scheduled outbound work entirely to an Edge Function scheduler. Add archive retention and a storage quota before enabling polling — development currently has no enabled poll target, so that storage risk is contained. |
| `DB-005` | `rate_limit_events` grants every ordinary privilege to browser roles, against its own stated design | **Open, latent.** The migration says "no client access at all" and then never revokes: `anon` and `authenticated` hold `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` and `TRIGGER` in both environments. RLS is enabled with no policy, so browser access currently sees no rows and cannot mutate them — the table is protected by one control where the design intended two. Accidentally disabling RLS, or adding one broad policy, would expose a table that already grants every operation. | An additive migration doing `revoke all on table public.rate_limit_events from anon, authenticated`, plus pgTAP asserting **both** the default-deny behaviour and the exact ACL. Do not rely on RLS alone where the intent is no client access. |
| `PERF-001` | League summaries may scale serially | **Open** |
| `PERF-002` | Scoring recomputes whole tournament | **Open pending complete-volume measurement** |
| `TYPE-001` | Hand-written types/casts can hide schema drift | **Open** |
| `A11Y-001` | Assistive-technology review incomplete | **Partial; automated coverage exists, manual review remains** |
| `UX-001` | Trustworthy invite context before auth incomplete | **Partial** |
| `UX-002` | Unavailable and empty data can be conflated | **Reduced; secondary surfaces remain.** `PredictionTrendsPage`'s player-name read now tracks its own failure separately from a genuinely player-less pick and warns rather than silently falling back (2026-08-05). `AccountPage` now distinguishes a failed standings read from the pre-results state and reports a failed reminder-preference save instead of silently reverting the toggle (2026-08-06). |
| `FUNC-003` | Bonus Games rendered as absent when reference data was empty | **Resolved in production** |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | **Open; aggregate minimum cohort is implemented, broader invite/abuse review remains. Reconfirmed 6 August 2026** against `20260719180000_add_leagues.sql`: codes are six characters drawn by `random()` — not a cryptographic generator — from a 31-character unambiguous alphabet. The pre-join preview accepts any authenticated caller's guess and returns league id, name, owner display name, member count and whether the caller is already a member, which is enough to confirm a hit and identify a private group. Because the join limit is a trigger on `league_members`, an invalid code consumes no rate limit, so probing is unbounded. Full characterisation stays in `ACQ-R10` and [`investigations/2026-07-30-acq-r10-invite-enumeration.md`](investigations/2026-07-30-acq-r10-invite-enumeration.md); required closure adds: at least 10 characters from cryptographically secure bytes, an atomic limiter covering previews and failed joins, minimal preview disclosure, and code rotation/revocation. |
| `SEC-002` | Content-Security-Policy still permits inline styles | **Open, low.** `netlify.toml` sets `style-src 'self' 'unsafe-inline'`. The rest of the policy is strong — `default-src 'self'`, restricted scripts and connections, framing blocked, HSTS, nosniff, camera/microphone/geolocation disabled — and a repository search found no `dangerouslySetInnerHTML`, `eval`, `new Function`, `document.write` or direct `innerHTML`. So this is not an exploit today; it removes one layer of defence if an injection bug appears later. | Move remaining inline styles to classes or nonce/hash-approved styles, then drop `'unsafe-inline'`. Worth doing gradually rather than as one change, since a CSP tightening that breaks rendering is discovered in production. |
| `DATA-007` | Rate limiting is count-then-insert | **Open. Reconfirmed 6 August 2026** in `20260720210000_rate_limits.sql`: it selects a count, compares it, then inserts, with no advisory lock or atomic counter, so concurrent transactions can each observe a count below the threshold and all proceed. Coverage is also narrower than it reads — the limits are on prediction saves (60/min) and league-membership inserts (5/min), both enforced by triggers on the *written* table, so an **invalid** league code fails before any insert and consumes no limit at all. Repeated leaderboard, profile, search and other expensive read RPCs are outside it entirely. Required closure: make enforcement atomic (locked bucket, advisory lock or atomic upsert); rate-limit invalid operations and not only successful writes; bound the expensive reads; add edge/IP controls alongside the per-user database limit; alert on repeated rate-limit and timeout exceptions. The existing API-role statement timeouts stay — production limits anonymous statements to 3 seconds and authenticated to 8. |
| `DATA-009` | Contract 104 gated the tournament-path Bonus Games recompute functions (`recompute_ko_predictor_for_match`, `recompute_lms_for_tournament`) on `completed_at is null`, so a post-completion correction silently no-opped instead of rederiving — the opposite of what the season LMS settlement job deliberately does for the identical problem | **Resolved at contract 106.** Both functions now resolve through `predictor_internal.current_public_competition_id`, which falls back to the most recently completed public instance, so a corrected result rederives after a competition ends. Proven behaviourally rather than structurally by `supabase/tests/157_terminal_aware_bonus_rederive.sql`: a completed KO Predictor competition has its result corrected and both entrants' stored scores must move to zero. Verified on development — neither function retains a `live_competition_id` call. The risk was recorded as latent and unreachable when found; contract 107 would have made it reachable, which is why it was closed first. See `docs/quality/investigations/2026-08-05-tournament-bonus-recompute-completion-gate.md` for the original trace. |
| `DOC-001` | Documentation authority can drift | **Open, reduced 6 August 2026.** Two of the named structural fixes landed: accepted-but-unbuilt requirements now have one home with stable identifiers ([`accepted-requirements.md`](accepted-requirements.md), enforced by `tests/scripts/acceptedRequirements.test.ts`), and the `DOC-AI-001`–`010` safeguards are written down in [`../ops/documentation-authorities.md`](../ops/documentation-authorities.md) beside the freshness/sweep machinery. **What remains open is the harder half:** a single small current-state surface with *generated* rather than hand-edited values. Most of these safeguards are still convention, and a convention is what drifted in the first place. |

## Low

| ID | Finding | Status |
| --- | --- | --- |
| `HYGIENE-002` | Some pure modules may be test/reference-only | **Open; verify before deletion** |
| `CODE-001` | Large orchestration files are hotspots | **Open** |
| `SEO-001` | SPA fallback produces soft 404s | **Resolved in repository configuration; production publication pending.** `netlify.toml`'s catch-all answers 404 (the rule's comment names this finding) and `tests/app/spaRoutingStatus.test.ts` guards it. Production deploys remain paused, so the hosted production application predates the fix; hosted closure follows the next approved production publication. |
| `SEO-002` | Metadata largely global | **Open** |
| `UX-003` | Other-player profile action incomplete | **Resolved; secure co-member profile and H2H navigation are production-hosted** |
| `UX-004` | A deterministic fatal error traps the user in a reload loop | **Reduced 6 August 2026 — the recovery path exists; the support route does not.** `src/app/fatalRecovery.ts` holds the decision as pure logic and `ApplicationErrorBoundary` consumes it. Reload remains the **first** remedy, unchanged, because most faults are transient; the second consecutive failure is treated as evidence the fault is deterministic and offers a local sign-out instead. It clears only the Supabase auth-session keys — the sole browser-persisted state this application has, verified rather than assumed — makes no network call, and returns to the origin root rather than the failing route. A correlation reference is shown for support. **What remains open:** the reference is not yet delivered anywhere a supporter can look it up, and there is no contact route from the screen, so a user can quote a reference nobody can resolve. Closure needs the reference attached to the Sentry event and a support destination that does not depend on the application working. Original finding: | Confirmed in `src/app/ApplicationErrorBoundary.tsx`: the fatal fallback's only recovery is `window.location.reload()`. The surrounding controls are good — a global React error boundary, global error and rejected-promise reporting, production Sentry and a configuration-failure screen — but reload is the wrong remedy for a *deterministic* failure. Corrupt local state, incompatible cached data, a malformed server response or a broken route fails again on every reload, so one user can be locked out indefinitely by a fault nobody else sees. | A secondary recovery path that signs out locally, clears only safe application cache and state, redirects to a minimal recovery page, preserves a correlation id for support, deletes no server data, and offers a support route after repeated crashes. |
| `DATA-008` | Scores have no practical database maximum | **Open** |
| `DOC-002` | Package version remains `0.0.0` | **Open** |
| `DOC-003` | Component gallery large/partly historical | **Open; development-only** |
| `REPO-001` | Licence/changelog policy absent | **Partial** |

## Register rules

- Repository implementation, database promotion and application publication are separate closure states.
- Do not call the whole product launch-ready because the baseline is tag-ready.
- Do not retain broad findings after the concrete defect is resolved.
- Current contract truth lives in `config/deployment-contract.json`, `config/development-hosted-contract.json` and [`current-status.md`](current-status.md) — never restated here, because a restated number drifts. The recorded, fail-closed split between environments is a controlled state.
- A guard blocking incompatible deployment is a safeguard, not a defect to bypass.
- Historical audits and reconciliations remain immutable; corrections are recorded alongside them rather than rewriting history.
