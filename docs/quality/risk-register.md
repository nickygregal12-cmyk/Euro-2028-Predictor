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

**Deliberately not acted on, with the reason in each entry:** `DB-003`, `DB-005`, `DATA-007` and `SEC-001` all require a migration. (`DB-005` was subsequently acted on at contract 134; its row below is the current position and this line is the 6 August audit's, kept as written.) `AUTH-002` is a hosted Supabase Auth setting. `SEC-002` is a gradual campaign across dozens of call sites rather than a change, and the audit says so itself.

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

## Correction record — 10 August 2026, audit remediation batch

The first working batch against the 10 August audit. Position is tracked in
[`audit-2026-08-10-remediation.md`](audit-2026-08-10-remediation.md), which is a
work tracker and not an authority. What moved in **this** register:

- **`AUTH-002` reduced, and its recorded closure corrected.** The closure said
  "enable leaked-password protection in both projects"; that toggle is Pro-plan
  only and cannot be enabled on the current tier, so the closure as written was
  never achievable. A client-side k-anonymous breach-corpus check now exists on
  the sign-up and reset forms. It is a mitigation, not the closure — it is
  bypassable, the length floor is untouched at six, and the policy for existing
  passwords is still undecided. The row says all of that.
- **`SEC-002` is unchanged and was not made worse.** `connect-src` gained
  `https://api.pwnedpasswords.com`, which widens the policy by one origin. That
  is a deliberate outbound dependency and `contentSecurityPolicyParity.test.ts`
  now derives the permitted external hosts from what `src/` actually references
  rather than comparing against a hand-written list, so the widening cannot
  outlive the code that needs it. `style-src 'unsafe-inline'` is untouched.
- **`ACQ-R19` — SHA pinning is blocked here for the second time, recorded rather
  than retried.** The 6 August record says pinning "could not be performed from
  the working environment, and inventing a hash would break CI rather than
  secure it". It still cannot: `api.github.com` answers 403 from the remediation
  environment, so no tag could be resolved to a commit. Nothing was invented.
  That original duplicate workflow has since been retired. The replacement
  `.github/workflows/security-tooling.yml` installs checksum-verified actionlint,
  runs it as a blocking pull-request check, and runs pinned zizmor with hardened
  runners. New required and scheduled workflows use full action SHAs; the
  historical floating-action estate remains a family-by-family cleanup rather
  than an invented bulk rewrite. The dependency-scanning half is also widened: CI
  now runs a second, non-blocking `npm audit --audit-level=moderate` including
  devDependencies. Dependabot **alerts** remain a repository setting and remain
  off.
- **`DOC-001` — one instance of the drift it describes was corrected.** Three
  documents disagreed about the site perimeter: `netlify-deploy-access.md`
  recorded the 10 August switch to site password protection in one section while
  still asserting Team SSO in two others, `current-status.md` carried the
  8 August Team SSO reading as current, and the dated release record's title says
  "behind Team SSO". The two live authorities are corrected; the dated release
  record keeps its title and gains a correction banner, because rewriting it
  would destroy the only trace that the release and the perimeter change crossed.
  The structural half of `DOC-001` is untouched and the finding stays open.
- **Nothing else moved.** No migration, no hosted change, no scoring, lock,
  settlement, progression or reveal rule. `SEC-001`, `DATA-007`, `DB-003`,
  `DB-004`, `TYPE-001`, `PERF-001`, `PERF-002` and `OPS-006` are all untouched.

## Correction record — 10 August 2026, `DOC-001`'s structural half found a new way to fail

`DOC-001`'s remaining open half is the structural one: a single small current-state
surface with *generated* rather than hand-edited values. That surface exists —
`NOW.md`, generated by `scripts/generate-now.mjs` and gated by `npm run check:now`.
On 10 August 2026 it reported **production at contract 145** while the production
hosted record said **151**, verified by rollout run `31420443441` and an independent
read-only query. Nobody typed the wrong number, and no gate was skipped.

- **The cause is duplication, not staleness.** Production's contract was stated in
  `config/production-hosted-contract.json` and *also* as `productionContract` in
  `config/development-hosted-contract.json`. The generator read the second. That copy
  was written by the development follow-up workflow, which runs after a **development**
  rollout — so a **production** rollout had nothing that moved it.
- **The gate was blind by construction, which is the transferable part.**
  `npm run check:now` regenerates `NOW.md` from the same field and compares. Given one
  stale input it produces one stale output, matches it, and passes. A duplicated fact
  checked by regeneration from one of its copies certifies its own error, every time,
  for as long as the duplication lasts. This is the second time this repository has been
  bitten by the same field: it was previously a hard-coded `63` that put four
  unmergeable contract-declaration changes on `origin` at once, and that fix corrected
  the *source* of the copy while keeping the copy.
- **What changed.** The copy is deleted from the development record and from the
  workflow that wrote it; `scripts/generate-now.mjs` and
  `scripts/check-hosted-migration-inventory.mjs` both read
  `config/production-hosted-contract.json` at the point of use; and both now **refuse** a
  development record that restates production, whether or not the two agree — a copy
  that agrees today is one nobody has moved yet, not a safe one.
- **Two related defects surfaced with it.** The inventory checker asserted
  `| Production Supabase | **145** |` appeared somewhere in
  `ops-pending-migrations.md`, which passed by matching a **superseded** entry, because
  that file deliberately keeps its history — so it was verifying a historical fact and
  reporting it as current. And `hosted-migration-inventory.yml` did not trigger on
  `config/production-hosted-contract.json` at all, so raising production to 151 ran no
  check; both are fixed here.
- **`current-status.md` was checked and is correct at 151.** The generated surface was
  the only live authority stating the wrong number, so no prose was corrected and no
  dated evidence was touched.
- **`DOC-001` stays open**, reduced again. The structural surface is right in principle
  and was wrong in fact for a day; what this record adds to the finding is that a
  generated page is only as honest as the *uniqueness* of its inputs.
- **Nothing else moved.** No migration, no hosted change, no scoring, lock, settlement,
  progression or reveal rule. This is a repository-side reporting correction; it makes
  no hosted claim of its own and asserts production's contract only by reading the
  record the owner's rollout wrote.

## Correction record — 11 August 2026, phase 7 measurement

Four of phase 7's items were measured rather than acted on, and one was closed.
Nothing here changes production, and only the closed item ships code.

- **`DB-002` is CLOSED for its most-warned-about hole, by an executable guard rather
  than a migration.** `AGENTS.md` and `20260804163000_lms_auto_assignment.sql` both
  state at length that `current_user` inside a `SECURITY DEFINER` function is the
  function OWNER for every caller, so a predicate on it is always true — a control
  that reads in review exactly like a security narrowing and is not one. Measured:
  **no definer uses it today**, and the four legitimate `current_user = 'postgres'`
  predicates are all on `security invoker` trigger functions, which is now a
  positive control rather than a coincidence.
  `tests/database-parity/securityDefinerCallerGuards.test.ts` makes both executable,
  over the committed migration text rather than over `pg_proc` — a function
  redefined twice in one migration shows only its last definition to the live
  database, which is the exact case `stageC1LockFunctionConsistency` exists for.
  Writing a second, independent parser also found that `search_path` is pinned in
  **two spellings** — `= ''` as authors type it, `TO ''` as `pg_get_functiondef`
  emits it — so a guard matching only one would silently have exempted every
  round-tripped definer from the check. **What remains open under `DB-002`** is the
  mutation testing of individual caller guards, which needs a live database and a
  non-owner role per function, not a source read.

- **`DB-003` is measured and deliberately not acted on.** Read-only against hosted
  Development: **40+ single-column foreign keys have no index able to serve them**,
  across `public` and `predictor_internal`. The task's own instruction is the reason
  nothing was added — *add only indexes supported by joins, deletion checks,
  settlement or ingestion paths; do not index every advisor warning blindly* — and
  the evidence to tell those apart does not exist yet: Development holds one auth
  user and 578 season fixtures, so every plan is a sequential scan on merit and no
  measurement taken there would generalise. **The trigger for acting** is the first
  of: a realistic-volume rehearsal, a closed cohort with real rows, or the
  `PRIV-003` account-closure path becoming live — that last one matters most,
  because an unindexed referencing table is scanned once per delete, and account
  closure is the deletion this schema has the most of.

- **`DATA-007` is re-measured and stays open, reduced.** Contract 145 closed the
  atomicity half and contracts 158/159 charged the invite-probe budget on all three
  doors. Measured after contract 171: the expensive league and leaderboard reads are
  bounded, and both league prediction reads now declare their truncation — so the
  "expensive read RPCs are unbounded" clause of its closure is **no longer true and
  is corrected here**. Still open, unchanged: invalid operations consume no limit,
  and there are no edge/IP controls or alerting. PostgreSQL cannot see a trustworthy
  client IP through the Data API, so that half is an edge-layer change and is not a
  migration anybody should write.

- **`DATA-008` remains blocked on a rule, and the rule is not an engineering
  decision.** A score constraint needs an accepted practical maximum, and the
  tournament path's extra-time and penalty representations must survive it. No
  authority states one. Recorded rather than guessed, for the same reason as
  `CUP-001`: a CHECK is where a product decision would become invisible.

- **`DB-004` re-verified, unchanged.** The source guard forbidding a browser-callable
  wrapper around `net.*` still holds, and contract 115's finding stands: `pg_net`'s
  grants belong to whoever owns the extension, and where the platform owns it the
  project role can neither revoke them nor pretend to.

## Correction record — 17 August 2026, external repository audit

A fresh audit read current `main`, open pull requests, source, tests, CI, operational
documentation and configuration, deliberately without using project history as evidence.
Its finding was not "there are no tests" but something narrower and more useful: **some
safeguards looked stronger than what they actually proved.** Each of its five findings was
reverified against the repository before anything was recorded here, and the verification
changed one of them.

**Four are resolved and are deliberately NOT opened as entries**, per this register's own
rule against retaining a finding after the concrete defect is fixed. They are recorded here
so they are not re-raised from the audit text, and so the evidence of the check survives:

- **The hosted-status authority was wrong and the freshness gate could not fail.**
  [`current-status.md`](current-status.md) stated a hosted Production contract behind the
  one `config/production-hosted-contract.json` records, while
  [`ops-pending-migrations.md`](../ops/ops-pending-migrations.md) agreed with the record —
  and `tests/scripts/documentationContractFreshness.test.ts` was green throughout. The
  audit attributed this to Production lacking protection; **verification found the
  mechanism to be different, which matters for the fix.** The Production record *was* used,
  but only to check the Netlify declaration did not *lead* it, through a helper returning
  `declared <= hosted` that permits trailing by design. No pattern compared the prose to
  the record, and no `PRODUCTION_CONTRACT` pattern existed at all while the repository and
  Development ones did. Fixed in pull request #817: both hosted claims are now checked
  against their records, the Development claim included — it had only ever been checked for
  self-consistency, which a document uniformly stating a wrong number passes. Proven by
  reverting the value in the document and watching two assertions fail.
- **A development-credential guard matched by substring.** `isDevProjectUrl` tested
  `url.includes(DEV_PROJECT_REF)`, so the project ref merely had to appear somewhere in the
  string: a hostile subdomain, path, query or fragment all passed, as did the correct host
  over plaintext. `isLocalSupabaseUrl` eight lines below had always parsed the URL properly.
  Fixed in pull request #818 by requiring the exact HTTPS origin. **Never reachable from a
  production build** — the path needs a development build *and* the opt-in flag — so this
  was a guard that did not hold in the one situation it exists for, not a production
  exposure. The old test could not have caught it: it rejected a *different* project ref,
  which a substring test rejects anyway.
- **Telemetry URL sanitisation kept the path verbatim.** Query strings, hashes, emails,
  bearer material and database errors were stripped; `origin + pathname` was not, and the
  path is where invite codes and player identifiers live. Fixed in pull request #819 by
  reusing the existing route categoriser, whose vocabulary is a closed set and therefore
  cannot carry a value. An invite code cannot be recognised structurally — it is
  indistinguishable from an ordinary path word — which is why an allowlist was the only
  sound approach for this application's own routes. `sentryReporter` was checked and was
  already correct.
- **The duplication guard could not see a file repeating itself.** It recorded each path
  once, so its `carriers.length < 2` sweep deleted intra-file repeats before they reached
  an assertion; [`current-status.md`](current-status.md) carried an identical seven-line run
  twice. Fixed in pull request #820, **open at the time of writing rather than landed** — it
  is listed here because the defect and its cause are verified, not because the change has
  merged. No baseline entry was added, because that ratchet is deliberately empty.

**One is new and is opened below: `TYPE-002`.** It is the audit's only P3 and the only
finding whose closure is not a single change.

## Correction record — 18 August 2026, tooling assurance activation

- **`ACQ-R19`'s repository pinning gap is closed.** All tracked external GitHub
  Action references now use full 40-character SHAs, preserving the existing
  major families (including the three workflows intentionally still on
  `supabase/setup-cli` v1). `security-tooling.yml` runs a full-tree gate rather
  than merely refusing newly added floats. Renovate is configured to maintain
  SHA pins, but its hosted App still has no observed onboarding or dependency
  PR and is therefore not claimed active.
- Harden Runner audit mode now covers the active AI, browser, backup, smoke,
  CodeQL and security families. Historical/manual rollout families remain a
  measured follow-up because enforcing egress without first observing their
  destinations would risk disabling a recovery control.

## Correction record — 19 August 2026, vNext programme review

A read-only review of the running vNext frontend programme, recorded in full at
[`audits/2026-08-19-vnext-programme-review.md`](audits/2026-08-19-vnext-programme-review.md).
It read commit `0dfc669` and was recorded at `35cd870`; between those two the
programme advanced to Stage 12, which moved no evidence and only changed which
stage owns which finding.

Its findings are **not uniform in kind**, and the difference matters more than
the count. Four of them are the same underlying defect at different distances —
the vNext surface conformance checklist exists only as duplicated test code, so
it has drifted between surfaces, so no list of lane primitives exists for Stage
15 to audit against, and no rule covers the drawn geometry Stage 12 is about to
produce. One is a scheduled collision rather than a present defect: vNext is
dark-only by a deliberate workshop decision, production ships a persisted theme
preference, and Stage 14 is contractually barred from resolving the difference
it would create. One could not be verified from the repository at all.

- **`UX-005` is opened** for the theme collision, with the decision half
  recorded as `DEC-016` in [`deferred-decisions.md`](deferred-decisions.md).
  The risk is the *timing*, not the dark palette: the palette is an accepted
  design decision and this register takes no position on it.
- **`TEST-002` is opened** for the duplicated and drifted conformance checklist.
  The measured drift is in the report; the sharpest instance is that Last Man
  Standing, the only vNext surface that writes, has the thinnest browser
  coverage of the six measured.
- **`UX-006` is opened** because `src/vnext/foundations/tokens.css` has no
  contrast matrix while `src/styles/tokens.css` has had one since the `--tx3`
  on `--chip` failure this register already records. It is related to `DEC-013`
  but is not the same item: that one is a legacy token's headroom, this one is a
  second palette that is not measured at all.
- **`TEST-003` is opened** for drawn geometry, and it is the most
  time-sensitive: Stage 12's bracket is in progress now, and the precedent worth
  following — reading plotted coordinates back out of the rendered SVG — is
  currently a comment about one chart.
- **`DOC-004` is opened** for the absent enumeration of vNext primitives that
  Stage 15's completion predicate requires an auditor to check against.
- **`CI-002` is opened** for the vNext browser suite's serial runtime budget,
  whose own workflow states the remedy and names the stages that will exhaust
  it.
- **`OPS-012` is recorded as a check to perform, not a confirmed defect.**
  Whether the branch ruleset requires the vNext and Storybook contexts is a
  hosted setting that could not be read from the repository. It is written down
  because the failure mode is silent and this repository has already lost time
  to a ruleset/context mismatch.

**No finding was fixed in this pass**, and nothing in the vNext lane was
changed. The review altered no source, test, workflow, token or machine state,
touched no hosted system and opened no GitHub Issue.

## Correction record — 19 August 2026, `TEST-003` closed before the bracket existed

The 19 August review opened `TEST-003` because the repository's best idea about
drawn geometry was a comment on one component rather than the lane's rule, and
Stage 12 was about to draw a knockout bracket — ordering, connectors, byes and
walkovers, every one of them wrong in ways that render successfully.

It is now `src/vnext/AGENTS.md`'s rule and
`tests/vnext/vnextDrawnGeometry.test.ts`'s registry. The row below carries the
detail. Three things are worth recording here rather than there:

- **The timing held.** No vNext Championship or bracket source existed on `main`
  when this landed, so the rule is in place before the first drawing it governs
  rather than being retrofitted around one. That was the whole point of the
  finding, and it is the part that would have been lost by waiting.
- **The guard was proved by breaking it.** A registry that silently matched
  nothing would have passed every assertion in the file, so the detector carries
  a fixed point naming the drawing it was written from, and three deliberate
  mutations were run to confirm each assertion fails for its own reason.
- **No other finding from that review moved.** `UX-005`, `TEST-002`, `UX-006`,
  `DOC-004`, `OPS-012` and `CI-002` are untouched and stay exactly as opened.
  `TEST-002`'s shared conformance harness in particular is a different change
  with different evidence, and folding it in here would have made both harder to
  review.

## Correction record — 19 August 2026, `OPS-012` confirmed and reclassified

`OPS-012` was opened hours earlier as a check to perform rather than a defect,
because the branch ruleset is a hosted setting and this clone cannot read it.
The question has now been answered without reading it, from the repository's own
merge history — and the answer is more interesting than the question.

**The vNext browser suite is not a merge condition.** On #910 the merge fired
five seconds after `CI / Required merge gate` went green and **cancelled the
`layout` job mid-run**; it never reported a conclusion on that head. #914 shows
the same five-second pattern. Whatever the ruleset says in full, it plainly does
not wait for that suite.

**But this is a deliberate trade-off, not an oversight**, and the register
should not have implied otherwise. `specs/tooling-assurance-activation/plan.md`
already names the constraint that produced it: a path-scoped workflow must not
become an impossible required check, because a required context that a `paths:`
filter stops from ever posting blocks the pull request forever — the same class
of failure as the ruleset/context name mismatch recorded under `DOC-001`, and
this repository has already lost a day to that one.

So the finding survives with its cause corrected, and its closure changed. The
review asked for the ruleset to be read; reading the merge history answered it
better, and the fix the review implied — make those contexts required — is the
one thing that must not be done on its own.

**A note on what this makes of `CI-002`.** The #911 path-filter change is still
worth having, but its benefit is runner minutes and capacity rather than merge
latency: a merge was never waiting on that suite in the first place. The earlier
framing of it as time a doc-only pull request spent waiting was wrong.

## Correction record — 10 August 2026, `DATA-007` partly acted on

The 6 August audit record above says `DATA-007` was "deliberately not acted on" because it requires a migration, and the 9 August record above says it stayed open when `DB-005` was fixed in the same limiter. Contract 145 is the migration, and it takes **one** of the four things `DATA-007`'s closure asks for. The earlier records are left exactly as written; this one says what changed and what did not.

- **The atomicity half is resolved in the repository, pending hosted apply.** `20260810010000_rate_limit_atomicity.sql` redefines `public.enforce_rate_limit` to take a transaction-scoped advisory lock, keyed on the calling user, before it prunes, counts and inserts. A waiter therefore acquires the lock only after the holder's transaction has ended, and under read-committed isolation its subsequent count includes the holder's committed event. Overshoot becomes impossible rather than unlikely.
- **The lock is per caller and never per action, deliberately.** Per-action keys would let one transaction hold two of these locks, and two transactions taking the same two keys in opposite orders is a deadlock. Nothing writes `match_predictions` and `league_members` in one transaction today, but "nothing does today" is weaker than "this function can only ever hold one of its own locks". The cost is that a single caller's league join serialises against that same caller's own prediction save, which is not a real concurrent workload.
- **Which limit this mattered most for.** The prediction-save ceiling is self-scoped — row-level security confines a caller to their own entry — so overshooting it wastes this platform's capacity and nobody else's. The league-membership ceiling is the control that makes invite-code probing expensive, and a control that can be overshot by running attempts in parallel is the wrong control for an attacker who was always going to run them in parallel. That is the overlap with `SEC-001`, and it is a reduction of `SEC-001` rather than its closure.
- **Three quarters of the required closure is untouched and the row below still says so.** Invalid operations still consume no limit — an unmatched invite code fails before any `league_members` insert. The expensive read RPCs are still outside the limiter entirely. There are still no edge or IP controls beside the per-user database limit, and no alerting on repeated rate-limit or timeout exceptions. Each is a separate change with separate evidence, and the first of them is a change to the invite-code path rather than to the limiter.
- **Neither hosted environment holds the fix.** Development receives it through the guarded additive fast lane; Production only through its own controlled promotion, which is separately blocked. Nothing here is a hosted claim.
- **Nothing else in this register moved.**

## Correction record — 9 August 2026, `DB-005` acted on

The 6 August audit record above says `DB-005` was "deliberately not acted on" because it requires a migration. Contract 134 is that migration. The earlier records are left exactly as written; this one says what changed.

- **`DB-005` resolved in the repository, pending hosted apply.** `20260809030000_rate_limit_events_client_revoke.sql` revokes `public.rate_limit_events` and its identity sequence from `anon` and `authenticated`. Privileges only: no relation, function, policy, trigger, threshold or rule moves, and `service_role` is untouched. Its row below carries the evidence.
- **The blind spot that produced it is closed, which matters more than the one table.** Every guard that pinned the direct Data API surface read `grant` statements — and no `grant` on this table was ever written. Supabase's default privileges in `public` hand every ordinary privilege on a new table to both browser roles, so a table is reachable unless a migration takes it away, and nothing checked for the taking-away. `dataApiExposure.test.ts` now pins the complete set of public tables browser roles can still reach at all (the sixteen original Euro tournament relations, protected by row-level security by design). A new table created without a revoke is now a failing test on the commit that creates it.
- **Neither hosted environment holds the revoke yet.** Development receives it through the guarded additive fast lane; Production only through its own controlled promotion. Nothing here is a hosted claim.
- **Nothing else in this register moved.** `DATA-007` — the count-then-insert race in the same limiter — is untouched and stays open: it is an enforcement-atomicity defect in `enforce_rate_limit`'s body, a different change with different evidence, and folding it into a privileges-only fix would have made both harder to review.

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
| `OPS-011` | Netlify's non-production database-contract variable is stale, weakening preview evidence | **Resolved 6 August 2026 for the current value; the recurrence is not prevented.** `EURO28_DEPLOYED_DB_CONTRACT` read `97` in the `dev`, `branch-deploy` and `deploy-preview` contexts of the `euro28predictor` project while hosted development had moved well beyond it. All three were raised to the value the machine-readable hosted record verifies, and the change was confirmed by reading the variable back. **Production's value was deliberately not touched** — it still holds the figure the promotion gate expects, on the same value id and timestamp as before — and neither was the empty `dev-server` context, the legacy `euro28-predictor-dev` project, nor any other variable. No deploy was triggered. **What remains open is the reason it drifted:** the value is maintained by hand, so it goes stale again after the next rollout. Closure is the follow-up workflow updating it, or failing with an actionable mismatch — the same class of defect as `OPS-010`, where correct evidence existed and nothing carried it to where it was read. Original finding: Netlify sets `EURO28_DEPLOYED_DB_CONTRACT=97` for development, branch deploys and deploy previews while hosted development is verified at a far higher contract. This is a Netlify environment variable rather than a repository value, so it is **not repository-verifiable** and the audit reading is the evidence. It does not fail the build — the validator's non-production carve-out deliberately lets a trailing database report a gap instead — which is exactly why it is easy to miss: previews report a contract gap that does not exist, weakening release evidence and potentially suppressing useful database smoke coverage. Production must remain 63 until an authorised promotion. | Update the non-production contexts to the verified development contract after every successful rollout, and make the hosted-contract follow-up workflow either update this value or fail with an actionable mismatch — a number a human has to remember to change is the same failure class as `OPS-010`. **Reduced 10 August 2026 (AUD-22): the recurrence is now reported, and reported loudly.** The development hosted-status follow-up gained a final `if: always()` step that owns this value. With `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` it sets `EURO28_DEPLOYED_DB_CONTRACT` for `dev`, `branch-deploy` and `deploy-preview` and **reads each back**, because writing and assuming is exactly what a hand-maintained value already does. **Measured: neither secret exists in this repository**, so what runs today is the other half — it fails with the exact `netlify env:set` commands in a job summary and an issue. A warning on an otherwise green run is how this value went stale in the first place, and a trailing non-production value deliberately fails no build, so nothing else would ever report it. **`production` and `dev-server` are never passed to anything**, and a guard inside the step refuses if the context list is ever widened to either: production's value is what its promotion gate reads. It runs last and always, so a failure here cannot discard the hosted record the earlier step pushed — the lesson that workflow already carries once. **Open until** either the two secrets are added, or the owner accepts the fail-loudly form as the closure.
| `OPS-010` | A verified hosted record can fail to reach `main` | **Open pending proof; both causes addressed** | The follow-up workflow can no longer strand a record silently, and the owner enabled the repository setting permitting GitHub Actions to create pull requests on 6 August 2026. Neither half is proven yet: the next fast-lane rollout is the first run that will exercise both. Close it on that run opening its pull request unaided; if it is refused again, the fallback should say so in a job summary and an issue rather than in silence. |
| `UX-005` | vNext has no light theme while production ships a persisted one, and the stage that would inherit the mismatch may not resolve it | **Open, recorded 19 August 2026.** `src/app/providers/ThemeProvider.tsx` persists a user theme choice at `euro28-theme` and `src/styles/tokens.css` carries a full `[data-theme="light"]` block; `src/vnext/foundations/tokens.css` is dark-only by a stated, deliberate workshop decision. Stage 14 makes vNext the production Football Hub, so on the current plan the cutover removes a preference a user set. | Either the light theme is answered as Stage 13 scope, or retirement of the stored preference is recorded as a deliberate decision in the route-migration and cutover work. Stage 14 cannot be the place it is discovered: its own contract excludes creative redesign of accepted vNext surfaces. The product decision is `DEC-016`; this row is the delivery risk around it, and closes when either outcome is recorded. If the theme is built, `UX-006` is a prerequisite — an inverted dark ramp is not a measured light ramp. |

## Medium

| ID | Finding | Current status |
| --- | --- | --- |
| `AUTH-001` | Turnstile/CAPTCHA contexts not fully verified | **Partial.** Netlify non-production contexts use the Cloudflare always-pass test site key and production retains its real key. Matching development Supabase secret/toggle and preview sign-up/login/recovery evidence remain open in issue #28. |
| `AUTH-002` | Leaked-password protection disabled | **Open, reduced 10 August 2026 — and its stated closure is now known to be unachievable.** The required closure below reads "enable leaked-password protection in both projects". That toggle is a **Pro-plan-and-above feature**, and this project is on the free tier: the setting is not merely off, it cannot be switched on. The closure was written on the assumption it was a dashboard checkbox, and it is not. **What now exists instead** is a client-side breach-corpus check — `src/services/auth/pwnedPassword.ts`, wired into the sign-up and password-reset forms, calling HaveIBeenPwned's k-anonymous range API so only the first five hex characters of the SHA-1 leave the browser. It fails open on every error path, deliberately: an unreachable corpus must not become a signup outage, and Turnstile, the contract-145 atomic limiter and the length floor all still stand without it. **This is a mitigation and not the closure, for a reason worth naming:** it is bypassable by calling the Supabase auth endpoint directly. That bypass is close to irrelevant for the threat actually recorded here — the risk is an ordinary user reusing a password already in a credential-stuffing list, and that population uses the form. It is not irrelevant for an attacker, which is why this row stays open. **The advisor will keep reporting this finding no matter what is built**, because it reads the toggle rather than the implementation; that is recorded here so a permanent warning does not quietly train anyone to ignore the advisor panel. **Still open and untouched:** the minimum length is still six — Supabase's default rather than a chosen policy — secure password change is not required, MFA for administrators is undecided, and there is still no deliberate policy for **existing** passwords, which no setting change would re-validate anyway. Evidence: `tests/services/auth/pwnedPassword.test.ts`, `tests/features/auth/breachedPasswordForms.test.tsx`, and the after-state assertions in `tests/features/auth/antiBotAndPasswordBeforeState.test.ts`, which previously pinned the *absence* of any breach check. Original finding, **reconfirmed 6 August 2026** by the live Supabase security advisors in **both** environments — this is a hosted Auth setting and is not repository-verifiable, so the advisor reading is the evidence. Users may therefore choose passwords known from previous breaches, which is what makes credential stuffing worth attempting. Turnstile tokens are correctly threaded to Auth for login, signup and recovery. Required closure: enable leaked-password protection in both projects, set a sensible minimum length, retain Turnstile, consider MFA for administrators, and decide a deliberate policy for **existing** passwords — changing the setting does not force a reset. |
| `OPS-008` | Legacy public development site remains | **Reduced.** Anonymous public access was removed and Netlify team SSO is required. The hourly legacy function and missing/inaccessible Supabase ref remain open in issue #27. |
| `REL-007` | Stale device can delete a newer bracket pick | **Implementation present; final controlled browser evidence pending** |
| `REL-008` | Netlify deploy-preview policy was inconsistent across documentation branches | **Reduced; final contract-63 preview passed.** |
| `MIG-001` | Concurrent branches can add stale/colliding migration timestamps | **Resolved by the committed guard and focused tests.** |
| `PRIV-001` | Tournament-wide prediction consensus had no minimum cohort | **Resolved and production-hosted.** |
| `DB-001` | `public.enforce_joker_rules` has mutable search path | **Resolved in the repository chain and within the migrations the development contract records as applied** — the Stage C1 foundation migration redefines the function with `set search_path = ''` and the C1b redefinition preserves the pin. Production still runs the older definition until promotion. |
| `DB-002` | Authenticated `SECURITY DEFINER` allowlist needs continued review | **Open assurance finding; intended RPCs remain explicitly granted** |
| `DB-003` | Several foreign keys lack supporting indexes | **Open pending representative query evidence. Reconfirmed 6 August 2026** by the live Supabase performance advisors in both environments, which now name production examples: `matches.home_team_id`, `matches.away_team_id`, result-revision actor references, Cup participant/winner references, LMS team references and prediction/score-event team references. Development adds further unindexed relationships in the newer season tables. Not visible at the current data volume, which is why measured evidence is still the gate: capture slow-query and `EXPLAIN (ANALYZE, BUFFERS)` plans, prioritise keys used in joins, deletion checks and settlement jobs, then add indexes additively. Do not index every advisory row. |
| `DB-004` | `pg_net` privileges remain with browser roles, so a future exposed wrapper would become SSRF | **Open, latent and contained.** `anon` and `authenticated` retain usage on the `net` schema and execute on `net.http_get`, `http_post`, `http_delete` and the response functions, because the platform owns the extension and `postgres` cannot revoke them — the contract-115 migration reports this by notice rather than hiding it. **No presently reachable exploit was found:** `net` is not an exposed Data API schema, no browser-callable function in `public` or `graphql_public` invokes `net.*`, provider URLs are fixed HTTPS origins with redirects blocked and responses bounded. The danger is one future migration adding an innocent-looking exposed wrapper. | Add a hosted assertion, run against both environments, that `net` is never an exposed API schema; keep the existing guard rejecting exposed functions that call `net.*`; escalate to Supabase support to narrow the platform grants; consider moving scheduled outbound work entirely to an Edge Function scheduler. Add archive retention and a storage quota before enabling polling — development currently has no enabled poll target, so that storage risk is contained. **Reduced 10 August 2026 (AUD-20): the hosted assertion this row asks for exists, and has not yet run.** `supabase/checks/net-exposure.sql` reads `pgrst.db_schemas` from the `authenticator` role — which IS the Data API setting rather than a copy of it — and raises if `net` appears; it then applies contract 115's function-body check against **whatever is actually exposed** rather than a hard-coded `public, graphql_public`, so exposing a third schema brings its functions under the check instead of leaving them outside it. **It fails closed**: an unreadable schema list is reported as UNKNOWN and fails, because a check that reports unknown as safe is worse than no check, being believed. The platform-owned residue is printed rather than failed on, so this cannot become permanently red on a condition nobody here can change. `.github/workflows/net-exposure-check.yml` runs it against Development **and** Production, read-only, `fail-fast: false`, failing rather than skipping when a target secret is missing, on a weekly schedule because the setting it watches changes from a console with no commit behind it. It is **schedule and manual dispatch only**: a pull-request trigger was tried and removed, because a job that fails without credentials can only be red on a pull request, and a permanently red check is one people stop reading — which is this finding's own failure mode. **Why this was needed even though contract 115 already checked it:** that check is a one-shot `do $$ … $$` block that ran at apply time and cannot see migration 153, and it never covered the exposed-schema list at all — that list is a project setting no migration could assert. **The finding stays open**: no run has happened, so there is no evidence for either environment, and the platform grants are unchanged. Close it on a passing scheduled run against both targets.
| `DB-005` | `rate_limit_events` granted every ordinary privilege to browser roles, against its own stated design | **Resolved in the repository at contract 134; hosted rollout pending.** `20260809030000_rate_limit_events_client_revoke.sql` revokes the table and its identity sequence from `anon` and `authenticated`. `187_rate_limit_events_client_revoke.sql` asserts both halves the closure asked for — `table_privs_are` for the exact empty ACL on each browser role, and the default-deny *behaviour* driven as those roles, where `select`, `insert`, `update`, `delete` and `truncate` are each refused `42501` rather than returning the empty result row-level security used to give — and adds the half it did not ask for: the limiter is driven to its ceiling and through its hourly prune after the revoke, because a revoke on a table only a `security definer` function touches is exactly the change that can disarm a control with nothing failing. `service_role` is deliberately unchanged: it is not a browser role, this finding does not name it, and narrowing the server key needs its own evidence. `dataApiExposure.test.ts` now pins every public table browser roles can still reach at all, closing the blind spot that produced this — the previous guards read `grant` statements, and no `grant` was ever written; Supabase's default privileges did it. **Reopen if the hosted apply does not happen:** neither environment holds the revoke until the guarded Development fast lane applies contract 134, and Production follows only through its own controlled promotion. Original finding: the migration says "no client access at all" and then never revokes: `anon` and `authenticated` hold `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` and `TRIGGER` in both environments. RLS is enabled with no policy, so browser access currently sees no rows and cannot mutate them — the table is protected by one control where the design intended two. Accidentally disabling RLS, or adding one broad policy, would expose a table that already grants every operation. | Apply contract 134 to hosted Development through the guarded additive fast lane and verify the ACL there; promote to Production only through the separately approved release. Do not rely on RLS alone where the intent is no client access. |
| `PERF-001` | League summaries may scale serially | **Open** |
| `PERF-002` | Scoring recomputes whole tournament | **Open pending complete-volume measurement** |
| `TYPE-001` | Hand-written types/casts can hide schema drift | **Open, reduced further 10 August 2026 — the client is now typed and the first module group is reconciled.** `src/services/supabase/client.ts` calls `createClient<Database>` and exports the same instance twice: `db` with the generated types applied and `supabase` with them erased, so modules migrate in reviewable groups instead of all at once. It is **not a cast** — `SupabaseClient<Database>` is assignable to `SupabaseClient`, so the widening is compiler-checked. Seven modules are on the typed client and **eight real argument defects are fixed**: each passed an explicit `null` for an optional RPC parameter, and the conversion to omission was verified per-parameter against its SQL default (`p_after text default null`, `p_note text default null`, `p_from`/`p_to timestamptz default null`) rather than assumed — `p_limit integer default 50` sits beside four of them as the case where the same edit would have changed what the query sent. `tests/services/databaseTypeMigration.test.ts` pins the migrated set, refuses a module moving back to the untyped export, and asserts the remaining count so the seam cannot go quiet. **Still open, and the larger part:** 39 service modules import the untyped export and 19 measured errors remain, including three insert shapes that are correct as written because a preparation trigger fills the column the generated `Insert` type demands. Closure is the remaining groups, ending with the deletion of the `supabase` export. **Correction to the previous entry:** it reported 81 errors; the figure is **27** — `tsc -b` builds several projects over the same sources and each error was counted once per project. The de-duplicated count and the corrected classification are in [`database-types-baseline.md`](database-types-baseline.md). Prior position, 10 August 2026 — **the artifact existed and was not yet consumed, which was half the closure and deliberately not more than half.** `src/services/supabase/database.types.ts` now holds generated types for all 53 tables, produced read-only from hosted Development at contract 151 while repository and Development were level, with provenance in `database.types.meta.json` and a staleness guard (`tests/services/databaseTypes.test.ts`) that fails the moment a later migration lands — proven by adding a migration and watching it fail. `scripts/generate-database-types.mjs` refuses the Production project by name. **This does not close the finding, and the reason is exact: a generated file that nothing imports hides nothing and prevents nothing.** The client is still `createClient(...)` untyped, so every call site is still hand-typed or cast, which is the finding as written. **What closure now costs is measured rather than estimated:** typing the client produces **81 errors across 17 service modules** (66 assignment, 15 argument), and they are NOT all defects — [`database-types-baseline.md`](database-types-baseline.md) classifies them into three classes wanting opposite fixes, including sites where the generated `Insert` type demands a column that a preparation trigger fills, so "fixing" them would duplicate a value the database owns. Nothing was suppressed to land the artifact: no `@ts-expect-error`, no `as unknown as`, no widened model. Required closure is unchanged — type the client and resolve those 81 — plus the regenerate-and-diff gate, which belongs against a **local** database built from the committed migrations rather than hosted Development, because ADR 0024 makes Development trailing the repository normal and a hosted diff would fail every schema-advancing pull request. **CLOSED 10 August 2026 at AUD-10-b-ii, with two named exceptions.** All forty-six service modules are on the typed client, the untyped `supabase` export is deleted from `client.ts`, and `databaseTypeMigration.test.ts` — which counted the remainder — is deleted with it. There is no supported way to reach the database from a service module without the generated types, and `typedDatabaseClient.test.ts` guards that rather than the old count: no second client, no `as any`/`@ts-expect-error` in any service module, and the opaque `Json`-return narrowings named individually so the list cannot grow quietly. **The 81 in the sentence above is doubly superseded** — it was 27 unique once de-duplicated across TypeScript projects, 8 of which AUD-10-b-i closed, and the remaining 19 are now zero. Their classification was also wrong and is corrected in the baseline rather than swapped: there were **no** read-side errors at all; every one was an RPC argument travelling *to* the database. **The two exceptions each span a fact SQL knows and TypeScript cannot express**, hold exactly one assertion, cite the migration that establishes them and are bound to a single named table or function: `preparedInsert.ts` for the three scope columns a `before insert` trigger fills, and `rpcArguments.ts` for arguments a function's own body branches on as NULL — a PostgreSQL signature carries no nullability, so the generator can never write `| null` on one. **The finding paid for itself**: typing the client surfaced a live defect in `seasonAdmin.ts`, where an absent score was dropped by JSON serialisation, the call resolved to no function at all, and an administrator saw a PostgREST schema-cache error instead of the server's own `A season result needs both scores` refusal that the page had promised to show. No test caught it, because every test mocked the client. **What remains is `AUD-10-c` only** — regenerate-and-diff against a local database — and that guards the artifact's freshness rather than its application; `databaseTypes.test.ts` already fails the moment a migration lands without a regeneration. |
| `A11Y-001` | Assistive-technology review incomplete | **Partial; automated coverage exists, manual review remains** |
| `UX-001` | Trustworthy invite context before auth incomplete | **Partial** |
| `UX-002` | Unavailable and empty data can be conflated | **Reduced; secondary surfaces remain.** `PredictionTrendsPage`'s player-name read now tracks its own failure separately from a genuinely player-less pick and warns rather than silently falling back (2026-08-05). `AccountPage` now distinguishes a failed standings read from the pre-results state and reports a failed reminder-preference save instead of silently reverting the toggle (2026-08-06). |
| `FUNC-003` | Bonus Games rendered as absent when reference data was empty | **Resolved in production** |
| `SEC-001` | Invite/aggregate disclosure needs abuse review | **Open; aggregate minimum cohort is implemented, broader invite/abuse review remains. Reconfirmed 6 August 2026** against `20260719180000_add_leagues.sql`: codes are six characters drawn by `random()` — not a cryptographic generator — from a 31-character unambiguous alphabet. The pre-join preview accepts any authenticated caller's guess and returns league id, name, owner display name, member count and whether the caller is already a member, which is enough to confirm a hit and identify a private group. Because the join limit is a trigger on `league_members`, an invalid code consumes no rate limit, so probing is unbounded. Full characterisation stays in `ACQ-R10` and [`investigations/2026-07-30-acq-r10-invite-enumeration.md`](investigations/2026-07-30-acq-r10-invite-enumeration.md); required closure adds: at least 10 characters from cryptographically secure bytes, an atomic limiter covering previews and failed joins, minimal preview disclosure, and code rotation/revocation. **CLOSED IN THE REPOSITORY at contract 152, OPEN IN BOTH HOSTED ENVIRONMENTS, 10 August 2026.** `20260810190000_invite_code_hardening.sql` takes all four of the closure requirements this row names, and contract 145 had already taken the atomicity the limiter needed. Codes are drawn from pgcrypto's CSPRNG with **rejection sampling** and are twelve characters — the rejection matters as much as the source, because `byte % 31` is not uniform (256 = 8*31 + 8, so the first eight characters of the alphabet run 12.5% high on every character) and a biased code looks exactly as random as an unbiased one. The preview returns the league name and whether the caller is already a member, and no longer the member count or the owner's display name: those were what turned a guessed code into a positively identified private group and named a real person to whoever guessed. Both the preview and the join charge a new `league_invite_probe` limit of 20/min **before** they look a code up, which is the fix — the 5/min membership ceiling is a trigger on `league_members`, so it fired only on a SUCCESSFUL join and limited an attacker on the one action they were not attempting. `rotate_league_invite_code` is owner-only and refuses identically for a league that is not yours and one that does not exist, so rotation is not itself a probe. **Three things keep this open.** (1) Neither hosted environment holds contract 152, and no hosted claim is made. (2) `supabase/tests/201_invite_code_hardening.sql` — 16 assertions including a 200-code distribution check that fails against a modulo-biased generator — **has not been executed**: the authoring environment has no Docker daemon and no Supabase CLI. (3) **Codes already issued are untouched and remain six characters** until an owner rotates them; invalidating outstanding invitations is an operator decision with a blast radius rather than a migration's to take. Close this on the guarded fast lane applying 152, the pgTAP suite passing there, and a decision on the existing short codes. |
| `SEC-002` | Content-Security-Policy still permits inline styles | **Open, low.** `netlify.toml` sets `style-src 'self' 'unsafe-inline'`. The rest of the policy is strong — `default-src 'self'`, restricted scripts and connections, framing blocked, HSTS, nosniff, camera/microphone/geolocation disabled — and a repository search found no `dangerouslySetInnerHTML`, `eval`, `new Function`, `document.write` or direct `innerHTML`. So this is not an exploit today; it removes one layer of defence if an injection bug appears later. | Move remaining inline styles to classes or nonce/hash-approved styles, then drop `'unsafe-inline'`. Worth doing gradually rather than as one change, since a CSP tightening that breaks rendering is discovered in production. |
| `DATA-007` | Rate limiting is count-then-insert | **Open, reduced at contract 145 — the atomicity half is fixed in the repository and pending hosted apply.** `20260810010000_rate_limit_atomicity.sql` serialises a caller's limit decisions on a transaction-scoped advisory lock taken before the prune, the count and the insert, so concurrent transactions can no longer each observe a count below the threshold and all proceed; `195_rate_limit_atomicity.sql` drives the lock, the ceiling, the refusal, the recovery once the window slides and the prune, and `rateLimitParity.test.ts` fails if a later redefinition drops the lock or makes it session-scoped. **The other three quarters of the required closure remain open**, and neither hosted environment holds even the atomicity fix. Original finding, **reconfirmed 6 August 2026** in `20260720210000_rate_limits.sql`: it selects a count, compares it, then inserts, with no advisory lock or atomic counter, so concurrent transactions can each observe a count below the threshold and all proceed. Coverage is also narrower than it reads — the limits are on prediction saves (60/min) and league-membership inserts (5/min), both enforced by triggers on the *written* table, so an **invalid** league code fails before any insert and consumes no limit at all. Repeated leaderboard, profile, search and other expensive read RPCs are outside it entirely. Required closure: make enforcement atomic (locked bucket, advisory lock or atomic upsert); rate-limit invalid operations and not only successful writes; bound the expensive reads; add edge/IP controls alongside the per-user database limit; alert on repeated rate-limit and timeout exceptions. The existing API-role statement timeouts stay — production limits anonymous statements to 3 seconds and authenticated to 8. |
| `DATA-009` | Contract 104 gated the tournament-path Bonus Games recompute functions (`recompute_ko_predictor_for_match`, `recompute_lms_for_tournament`) on `completed_at is null`, so a post-completion correction silently no-opped instead of rederiving — the opposite of what the season LMS settlement job deliberately does for the identical problem | **Resolved at contract 106.** Both functions now resolve through `predictor_internal.current_public_competition_id`, which falls back to the most recently completed public instance, so a corrected result rederives after a competition ends. Proven behaviourally rather than structurally by `supabase/tests/157_terminal_aware_bonus_rederive.sql`: a completed KO Predictor competition has its result corrected and both entrants' stored scores must move to zero. Verified on development — neither function retains a `live_competition_id` call. The risk was recorded as latent and unreachable when found; contract 107 would have made it reachable, which is why it was closed first. See `docs/quality/investigations/2026-08-05-tournament-bonus-recompute-completion-gate.md` for the original trace. |
| `DOC-001` | Documentation authority can drift | **Open, reduced 6 August 2026.** Two of the named structural fixes landed: accepted-but-unbuilt requirements now have one home with stable identifiers ([`accepted-requirements.md`](accepted-requirements.md), enforced by `tests/scripts/acceptedRequirements.test.ts`), and the `DOC-AI-001`–`010` safeguards are written down in [`../ops/documentation-authorities.md`](../ops/documentation-authorities.md) beside the freshness/sweep machinery. **What remains open is the harder half:** a single small current-state surface with *generated* rather than hand-edited values. Most of these safeguards are still convention, and a convention is what drifted in the first place. **Reduced again 10 August 2026, after the generated surface itself was wrong for a day.** That surface now exists as `NOW.md`, and it reported production at contract 145 while production stood at 151 — not because anyone typed it, but because production's contract was stated in two machine files and the generator read the copy in the *development* record, which only a development rollout refreshes. `npm run check:now` regenerated from the same copy and agreed with it, so the gate certified its own error. The copy is deleted, every reader now reads `config/production-hosted-contract.json` at the point of use, and the generator and the inventory checker both refuse a development record that restates production at all. See the 10 August correction record above. The finding stays open: **a generated page is only as honest as the uniqueness of its inputs**, and that property is now enforced for exactly one fact. |
| `TEST-002` | The vNext surface conformance checklist is duplicated across eight browser specs, and has drifted between them | **Open, recorded 19 August 2026.** `e2e/vnext-*.spec.ts` is 4,662 lines with no shared module: `open` and `read` are redeclared in all eight, `expectBaseline` in four, with an identical six-assertion core. The drift is measured in [`audits/2026-08-19-vnext-programme-review.md`](audits/2026-08-19-vnext-programme-review.md) — reduced motion is asserted in two specs of eight, and `768`/`1024` appear 10 and 9 times against 58 for `1440`, so three surfaces are effectively never measured where a two-column composition forms or collapses. Closure is one shared reader and baseline plus a shared width matrix, with each spec keeping its own tail and declaring any width it opts out of. Stages 12, 13 and 15 add at least four more surfaces, so the cost of not doing it compounds. |
| `UX-006` | The vNext palette has no contrast matrix | **Open, recorded 19 August 2026.** `tests/design-system/tokenContrast.test.ts` measures every text token against every surface token in `src/styles/tokens.css` and exists because a 4.06:1 pairing shipped and was found only where a route happened to render it. Nothing measures `src/vnext/foundations/tokens.css`, whose muted text step is described in its own authority as sitting at the contrast floor. The vNext Storybook axe run is blocking and real, but it is exactly the per-story mechanism that earlier proved insufficient. Closure is the same measurement pointed at the vNext palette with its table pinned. Related to `DEC-013`; not the same item. |
| `TEST-003` | No rule covers drawn geometry, and Stage 12 draws a bracket | **Closed 19 August 2026 — the rule exists and it fails.** `src/vnext/AGENTS.md` now states the three parts together: the geometry comes from the model in one calculation, a browser spec reads the rendered coordinates back and asserts the RELATIONSHIPS against what the page itself states, and the drawing is the illustration while something semantic is the authority. `tests/vnext/vnextDrawnGeometry.test.ts` is the half that fails: a registry naming, for every vNext component that positions something by a computed coordinate, the browser spec that measures it — checked in BOTH directions, so an unregistered drawing fails and a registered file that has stopped drawing fails too, and the named spec must exist, be registered in `playwright.vnext.config.ts` so it actually runs, and contain a read of rendered geometry rather than markup alone. **Enforcement was verified by mutation rather than by the checker going quiet:** removing the registry entry, adding an unregistered bracket component, and pointing the entry at a spec that never reads a coordinate each failed the assertion written for them. A drawing whose coordinates are all literals is deliberately outside the rule — a static icon is not a calculation that can invert itself, and a gate that made the lane's future icon set answer to a chart rule would be worked around rather than satisfied. **What the guard cannot check** is whether the assertions inside the named spec are the right ones; nothing mechanical can, and the reviewer still has to ask what the coordinates are compared against. Closed before Stage 12 drew anything: no vNext Championship or bracket source existed on `main` at the time, which is the timing the finding asked for. |
| `DOC-004` | Stage 15 must audit against vNext primitives that are not enumerated anywhere | **Open, recorded 19 August 2026.** Stage 15's completion predicate requires every major Euro 2028 surface to be audited against the vNext quality and system primitives, and that shared components are reused only where their semantics match. The per-surface authorities exist and are good; the global half is distributed through `src/vnext/AGENTS.md` alongside the shell contract, the integration contract and roughly thirty invariants. An auditor would have to re-derive the list by inferring which paragraphs are reusable primitives. Closure is one short enumerated list that `src/vnext/AGENTS.md` points at. |
| `OPS-012` | The vNext and Storybook checks are not required for merge, and a merge can cancel them mid-run | **Confirmed 19 August 2026, and reclassified — the cause is a deliberate trade-off rather than an oversight.** Measured on two of this repository's own pull requests: on #910 `CI / Required merge gate` reported success at 10:44:02 and the pull request merged at 10:44:07, five seconds later, while the vNext `layout` suite was still running — it was **cancelled at 10:55:08** by that merge and never reported a conclusion on that head. #914 repeats the pattern: gate green 12:06:30, merged 12:06:30. `authenticated-browser` also completed after #910 had merged. **The cause is written down and was reasoned about.** `specs/tooling-assurance-activation/plan.md` names the constraint under *Risks to falsify* — "path-scoped workflows must not become impossible required checks; the main CI aggregate must always report a conclusion" — which is the correct GitHub concern: a required context that a `paths:` filter prevents from ever posting blocks the pull request forever. So the gate aggregates the always-running `ci` job alone, on purpose. **What remains true is the review's point:** the suite that proves a vNext stage's layout contract is not a merge condition, so the controller's stage-transition requirement that exact-head required CI is green can be satisfied while that suite is cancelled, unreported or red. **Closure is therefore NOT "add the contexts to the ruleset"** — that recreates exactly the failure the plan warned about. Either the path-scoped workflow gains a companion job that always reports a conclusion (success when its paths did not match) and *that* becomes required, or the vNext programme's own transition check verifies the layout suite's conclusion on the exact head rather than trusting the aggregate. Both are repository work; the ruleset half is an admin action in GitHub settings and cannot be performed from a session. |

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
| `TYPE-002` | Two compiler checks that catch AI-shaped mistakes are off, so absent-versus-undefined and unchecked index access are unproven | **Closed 17 August 2026 — both flags are ON, at zero errors, project-wide.** `tsconfig.app.json` sets `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`; because `tsconfig.test.json`, `tsconfig.tools.json` and `tsconfig.gates.json` all `extend` it, both reach `tests/`, `scripts/**/*.ts`, `supabase/functions/**/*.ts`, the Playwright configs and the JSDoc-checked `.mjs` deploy gates — not just `src/`. `npx tsc -b` (what `npm run build` runs, what CI runs) is clean at **zero** across every referenced project. **Enforcement is verified by mutation, not by the checker going quiet:** reverting one guard in `matchNavigation.ts` reproduces the exact original `TS2532`, and the same check was made for `exactOptionalPropertyTypes` in `SignUpForm.tsx`. `noUncheckedIndexedAccess` cost **210** errors in `src/` alone and **685** more once the downstream projects became visible. **`src/domain` was taken deliberately rather than swept**, as this row required: an unchecked `array[i]` there is a scoring or elimination question, so every genuine invariant is now a real guard that throws naming the index (`bracketHealth.ts`, `maxRemainingPoints.ts`, `cupSchedule.ts`, `betBuilder.ts`) or fails safe (`calculateLeagueRank.ts`, `scoreEvents.ts`). **Suppression was not used and the count proves it:** net non-null assertions in code across the whole change are **−3** — three pre-existing ones (`found.at(-1)!`, and `match!`/`options![1]` in `strixSecurityWorkflow.test.ts`) became real guards, and none were added. Measured excluding prose, because this row and the helper's own docstring both quote `array[0]!` as the thing not to do. No `@ts-expect-error`, no `as any`, no widened model. Test suites index through `tests/support/indexed.ts`, whose `at`/`first`/`last` fail naming the index and the length actually found, because `array[0]!` in a test reports a missing fixture as "cannot read properties of undefined" — a message about the assertion's plumbing rather than the fixture. **One honest caveat about how this was done.** Scripted passes over the test corpus introduced **23 defects** — mid-identifier splices, a swallowed assignment left-hand side, a property name captured as an expression, compound-assignment targets, and one genuine precedence change (`find() ?? staleBooks[0]` becoming `(find() ?? staleBooks)[0]`). Two survived a text-reversibility check and were caught only by the suite; the rest by targeted scans. All are repaired, the scans are clean and 5,227 tests pass, but the lesson is recorded rather than tidied away: **a reversible-looking edit is not a correct edit**, and broad scripting over arbitrary statements needs an independent check that is not the transform's own inverse. |
| `REPO-001` | Licence/changelog policy absent | **Partial** |
| `CI-002` | The vNext browser suite's serial runtime budget collides with the remaining stages | **Open, recorded 19 August 2026.** `.github/workflows/vnext-workshop.yml` states its own arithmetic — 289 tests took 21 minutes locally, Stage 9 took it to 327, the ceiling is 35 minutes — and states the remedy: parallelise the runner or split the specs, not raise it again. It runs `workers: 1` against one Storybook server because every spec measures laid-out geometry. Stages 12, 13 and 15 add at least four more surfaces. Closure is sharding by spec before Stage 13, which `TEST-002`'s shared module makes cheap. |

## Register rules

- Repository implementation, database promotion and application publication are separate closure states.
- Do not call the whole product launch-ready because the baseline is tag-ready.
- Do not retain broad findings after the concrete defect is resolved.
- Current contract truth lives in `config/deployment-contract.json`, `config/development-hosted-contract.json` and [`current-status.md`](current-status.md) — never restated here, because a restated number drifts. The recorded, fail-closed split between environments is a controlled state.
- A guard blocking incompatible deployment is a safeguard, not a defect to bypass.
- Historical audits and reconciliations remain immutable; corrections are recorded alongside them rather than rewriting history.

---

## Correction record — 19 August 2026, `UX-005` and `UX-006` closed together

Both were opened by the 19 August programme review and both are now discharged,
by owner instruction to give vNext a light option and a real icon system.

**`UX-005` — closed.** `src/vnext/foundations/tokens.css` gains a
`[data-vnext][data-vnext-theme='light']` ramp and `VNextRoot` a `theme` prop
whose precedence is a choice over the device — the half a `prefers-color-scheme`
media query cannot do, and the reason the resolution is in the component rather
than the stylesheet. The vNext Account surface carries the control, as three
answers rather than a toggle, because the third — *match my device* — is the one
a player has before they ever open the page.

**`UX-006` — closed, and it found four defects on its first run.** The palette
had never been measured, and the new
`tests/vnext/vnextTokenContrast.test.ts` immediately reported
`--vnext-text-muted` and `--vnext-rank-flat` at **4.45:1** on the interactive
hover surface, against the 4.5 floor. Both were lifted to `#8d9bb4`.

**One of that test's own assertions was wrong, and the correction is the more
useful record.** It first floored every state colour on every surface, and its
loudest failure was `--vnext-text-on-live` on `--vnext-live` at 3.21:1 — a
pairing **no component renders**. `text-on-live` named the crest monogram and
the live chip's word; the live fill is a seven-pixel dot. Changing a shipped
palette to satisfy that would have been correcting the product to match the
test. The floor now applies to the general text ramp everywhere and to state
colours on the surfaces a page actually places them on, with the whole matrix
pinned either way. (The crest half of that sentence stopped being true the same
day — see the veil record below.)

`DEC-016` and `DEC-017` move to **decided and implemented** in the deferred
register. `TEST-002`, `DOC-004`, `OPS-012` and `CI-002` are untouched and stay
exactly as opened.


## Correction record — 19 August 2026, the veil pairings nobody measured

`UX-006` closed on a table that measures **token against token**, and shipped a
gap the same size as the one it was opened for. A vNext state colour is rarely
drawn on a surface. It is drawn on **its own veil** — `.youTag` is the accent
over `--vnext-accent-veil`, `.badgeSettled` the hit over `--vnext-hit-veil` —
and a veil is `rgba(...)` composited over whatever surface the chip landed on.
The effective background is therefore a colour that appears **nowhere in
`tokens.css`**, so no token-to-token matrix can see it, however complete.

**What that hid.** The Storybook axe run failed on `--vnext-accent` at **4.45**
over `--vnext-accent-veil` on `--vnext-surface-interactive` — found because
`.youTag` happens to have a story, which is precisely the per-story mechanism
`UX-006` was opened to stop relying on. Measuring the composite properly found
that five light state colours sat under the floor, not one:

| token | was | tightest, on its own veil | now | tightest |
| --- | --- | --- | --- | --- |
| `--vnext-accent` | `#00754a` | 4.13 | `#006b44` | 4.69 |
| `--vnext-hit` | `#0c7141` | 4.36 | `#0b6b3e` | 4.69 |
| `--vnext-warn` | `#8a5300` | 4.42 | `#844f00` | 4.72 |
| `--vnext-miss` | `#b3243c` | 4.56 | `#ae233a` | 4.75 |
| `--vnext-joker` | `#7a5800` | 4.55 | `#765500` | 4.76 |

**The dark ramp needed nothing.** Its worst veil pairing is `miss` at 4.60. That
matters as evidence: the fix is not a blanket darkening applied until a test
went quiet, it is the light ramp alone, because compositing a dark veil onto a
light surface eats margin in one direction only.

**And a light-theme defect the same measurement would have caught first.**
`--vnext-text-on-live` was copied into the light block as `#ffffff` and measured
**1.33** on the live chip's own veil — white words on a near-white pill. Axe
found it; the row `text-on-live` × `live-veil` is what should have. It is now
`#0a1019`.

**`TeamCrest` was reading the wrong token, and only the light theme exposed it.**
The monogram took its colour from `--vnext-text-on-live`, which worked in dark
by coincidence — `#ffffff` on `--vnext-team-primary` — and gave white on
`#eef1f8` in light. `--vnext-team-on-primary` exists for exactly this and follows
the team ramp, which is the point of a crest. That is the correction; the token
was never about the live state.

**Why the pairing list is written out and not parsed from the CSS.** A parser
that pairs every `background-color: var(--vnext-*-veil)` rule with its `color:`
finds `LiveIndicator`'s `.indicator`, which declares `color: var(--vnext-live)`
— and would demand 4.5:1 of a token that renders **no text there**: every text
node in that chip overrides the colour, and what `--vnext-live` actually draws
is a 1px border and a 7px dot, non-text graphics at a 3:1 floor (WCAG 1.4.11)
which they clear at 3.64 worst case. Deriving the list would have washed out the
live colour to satisfy a pairing that does not exist — the identical mistake the
record above documents. The list is explicit, each row carrying the component it
was read from.

Both directions are mutation-proved: reverting `--vnext-accent` fails four rows,
and reverting `--vnext-text-on-live` reports **1.33 on `surface-interactive`**,
the same number axe printed from a real browser.

## Correction record — 19 August 2026, the external UI checklist audit

The owner asked whether `nextlevelbuilder/ui-ux-pro-max-skill` could improve
what this lane has built. It was read and applied as a checklist. Most of it
does not reach us — it targets Tailwind, shadcn and native mobile, and this lane
uses none of them — but three of its rules are stack-agnostic and worth the
audit it prompted. **One found a real defect.**

**`truncation-strategy` — "prefer wrapping over truncation; when truncating,
provide the full text" — found a defect, and the lane had already written the
rule itself.** Seven screen-level stylesheets say it in capitals: *"NO DISPLAY
NAME IS EVER CLIPPED"* (`leagues.module.css`), *"NO CLUB NAME IS CLIPPED
ANYWHERE IN THIS FILE"* (`matches.module.css`), *"A truncated name is the
defect"* (`playerProfile.module.css`). It was nonetheless false.
`typography.module.css` carried a `.truncate` helper — `white-space: nowrap`
plus `text-overflow: ellipsis` — whose only three consumers were a rival's
display name, that rival's league name, and a ladder row's player name. Exactly
the three strings the doctrine is about. They now use `.clamp2`, which every
other name in the lane already used, and the helper is gone.

Nothing had a chance of catching it. The class was declared and its key existed,
so the style-class scan was satisfied; axe has no rule for silent truncation;
and no story renders a name long enough for the browser suite to see it clip.
`tests/vnext/vnextNoNameTruncation.test.ts` closes it from the other end — the
shared typography module may not offer a single-line clipping helper at all —
and is mutation-proved in both directions.

**Its first assertion was wrong, and the correction is the useful part.** It
banned `white-space: nowrap` outright and failed on `.srOnly`, which carries it
as part of the standard visually-hidden pattern on a 1px box that is already
clipped out of the picture — it cuts nothing a sighted reader sees, and exists
to give a screen reader the *full* string. The defect was never the property. It
was clipping a name. `.srOnly` is a named exemption with that reasoning
attached.

**`color-not-only` — checked, already satisfied.** `FormRun` writes W/D/L and
carries `role="img"` with a worded label; `PredictionChip` writes "Exact score",
"Missed", "Not predicted". Neither leans on the hit/miss/warn colour alone.

**`web-target-size` (WCAG 2.2 AA, 24×24) — checked, already enforced, and not by
us.** axe-core 4.13 runs `target-size` in its default set under the `wcag22aa`
tag, which is inside the tag list `tests/vnext/vnextAxe.ts` selects and inside
the Storybook addon's default run. The lane's own 44px promise is stricter and
is separately asserted by the browser suite.

**`focus-not-obscured` (WCAG 2.2 AA) — NOT verified, and recorded as unproven
rather than fixed.** `VNextShell.module.css` has a `position: sticky; top: 0`
masthead and no `scroll-padding-block-start` anywhere in the lane, which reads
like exposure. It was probed in a real browser and the probe did not stand up:
its only hit was the masthead's *own* children, whose `top` is naturally above
the bar's bottom because they are inside it, and after that bug was fixed the
probe stopped detecting the sticky bar at all between runs. A flaky probe is not
evidence. It also cannot currently be exercised where it would matter —
`playwright.vnext.config.ts` states outright that vNext has no application
route, so the document-level scroll this criterion is about does not exist in
this lane yet. **`UX-007` is opened** for it below, owned by Stage 14, where the
shell becomes the production frame and the document becomes the scroller.

**`touch-action: manipulation` — declined, with the reason.** The skill lists it
against a 300ms tap delay that modern engines removed for any document with
`width=device-width`, which this application sets. Adding it lane-wide would be
cargo, not a fix.

| id | risk | status | closes when |
| --- | --- | --- | --- |
| `UX-007` | vNext's sticky masthead may obscure the keyboard-focused control once the shell becomes the production frame (WCAG 2.2 AA, 2.4.11) | **Open, recorded 19 August 2026.** Suspected from the CSS — sticky `top: 0` masthead, no `scroll-padding-block-start` in the lane — and deliberately NOT asserted: the browser probe written for it was unreliable and is not carried as evidence. Not currently reachable, because vNext has no application route. | Stage 14 exercises the criterion against the real document scroller and either measures it clear or adds the scroll padding, with a browser assertion that holds across runs. |

