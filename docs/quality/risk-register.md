# Euro 2028 Predictor — Current Risk Register

**Current audit:** `2026-07-23L`  
**Evidence:** [`audits/2026-07-23-live-environment-audit.md`](audits/2026-07-23-live-environment-audit.md)  
**Current production release:** [`reconciliations/2026-07-24-post-merge-production-release-state.md`](reconciliations/2026-07-24-post-merge-production-release-state.md)  
**Production recovery readiness:** [`reconciliations/2026-07-24-production-recovery-readiness.md`](reconciliations/2026-07-24-production-recovery-readiness.md)  
**Netlify environment isolation:** [`reconciliations/2026-07-24-netlify-environment-isolation.md`](reconciliations/2026-07-24-netlify-environment-isolation.md)  
**Application/schema deployment gate:** [`reconciliations/2026-07-24-app-schema-deployment-gate.md`](reconciliations/2026-07-24-app-schema-deployment-gate.md)  
**Legacy development/Turnstile evidence:** [`reconciliations/2026-07-24-legacy-development-site-and-turnstile.md`](reconciliations/2026-07-24-legacy-development-site-and-turnstile.md)  
**Owner default decisions:** [`reconciliations/2026-07-24-owner-default-decisions.md`](reconciliations/2026-07-24-owner-default-decisions.md)  
**Node runtime pinning:** [`reconciliations/2026-07-24-node-runtime-pinning.md`](reconciliations/2026-07-24-node-runtime-pinning.md)  
**Environment-file hygiene:** [`reconciliations/2026-07-24-environment-file-hygiene.md`](reconciliations/2026-07-24-environment-file-hygiene.md)  
**Editor baseline:** [`reconciliations/2026-07-24-editor-baseline.md`](reconciliations/2026-07-24-editor-baseline.md)  
**Bottom-navigation links:** [`reconciliations/2026-07-24-bottom-navigation-links.md`](reconciliations/2026-07-24-bottom-navigation-links.md)  
**Route-transition accessibility:** [`reconciliations/2026-07-24-route-transition-accessibility.md`](reconciliations/2026-07-24-route-transition-accessibility.md)  
**League options disclosure:** [`reconciliations/2026-07-24-league-options-disclosure.md`](reconciliations/2026-07-24-league-options-disclosure.md)  
**Latest security reconciliation:** [`reconciliations/2026-07-24-function-privilege-hardening.md`](reconciliations/2026-07-24-function-privilege-hardening.md)  
**Latest reliability reconciliation:** [`reconciliations/2026-07-24-submit-save-barrier.md`](reconciliations/2026-07-24-submit-save-barrier.md)  
**Latest data reconciliation:** [`reconciliations/2026-07-24-score-clearing.md`](reconciliations/2026-07-24-score-clearing.md)

This register retains every original finding ID and adds findings discovered by live hosted verification. Older audit reports remain immutable evidence. “Repository/development implemented” does **not** mean production-compatible, and “backup tooling prepared” or an approved recovery method does **not** mean recovery is proven.

## Summary

| Severity | Total current findings | Closed/superseded | Open or partially resolved |
| --- | ---: | ---: | ---: |
| Critical | 6 | 1 | 5 |
| High | 16 | 2 | 14 |
| Medium | 16 | 2 | 14 |
| Low | 14 | 3 | 11 |
| **Total** | **52** | **8** | **44** |

`OPS-001`, `OPS-004`, `OPS-007`, `A11Y-002`, `A11Y-003` and `REPO-002` are resolved. `OPS-005` is superseded by `OPS-002`. `DOC-001` is resolved by the active documentation authority/reconciliation process. `REPO-001` is partially resolved: the editor baseline is implemented and tested, while licence and changelog policy remain open. Several findings are implemented in repository/development but remain open because production has not received or browser-verified them.

## Critical

| ID | Finding | Current status | Current evidence / required closure |
| --- | --- | --- | --- |
| `OPS-006` | Production application and Supabase schema are incompatible | **Open — live mismatch contained by deployment gate** | Application-code baseline `a403b079` calls both `replace_predicted_progression` and `delete_match_prediction`; production lacks both. Contract 35 is enforced in prebuild while production declares hosted contract 20, so new incompatible production releases cannot replace the current ready deploy. Close only after migrations 21–35, post-verification and browser smoke evidence. |
| `DATA-001` | Predicted group positions are not safely derived/persisted | **Open production; implemented repository/development** | Migration 26 derives/protects positions and passes development verification. Production retains the old writable table/policies. |
| `SECURITY-001` | Group-position scoring inputs can be forged/changed | **Open production; implemented repository/development** | Development denies direct group-position writes. Production authenticated role retains old insert/update privileges and broad owner policy. |
| `SECURITY-002` | Submission timestamp can be bypassed directly | **Open production; implemented repository/development** | Development uses the RPC boundary and denies direct entry update/delete. Production retains old authenticated entry-update privilege. |
| `DATA-002` | Knockout results lack an authoritative winner/method | **Open production; implemented repository/development** | Development verifies result state/method/checkpoints/winner/revisions. Production lacks those controls. |
| `OPS-001` | Rollback instruction crossed production/development boundaries | **Resolved** | Current runbook prohibits production-to-development swaps; production Netlify references production Supabase. Reopen on any regression. |

## High

| ID | Finding | Current status | Current evidence / required closure |
| --- | --- | --- | --- |
| `OPS-007` | Production deploy previews/branch deploys inherit production Supabase values | **Resolved** | Netlify `deploy-preview`, `branch-deploy` and `dev` contexts now use development Supabase while `production` remains production. PR #24’s ready preview passed the repository prebuild context guard. Reopen if the context matrix or guard regresses. |
| `SECURITY-003` | Hosted `SECURITY DEFINER` grants and mutable search paths are over-broad | **Open production; implemented repository/development** | Migrations 34–35 establish exact function allowlists, closed defaults and fixed helper paths on development. Production retains old broad grants until migrations 21–35 roll out. |
| `DATA-003` | Same-tournament/reference constraints are incomplete | **Open — partially implemented** | Major guards exist; wider immutable/composite constraints remain and production controls are absent. |
| `FUNC-001` | Bracket progression can be internally inconsistent | **Open production; implemented repository/development** | Full predicted-tree replay/validation passes on development. Production validator/propagation is absent. |
| `FUNC-002` | Valid entries are not automatically submitted at lock | **Open** | Rule exists in `docs/scoring-rules.md`; no scheduler/server implementation. |
| `REL-001` | Score recomputation/result writes can race | **Open production; materially addressed repository/development** | Development serializes recomputation. Production old recompute path remains. |
| `DATA-004` | Actual tie resolution can depend on non-authoritative fallback behavior | **Open** | No fresh evidence of complete resolution. |
| `DATA-005` | Clearing an incomplete score does not delete the stored prediction | **Partially resolved — client deployed, production backend absent** | Repository/development implementation and tests pass. Production lacks `delete_match_prediction`, so clearing a persisted row reaches a save error and reload can restore the old score. Close only after migrations 21–35 plus authenticated clear/reload/conflict/lock browser journeys. |
| `REL-002` | Independent late reads can overwrite newer state | **Open** | Prediction/tie/bracket/bonus loading remains independently best-effort. |
| `REL-003` | Manual submit does not flush pending debounced writes | **Partially resolved — repository implemented and tested** | Provider/controller settlement tests pass. Close after compatible production rollout plus authenticated immediate-final-edit and failure/conflict browser verification. |
| `REL-004` | Compound bracket writes are non-atomic | **Open production; client deployed/backend absent** | Atomic snapshot RPC and stale-version rollback pass on development. Production lacks `replace_predicted_progression`, so bracket persistence fails. |
| `DATA-006` | Fixture/source relationships are mutable or insufficiently constrained | **Open** | Wider reference immutability remains a launch blocker. |
| `OPS-002` | No version-controlled administrator model/control room boundary | **Open** | No `profiles.role` column exists in repository/hosted schema; no browser result admin page. |
| `TEST-001` | Critical database/browser rules lack executable integration assurance | **Partially resolved** | Disposable database CI, pgTAP and provider-level submission/score-clear tests exist; authenticated production-like browser E2E remains absent. |
| `OPS-003` | Release, monitoring and recovery controls are incomplete | **Partially resolved — recovery method approved, evidence absent; issue #32** | The owner approved personal-computer execution, 7-Zip AES-256 encryption, OneDrive custody and owner review. The current work laptop is explicitly not approved. Fail-closed backup tooling/checksums/runbook exist, but no fresh production dump, encrypted off-site artifact, retrieval proof or disposable restore has been performed. Production rollout remains blocked until issue #32 is completed and accepted. |
| `OPS-005` | Production may contain an untracked admin role column | **Superseded by `OPS-002`** | Read-only production inspection confirmed the column does not exist. |

## Medium

| ID | Finding | Current status | Closure evidence required |
| --- | --- | --- | --- |
| `OPS-008` | A public legacy “development” site is sourced from the World Cup repository and a dormant staging backend | **Open — retire/protect approved; dashboard execution pending; issue #27** | The owner approved removal of public access and separate retirement of the hourly legacy activity. Automated team-login protection returned HTTP 422 and the password fallback was blocked before execution, so the site remains unchanged and public. Close after the separate Netlify dashboard action and verified public-access/function/cron/backend state. Do not repoint it to either current Euro project. |
| `AUTH-001` | Production Turnstile site key is inherited by non-production contexts while development CAPTCHA configuration is unverified | **Open — always-pass test model approved; dashboard execution pending; issue #28** | The owner approved Cloudflare's matching always-pass test pair for previews/branches/dev and development Supabase, while production retains its real pair. Connected tools cannot update the development Supabase CAPTCHA secret/toggle. Close after both dashboard sides are configured together and preview login/signup/recovery plus production regression evidence pass. |
| `REL-005` | Open pages can remain convincingly stale | Open | Add and test realtime, polling or focus-refetch strategy. |
| `REL-006` | Concurrent first-use requests can hit entry unique conflicts | Open | Replace/select-insert race with idempotent server boundary and test two-tab creation. |
| `REL-007` | Stale device can delete a newer bracket pick | **Open production; implemented repository/development** | Complete-snapshot versions contain this on development; verify production rollout and multi-device browser behavior. |
| `PERF-001` | League summary requests scale linearly/serially | Open | Remove serial per-league request pattern and profile representative load. |
| `UX-001` | Invite context is hidden behind generic signup | Open | Show trustworthy invite preview before auth and remove render-time storage mutation. |
| `A11Y-001` | SPA navigation lacks complete assistive-technology transitions | **Partially resolved — repository/preview implemented** | Skip link, stable main target, route titles, focus movement and polite live-region announcements are implemented and unit-tested. Two ready previews retained accessibility 100; repeat performance returned the 98 baseline. Close after real keyboard and screen-reader route journeys plus authenticated browser E2E retention. |
| `A11Y-002` | League options menu semantics do not match behavior | **Resolved** | Replaced the incomplete ARIA menu pattern with a disclosure using `aria-expanded`/`aria-controls` and native action buttons. Escape restores trigger focus; outside close and owner/member actions are tested. Preview retained accessibility 100. Reopen if misleading menu roles or incomplete focus behavior return. |
| `TYPE-001` | Hand-written casts and non-strict TypeScript can hide schema drift | Open | Generate DB types, enable strictness incrementally and validate critical RPC payloads. |
| `DOC-001` | Documentation is not consistently authoritative | **Resolved by active reconciliation process** | Current-status/reconciliation sources are updated after hosted changes; reopen if contradictions persist without correction. |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | Open | Threat-model enumeration and rate limits at intended competition size. |
| `SEC-002` | Raw internal errors can reach users | Open | Map database/network failures to stable safe messages. |
| `DATA-007` | Rate limiting is count-then-insert | Open | Serialize per user/action or use atomic database primitive. |
| `UX-002` | Unavailable data is conflated with empty data | Open | Preserve loading/error/unavailable states through home and related reads. |
| `PERF-002` | Scoring recomputes the whole tournament | Open / accepted pending measurement | Profile target-capacity cost before deciding whether to optimize. |

## Low

| ID | Finding | Status |
| --- | --- | --- |
| `HYGIENE-001` | Unused Vite scaffold asset remains | **Open — original referenced asset not yet identified; common `vite.svg` scaffold paths are absent. Do not delete by assumption.** |
| `HYGIENE-002` | Some pure modules appear test/reference-only | Open; verify before deletion |
| `CODE-001` | Large orchestration files are coordination hotspots | Open |
| `OPS-004` | Runtime pinning is incomplete | **Resolved** — Node `22.22.2` is pinned in `.nvmrc`, package engines, GitHub Actions and `netlify.toml`; the alignment test and ready Netlify preview passed. Reopen on any declaration or hosted-build regression. |
| `SEO-001` | SPA fallback produces soft 404s | **Open — the router already renders a dedicated recovery page for unknown paths; static Netlify SPA fallback still responds at the HTTP layer.** |
| `SEO-002` | Metadata is largely global | Open |
| `A11Y-003` | Bottom navigation is imperative rather than link-semantic | **Resolved** — all five primary destinations are React Router links, retain `aria-current="page"`, support normal browser link actions and pass semantic regression tests. PR #37’s guarded preview reached ready state with accessibility 100. Reopen if a primary destination becomes button-imperative again. |
| `UX-003` | Other-player profile action remains incomplete | Open |
| `UX-004` | Sign-out is immediate | Open |
| `DATA-008` | Score values have no practical database maximum | Open |
| `DOC-002` | Package version remains `0.0.0` | Open |
| `DOC-003` | Component gallery is large and partly historical | Open; correctly dev-only |
| `REPO-001` | Licence, changelog and editor baseline are absent | **Partially resolved** — `.editorconfig` now enforces UTF-8, LF, final newlines and repository indentation rules, with executable drift coverage. Licence selection and changelog policy remain open. |
| `REPO-002` | `.gitignore` misses `.env.production` and `.env.development` | **Resolved** — `.env` and all `.env.*` variants are ignored while `.env.example` remains committable; Git's own `check-ignore` semantics are covered by the test suite. Reopen if a sensitive variant becomes committable or the template becomes ignored. |

## Register rules

- Keep original IDs when the same defect regresses or broadens.
- A repository/development fix remains open when the actual risk is still present or unverified in production.
- Prepared tooling or an approved method does not resolve a finding that requires a real artifact or restore proof.
- `Resolved` requires implementation, validation and current-environment evidence appropriate to the finding.
- `Superseded` must name the active replacement finding.
- Do not silently remove uncertain or accepted risks.
- Use GitHub Issues/PRs for implementation work; this file records risk state rather than duplicating a task tracker.
- Update this register after every material integrity, deployment, security or operations change.
