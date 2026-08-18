# vNext stage contracts — Stages 9–15

**Status:** stable programme-scope contract. This file defines what each remaining stage is for, what it must deliver before it can be called complete, and what it must not absorb. It does **not** freeze implementation details, backend contracts, route SHAs or hosted state; those are re-read from their current authorities when a stage starts.

**Programme controller:** [`vnext-programme-controller.md`](vnext-programme-controller.md)
**Machine state:** [`../../config/vnext-programme.json`](../../config/vnext-programme.json)
**Primary UI authority:** [`ui.md`](ui.md)
**Selected shell authority:** [`vnext-shell-ia.md`](vnext-shell-ia.md)
**Route inventory:** [`vnext-route-migration-matrix.md`](vnext-route-migration-matrix.md)

The agent must use these contracts as the stable answer to **“what is Stage N?”** and then derive the exact implementation plan from current `main`, current tests, current product/backend authorities and capabilities that have actually merged.

---

## Common rules for every stage

Every stage must:

1. preserve the Competition Deck hierarchy established by Stage 7.6 unless a later explicit product authority supersedes it;
2. use current server/domain authorities rather than reconstructing scoring, locks, reveal, settlement, rank, membership or progression in presentation code;
3. keep generated database/provider types out of the visual tree through a source → pure presentation mapper → model → visual surface boundary where applicable;
4. work at 375, 430, 768, 1024, 1440 and 1920 where the surface is responsive;
5. preserve one `<main>`, accessible navigation/focus, 44×44 interactive targets, reduced motion and the current vNext accessibility authority;
6. avoid production cutover until Stage 14;
7. use exact-head validation and independent review before the stage becomes `merged`;
8. update the route migration matrix for every route whose target fate is decided by that stage;
9. leave optional enrichment optional rather than inventing missing server truth;
10. not mark the stage complete because one sub-PR merged if the stage completion predicate is still unmet.

---

## Stage 9 — Leagues

### Mission

Build the vNext **people-I-compete-with** layer inside the active football competition, without turning Leagues into Player Profiles or a social network.

The shell question is:

> **Who am I competing against here, and where do I stand?**

### Stage 9 owns

- the competition-scoped `Leagues` destination;
- global/overall standings for the current competition/game where authority exists;
- private league discovery/listing for leagues the player can legitimately see;
- private league switching and selected-league context;
- private league standings;
- the current player's position and useful neighbourhood/context;
- authoritative rank movement where the backend already supports it;
- empty/new-player/no-private-league states;
- clear separation between football competition, prediction game and people/league context;
- clickable player-row entry points **only** when current server identity/permission authority can safely address the destination.

### Stage 9 does not own

- full player profile design;
- player-v-player H2H;
- rank-over-time profile graphs;
- player search/directory;
- follower/friend systems;
- LMS gameplay;
- Championship gameplay;
- scoring/rank logic changes.

### Minimum completion predicate

Stage 9 is not complete until:

- global and private league experiences have deliberate vNext presentations;
- ordinary single-league and multi-league users can understand which league/game/competition they are viewing;
- standings use canonical ordering and do not compute ranks independently in React;
- current-player emphasis and useful rank context work at phone and desktop widths;
- player row navigation is either real and server-authorised or deliberately absent, never display-name-derived;
- real connected global/private league reads are proven;
- no N+1 profile/player lookup is introduced;
- relevant route-matrix rows are resolved;
- exact-head tests/browser/CI and independent review are green.

### Transition to Stage 10

Stage 9 should leave clear, authorised **entry points to a player** where possible, but Stage 10 owns what the player sees after opening one.

---

## Stage 10 — Player Profiles + H2H

### Mission

Build the competition-season player identity and comparison experience so a participant can understand another permitted player's performance **without leaking unrevealed predictions or creating a global social network**.

The product questions are:

> **Who is this player?**
>
> **How are they performing?**
>
> **How do we compare?**

### Stage 10 owns

- vNext season/competition player profile presentation;
- current rank, total points and other canonical summary metrics the server exposes;
- Prediction DNA where authoritative;
- reveal-safe settled prediction history;
- true rank-position-over-time visualisation when the backend provides canonical rank history;
- player-v-player H2H/comparison using the weekly-season authority rather than tournament-shaped assumptions;
- recent settled matchweek comparison;
- exact-score/correct-result comparison where the backend exposes it canonically;
- private/shared league context where permission allows;
- loading/error/refusal states for users the caller is not permitted to inspect.

### Stage 10 does not own

- player search or directory;
- followers/following;
- friend requests;
- public cross-competition identity graph;
- direct messages/activity feed;
- widening privacy rules in React;
- revealing current/unlocked predictions early;
- recomputing rankings or H2H client-side from downloaded histories.

### Minimum completion predicate

Stage 10 is not complete until:

- a safely addressable permitted player can be opened from at least one real competition context;
- unauthorised/refused profile access is represented honestly;
- current/unrevealed predictions cannot leak through profile or H2H UI;
- settled history follows the server reveal boundary;
- rank-over-time plots actual canonical rank, not just points;
- H2H is weekly-season-shaped and bounded rather than one RPC per matchweek;
- mobile and desktop graph/comparison layouts are readable and accessible;
- two players with the same display name cannot be confused by UI identity;
- exact-head tests/browser/CI and independent review are green.

### Transition to Stage 11

Profiles/H2H establish the people dimension. Stage 11 returns to the `Games` destination and proves that a structurally different game format can live cleanly inside the same shell.

---

## Stage 11 — Last Man Standing

### Mission

Build Last Man Standing as a **first-class game**, not a Match Predictor reskin.

The core mental model is:

> **One consequential pick → survive or be eliminated.**

### Stage 11 owns

- LMS game landing/overview inside the active football competition;
- current round and deadline state;
- eligible team/fixture pick flow using authoritative eligibility;
- teams already used and unavailable reasons where supplied;
- pick submission through the existing write authority;
- locked/pending/settled round states;
- alive, eliminated and winner states;
- survival streak/round history where authoritative;
- player pool remaining/league standing context where real;
- private LMS league/container presentation where current authority permits;
- clear route from `Games` → `Last Man Standing`.

### Stage 11 does not own

- Match Predictor score-entry redesign;
- Championship brackets;
- invented team eligibility;
- client-derived deadline/lock authority;
- player profile expansion;
- new LMS scoring/progression rules.

### Minimum completion predicate

Stage 11 is not complete until:

- the one-pick survival mental model is visually and interactionally distinct from Match Predictor;
- an eligible player can make a real LMS pick through the canonical mutation authority;
- used/ineligible teams cannot be made selectable by presentation shortcuts;
- lock/deadline states come from authority, not browser inference;
- survive/eliminated/winner states are proven with deterministic worlds and real connected reads;
- private and ordinary LMS contexts do not become confused with Match Predictor leagues;
- mobile one-handed pick flow and desktop presentation meet accessibility/responsive quality bars;
- exact-head tests/browser/CI and independent review are green.

### Transition to Stage 12

Stage 11 proves one non-score-prediction game. Stage 12 builds the more complex competition-within-a-competition format.

---

## Stage 12 — Predictor Championship

### Mission

Build the complete player-facing Predictor Championship experience over the canonical Championship backend: qualification/group or league phase, knockout progression, bracket/tie state and Penalty Number where required.

The product question is:

> **Where am I in this Championship, what must I do next, and how can I win it?**

### Stage 12 owns

- Championship game overview inside `Games`;
- current format/phase presentation;
- group/league standings where applicable;
- qualification status and cut line where authoritative;
- current tie/opponent;
- knockout bracket/progression;
- bye/walkover/withdrawal/disqualification outcomes as supplied by canonical state;
- Penalty Number requirement/submission/status through the existing authority;
- eliminated/finalist/champion states;
- relevant Championship attention/deadline entry points if the action backend supports them by then;
- private Championship container/league context where current authority permits.

### Stage 12 does not own

- reselecting Championship format client-side;
- recomputing bracket arithmetic;
- inventing scores/points for walkovers;
- changing qualification/seeding/bye rules;
- exposing secret Penalty Numbers early;
- tournament predictor redesign.

### Minimum completion predicate

Stage 12 is not complete until:

- a launched Championship can be understood from its canonical player-facing read without reconstructing its bracket in React;
- every supported phase has a deliberate UI state;
- Penalty Number requirement/write/reveal behaviour is authoritative;
- deterministic walkover/withdrawal/disqualification outcomes are displayed without fake football scores or points;
- insufficient-calendar launch is a backend refusal, not something the UI tries to repair;
- bracket layout works on phone and desktop without becoming unreadable;
- eliminated/champion/no-action-required states are complete;
- real connected Championship data is proven;
- exact-head tests/browser/CI and independent review are green.

### Transition to Stage 13

After Stage 12, all headline competition/game/people surfaces are expected to have vNext treatment. Stage 13 closes the remaining user-facing product gaps before cutover.

---

## Stage 13 — Supporting Surfaces

### Mission

Complete the non-headline user journeys and route-matrix obligations so vNext is a coherent application rather than a collection of excellent core pages.

### Stage 13 owns

A route/inventory-driven sweep of supporting user-facing surfaces, including where still applicable at that point:

- Account / You presentation and settings;
- onboarding/welcome presentation;
- competition discovery/catalogue;
- join/follow/favourite presentation over existing authority;
- How to Play / rules navigation;
- action/attention centre presentation once its backend coverage is truthful enough;
- invitation/join-code flows that already have canonical authority;
- generic loading, empty, error, not-found and access-refused states;
- remaining share/help/utility surfaces that the current route migration matrix says survive;
- deletion/redirect/hide decisions for legacy user-facing routes not already resolved.

The exact list is derived from the **current route migration matrix at Stage 13 start**; this stage must not silently omit a route because it was not named in this file.

### Stage 13 does not own

- new social-network features;
- speculative analytics/vendor adoption;
- backend/legal work still explicitly blocked;
- Production routing cutover;
- arbitrary redesign of admin surfaces unless the current programme authority explicitly includes them.

### Minimum completion predicate

Stage 13 is not complete until:

- every remaining user-facing route in the migration matrix has an intentional target fate;
- all retained/merged/absorbed supporting journeys needed for cutover have viable vNext presentation;
- new-user onboarding → competition/game entry is coherent;
- account/discovery/help/error states no longer fall back accidentally to an unrelated visual system where the target IA says they belong to vNext;
- action/attention UI only claims event classes the backend can actually produce;
- no legally blocked or absent backend capability is papered over in presentation;
- exact-head tests/browser/CI and independent review are green.

### Transition to Stage 14

Stage 13 should leave no known **frontend product-surface** blocker to making vNext the Football Hub application. Stage 14 is the controlled engineering cutover, not another creative redesign stage.

---

## Stage 14 — Football Hub Production Cutover

### Mission

Make the accepted vNext Football Hub the production application safely, preserving authentication, deep links, existing game truth and rollback capability.

This stage has two distinct states:

1. **READY FOR CUTOVER** — autonomous engineering can reach this state;
2. **CUT OVER AND VERIFIED** — requires explicit authority for the actual Production mutation.

### Stage 14 owns

- final route migration implementation for the Football Hub;
- legacy → vNext redirect/compatibility behaviour;
- authentication/session boundaries;
- deep-link and browser-history verification;
- production bundle/performance/accessibility regression;
- production error-monitoring readiness;
- removal/retirement plan for superseded legacy frontend code;
- staged deployment/rollback plan;
- pre-cutover smoke evidence;
- the actual production switch **only when explicitly authorised**;
- post-cutover production verification.

### Stage 14 does not own

- creative redesign of already accepted vNext surfaces;
- scoring, lock, reveal, settlement or provider changes merely to ease cutover;
- silently changing Production without the explicit gate;
- deleting recoverable legacy code before rollback safety is proven.

### Minimum completion predicate

Before `READY FOR CUTOVER`:

- every Football Hub route has an intentional production behaviour;
- no required user journey depends on the workshop/dev harness;
- production build contains the intended vNext surfaces and only intentional legacy compatibility;
- auth, refresh, deep-link, navigation and error paths are tested;
- accessibility/performance/bundle regression is acceptable;
- monitoring and rollback are ready;
- current required CI/review is green.

Before Stage 14 can be `merged/complete` as a cutover:

- explicit Production authority for the exact action/target exists;
- the cutover executes through the authorised deployment path;
- post-deploy smoke/route/auth checks pass;
- rollback remains available until the defined confidence gate is satisfied;
- actual Production state is recorded truthfully.

### Transition to Stage 15

Stage 15 starts from a proven production Football Hub design system and asks what should be shared with the separate Euro 2028 tournament product. It is not permission to erase tournament-specific behaviour.

---

## Stage 15 — Euro 2028 vNext Adoption

### Mission

Apply the proven vNext design system and shared football/product primitives to the Euro 2028 tournament experience while preserving the tournament-specific predictor, groups, knockout and scoring authorities.

The goal is **convergence where the products genuinely share concepts**, not forcing the Football Hub IA onto a tournament product.

### Stage 15 owns

- audit of reusable vNext primitives/components/models from the Football Hub;
- Euro 2028 application shell/navigation adaptation where appropriate;
- tournament Home/overview visual adoption;
- tournament Matches/Match Centre reuse where compatible;
- tournament leagues/player/profile primitives where the same authority truly applies;
- groups presentation;
- tournament knockout/bracket presentation;
- tournament predictor presentation under its existing scoring/reveal rules;
- champion/group-position/knockout-specific prediction surfaces that are unique to the Euro product;
- deliberate decisions on which Football Hub patterns are shared, adapted or rejected.

### Stage 15 does not own

- replacing tournament scoring with weekly-season scoring;
- treating tournament groups as domestic-league matchweeks;
- applying Season Championship/LMS rules to Euro 2028;
- deleting tournament-specific authority because a Hub component looks similar;
- broad backend rewrite without a demonstrated consumer requirement.

### Minimum completion predicate

Stage 15 is not complete until:

- every major Euro 2028 user-facing surface has been audited against the vNext quality/system primitives;
- shared components are reused only where their semantics match;
- tournament-specific Groups, knockout, predictor and champion flows retain their canonical rules;
- route migration/cutover fate for Euro surfaces is explicit;
- responsive/accessibility/production validation is green for the adopted surfaces;
- no Hub-season assumption leaks into tournament behaviour;
- independent final review finds no unresolved Blocker/Important issue.

---

## Final programme completion

Completing Stage 15 is necessary but not sufficient. The runner must then execute the controller's final programme audit and prove:

- Stage 8–15 completion predicates are all satisfied;
- the current route migration matrix has no silently orphaned user-facing route;
- required exact-head CI is green;
- no unresolved Blocker/Important review finding remains;
- Production state is truthful;
- no vNext presentation workaround is substituting for unfinished scoring, lock, reveal, settlement, privacy or progression authority.

Only then is the vNext programme complete.
