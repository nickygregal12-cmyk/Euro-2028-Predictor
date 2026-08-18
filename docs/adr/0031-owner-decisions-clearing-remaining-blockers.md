# ADR 0031 — Owner decisions clearing remaining decision blockers

| Field | Value |
| --- | --- |
| Status | Accepted direction — implementation/operations pending where named |
| Date | 18 August 2026 |
| Decided by | Product owner |
| Supersedes | The specific owner/product-decision blockers named below; ADR 0019 only to the extent it deferred the weekly platform's working umbrella identity; ADR 0028 only where this record gives a later, more specific decision |
| Does not supersede | `PRIV-007`'s requirement for a qualified independent UK data-protection review; scoring, reveal, settlement, provider-result or Production safety authorities |
| Related | ADR 0019, ADR 0023, ADR 0026, ADR 0027, ADR 0028, `docs/quality/accepted-requirements.md`, `docs/product/innovation-lab.md`, issue #272 |

## Why this record exists

A later repository review found a small set of otherwise-ready work still described as “blocked on a decision”. The product owner has now asked for every decision that can responsibly be taken by the owner to be taken, so implementation agents can proceed without repeatedly stopping to ask the same question.

This record separates three different states that had been conflated:

1. **owner/product decision answered here** — implementation may begin through the normal reviewed path;
2. **external capability/operations gate** — preparatory implementation may begin, but hosted enablement waits for the named external fact;
3. **external legal/compliance review** — no AI or product-owner decision substitutes for the required qualified review.

Nothing in this ADR is a hosted-state claim, migration reservation, Production mutation, legal opinion or permission to weaken a safety gate.

---

## 1. `PRIV-003`–`PRIV-006`: keep `PRIV-007` as the external legal gate, not a general engineering blocker

**Decision:** `PRIV-007` remains fully open and unchanged. No AI-generated analysis, owner preference or engineering test is legal approval of the proposed account-erasure/pseudonymisation model.

Issue #272 already contains the reviewer brief and completion criteria. It remains the sole gate for the hosted Stage C2 account-deletion/erasure path.

Until a qualified independent reviewer supplies the evidence required by `PRIV-007`:

- do not implement or host the account-deletion/anonymisation routine;
- do not perform the `auth.users` → durable-profile ownership migration for that purpose;
- do not rewrite ownership RLS around the assumed deletion outcome;
- do not claim a lawful basis, retention schedule, DPIA/LIA result or legal approval.

**What is unblocked:** unrelated Stages 9–13, non-destructive UI work, read-only research, test planning and code that does not assume the outcome may proceed. The presence of `PRIV-007` must not be used as a blanket stop for unrelated product work.

**Next action:** obtain the qualified external review described by issue #272. After that review lands, reconcile `PRIV-003`–`PRIV-006` to its actual conclusion rather than to a preselected implementation.

---

## 2. `PROF-001`: same-season entrants may view each other's bounded season profiles

**Product rule:** joining a competition season makes the participant's **bounded, season-scoped, reveal-safe competitive profile** viewable by other entrants in that same competition season.

This is a product visibility rule, **not a declaration that UK-GDPR consent is the legal basis**. Privacy notice/lawful-basis wording remains subject to the repository's applicable privacy process and does not close `PRIV-007`.

The visible profile may contain only the already-defined season competitive facts, where authoritative:

- display name within that competition context;
- season rank and points;
- matchweeks played;
- settled accuracy/result statistics;
- Joker summary;
- Prediction DNA/other approved deterministic season metrics;
- **revealed/settled** prediction history;
- canonical rank history and permitted H2H/comparison facts.

It must not expose:

- pre-lock or otherwise unrevealed predictions;
- email, auth identifier, account settings or contact data;
- invite secrets;
- private-league membership/detail merely because both users are season entrants;
- a permanent cross-competition person identifier;
- a player directory, search graph, follower graph or public social profile.

Identity remains **season-scoped** and server-addressed. Display-name matching is forbidden.

**Implementation consequence:** amend the single server reach authority (`predictor_internal.season_player_reach` / its current successor) so `compare`-reachable same-season entrants become profile-reachable for this bounded payload, and prove it with pgTAP including duplicate display names, non-member refusal, cross-season refusal and reveal boundaries. Stage 10 consumes that authority; React does not widen it.

---

## 3. `MIG-UI-14` / `league_invitation`: do not invent an invitation event for share-code leagues

**Decision:** the current private-league invite model is a **standing share capability** (code/link), not a recipient-specific invitation event. Therefore `league_invitation` is **not a required action-centre kind for the current invite journey**.

The persistent Action Centre may now ship over the event-backed kinds that have real stable source events and generators. The browser consumer must not remain blocked waiting for a fake `league_invitation` event.

Current rule:

- share code/link exists → invitation is discoverable through the existing join/invite journey, not emitted repeatedly into a user's personal action feed;
- no new invitation relation is created merely to satisfy an enum entry;
- no action item is generated from a standing code because there is no idempotent recipient event to key it to.

If the product later adds **targeted invitations** to a specific account/contact, that is a new product capability and must introduce a first-class invitation entity with a stable invitation id, recipient, lifecycle/expiry and revocation. Only then may `league_invitation` be generated from that entity.

**Implementation consequence:** reconcile `MIG-UI-14` so its current completion predicate is the browser consumer plus the real event-backed kinds; mark `league_invitation` not applicable to the current share-code model rather than “missing generator”. Preserve cross-device seen/dismiss state for genuine action items.

---

## 4. `INNOV-021`: approve a native Supabase passkey pilot; prohibit bespoke WebAuthn storage

**Decision:** passkeys are accepted as an **optional account-security/sign-in convenience**, using Supabase Auth's native passkey capability only. Do not build a custom credential store, WebAuthn challenge service or cryptographic implementation.

Capability evidence checked 18 August 2026:

- Supabase documents native passkeys as an experimental capability introduced in 2026;
- the documented client requirement is `@supabase/supabase-js` 2.105.0 or newer;
- this repository currently uses a newer compatible `supabase-js` version.

Implementation may begin as a Development-only, capability-gated pilot covering:

- register a passkey from Account/Security;
- sign in with a passkey;
- list/remove the caller's passkeys using provider authority;
- password/recovery remains available;
- no custom private-key/credential material is stored by this application;
- unsupported browsers/provider states degrade to the ordinary auth flow.

**Hosted/domain gate:** WebAuthn relying-party identity is domain-bound. Do not enrol real long-lived Production passkeys until the weekly Hub's stable public relying-party domain is selected and configured, because changing the RP identity invalidates the credential relationship. The separate Euro domain must not be silently assumed to share that RP identity.

Initial rollout target is therefore **Hub-only** after the Hub domain is stable. Euro keeps the shared account's existing sign-in methods unless a later measured cross-domain design is approved.

Because Supabase currently labels the feature experimental, passkeys remain optional and reversible; they are not a launch-critical single factor.

---

## 5. `INNOV-019`: anomaly sentinel uses available-provider overlap, not an invented “three against one” quorum

**Decision:** cross-provider anomaly detection is approved where **two or more configured providers have measured overlapping coverage for the exact competition/fixture/fact being compared**.

There is no requirement for “three agree against one”. That wording is rejected because the current provider subscriptions do not provide four equivalent sources over the same competitions.

Rules:

- one proven provider → label the evidence **single-source**; no cross-provider verdict exists;
- two or more proven overlapping providers → compare normalized identity/kickoff/status/score facts that both legitimately supply;
- disagreement creates an anomaly/review item with provenance; it never automatically rewrites platform result/scoring truth;
- no provider is purchased or integrated merely to make a quorum metric look richer;
- a provider counts only after its actual configured subscription and endpoint have been measured through the controlled custody path;
- comparisons are fact-specific: calendar overlap does not imply lineup, score or status overlap.

SportMonks, football-data.org and API-Football keep their measured capability boundaries. SportDB remains a candidate until a controlled adapter and actual-account measurement exist.

**Implementation consequence:** the existing sentinel/provider-review foundation may proceed now with an `availableSources`, `sourceCount`, `agreementState` (`single_source`, `agree`, `disagree`, `insufficient_comparable_data`) model and deterministic source provenance. No UI should say “verified by multiple providers” unless at least two comparable observations exist.

---

## 6. `SITE-003` / `SITE-007`: use **Predictor Hub** as the operational umbrella identity; keep external clearance/domain registration as a pre-public gate

**Decision:** the weekly product's working umbrella identity is now **Predictor Hub**. Engineering, design, configuration and neutral transactional copy may use that name instead of waiting for another naming workshop.

This decision removes the brand-name choice from the engineering critical path. It does **not** claim trademark/domain/app-store clearance or ownership of any particular domain.

The external public identity must remain configurable rather than scattered as hard-coded strings.

### `SITE-003`

Implementation may now build and test the weekly site under the `Predictor Hub` brand. The **final public domain** becomes an operations/clearance task:

1. perform the clearance checks already required by ADR 0019 (UK trade mark, Companies House/use in trade, app-store names and domain);
2. select and register a clean stable umbrella domain compatible with the brand or, if the exact name cannot be cleared, return only the external naming/domain choice for revision — do not reopen product architecture;
3. bind the weekly deployment and configure canonical origin/auth redirects;
4. retain `euro28predictor.com` as the separate tournament property under ADR 0026.

Until that domain is registered, use configuration/placeholders for origin-dependent work rather than inventing a domain in code.

### `SITE-007`

Transactional-email work is now **implementation-ready in all brand-agnostic respects**:

- sender display name/copy = Predictor Hub;
- templates/configuration use the site-brand authority rather than hard-coded Euro naming;
- sender-domain setup, SPF, DKIM, DMARC and real signup/recovery/email-change verification execute once the stable Hub domain is registered.

Thus `SITE-007` is no longer blocked on “what should the brand be”; its remaining gate is the concrete domain/DNS operations step.

---

## 7. `INNOV-012`: deterministic League Side Honours definitions

League Side Honours are presentation/recognition only. They never change official points, standings order, qualification, settlement or awards.

All calculations use only settled/revealed authoritative season data. Ties are **shared** unless a deterministic tie rule is named below; never invent an alphabetical winner.

### Exact Score King

Season-to-date entrant(s) with the most exact-score hits across settled Match Predictor fixtures.

### Form Player

Entrant(s) with the most official Match Predictor points across the **latest five completed matchweeks**. If fewer than five matchweeks have completed, use all completed matchweeks. Tie-break within the same window: more exact scores, then more correct results; if still tied, share the honour.

### Biggest Mover

Largest positive change in canonical rank from the immediately previous completed matchweek to the latest completed matchweek. If fewer than two completed matchweeks exist, the honour is unavailable. Ties are shared.

### Draw Specialist

Most correctly predicted draw **results** season-to-date, minimum **3** correct draws. Ties are shared. This counts the result, not an exact draw score.

### Goals Guru

Lowest mean absolute error between predicted total goals and actual total goals over settled predictions, minimum **10** eligible predictions. Compare using the unrounded underlying metric; ties at the stored/computed precision are shared.

### Contrarian

Most correct result predictions season-to-date where, at the prediction's reveal-safe consensus snapshot, the chosen outcome was backed by **20% or fewer** of the qualifying cohort and the existing minimum-cohort privacy rule was satisfied. If authoritative consensus is unavailable, that fixture does not count. Ties are shared.

### Comeback of the Season

Largest improvement from the entrant's **worst canonical rank reached from Matchweek 3 onward** to their final/current canonical rank, available only once at least **5 matchweeks** have completed. Ties are shared.

Negative/humiliating honours remain out of scope by default.

**Implementation consequence:** publish these definitions beside the feature, calculate from canonical reads/server derivations where practical, add deterministic tie/sample tests, and omit an honour when its minimum sample is not met rather than inventing a winner.

---

## 8. `INNOV-010`: Wallet Pass stays parked and must stop appearing as an active blocker

ADR 0028 §18 is reaffirmed.

`INNOV-010` is **Parked / not planned in the current programme**. It is not an implementation blocker and should not appear in lists of work waiting for an owner decision.

Do not build pass-signing, push-update, wallet enrolment or device-registration infrastructure now. Reopening requires a later explicit owner decision after the core products/cutovers are complete or after a concrete distribution case makes the cost worthwhile.

---

## Implementation sequencing

These decisions are intentionally consumed by their owning lanes rather than one mega-feature branch:

1. Stage 9/10 may consume `PROF-001` after the server reach rule is updated and typed;
2. the Action Centre consumer may proceed without `league_invitation` under the current share-code model;
3. passkey Development pilot may proceed, but Production enrolment waits on a stable Hub RP domain;
4. anomaly sentinel may proceed using measured provider overlap and honest single-source states;
5. Side Honours may proceed under the definitions above;
6. brand/config/template work may proceed as Predictor Hub; domain/DNS clearance remains an ops gate;
7. Wallet Pass does not consume engineering time;
8. `PRIV-007` remains an external legal gate and no implementation may assume its answer.

## Acceptance evidence expected

A row should not be called implemented merely because this decision exists.

- `PROF-001`: migration/read-authority delta + pgTAP + generated types + connected profile proof.
- `MIG-UI-14`: persistent browser consumer over canonical action feed with cross-device seen/dismiss tests; no fake invite action.
- `INNOV-021`: provider-native Development passkey register/sign-in/remove proof plus password/recovery fallback and domain/RP guard.
- `INNOV-019`: deterministic comparable-provider agreement/disagreement fixtures plus single-source state and no automatic result mutation.
- `SITE-003/007`: brand-config adoption; later registered/cleared domain, DNS sender records and real auth-email tests.
- `INNOV-012`: published deterministic definitions and fixtures proving ties/minimum samples.
- `PRIV-003`–`PRIV-007`: only the qualified external-review evidence specified in issue #272 can advance the hosted account-erasure path.
