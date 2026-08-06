# Accepted requirements not yet implemented

| Field | Value |
| --- | --- |
| Authority | Primary |
| Status | Active |
| Last verified | 2026-08-06 |
| Governs | The stable identifier, owning decision, dependency and acceptance evidence for every requirement that has been **accepted and is not implemented** |
| Does not govern | Current implementation or hosted state ([`current-status.md`](current-status.md) and the machine contract records); execution order ([`../roadmap.md`](../roadmap.md)); the detailed active/parked inventory ([`../../MASTER-TODO.md`](../../MASTER-TODO.md)); defects ([`risk-register.md`](risk-register.md)); deliberate postponements ([`deferred-decisions.md`](deferred-decisions.md)) |
| Supersedes | None |
| Superseded by | None |
| Related work | Issue [#272](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/272) (`PRIV-003`–`PRIV-007`); no open pull request implements any row |
| Implementation truth | Every row is unimplemented by definition. A row leaves this register when merged code, a migration, an executable test or verified hosted evidence exists for it — and it leaves by being *marked implemented here*, not by being deleted |

## What this file is for

An accepted decision that nobody implements is indistinguishable, six months later, from a decision nobody made. The ADRs record *what was decided*; the roadmap records *what happens next*; neither is a durable list of the gap between them, and requirements have been lost in that gap before.

This register is that list, and nothing else. It is deliberately short on prose: each row names the identifier, the authority that accepted it, what it waits on, and what would prove it done.

**It is not a backlog, a status report or a plan.** It states no contract number, no hosted claim and no commit — those move, and this file must not.

## Rules

- **One row per accepted, unimplemented requirement**, with a stable identifier that never changes or is reused.
- **The owning authority is the ADR or governance record that accepted it.** This register never decides anything; if a row and its authority disagree, the authority wins and this row is wrong.
- **Acceptance evidence is what would let the row be marked implemented** — a named artefact class, not a promise. "A route guard test" is evidence; "done" is not.
- **A row is marked implemented, superseded or rejected in place.** Deleting a row destroys the only trace that the requirement existed, which is the failure this file prevents.
- **Identifiers are unique across the repository.** `PRIV-001` and `PRIV-002` are already allocated in [`risk-register.md`](risk-register.md); new privacy identifiers continue from `PRIV-003`. `FEAT-*`, `PLAN-*` and `SAFE-*` belong to [`feature-baseline.md`](feature-baseline.md) and are not used here.

## Two-site architecture, shared accounts and Euro acquisition

Authority: [ADR 0026](../adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md), accepted 6 August 2026.

| ID | Requirement | Depends on | Acceptance evidence | Status |
| --- | --- | --- | --- | --- |
| `SITE-001` | One repository and one shared Supabase backend serve both frontend sites | — | Holds today; recorded so a second backend cannot be introduced without reversing an ADR | Accepted — currently true, unbuilt as a control |
| `SITE-002` | Two separate frontend deployments, each with its own domain and build | `SITE-003` for the weekly domain | A second deploy configuration producing a distinct site from one codebase | Accepted — unimplemented |
| `SITE-003` | The weekly platform uses the eventual umbrella-brand domain | [ADR 0019](../adr/0019-brand-decision-deferred.md) brand trigger (Phase 0 discovery) | Chosen brand, registered domain, site bound to it | Accepted — blocked on the brand decision |
| `SITE-004` | Euro 2028 uses the purchased tournament-specific domain | `SITE-002` | Euro site served from the retained tournament domain | Accepted — unimplemented |
| `SITE-005` | No permanently diverging Euro source branch; a temporary release branch is permitted near launch | — | Branch policy honoured at the Euro launch; no long-lived Euro branch exists | Accepted — in force as a prohibition |
| `SITE-006` | Both production frontend domains present in the Supabase Auth redirect configuration | `SITE-002`, `SITE-003` | Allow-list containing both origins, verified by a real confirmation and recovery send per origin | Accepted — unimplemented |
| `SITE-007` | The transactional sender moves to the neutral umbrella brand | `SITE-003`; [`../auth-plan.md`](../auth-plan.md) § 5 checklist | New sender domain verified, SPF/DKIM/DMARC valid, signup/recovery/email-change re-tested | Accepted — blocked on the brand decision |
| `ACCOUNT-001` | One Supabase Auth account and profile work across both sites | `SITE-002` | Same account signs in on both origins against one `profiles` row | Accepted — unimplemented (single-site today) |
| `ACCOUNT-002` | The same credentials work on both sites | `ACCOUNT-001` | Browser proof on both origins | Accepted — unimplemented |
| `ACCOUNT-003` | Separate browser sessions acceptable initially; seamless handoff assessed later | — | Recorded position; revisited by a new decision, not by drift | Accepted — in force |
| `ACCOUNT-004` | Signing up joins no competition, game or private container | — | Test asserting a new account holds zero memberships on either origin | Accepted — law holds today, unproven per-origin |
| `ACCOUNT-005` | Acquisition source is analytics metadata only, never authorization data | Recording acquisition source at all | Test asserting no policy, grant or visibility check reads the field | Accepted — vacuous until the field exists |
| `EURO-001` | Euro 2028 is completely hidden from the weekly platform until an owner-approved publication state | `EURO-002` | Weekly platform surfaces contain no Euro reference while the state is hidden | Accepted — **currently violated**: the weekly Hub lists Euro 2028 from its static catalogue |
| `EURO-002` | Server-owned publication states: hidden, prelaunch, registration-open, live, completed, archived | — | Persisted state with one authority, and a transition record | Accepted — unimplemented |
| `EURO-003` | While hidden, Euro absent from landing content, Hub discovery, competition cards, navigation, metadata, sitemap, Open Graph and guessable public routes | `EURO-002`, `EURO-004` | Each surface checked, including a direct request to a guessable Euro route | Accepted — unimplemented |
| `EURO-004` | Visibility enforced by the server-owned state plus route guards, not client filtering | `EURO-002` | Route guard refusing the route, proven by test rather than by absence from a catalogue constant | Accepted — unimplemented |
| `AGE-001` | The initial external cohort is restricted to users aged 18 or over | — | Server-side signup rule, eligibility wording and matching test fixtures | Accepted — unimplemented |

## Account closure and formal erasure

Authority: [`../architecture/stage-c1-c2-governance.md`](../architecture/stage-c1-c2-governance.md) § Stage C2, amended 6 August 2026. Tracked by issue [#272](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/272), which stays open.

`PRIV-001` and `PRIV-002` are allocated in [`risk-register.md`](risk-register.md) and are not repeated here.

| ID | Requirement | Depends on | Acceptance evidence | Status |
| --- | --- | --- | --- | --- |
| `PRIV-003` | Ordinary Close Account: delete the Auth identity and direct identifiers, clear private preferences, transfer or archive owned containers, retain only justified minimum pseudonymised history | `PRIV-007` | Closure routine, retention schedule and deterministic tests | Accepted — **hosted implementation blocked** |
| `PRIV-004` | No permanent public cross-competition former-player identity | `PRIV-003` | Placeholder is generic or competition-specific; test asserting no stable cross-competition public identifier | Accepted — blocked |
| `PRIV-005` | Formal erasure is a separate rights-request workflow with individual assessment | `PRIV-007` | Rights-request process, granular deletion path and standings recomputation | Accepted — blocked |
| `PRIV-006` | Settled Cup and LMS outcomes preserved deterministically, without restoring eliminated players or changing settled winners | `PRIV-005` | Neutral settled-outcome placeholders plus recomputation and audit tests | Accepted — blocked |
| `PRIV-007` | Qualified independent UK data-protection review, and the resulting LIA, DPIA, retention, privacy and process requirements, complete before any hosted Stage C2 change | External review | Signed independent review and the completed assessments it requires | Accepted — **blocking `PRIV-003`–`PRIV-006`; no legal approval is claimed** |

## Provider change handling

Authority: [ADR 0023](../adr/0023-hub-information-architecture.md) § Administration and provider changes, clarified 6 August 2026; [ADR 0020](../adr/0020-football-prediction-hub-product-model.md) § Ingestion.

| ID | Requirement | Depends on | Acceptance evidence | Status |
| --- | --- | --- | --- | --- |
| `INGEST-001` | An existing, correctly mapped fixture's kickoff may be revised automatically under the delivered safeguards | — | Delivered; the revision import and its rescheduled-fixture lock are merged with pgTAP coverage | **Implemented** — retained here as the boundary the rest are defined against |
| `INGEST-002` | A newly discovered fixture requires administrative approval | `INGEST-005` | Proposal queued rather than created; test proving no automatic fixture creation | Accepted — unimplemented |
| `INGEST-003` | Removal, cancellation, abandonment, material identity change or material round change requires administrative approval | `INGEST-005` | Each class routed to review; test per class | Accepted — unimplemented |
| `INGEST-004` | Ambiguous provider data fails closed | — | Delivered for the mapping and import path: an unmapped identifier fails the whole payload | **Implemented** for import; unproven for the approval workflow |
| `INGEST-005` | Approval and rejection retain provider evidence, operator, decision and resulting calendar change | `INGEST-002`, `INGEST-003` | Append-only record carrying all four, with an administrator surface | Accepted — unimplemented |
| `INGEST-006` | Provider data never becomes official result truth automatically | — | Delivered; protected confirmation/correction remains the scoring and progression gate | **Implemented** — recorded so the approval workflow cannot erode it |

## Operating limits

Authority: [ADR 0023](../adr/0023-hub-information-architecture.md) § Private containers (per-owner limits, unchanged) and § Operating-limit classes (added 6 August 2026).

| ID | Requirement | Depends on | Acceptance evidence | Status |
| --- | --- | --- | --- | --- |
| `CAP-001` | The global public-user and league ceilings are an operational circuit breaker, distinct from product limits | — | Recorded classification; the limits themselves are unchanged | Accepted — classification recorded, values unchanged |
| `CAP-002` | ADR 0023's per-owner active-container and creation-rate limits stand unchanged | — | In force server-side today | **Implemented and in force** |
| `CAP-003` | A per-league membership limit for ordinary private leagues; 100 members is a recommendation, not an approved value | Owner approval | An approved figure, then a migration and pgTAP coverage | **Recommendation — not approved, not implemented** |
| `CAP-004` | Commercial entitlement limits stay separate from the operating circuit breaker | A commercial model existing | Separate tables and authority when built | Accepted — unimplemented |
| `CAP-005` | Custom SMTP is configured through the Euro 2028 Predictor domain, so email delivery alone no longer justifies the public-user cap | — | Delivered and live-verified; see [`../auth-plan.md`](../auth-plan.md) § 5 | **Implemented**; the cap's remaining justification is `CAP-001` |
| `CAP-006` | Raising the public-user cap to 250 is the next recommended controlled test stage | Owner approval | An approved, executed change with hosted evidence | **Recommendation — not approved, not a current production change** |
| `CAP-007` | The global league ceiling should count active leagues rather than lifetime rows; 1,000 active leagues is a recommendation | Owner approval | Approved figures, an additive migration, pgTAP coverage and hosted verification | **Recommendation — not approved, not implemented** |

## Documentation safeguards

Authority: [`../ops/documentation-authorities.md`](../ops/documentation-authorities.md) § Safeguards for agent-readable documentation.

`DOC-AI-001`–`DOC-AI-010` are stated in that authority rather than duplicated here. They are rules about how this repository's documentation behaves, not product requirements, and they are enforced — where they are enforceable at all — by `scripts/check-documentation-authorities.mjs` and the tests under `tests/scripts/`.

## Supersession and history

This register was created on 6 August 2026 by the documentation reconciliation that also produced [ADR 0026](../adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md). It supersedes no prior file. Before it existed, accepted-but-unimplemented requirements were spread across ADR prose, the roadmap and `MASTER-TODO.md` without stable identifiers, which is how several were lost and later rediscovered by audit.

Linking this register from [`../roadmap.md`](../roadmap.md), [`feature-baseline.md`](feature-baseline.md) and [`../../MASTER-TODO.md`](../../MASTER-TODO.md) is deliberately deferred: all three are owned by open pull requests at the time of writing, and competing edits to a planning authority are how a requirement gets lost.
