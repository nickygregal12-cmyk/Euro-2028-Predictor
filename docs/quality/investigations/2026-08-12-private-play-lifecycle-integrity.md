# Private-play lifecycle integrity audit — 12 August 2026

## Status

**Open defects recorded; no implementation change in this audit.**

This investigation records a class of player-facing failure that ordinary unit/component coverage can miss:

> **a mutation is not safely delivered merely because its RPC returns success. The resulting state must also survive an authoritative reread, remain discoverable after a hard reload, and have a usable destination in the product.**

The immediate trigger was a private Last Man Standing creation that appeared to succeed and then could not be found again in the product. The deeper audit found that the most likely failure was not the create transaction itself: the private competition can be persisted correctly while the `/leagues` surface reads a different authority and therefore cannot rediscover it.

This investigation deliberately does **not** change a migration, hosted database, scoring rule, membership rule, provider function or production application. It records the defects and the acceptance evidence required before private play can be called complete.

Audit baseline: repository `main` at `30d671b14c5db6c108bd08cee524bfcf8e09e394`, 12 August 2026. Read-only hosted queries were used only to distinguish code-path defects from malformed persisted data.

## Executive finding

Three functional defects are confirmed and should be treated as priority private-play lifecycle work:

1. **Private Last Man Standing and Predictor Championship memberships are not reliably rediscoverable on `/leagues`.**
2. **A Predictor Championship-only player can hold a valid Championship membership without the season prediction entry that Championship scoring reads.**
3. **A private Predictor Championship organiser can leave the create flow while waiting for entrants and then have no later UI path to launch the competition.**

Two additional failures follow from the first defect rather than needing separate product rules:

- the post-join success copy can state that a competition is “in the list below” when the list cannot return it;
- the documented interim position for `MIG-UI-20` — that the `/leagues` card is the private LMS/Championship container's only home until a dedicated workspace exists — is not actually held by the current implementation.

The ordinary Match Predictor private-league lifecycle has materially stronger browser coverage and does not show the same structural defect.

---

## Finding PPLAY-001 — private LMS / Championship can persist but disappear from `/leagues`

**Severity:** Critical  
**State:** Confirmed  
**Affected games:** Last Man Standing; Predictor Championship  
**Primary surface:** `/leagues`

### What the product says

`src/features/hub/GlobalLeaguesPage.tsx` describes `/leagues` as the cross-competition home for:

- private Match Predictor leagues;
- private Last Man Standing competitions; and
- private Predictor Championships.

The same route's post-join success state says the joined private play is “in the list below”. `JoinLandingPage` also sends a successfully joined private competition to `/leagues`, explicitly because that list is supposed to be where it appears.

### What the page actually reads

The page starts from `PlayerCompetitionsProvider`, loops over the caller's active game memberships, and calls `fetchMyGameLeagues(game.id)` for each game.

`fetchMyGameLeagues` resolves through `public.get_my_game_leagues(...)`.

That function reads the ordinary Match Predictor private-league model:

- `public.leagues`;
- `public.league_members`.

Private Last Man Standing and Predictor Championship containers are not rows in `public.leagues`. They are private `public.bonus_competitions` with participation in `public.game_memberships` / the relevant game-specific tables.

Therefore a successful LMS/Championship create or join can be completely valid in the database and still be invisible to the read the product uses to rebuild `/leagues`.

### A second read mismatch compounds it

`PlayerCompetitionsProvider` obtains game memberships through `public.get_competition_games(tournament_id)`.

That catalogue read deliberately resolves the current public game competition for each game. A private LMS or Championship has its **own private `bonus_competitions` row**, so its membership is not a substitute for the public game membership returned by that catalogue read.

That means fixing only `get_my_game_leagues` would not be sufficient if the caller continues to decide which private containers to query only from public-game membership.

Private-container discovery needs its own bounded caller-addressed read, or another server contract whose authority is explicitly the caller's private-container participation.

### Hosted evidence

A read-only integrity check of Development found private LMS rows whose expected linked state was present: owner, invite code, active owner membership, LMS setup and invite-code registry linkage. This is evidence that the create path is capable of persisting a structurally complete private LMS.

Production had no private LMS/Championship containers to integrity-check at the time of this audit.

This changes the diagnosis of the triggering symptom: **“not visible afterwards” is not evidence that the create transaction failed.** The current UI can lose a correctly persisted private competition simply because it asks the wrong read to find it.

### Relationship to `MIG-UI-20`

`MIG-UI-20` already records the missing dedicated private competition workspace and says that, until that workspace exists, the `/leagues` card is the private LMS/Championship container's only home.

That remains the correct interim product requirement, but the implementation does not currently satisfy it because the card itself is not reliably discoverable.

`MIG-UI-20` must therefore not be treated as merely “a nicer destination later”. There is a present-tense discovery defect before the future workspace can even be reached.

### Required closure

Do not close this finding on a component mock or on an RPC success response.

Closure requires all of the following:

1. a bounded, caller-safe authoritative read that returns private LMS and Championship containers the caller participates in;
2. `/leagues` consumes that read without pretending those containers are ordinary `leagues` rows;
3. owner and non-owner memberships both rediscover correctly;
4. a hard reload still shows the container;
5. joining through `/join/:code` lands on a surface that actually contains the joined container;
6. failed reads remain failures and are never rendered as an empty private-play list;
7. the later `MIG-UI-20` workspace may add a richer destination, but private-container discovery must not depend on that workspace existing first.

---

## Finding PPLAY-002 — Championship membership does not guarantee the prediction capability its scorer consumes

**Severity:** Critical  
**State:** Confirmed structural defect  
**Affected game:** Predictor Championship

### The accepted product model

The product deliberately separates:

- following a competition;
- joining Match Predictor;
- joining Last Man Standing;
- joining Predictor Championship.

The onboarding model and its tests permit `predictor_cup` to be selected without `main_predictor`.

The private-play creation journey goes further: for a private Championship it tells the organiser that anyone with the invite code can join the private competition directly and does not need to have joined another game first.

That separation is intentional and should not be erased accidentally by a fix.

### What the membership function does

The current game definition for `predictor_cup` has `requires_prediction_entry = false`.

`predictor_internal.enter_competition_game(...)` creates an `entries` row only when the game definition says `requires_prediction_entry = true`. Otherwise it creates/updates bonus-game participation.

So joining Predictor Championship does **not**, by itself, create the season `entries` row used by Match Predictor prediction storage.

### What Championship scoring does

The season Championship group-table authority ultimately calls `predictor_internal.cup_season_fixture_points(...)`.

For every Championship member and season fixture it attempts to resolve:

`bonus_cup_members.user_id -> entries(user_id, tournament_id) -> season_predictions(entry_id, season_fixture_id)`.

If no `entries` row exists, there can be no `season_predictions` row and the Championship scoring input is treated as having no prediction.

The normal `public.save_season_prediction(...)` write also looks up `public.entries` and calls `predictor_internal.require_season_entry(...)`. A player with only the Championship membership therefore cannot use that write to repair the missing dependency themselves.

### Why current Development fixtures can hide the bug

At the time of this audit, the active Development Championship members checked happened also to possess season `entries` rows. That makes seeded or already-enrolled accounts look healthy while not proving the product rule “Championship-only player can participate”.

A regression test must therefore start from a user who has **no existing Match Predictor/season entry**.

### Do not apply the wrong fix

A fix must not silently join a player to Match Predictor merely because they join Championship. That would violate the product's explicit game-membership separation and would turn one game entry into an invisible side effect of another.

One coherent rule must be selected and implemented end-to-end:

- **Option A — explicit prerequisite:** Predictor Championship requires Match Predictor participation; the server refuses Championship entry without it, and the UI says so before join; or
- **Option B — shared prediction capability without shared game membership:** Championship entry establishes only the prediction-entry capability required to submit the shared score card, without representing the player as a Match Predictor game member.

Whichever design is adopted, the database membership contract, prediction write, scoring read, onboarding, invite preview/join and action-centre/UI behaviour must agree.

### Required closure

A real integration/browser journey must begin with a user who has no `entries` row for the season and prove one of these two outcomes:

- the player is refused Championship entry with the exact accepted prerequisite and no partial membership is left behind; or
- the player joins Championship and can submit the predictions Championship scoring consumes, while remaining unjoined to Match Predictor if the product continues to permit that separation.

Then settle a Championship window and prove the submitted prediction is scored from the same authoritative fixture-points path used for ordinary entrants.

A test seeded with a user who already has a season entry does not close this finding.

---

## Finding PPLAY-003 — private Championship launch is stranded after the create screen

**Severity:** High  
**State:** Confirmed  
**Affected game:** Predictor Championship

### Intended lifecycle

The creation journey states the correct organiser workflow:

1. create the Championship;
2. share the invite code;
3. wait until the field is complete;
4. launch the Championship;
5. launching fixes the field/draw and closes registration.

The backend command exists as `public.launch_private_season_cup(...)`, exposed in the frontend through `launchPrivateSeasonCup(...)`.

### Current UI wiring

The launch command is wired into `CreatePrivateJourney`'s **just-created step**.

The same screen tells the organiser not to launch too early and to wait for the field to be complete.

If the organiser follows that instruction and presses **Done**, the later `OrganiserPanel` can show the competition, entrants and invite code, but exposes no Championship launch command.

Therefore the normal path:

`create -> share -> Done -> wait for friends -> return later -> launch`

has no UI completion path.

This is not merely a missing “nice to have” workspace. It prevents the organiser from completing the lifecycle the creation screen itself instructs them to use.

### Required closure

The organiser must be able to return to an unlaunched private Championship and launch it later from a caller-safe organiser/private-container surface.

The UI must preserve the existing backend authority and must not reconstruct launch eligibility itself. It should show the server's refusal/reason when launch is unavailable and make the irreversible consequence clear before calling the command.

The acceptance journey must explicitly leave the create flow **without launching**, add another entrant, hard reload/re-enter the product and then launch successfully.

---

## Finding PPLAY-004 — success copy can assert state the authoritative reread does not hold

**Severity:** High consequence / subordinate to `PPLAY-001`  
**State:** Confirmed

The `/leagues` join success alert says:

> “It is in the list below.”

For a private LMS/Championship the current list read cannot guarantee that statement.

This is a trust defect rather than the root data defect. It should be fixed by repairing discovery first; the copy should then be backed by the authoritative reread rather than by the fact that the join RPC returned success.

General rule for similar flows:

> **Do not claim “saved”, “joined”, “created”, “in your list” or equivalent cross-surface state unless the mutation response itself is the accepted authority for that statement or an authoritative reread has confirmed it.**

A local optimistic state is not enough when the next route/reload reads a different authority.

---

## Finding PPLAY-005 — private LMS/Championship lifecycle lacks the E2E proof ordinary leagues already have

**Severity:** High test gap  
**State:** Confirmed

The ordinary Match Predictor private league has a real two-account browser lifecycle in `e2e/private-league-invite.spec.ts`:

- owner creates;
- invite code is issued;
- second account joins through the deep link;
- both members are visible;
- owner reloads;
- membership remains visible.

Private LMS/Championship creation coverage is largely component/service-oriented and can pass with mocked create results. That proves presentation and mapping, not the lifecycle that failed here.

### Required regression suite

Add real local-Supabase browser/integration journeys for:

#### LMS owner persistence

`create -> Done -> hard reload /leagues -> same private LMS is present`.

#### LMS invitee persistence

`second account joins by code -> /leagues -> hard reload -> same private LMS is present for the non-owner`.

#### Championship owner return-and-launch

`create -> do not launch -> Done -> another entrant joins -> organiser returns later -> launch is still available -> launch succeeds`.

#### Championship-only prediction dependency

Use a fresh account with **no season entry / Match Predictor membership**. Join Championship and prove the accepted rule from `PPLAY-002`: either a deliberate prerequisite refusal with no partial membership, or an explicitly supported prediction capability that does not silently join Match Predictor.

#### Championship persistence

`create/join -> hard reload -> Championship remains discoverable`.

#### Match Predictor control case

Retain the existing create/join/reload proof so changes made for bonus-game private containers cannot regress the ordinary `leagues` model.

Mocking `createPrivateSeasonLms`, `createPrivateSeasonCup` or the invite join result is insufficient acceptance evidence for these journeys.

---

## Adjacent data-integrity observation — Development ordinary league owner membership

A read-only Development integrity query found one historical ordinary private league, created on 27 July 2026, whose `owner_id` is not also present as a `league_members.user_id` row even though the league has other members.

Production's ordinary private league checked cleanly for the same invariant.

This looks like historical Development seed/test debt rather than evidence that the current ordinary `create_league` path is broken. Do not mutate or delete it from this investigation. Either:

- identify it as an intentional seed fixture and document that exception; or
- clean/reseed it through the normal Development fixture process.

It should not be allowed to become evidence for or against the current private-play create contract without first identifying its origin.

---

## Paths audited that do not show this failure pattern

This investigation also compared high-value mutation flows rather than assuming a site-wide persistence problem.

### Match Predictor score saves

The player prediction controller exposes per-fixture saving/saved/conflict/error state and does not treat every attempted write as accepted.

### Last Man Standing pick save

After an accepted LMS pick, the hook reloads server state before settling the committed UI state.

### Season LMS registration

Registration is deliberately non-optimistic. Both accepted joins and ambiguous refusals are followed by an authoritative reload.

### Follow/favourite preferences

The preference write is followed by a reload of the shared player-competition shell, rather than maintaining an independent optimistic copy that other surfaces cannot see.

### Ordinary Match Predictor private leagues

The existing two-account browser test proves create/join/reload persistence against the real local backend.

These comparisons support the narrower conclusion: **there is no evidence here of a general Supabase persistence problem. The confirmed defects cluster around private bonus-game container discovery and Championship lifecycle dependencies.**

---

## Release/implementation gate for private play

`DFA-008` must not be marked complete merely because create/join RPCs and forms exist for all three games.

For each player-facing private-play mutation, acceptance must prove this chain:

`WRITE -> AUTHORITATIVE REREAD -> DISCOVERABLE DESTINATION -> HARD-RELOAD PERSISTENCE`

For Championship it must additionally prove:

`MEMBERSHIP -> PREDICTION CAPABILITY -> AUTHORITATIVE SCORING INPUT`

and for organisers:

`CREATE -> LEAVE FLOW -> RETURN -> LAUNCH/MANAGE`.

A PR that fixes only copy, only the just-created screen or only a mocked list does not close these defects.

## Recommended implementation grouping

The fixes can be split without losing the lifecycle:

### Backend / migration contract

- bounded private-container discovery for the authenticated caller;
- explicit Championship prediction-capability/prerequisite decision implemented in membership + prediction storage/scoring boundaries;
- any organiser read addition needed to expose launchability without duplicating the launch rule;
- pgTAP for member/non-member/privacy/reveal/entry dependency and partial-failure cases.

### Frontend

- `/leagues` consumes private-container discovery rather than `fetchMyGameLeagues` for bonus-game containers;
- post-join success state follows the authoritative reread;
- organiser can return later and launch a Championship;
- later `MIG-UI-20` private workspace opens the already-discoverable container rather than being used as a substitute for discovery.

### Browser/integration acceptance

Add the five lifecycle journeys under `PPLAY-005`, using real local Supabase state and hard reloads.

## Closure rule

This investigation may be marked resolved only when every confirmed finding has implementation evidence and the real lifecycle tests pass. If the work is split across multiple PRs, keep this document as the parent checklist and link each closing PR rather than rewriting the original evidence.

## Closing work, appended rather than merged into the evidence above

Nothing above is edited. This section is the parent checklist the closure rule asks for.

| Finding | State | Evidence |
| --- | --- | --- |
| `PPLAY-001` | **Backend closed; surface open** | [#732](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/732), contract 179. `get_my_private_competitions` returns every private container the caller owns or holds a membership in, in any membership status, and takes no competition, game, season or player argument — so it cannot run through public-game membership and cannot become a directory. `228_private_container_discovery.sql` asserts the fixture holds **no** public-game membership before it starts, which is the property a suite seeded the ordinary way would not have. **`/leagues` still calls `fetchMyGameLeagues` for bonus-game containers, so the player-visible defect is live.** |
| `MIG-UI-20` | **Server half closed** | [#732](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/732), contract 179. `get_private_competition_workspace` resolves one container by its own id, refuses a non-member exactly as it refuses an unknown id, and shows THAT a Last Man Standing entrant has picked and never what. The page does not exist. |
| `PPLAY-002` | **Closed at the database** | [#732](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/732), contract 180. **Option B** of the two rules this document set out. `game_definitions.uses_season_prediction_card` declares which games read the shared card; entering one establishes the card and writes no membership of the game that owns it. `229_shared_season_prediction_capability.sql` starts from a user with no entry, no membership and no entrant row anywhere, as § "Why current Development fixtures can hide the bug" requires. |
| `PPLAY-003` | **Server half closed** | [#732](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/732), contract 179. Read-only launch readiness composed from the authorities `launch_season_cup` already uses, and differential-tested against a real launch over a short field, a viable field and an already-launched one. **No organiser surface exists yet**, so the acceptance journey this document specifies — leave without launching, add an entrant, re-enter, launch — cannot yet be run in a browser. |
| `PPLAY-004` | **Open** | Depends on the surface consuming contract 179. |
| `PPLAY-005` | **Open** | None of the five local-Supabase browser journeys exists. Contract 179's and 180's pgTAP suites prove the server contracts; this document is explicit that they are not the same evidence. |

**Two of this document's own diagnoses were confirmed against hosted Development on 12 August 2026, read-only.** Three private containers exist there holding **ten** live memberships, and **none** of the three is reachable through `public.leagues` — so ten memberships were held in containers the `/leagues` read could not return. Separately, all **twelve** Championship entrants on that project already held a season entry, which is exactly the § "Why current Development fixtures can hide the bug" claim: the broken state looks healthy on every seeded account.
