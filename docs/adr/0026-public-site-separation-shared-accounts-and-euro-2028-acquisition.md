# ADR 0026 — Public-site separation, shared accounts and Euro 2028 acquisition

- **Status:** Accepted direction — partially implemented
- **Date:** 6 August 2026
- **Amends:** [ADR 0011](0011-multi-competition-platform.md) (the shared backend may serve more than one branded frontend), [ADR 0016](0016-client-and-distribution.md) (one codebase may emit two domain-specific deployments), [ADR 0019](0019-brand-decision-deferred.md) (the purchased Euro domain is a retained tournament property, not the universal account brand), [ADR 0020](0020-football-prediction-hub-product-model.md) (`euro28predictor.com` no longer hosts the whole hub) and [ADR 0023](0023-hub-information-architecture.md) (the Hub information architecture is the weekly platform's, and Euro is not in it while hidden).
- **Supersedes:** No prior record. This is the first decision on frontend-site separation.

| Field | Value |
| --- | --- |
| Authority | Primary |
| Status | Accepted direction — partially implemented; EURO-001–EURO-004 are implemented in the repository, with EURO-002 hosted in Development and the Development publication state still `hidden` |
| Last verified | 2026-08-10 |
| Governs | How many public frontend sites exist, which domain each uses, what one account means across them, and the states through which Euro 2028 becomes visible |
| Does not govern | Scoring, locks, settlement, progression or reveal (the game ADRs); Hub route tree and page ownership ([`../architecture/hub-information-architecture.md`](../architecture/hub-information-architecture.md)); per-owner private-container limits ([ADR 0023](0023-hub-information-architecture.md) § Private containers); which brand name is chosen ([ADR 0019](0019-brand-decision-deferred.md)) |
| Supersedes | None |
| Superseded by | None |
| Related work | Issue [#272](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/272) (Stage C2 data protection, open); Contract 143 introduced EURO-002; PR #627 implemented the fail-closed EURO-004 route consumer |
| Implementation truth | Contract 143 is hosted in Development and owns one default-hidden server publication state, bounded state read, owner-only adjacent transition RPC and append-only history. Repository code now removes Euro from the weekly/public surfaces covered by EURO-001/EURO-003 and guards Euro-only player routes through that server state. Production remains on Contract 132 and the current production application artifact has not been claimed to contain the new guard. SITE-002–SITE-007 and AGE-001 remain unimplemented; the requirement register in [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md) tracks each clause |

## Context

Two facts about the product had never been decided together, and each was being answered by accident.

**The weekly platform and Euro 2028 want different front doors.** ADR 0020 recorded that the purchased `euro28predictor.com` domain could host the private rehearsal hub during 2026/27 and later open directly into Euro 2028. That made sense before the product became a year-round domestic platform, but it would make a tournament domain the universal account brand for Premier League and Scottish Premiership players.

**Euro 2028 must remain invisible until its publication moment.** The acquisition event should not leak through a parked catalogue card, landing copy, metadata or a guessable route before the owner deliberately advances publication state.

ADR 0019 still owns the future umbrella-brand decision. This ADR is orthogonal to which brand wins: it decides how many sites there are, what one account means across them, and how Euro publication is controlled.

## Current decision

### One repository, one backend, two sites

**`SITE-001` — one repository and one shared Supabase backend serve both frontend sites.** There is no second database, Auth instance, competition model or duplicated game-rule engine. A frontend deployment is a presentation boundary, not a data boundary.

**`SITE-002` — there are two separate frontend deployments.** Each has its own domain, build and release cadence, but both are builds of one codebase.

**`SITE-003` — the weekly platform uses the eventual umbrella-brand domain** once ADR 0019's brand trigger fires.

**`SITE-004` — Euro 2028 uses the purchased tournament-specific domain.** `euro28predictor.com` remains a tournament property rather than the weekly platform's universal account address.

**`SITE-005` — no permanently diverging Euro source branch.** A short-lived release branch near launch is allowed; a permanent Euro fork is not.

**`SITE-006` — both production frontend domains must be present in the Supabase Auth redirect configuration.** Confirmation, recovery and email-change links must land on the correct origin.

**`SITE-007` — the transactional sender moves to the neutral umbrella brand** once that brand exists.

### One account, two sites, no automatic membership

**`ACCOUNT-001` — one Supabase Auth account and one profile work across both sites.** There is no second Euro identity.

**`ACCOUNT-002` — the same credentials work on both sites.**

**`ACCOUNT-003` — separate browser sessions are acceptable initially.** Seamless cross-domain handoff is a later security/convenience decision.

**`ACCOUNT-004` — signing up joins no competition, game or private container.** Arrival through a domain is not membership.

**`ACCOUNT-005` — acquisition source is analytics metadata only and never authorization data.**

### Euro 2028 visibility is a server-owned state

**`EURO-001` — Euro 2028 is completely hidden from the weekly platform until an explicit owner-approved publication state.** Not de-emphasised or marked coming soon: absent.

**`EURO-002` — the Euro site progresses through hidden, prelaunch, registration-open, live, completed and archived states.** The server owns one value and one transition authority.

**`EURO-003` — while hidden, Euro 2028 is absent from** weekly landing content, signed-in Hub discovery, competition cards, navigation, metadata, sitemap, Open Graph content and guessable public routes.

**`EURO-004` — visibility is enforced by the server-owned state plus route guards**, not by catalogue filtering alone.

### The first external cohort is adults only

**`AGE-001` — the initial external cohort is restricted to users aged 18 or over.** This remains an enforceable signup requirement, not footer wording.

## Implemented position

The Euro publication boundary is now materially implemented.

- **EURO-002 / Contract 143:** `predictor_internal.euro_publication_state` owns one default-`hidden` value; `public.euro_publication_state()` exposes only state and change time; `public.admin_transition_euro_publication_state(...)` permits a signed-in `super_admin` to advance one adjacent lifecycle state with expected-state checking and a mandatory reason; successful changes are written to append-only transition history. The guarded Development rollout applied Contract 143 as part of the Development-to-144 batch, and a fresh read on 10 August 2026 still returned `hidden`.
- **EURO-001 / EURO-003:** Euro has been removed from the weekly/public catalogue and discovery surfaces covered by the requirement register, landing/prototype content and static metadata. Euro-only player routes remain mounted only inside the tournament boundary and are no longer reachable while hidden.
- **EURO-004:** `TournamentJourney` consumes `euro_publication_state()` before mounting tournament data or predictions for player-facing Euro routes. `hidden` and unreadable publication truth fail closed to the weekly Hub. Executable tests prove hidden refusal, read-failure refusal, access after publication advances, and the separately authorised `/admin/results` preparation exception.

This is repository and Development implementation truth, not a Production release claim. Production is still Contract 132 and the currently served Netlify production artifact predates the guarded route consumer. The database promotion and application release remain separately controlled.

The rest of this ADR is not thereby implemented. SITE-002–SITE-007, ACCOUNT-001/002 as a two-origin proof, ACCOUNT-004 per-origin proof, ACCOUNT-005 once acquisition metadata exists, and AGE-001 remain future work.

## Remaining work

[`../quality/accepted-requirements.md`](../quality/accepted-requirements.md) remains the stable register for every clause. Implemented rows stay in place and are marked implemented rather than deleted.

The next architectural work is not another Euro visibility state. The remaining work is the two-site build/domain/auth-release boundary, the future brand transition, the adult-cohort gate, and the production promotion/release required before the merged Euro guard can be claimed live.

## Explicitly not implemented

- there is no second Netlify site or second-site build configuration;
- no future umbrella weekly-platform domain has been selected or bound;
- both future production frontend origins are not yet proven in the Auth redirect allow-list;
- there is no age field, age gate or 18+ signup rule;
- the transactional sender is still the Euro 2028 Predictor domain;
- acquisition source is not recorded;
- Production has not yet been promoted from Contract 132 to Contract 144, so Contract 143's publication authority is not claimed hosted there;
- the current production application artifact is not claimed to contain PR #627's route guard.

## Dependencies and blockers

- `SITE-003` and `SITE-007` wait on ADR 0019's brand trigger.
- `SITE-006` cannot be completed before both domains exist, although its migration procedure is fixed now.
- `AGE-001` sits alongside the Stage C2 data-protection work but is not automatically satisfied by it.
- Production use of the merged route guard depends on the repository-controlled Production database promotion reaching Contract 143 or later first, followed by a compatible application release.

## Consequences

- **The weekly Hub information architecture is the weekly platform's, and Euro is not in it while hidden.**
- **A second deployment doubles deploy-time configuration surface, not the codebase.** Environment separation rules apply per site.
- **Two origins double the redirect and cookie surface.** Every auth redirect, deep link and share URL must name its intended site.
- **Euro publication is an operational act with a recorded approval, not a merge.** Code enforces the server state; an owner changes that state.
- **An 18+ cohort changes signup, privacy wording and fixtures together.**
- **Acquisition metadata has a hard no-authorization boundary.**

## Rejected alternatives

- **One site serving both products by switching on the domain.** Rejected because the weekly platform and Euro acquisition event have different audiences and release moments; it would make every visibility rule a runtime presentation branch.
- **A permanently separate Euro source branch.** Rejected because it forks the shared engine by degrees.
- **Two accounts, one per site.** Rejected because it fragments identity and cross-competition history.
- **Shared cross-domain sessions from the start.** Rejected for now; shared credentials matter first, while seamless handoff deserves its own security design.
- **Automatically enrolling Euro-domain arrivals in Euro 2028.** Rejected because arrival is not membership.
- **Hiding Euro only by removing it from a client catalogue.** Rejected because routes and metadata can still leak the tournament; the delivered server-state route guard exists specifically to prevent that class of drift.
- **Using acquisition source to grant Euro access.** Rejected because analytics metadata must never become an authorization mechanism.
- **Restricting the first cohort by territory instead of age.** Rejected because it does not address the child-data/design concern and adds operational complexity.