# ADR 0026 — Public-site separation, shared accounts and Euro 2028 acquisition

- **Status:** Accepted direction — unimplemented
- **Date:** 6 August 2026
- **Amends:** [ADR 0011](0011-multi-competition-platform.md) (the shared backend may serve more than one branded frontend), [ADR 0016](0016-client-and-distribution.md) (one codebase may emit two domain-specific deployments), [ADR 0019](0019-brand-decision-deferred.md) (the purchased Euro domain is a retained tournament property, not the universal account brand), [ADR 0020](0020-football-prediction-hub-product-model.md) (`euro28predictor.com` no longer hosts the whole hub) and [ADR 0023](0023-hub-information-architecture.md) (the Hub information architecture is the weekly platform's, and Euro is not in it while hidden).
- **Supersedes:** No prior record. This is the first decision on frontend-site separation.

| Field | Value |
| --- | --- |
| Authority | Primary |
| Status | Accepted direction — unimplemented; EURO-002 has a repository Contract 143 candidate |
| Last verified | 2026-08-09 |
| Governs | How many public frontend sites exist, which domain each uses, what one account means across them, and the states through which Euro 2028 becomes visible |
| Does not govern | Scoring, locks, settlement, progression or reveal (the game ADRs); Hub route tree and page ownership ([`../architecture/hub-information-architecture.md`](../architecture/hub-information-architecture.md)); per-owner private-container limits ([ADR 0023](0023-hub-information-architecture.md) § Private containers); which brand name is chosen ([ADR 0019](0019-brand-decision-deferred.md)) |
| Supersedes | None |
| Superseded by | None |
| Related work | Issue [#272](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/issues/272) (Stage C2 data protection, open); PR [#602](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/602) first implemented EURO-002 and is superseded by the repository Contract 143 candidate carrying the same authority |
| Implementation truth | EURO-002 has a repository Contract 143 candidate: one default-hidden server state, a bounded read, an owner-only adjacent transition RPC and append-only transition history. It is not applied to hosted Development or Production. SITE-002–SITE-007, EURO-001, EURO-003, EURO-004 and AGE-001 remain unimplemented; the requirement register in [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md) tracks each clause |

## Context

Two facts about the product had never been decided together, and each was being answered by accident.

**The weekly platform and Euro 2028 want different front doors.** ADR 0020 recorded that the purchased `euro28predictor.com` domain "may host the whole private rehearsal hub during 2026/27 and should open directly into Euro 2028 when that tournament becomes the public acquisition event." That was written when there was one deployment, and it quietly makes a tournament domain the universal account brand for a year-round domestic product. A player who signs up for the Premier League should not be told their account lives at a Euro address.

**And Euro 2028 is currently visible far too early.** The weekly platform's competition catalogue lists Euro 2028 as a parked competition. Euro 2028 is the acquisition event; its prelaunch is a marketing moment the owner controls, and a half-built tournament card sitting in a domestic product's catalogue spends that moment for nothing.

ADR 0019 deferred the brand decision with a trigger and left the repository named for the tournament. That remains correct and is not reopened here. What follows is orthogonal to *which* brand is chosen: it decides how many sites there are and what an account means across them.

## Current decision

### One repository, one backend, two sites

**`SITE-001` — one repository and one shared Supabase backend serve both frontend sites.** There is no second database, no second Auth instance, no forked competition model and no duplicated game rules. Everything ADR 0011 says about a single multi-competition engine holds unchanged; a frontend deployment is a presentation boundary, not a data boundary.

**`SITE-002` — there are two separate frontend deployments.** Each has its own domain, its own build and its own release cadence. They are two builds of one codebase, differing in configuration, not two codebases.

**`SITE-003` — the weekly platform uses the eventual umbrella-brand domain**, once ADR 0019's trigger fires and a brand is chosen. Until then it has no public domain, which is consistent with it having no public cohort.

**`SITE-004` — Euro 2028 uses the purchased tournament-specific domain.** `euro28predictor.com` is retained as a tournament property. It is not the weekly platform's address and not the address an account is described as belonging to.

**`SITE-005` — no permanently diverging Euro source branch.** The Euro site is a build of `main`. A temporary release branch is permitted near the Euro launch, for the ordinary reason a release branch exists — to stabilise a dated event while trunk keeps moving — and it is short-lived and merged back. A long-lived Euro branch is the thing this clause exists to prohibit.

**`SITE-006` — both production frontend domains must be present in the Supabase Auth redirect configuration.** A confirmation, recovery or email-change link that lands on the wrong origin is a broken signup, and the allow-list is the only thing that decides. This is the same procedure ADR 0019 records for the rename — allow-list first, verify, then remove old entries — applied to two live origins rather than one replacing another.

**`SITE-007` — the transactional sender moves to the neutral umbrella brand** when the brand decision lands. Custom SMTP is configured today through the Euro 2028 Predictor domain and is working; see [`../auth-plan.md`](../auth-plan.md) § 5 for the delivered state and the transition checklist. A domestic player receiving password-recovery mail from a Euro address is a brand defect, not a delivery defect, and it is fixed by the same brand decision that fixes `SITE-003`.

### One account, two sites, no automatic membership

**`ACCOUNT-001` — one Supabase Auth account and one profile work across both sites.** There is no separate Euro account and no account linking, because there is nothing to link: it is one row.

**`ACCOUNT-002` — the same credentials work on both sites.** A player who signed up on the weekly platform signs in at the Euro site with what they already have.

**`ACCOUNT-003` — separate browser sessions are acceptable initially.** Signing in at one origin need not produce a signed-in session at the other. Seamless cross-domain handoff is assessed later on its own merits; it is a convenience with a real security surface, and buying it before there is a cohort to benefit is the wrong order. What is *not* acceptable is a second account.

**`ACCOUNT-004` — signing up joins no competition, game or private container.** This is ADR 0011's and ADR 0023's separation law restated at the new boundary, because a two-site architecture is exactly where it would be eroded: arriving through the Euro domain must not enrol anyone in Euro 2028, and arriving through the weekly domain must not enrol anyone in anything either. Following is not entry; entry is always a separate, explicit act.

**`ACCOUNT-005` — acquisition source is analytics metadata only and never authorization data.** Which domain a player arrived through may be recorded to measure acquisition. It must never appear in a policy, a grant, a visibility check or an entitlement decision. A fact kept for measurement that starts deciding access becomes an access-control mechanism nobody reviewed.

### Euro 2028 visibility is a server-owned state

**`EURO-001` — Euro 2028 is completely hidden from the weekly platform until an explicit owner-approved publication state.** Not de-emphasised, not marked "coming soon" — absent.

**`EURO-002` — the Euro site progresses through hidden, prelaunch, registration-open, live, completed and archived states.** The state is owned by the server. It is one value with one authority, so the answer to "is Euro visible?" cannot differ between two surfaces.

**`EURO-003` — while the state is hidden, Euro 2028 must be absent from** weekly landing-page content, signed-in Hub discovery, competition cards, navigation, metadata, the sitemap, Open Graph content and guessable public routes. The list is deliberately exhaustive: a competition removed from the catalogue but still reachable at a predictable URL, or still named in a share preview, is not hidden.

**`EURO-004` — visibility is enforced by the server-owned state plus route guards**, not by client-side filtering. A catalogue constant that omits a competition is a presentation choice that the next contributor can reverse without noticing; a guard that refuses the route is the control.

### The first external cohort is adults only

**`AGE-001` — the initial external cohort is restricted to users aged 18 or over.** This is an enforceable signup rule with server-side effect and matching test fixtures, not footer wording. It stands until a Children's Code and age-risk assessment supports a different model. ADR 0016 records that the product is an ordinary free application on both stores because ADR 0015 removed stake and prize; that remains true, and `AGE-001` is a deliberate cohort restriction rather than a rating consequence.

## Implemented position

EURO-002 is implemented in the repository Contract 143 candidate only. `predictor_internal.euro_publication_state` owns one default-`hidden` value, `public.euro_publication_state()` exposes only state and change time, and `public.admin_transition_euro_publication_state(...)` permits a signed-in `super_admin` to advance one adjacent lifecycle state with expected-state checking and a mandatory reason. Every successful change is written to append-only transition history. No hosted rollout is claimed.

The rest of this ADR remains unimplemented. Three things it *depends on* already exist and are not claimed as implementing the remaining clauses:

- one repository, one Supabase backend and one competition model (ADR 0011, merged);
- one Auth account with a server-created profile ([`../auth-plan.md`](../auth-plan.md) § 3, merged);
- separate, explicit game membership (ADR 0023, merged backend authorities).

## Remaining work

Every clause above except EURO-002 remains unimplemented and carries a stable identifier. [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md) is the register; it names the dependency and acceptance evidence for each. This ADR does not schedule the work — the roadmap does, once it can be edited without competing with concurrent pull requests.

## Explicitly not implemented

Stated so that no later reader mistakes a decision for a delivery:

- there is no second Netlify site, and no second-site build configuration;
- the Contract 143 repository candidate supplies the publication-state enum, current state, history and bounded RPCs, but there is no hosted apply and no EURO-004 route guard yet; the weekly Hub still lists Euro 2028 from a static catalogue;
- neither production domain is in a redirect allow-list, because neither production domain exists yet;
- there is no age field, age gate or 18+ signup rule;
- the transactional sender is still the Euro 2028 Predictor domain;
- acquisition source is not recorded at all, so `ACCOUNT-005`'s prohibition is currently vacuous and must be honoured when it stops being so.

## Dependencies and blockers

- `SITE-003` and `SITE-007` wait on ADR 0019's brand trigger — Phase 0 discovery — and cannot be scheduled before it.
- `SITE-006` cannot be completed before both domains exist, but its *procedure* is fixed now so the order is not improvised later.
- `AGE-001` and the age-risk position sit alongside, but are not blocked by, the Stage C2 data-protection review recorded in [`../architecture/stage-c1-c2-governance.md`](../architecture/stage-c1-c2-governance.md).
- `EURO-004` requires a server-owned state before the Euro prelaunch deployment is created, not after.

## Concurrent work

The repository Contract 143 candidate implements EURO-002 only; it deliberately does not change the catalogue, landing page, metadata or route guards. The Euro catalogue entry this record makes wrong lives in the Hub's static competition catalogue, which is being actively changed by other work; removing it is implementation and is deliberately not attempted here.

## Consequences

- **The weekly Hub information architecture is the weekly platform's, and Euro is not in it while hidden.** ADR 0023's route tree, onboarding and catalogue describe one site. The Euro site's surfaces are a separate, later design.
- **A second deployment doubles the deploy-time configuration surface**, not the codebase. Environment separation rules already in force apply per site: no site may point at a project it does not own, and the historic World Cup deployment stays untouched.
- **Two origins double the redirect and cookie surface.** Every authentication redirect, deep link and share URL must now name which site it means. ADR 0016's requirement that these work inside a webview is unchanged and now applies twice.
- **Euro publication becomes an operational act with a recorded approval**, not a merge. The state transition is the owner's decision; the code merely enforces whatever state is set.
- **An 18+ cohort changes signup, privacy wording and test fixtures together.** A rule enforced in one of the three is not enforced.
- **Acquisition measurement gets a hard boundary at design time**, which is cheaper than removing an authorization dependency after one has grown.
- The Euro domain remains a retained asset through the deferral period, which is the position ADR 0019 already took toward speculative domain registration.

## Rejected alternatives

- **One site serving both products, switching on the domain.** Rejected: the weekly platform and a tournament acquisition event have different audiences, different content and different launch moments, and one build serving both makes every visibility rule a runtime branch — exactly the class of control `EURO-004` refuses. It also puts the tournament brand on the domestic product's front door.
- **A permanently separate Euro source branch.** Rejected: it forks the shared backend by degrees. Every fix lands twice or lands once and is silently missing from the other, which is the failure this repository's one-engine rule exists to prevent. The temporary release branch in `SITE-005` gets the launch stability without the permanent divergence.
- **Two accounts, one per site.** Rejected: it fragments a player's identity, doubles the support surface, and makes cross-competition career state — which ADR 0020 wants — impossible to express. Nothing about two frontends requires two identities.
- **Shared cross-domain sessions from the start.** Rejected for now, not on principle: it is a genuine convenience, but it needs a security design of its own and there is no cohort yet to benefit. `ACCOUNT-003` keeps the credentials shared, which is the part that matters, and leaves the session question open on the evidence.
- **Automatically enrolling Euro-domain arrivals in Euro 2028.** Rejected: it contradicts the separation law directly and repeats the observed failure where players did not understand that games are separately entered. Arriving somewhere is not joining it.
- **Hiding Euro 2028 by removing it from the client catalogue only.** Rejected: it leaves the routes reachable and the metadata intact, so the competition is hidden from people who would not have looked and visible to anyone who would.
- **Using acquisition source to grant Euro access.** Rejected explicitly, before anyone needs it: it is the natural shortcut once the metadata exists, and it turns an analytics field into an unreviewed authorization mechanism.
- **Restricting the first cohort by territory instead of age.** Rejected: it does not address the actual concern, which is the design and data-protection obligations owed to children, and it adds per-territory operational cost for no benefit at this scale.
