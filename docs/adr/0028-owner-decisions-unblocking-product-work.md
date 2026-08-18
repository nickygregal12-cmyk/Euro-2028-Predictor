# ADR 0028 — Owner decisions unblocking remaining product work

| Field | Value |
| --- | --- |
| Status | Accepted direction — implementation pending |
| Date | 12 August 2026 |
| Decided by | Product owner |
| Supersedes | The named open product decisions below, where this ADR gives a concrete answer |
| Superseded by | None |
| Related | [0013](0013-last-man-standing-season-rules.md), [0014](0014-predictor-cup-season-formats.md), [0019](0019-brand-decision-deferred.md), [0023](0023-hub-information-architecture.md), [0026](0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md), [0027](0027-innovation-lab-backend-foundations.md), [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md), [`../product/innovation-lab.md`](../product/innovation-lab.md) |

## Why this record exists

On 12 August 2026 the owner reviewed the remaining requirements that were blocked on an owner decision and answered them in one pass. This ADR records those answers so later implementation sessions do not reopen settled product questions or treat an engineering dependency as an owner blocker.

This is a **decision record, not an implementation claim**. It adds no migration, changes no hosted environment, alters no provider secret and does not authorise bypassing the repository's normal Development or Production rollout controls. A requirement is still unimplemented until its acceptance evidence exists.

Where an existing register row still says "blocked on an owner decision" and this ADR answers that exact question, **this ADR wins** until the register is reconciled. Existing legal, security and privacy controls remain in force unless this ADR explicitly changes them.

## Decisions

### 1. Weekly umbrella brand remains deferred for now, but must be decided before public beta

> **Superseded in part by § 25 (18 August 2026).** The name is now decided —
> Predictor Hub, operationally. What survives from this section is the
> prohibition on inventing a brand to close a technical dependency, and the
> rule that public beta waits for clearance.

The owner agrees with ADR 0019's current deferral for the immediate build. Core UI and backend work must not wait for the permanent umbrella brand/domain. The permanent weekly-platform brand and domain must, however, be chosen before public beta and before neutral-branded transactional email is treated as complete.

Consequences:

- `SITE-003` remains a real future decision, but is **not a blocker for unrelated core product work**.
- `SITE-007` remains dependent on that future brand/domain decision.
- No implementer may invent the permanent brand merely to close a technical dependency.

### 2. Hub and Euro are separate frontend products over the shared backend

The weekly Hub and Euro 2028 remain separate deployments/sites over the shared repository, Supabase backend and account model. Euro tournament routes should ultimately be served only by the Euro deployment, not by the weekly Hub deployment.

The products should still cross-link **at appropriate publication states**:

- the Hub may link to Euro only when the server-owned Euro publication state permits the destination to exist;
- the Euro site may offer a route into the weekly product where it is contextually useful, including after tournament acquisition/sign-in, without merging the two products into one navigation tree;
- while Euro is hidden, the Hub must not expose a guessable or promotional Euro route merely to provide the future cross-link.

This resolves the remaining owner half of `EURO-001`: separate the route ownership by deployment, preserve the shared backend/account model, and move the preserved Euro browser journeys to the Euro build rather than deleting them.

### 3. Ordinary private leagues have a 100-member initial limit

Approve **100 members** as the initial ordinary private-league membership limit (`CAP-003`). This is an operating/product limit, not a claim that the architecture may never support larger leagues.

Larger limits may be introduced later from measured load evidence without changing the product model.

### 4. Raise the next controlled public-user stage to 250, with no permanent user-visible cap as the goal

Approve **250 public users** as the next controlled capacity stage (`CAP-006`). The long-term goal is to remove any practical user-visible signup ceiling while retaining an internal emergency circuit breaker that can be raised progressively from measured capacity evidence.

The product must therefore not be architected around 250 as a permanent maximum.

### 5. Global league capacity counts active leagues, while completed seasons are archived

Approve an initial global operating ceiling of **1,000 active leagues** (`CAP-007`). Completed/historical leagues do not continue consuming the active-league circuit breaker merely because their records are retained.

At season completion:

- the league-season becomes completed/archived and stops counting as active;
- invite capability should expire/be disabled for that completed instance;
- final member summaries should be persisted from authoritative settled data, including at minimum final position, final points and field size, with other already-approved season/honour facts where available;
- the UI may default to a compact archived summary rather than rendering the full live workspace;
- **authoritative historical prediction, settlement and result evidence is not deleted merely to reduce the active-league count**;
- archive storage should remain compact and indexed, with future partitioning/retention optimisation driven by measured scale rather than premature deletion.

This keeps permanent player/league history compatible with a scalable operational ceiling.

### 6. Championship qualification may now be designed as one consistent 5–20 entrant rule table

The owner authorises the implementation/design session to define a **consistent and fair automatic-qualification plus wildcard table for every group size from 5 through 20**, reconciling ADR 0014's target field sizes and wildcard/seeding rules.

This removes the owner-decision blocker from `CUP-001`. The exact table must still be written into the Championship rule authority and reviewed by tests before code treats it as gameplay truth; this ADR does not invent those numbers itself.

### 7. The derived season Championship group table is the sole group-stage result authority

For `CUP-005`, `predictor_internal.cup_season_group_tables` — the derived group-table path the browser already reads — remains the authority for season Championship group standings/results.

The unused per-tie stored-outcome interpretation must be retired, narrowed or otherwise prevented from becoming a second expression of the same group-stage rule. No driver should begin writing group-stage winner rows merely because `settle_season_cup_tie` exists.

### 8. Championship walkovers, withdrawals and disqualifications advance the eligible opponent without synthetic prediction points

For a knockout tie:

- if one entrant cannot legally contest the tie, the eligible opponent advances;
- the platform records the reason/audit evidence;
- it does **not** invent a football score or prediction points to manufacture the advancement;
- if neither entrant is eligible, resolution goes through an explicit rule/admin path rather than fabricating a winner from ordinary scoring.

This resolves the owner-rule blocker in `CUP-004`; the implementation still needs deterministic state transitions and tests.

### 9. A private LMS organiser may act for an explicitly managed entrant before lock

For `LMS-001`, a private Last Man Standing organiser may submit/change a pick for a **managed entrant who has no self-managed account**, provided:

- the entrant is explicitly marked as managed under the accepted private-container model;
- the action occurs before the same authoritative deadline that governs a normal entrant;
- actor and subject identities are stored distinctly;
- the action is fully auditable and idempotent where applicable;
- the organiser can never act for an ordinary self-managed player;
- no organiser path may mutate a pick after lock.

### 10. Domestic league tables follow the real competition's published rules

For `TABLE-001`, the Premier League and Scottish Premiership table configuration must reproduce the **current official governing competition rules**, not Predictor-specific invented tie-breakers.

The implementation session is authorised to verify the relevant 2026/27 official rules and store exactly the supported tie-break order and promotion/playoff/relegation boundaries. Where the database vocabulary cannot represent an official rule (for example a final playoff/same-position outcome), the implementation must model or explicitly preserve that official behaviour rather than silently substituting a different tie-breaker.

No placeholder deduction or awarded outcome may be seeded.

### 11. Public spectator leagues are approved behind one revocable opt-in visibility model

Approve the public visibility family (`INNOV-004`, and the shared foundation for `INNOV-007` and `INNOV-008`).

Private remains the default. A league owner may explicitly opt an eligible league into a revocable **public spectator** mode.

The first public allow-list may contain only product-facing fields needed for a spectator experience, such as:

- league display name;
- competition/game identity;
- player display names within that public league;
- standings and settled movement/honours;
- already-revealed prediction/result aggregates;
- fixtures and next relevant lock/deadline.

It must not expose email addresses, auth identifiers, private profile/account fields, invite secrets or unrevealed predictions. Public pages, dynamic share payloads and embeds must reuse this one visibility/allow-list authority rather than inventing separate public-security models.

### 12. Single-match guest challenges are approved, with 30-day unclaimed retention

Approve `INNOV-005` as a deliberately bounded unauthenticated acquisition path.

A recipient may submit one guest prediction through an unguessable challenge capability, with the challenger's pick hidden until the normal reveal point. The guest may later create/sign into an account and claim the challenge through an ownership-safe claim flow.

Unclaimed guest challenge data should be retained for **30 days after the fixture**, then removed or anonymised according to the implemented privacy model. Rate limiting, expiry and anti-hijack tests are required. A challenge does not silently join either player to a season game or private league.

### 13. Prediction confidence means confidence in the match outcome, on an optional 1–5 scale

For `INNOV-015`, confidence means the player's confidence that the **home/draw/away match outcome implied by their score prediction** will be correct. It does not mean confidence in the exact score.

- optional;
- bounded **1–5** scale;
- locked/immutable on the same deadline as the prediction;
- never changes points, rank or settlement;
- calibration reports must evaluate the defined result outcome rather than silently switching to exact-score accuracy.

This removes the product-definition blocker from the schema/read/write work.

### 14. Privacy-conscious product analytics are approved

Approve the controlled analytics direction already described by ADR 0009 / `MIG-UI-15`:

- explicit allow-listed/versioned events only;
- no automatic event capture;
- no session replay by default;
- no prediction contents, free text, hidden league data or arbitrary DOM capture as event properties;
- analytics remains separate from Sentry/error observability;
- processor choice, lawful basis, retention and required privacy documentation remain governed by the repository's existing privacy process.

The owner is approving analytics as a product capability, not a specific vendor in this decision.

### 15. The Personal AI Matchweek Analyst architecture is approved server-side only

Approve `INNOV-003` as a server-side explanation layer over deterministic facts.

- model/API credentials remain server-side;
- the model receives only the minimum structured context required for the requested answer;
- deterministic reads/tool outputs remain the authority for every competitive fact;
- the model has a strict tool allow-list and no arbitrary SQL/database authority;
- it cannot write predictions, results, scoring, membership or admin state;
- real-user data may be sent to a chosen model only through the repository's existing privacy/security review process for processors.

This decision does **not** create a second independent privacy-review gate. It also does not claim any existing `PRIV-*` requirement has been completed without its required evidence.

### 16. Calendar subscriptions are approved as revocable private capability URLs

Approve `INNOV-022`.

A user may generate a private, revocable and regeneratable calendar subscription carrying selected fixtures and prediction/game deadlines. The token must be unguessable, stored safely (hashed at rest where practical), and revocation must stop future access.

The feed contains **no prediction values and no private-league standings**. Calendar/timezone behaviour follows calendar standards and canonical fixture/deadline authorities.

### 17. WhatsApp is the first messaging companion target if current platform rules make it feasible

For `INNOV-009`, evaluate **WhatsApp first** rather than Discord.

Initial scope remains read/notification-only: table, next deadline and completed-matchweek/league summaries are appropriate; prediction writes through messaging are not part of the first implementation.

Before build, verify current WhatsApp Business/platform requirements, costs, webhook constraints, opt-in/message-template requirements and privacy implications. If those make a useful first release impractical, record the evidence and return for a platform decision rather than silently switching provider.

### 18. Wallet Pass is parked

`INNOV-010` is **Parked**. Do not build pass-signing infrastructure, enrolment, device registration or UI during the current programme. Preserve the candidate for possible later reconsideration; reopening requires a new owner decision.

> **Reaffirmed 18 August 2026: parked, NOT blocked.** The distinction is
> deliberate. Nothing external prevents this work — it is a deprioritisation,
> so it must not be reported as an obstacle, counted among the items awaiting
> a dependency, or picked up because a session mistook a park for a queue.

### 19. Prediction receipts are internal integrity evidence, not a user-facing product

The user-facing prediction flow should communicate ordinary submission success without exposing cryptographic hashes, technical receipt identifiers or verification machinery as a feature.

If `INNOV-017` is extended beyond the existing immutable audit trail:

- treat the cryptographic commitment as **internal integrity/audit evidence**;
- prefer one compact commitment per submitted card/set rather than large per-prediction proof payloads;
- use reviewed standard primitives and preserve pre-reveal secrecy;
- storage overhead must remain negligible relative to ordinary prediction/history data;
- do not let cryptographic-receipt work displace higher-value core product work merely because it is technically interesting.

The narrower ordinary server confirmation instant/reference (`INNOV-017a`) may still exist for operational traceability, but it should not become a prominent user-facing receipt experience.

### 20. A knockout is what happens when the field is too big for one league

**Decided 18 August 2026.** `CUP-006` asked whether `select_season_cup_format`
must RESERVE calendar for the knockout it implies rather than reporting whatever
happens to be left over. It was blocked because the answer changes what shape a
competition takes, and because ADR 0014's worked table and contract 186
contradicted each other on whether a single group ends in a knockout or a split.

**The contradiction is resolved in contract 186's favour, and ADR 0014's table
is corrected.** A single group IS a league and finishes as one. The league is
**never shortened** to make room for a bracket; a knockout is added only when the
rounds left after the full league happen to be enough for the qualifier count,
and otherwise the table decides it. The split remains what it always was — the
balance for an odd meeting count — and is not a knockout trigger.

**A multi-group competition always ends in a knockout**, because its field
cannot be one league, and its calendar is **reserved by arithmetic working
backwards** before the groups are sized.

**The consequence, shown and accepted:** whether a single group ends in a
knockout depends on how the league rounds divide the calendar, so neighbouring
field sizes end differently. Over 38 matchweeks 18 entrants reach a knockout and
19 do not; 11 do and 12 do not.

Implemented by contract 198. No qualification, seeding, bye, playoff-pairing or
Penalty Number rule moves, so ADR 0022 is not engaged. No competition is
affected on any hosted environment, because none has been launched.

### 21. A season entrant may read another entrant's settled, reveal-safe profile

**Decided 18 August 2026.** `PROF-001` asked whether entering a competition
season lets any other entrant in that season read your season profile — points,
rank, matchweeks played, accuracy counts, Joker summary and REVEALED prediction
history — as distinct from the per-matchweek comparison contract 129 already
permits. Contract 151 took `MIG-UI-02`'s recommended boundary unvaried, so the
answer was **no** by default rather than by decision.

**The answer is yes, and the reason is product symmetry rather than consent.**
Entrants in one season are already competing against each other on a shared
leaderboard; a profile assembled from what that leaderboard already shows is not
a new disclosure. This is **not** recorded as a legal consent claim, and no
implementer may cite it as one: it is a product judgement about what a
competition leaderboard implies, and any data-protection question about it
belongs to `PRIV-007`'s external review, not here.

**What does not change, and no implementation may weaken:**

- no pre-lock prediction and no unrevealed pick becomes visible — reveal
  remains gated on the matchweek's own lock, exactly as contract 149 set it;
- no private-league membership, invite code or private container becomes
  discoverable;
- nothing becomes readable across seasons, and no cross-competition public
  identity is created — `PRIV-004`'s prohibition stands;
- the boundary is the SEASON, not the platform: a player who never entered that
  season reads nothing.

### 22. The action centre ships without inventing an invitation event

**Decided 18 August 2026.** `MIG-UI-14`'s last feed item, `league_invitation`,
has no generator because an invite code is a **standing capability**, not an
event: there is nothing to key an idempotent `action_key` on, so generating from
it would either repeat for ever or require a new relation.

**Ship the action centre without it.** Under the current share-code model no
invitation event exists, and inventing one — a new relation whose only purpose
is to make an action item possible — would add a second source of truth about
league membership to serve a feed. The action centre is complete as a deadline
and consequence feed; `league_invitation` stays declared and unwritten, and the
`player_action_items_type_allowed` vocabulary keeps it so a later share model
that DOES produce an event has somewhere to put it.

### 23. Passkeys are a native-provider pilot, Hub-only, never hand-rolled

**Decided 18 August 2026.** `INNOV-021` was blocked because the candidate's own
guardrail requires the platform capability to be measured first.

**Proceed as a pilot on the authentication provider's native passkey support,
scoped to the Hub product initially.** Existing sign-in and recovery routes stay
intact and unchanged; passkeys are additive.

**No bespoke WebAuthn implementation may be attempted, in any form.** A
hand-rolled credential store is authentication cryptography, and getting it
wrong is an account-takeover class of defect. If the provider's native support
turns out not to cover a case, the answer is to stop, not to fill the gap
locally.

### 24. The provider sentinel compares sources only where they genuinely overlap

**Decided 18 August 2026.** `INNOV-019`'s cross-provider half was blocked
because only one provider is configured, so "three agree against one" has no
data to run on.

**Compare two or more sources wherever their coverage genuinely overlaps, and
fall back to single-source plausibility detection everywhere else.** Overlap is
a measured property of the fixtures each source actually covers, not an
assumption: where two sources both carry a fixture, disagreement is a signal;
where only one does, only plausibility is.

Everything continues to feed the **existing staged-proposal path** with its
administrator decision gate. This authorises no second publication path, and a
sentinel finding is never itself a result.

### 25. The weekly platform is Predictor Hub operationally, with clearance as an ops gate

**Decided 18 August 2026, superseding the deferral in § 1 of this ADR.**
`SITE-003` and `SITE-007` were deferred until a pre-public-beta brand decision.

**Use Predictor Hub as the operational name now.** Internal surfaces,
documentation, workflow and deployment naming may use it immediately, and
implementers no longer have to route around an unnamed product.

**Domain and trademark clearance is an operations gate, not an engineering
one.** Public launch, the public domain and neutral-branded transactional email
remain blocked until clearance is done. Nobody may treat operational adoption as
clearance, and no implementer may register a domain or assert a mark to close a
technical dependency — § 1's prohibition on inventing the brand survives in that
narrower form.

### 26. League honours are defined by window, minimum sample and tie rule

**Decided 18 August 2026.** `INNOV-012` was blocked because every honour was a
product definition rather than an engineering one — "Form Player" over how many
matchweeks, "Biggest Mover" against what baseline.

**Each honour must state three things before it may be implemented: the WINDOW
it is computed over, the MINIMUM SAMPLE below which it is not awarded at all,
and the TIE rule.** An honour missing any of the three is not ready to build,
and an implementer may not choose the missing one.

The minimum sample is the part that protects the feature: an honour awarded off
one matchweek is noise presented as achievement, and a league where nobody
qualifies must show no honour rather than a weak one. Ties are named explicitly
— shared, or broken by a stated ordering — never resolved by whichever row the
database returned first.

### 27. PRIV-007 remains external and cannot be self-approved

**Restated 18 August 2026, unchanged.** The UK data-protection review remains
genuinely external. It is not satisfied by analysis produced inside this
programme, by an implementer's reading of the regulations, or by an AI-generated
opinion, and no amount of internal documentation converts into it.

`PRIV-003` through `PRIV-006` therefore stay blocked, and Close Account and
erasure work stays out of scope. § 21 of this ADR is a product judgement about
what a leaderboard implies and does **not** discharge any part of this review.

## Requirements no longer blocked on an owner decision

This ADR removes the named **owner** blocker from the following work, while leaving engineering dependencies and acceptance evidence intact:

- `CAP-003`, `CAP-006`, `CAP-007`;
- `CUP-001`, `CUP-004`, `CUP-005` (and therefore allows `CUP-002`/`CUP-003` to proceed through their normal dependency chain);
- `LMS-001`;
- `TABLE-001`;
- `INNOV-003`, `INNOV-004`, `INNOV-005`, `INNOV-007`, `INNOV-008`, `INNOV-009`, `INNOV-015`, `INNOV-022`;
- `MIG-UI-15` to the extent its blocker was whether analytics is permitted at all.

`INNOV-010` is intentionally **Parked**, not unblocked.

**Updated 18 August 2026.** Sections 21 to 27 additionally remove the owner blocker from `PROF-001`, `MIG-UI-14`'s remaining feed item, `INNOV-012`, `INNOV-019`, `INNOV-021`, `SITE-003` and `SITE-007`.

`SITE-003` and `SITE-007` are no longer deferred for the NAME — § 25 decides it — but their public launch half now waits on domain and trademark clearance, which is an operations gate rather than an owner decision.

Existing `PRIV-*` requirements are not declared complete by this ADR, and § 27 restates that `PRIV-007` remains external and cannot be self-approved.

## Implementation sequencing consequence

These decisions should be consumed by the relevant frontend/backend sessions rather than implemented as one mega-change. In particular:

1. finish the Championship rules/authority cleanup before adding bracket-dependent UI;
2. use one public visibility model for spectator pages, share payloads and embeds;
3. finish the already-deployed offline-draft client before lower-value integrations;
4. implement confidence only after the 1–5 outcome definition above is represented atomically in the prediction write;
5. evaluate WhatsApp against current platform rules before committing to integration infrastructure;
6. keep Wallet Pass parked and cryptographic receipts internal/low-priority.

## What this ADR does not authorise

- no Production or Development database mutation by itself;
- no migration number or contract reservation;
- no provider/API secret change;
- no public exposure before RLS/grant/privacy tests exist;
- no model provider or analytics vendor chosen by implication;
- no permanent umbrella brand invented by an implementation session;
- no deletion of settled historical prediction/result evidence merely because a league is archived.
