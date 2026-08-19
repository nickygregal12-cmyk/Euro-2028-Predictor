# Football Hub cutover — capability parity matrix

**Status:** live authority for Stage 14 readiness
**Scope:** what a player can DO in the Football Hub, and where each of those
things is at cutover
**Does not govern:** the addresses themselves — that is
[`vnext-route-migration-matrix.md`](vnext-route-migration-matrix.md), which is a
Stage 7.5 deliverable and stays one

---

## Why this exists beside the route matrix

The route matrix answers *"what happens to this URL?"*. That is the wrong
question to judge a cutover by, because **a route may disappear while every
useful capability survives — and that is the point.** `/more` is deleted and
nothing is lost. `/play` is deleted and something real would be lost if the
attention layer had not been built.

So this page is keyed on the CAPABILITY. A row is a thing a player can do
today, and its classification says what happens to the doing of it:

| | Class | Meaning |
| --- | --- | --- |
| **A** | vNext native | Built in vNext, on the same authority, at the same or better fidelity |
| **B** | Absorbed | The capability survives somewhere else in vNext, and **the row names where** |
| **C** | Compatibility route | The legacy address keeps resolving on purpose |
| **D** | Redirect | The address forwards to its successor |
| **E** | Outside the vNext programme | Administration, auth, the Euro tournament product, dev harnesses |
| **F** | Blocked | A named backend or product requirement is in the way, and the row names it |

**A `B` row with no destination is a loss with a citation for it.** Every `B`
below names the surface the capability moved to; a reviewer's job on this page
is to check those, not the counts.

---

## 1. Finding what needs doing

| Capability | Today | At cutover | Class | Where |
| --- | --- | --- | ---: | --- |
| See what needs doing in the competition I am in | `/` `HubPage`, `/competitions/:c/:s` | Home, for the active competition | **B** | Home is competition-contextual under the Competition Deck; `/` and the competition front door are one surface |
| See what needs doing in my OTHER competitions | `/play` `GlobalPlayPage` | the shell's cross-competition attention layer | **B** | `AttentionElsewhere`, filled by `buildShellAttention` from `useGlobalPlayInbox`. **Built in Stage 14** — it was empty until then, and a cutover before it would have lost this outright for a player with two competitions |
| See what needs doing in ONE named competition | `/competitions/:c/:s/play` | Home, for that competition | **B** | Same argument one level down. Two "what needs doing" surfaces at two scopes is one too many |
| Reach the right competition AND game in one press | `/play` row link | an attention row | **A** | One `ShellIntent`; measured in `e2e/vnext-shell.spec.ts` |
| Know a competition could not be checked | `/play` warning | the inbox still names it, and now addresses it | **A** | `PlayInbox.unreadable` carries `{tournamentId, competitionName}`, so a surface can offer to open it rather than only name it |

## 2. Football

| Capability | Today | At cutover | Class | Where |
| --- | --- | --- | ---: | --- |
| This competition's fixtures | `/competitions/:c/:s/matches` | **Matches** | **A** | `src/vnext/matches/VNextMatches.tsx` |
| Tonight's football across my competitions | `/matches` `GlobalMatchesPage` | a SCOPE control inside Matches | **B** | Never a fifth destination and never the landing state; every fixture in that mode names its competition |
| One fixture in full | `/competitions/:c/:s/matches/:fixtureId` | **Match Centre** | **A** | Address shape kept: contract 148 resolves from the id alone, so a deep link and a refresh both work |
| A matchday screen on a wall | `/competitions/:c/:s/tv` | unchanged, outside the shell | **C** | Deliberately shell-less. A room display with a bottom navigation bar is the wrong product |

## 3. The games

| Capability | Today | At cutover | Class | Where |
| --- | --- | --- | ---: | --- |
| See which games this competition runs, and which I play | `/competitions/:c/:s/games` | **Games** | **A** | The one surface where the three games are peers |
| Predict a matchweek | `…/games/match-predictor` | **Match Predictor** | **A** | Writes through `useSeasonMatchPredictor` |
| Survive an LMS round | `…/games/lms` | **Last Man Standing** | **A** | The first vNext surface that writes |
| Play the Championship | `…/games/championship/*` | **Predictor Championship** | **A** | Four addresses become two, from the data rather than from a preference |
| Submit a Penalty Number | Championship pages | the Championship's own panel | **A** | The lane rule is stated before the refusal |
| Know whether I am out of the Championship | **nowhere** — no season read returned it | the standing block | **A** | **Contract 207.** `your_outcome` is `bonus_competition_entrants.outcome`, verbatim and caller-only. Before it, the surface stated nothing rather than deriving |
| See how the games score | `/more/scoring` `ScoringRulesPage` | a block beside the game it governs | **B** | `VNextGameRules`, a segmented control rather than three stacked lists. Every number is the domain's |
| Understand the Championship's deciders | the legacy rules page | the same block | **B** | Extended in Stage 14: table points from `CUP_TIE_MATCH_POINTS`, the three deciders in the settler's own order, and the Joker exclusion |

## 4. People

| Capability | Today | At cutover | Class | Where |
| --- | --- | --- | ---: | --- |
| This competition's private leagues and season table | `/competitions/:c/:s/leagues` | **Leagues** | **A** | Two tables, two rank authorities, neither a filter of the other |
| All private play across every competition | `/leagues` `GlobalLeaguesPage` | absorbed into the competition's Leagues | **B** | A cross-competition people surface would rank players across competitions they do not share, which **ADR 0011 refuses at the data layer** |
| Open another player's season | `…/players/:playerId` | **Player profile**, reached from Leagues | **A** | Three reads with three permission boundaries |
| See a rival's rank over the season | H2H / standings | the profile's rank chart | **B** | Plotted from contract 192, measured in a browser because a chart drawn upside down throws nothing |
| Compare with one rival | `/h2h/:rivalId` (weekly) | a panel inside the profile | **B** | Contract 192's rivalry, not contract 129 per matchweek |
| Mark somebody as a rival | Hub Rival Watch pin | the profile's pin control | **B** | **Built in Stage 14** over `set_pinned_rival`, which has been in production since contract 157 |
| See the players I have pinned, by name | **nowhere** | **not built** | **F** | `PROF-002`. `get_my_preferences` returns pinned rivals as bare ids — no name, no season ref. The smallest safe read is proposed in [`vnext-player-profiles.md`](vnext-player-profiles.md) §8.5 |
| Open a same-season entrant I share no private league with | **refused** | **the backend permits it; the browser does not ask yet** | **F** | `PROF-001` / ADR 0031 § 2 decided YES. Contract 206 (`get_season_player_profile_by_ref`) is on this branch; the vNext consumer is not built and hosted Development has not applied it. See §8 |
| A Euro-tournament private league | `/league/:id` | unchanged | **E** | Stage 15's Euro adoption, deliberately not done early |
| A Euro-tournament profile | `/tournament/profile[/:id]` | unchanged | **E** | Three profile systems exist; vNext must not add a fourth, and must not rebuild the Euro ones out of order |

## 5. You

| Capability | Today | At cutover | Class | Where |
| --- | --- | --- | ---: | --- |
| Change my display name | `/account` | **You → Your details → sheet** | **B** | `updateMyDisplayName`, with `checkDisplayName` run in the screen |
| Change my password | `/account` | the same | **B** | `updatePassword` |
| Change my email address | `/account` | the same, and the row names both addresses while one is pending | **B** | `updateEmail` + `getSessionEmailState` |
| Turn reminder emails on and off | `/account` | **You → a switch**, saved on one press | **B** | `updateReminderEmails`. It moves back if the write refuses |
| Read what other players can see | `/account` privacy card | **You → Privacy and help** | **B** | Contract 151's reveal boundary, as three facts |
| Email an administrator | `/account` | the same block | **B** | A real link where `VITE_SUPPORT_EMAIL` is configured; a stated absence where it is not |
| Sign out | `/account` | **You → This device** | **B** | Performed by the host |
| See the competitions I follow | `/account` | **You → Competitions you follow** | **B** | Contract 157, named from the catalogue or the history, and `unnamed` where neither holds a name |
| Follow / unfollow a competition | `/account`, `/competitions` | **Discovery** | **B** | Discovery holds the read that knows the current state; a second entry point would be a second place for one write to disagree about what it was toggling |
| Set a favourite club | `/account` | the competition | **B** | Competition-scoped by the server, which constrains it to a team that plays there |
| My season history | `/profile` `PlatformProfilePage` | **You → Your seasons** | **B** | Contract 161, with no link where the season is no longer routable |
| A directory of all of the above | `/more` `MorePage` | **deleted** | **B** | A directory page is a symptom of a navigation that ran out of slots. Nothing is lost |

## 6. Getting in and getting started

| Capability | Today | At cutover | Class | Where |
| --- | --- | --- | ---: | --- |
| Sign in, sign up, reset a password | `/auth/*` | unchanged | **E** | Out of vNext scope. The signup gate is a route guard and stays one |
| First-run onboarding | `/welcome` | **Onboarding** | **A** | vNext presentation over the existing four-step journey |
| Accept an invitation | `/join/:code` | unchanged address, lands in the vNext IA | **C** | A pending invitation must survive authentication and onboarding |
| Browse the published catalogue | `/competitions` | **Discovery**, reached from the shell | **C** | Correctly outside permanent navigation already; the address stays because it is linkable |
| Old addresses | `/fixtures`, `/league`, `/more/points`, `/admin` | unchanged | **D** | Already redirects. Keep |
| Not found | `*` | unchanged | **C** | Every concept still needs a deterministic parent from a not-found |

## 7. Outside the programme

| Capability | Class | Note |
| --- | ---: | --- |
| Every `/admin/*` surface | **E** | Administration is out of vNext scope entirely |
| The AI Lab | **E** | Hub-only, inside the domestic boundary |
| Every `/dev/*` harness | **E** | Behind `import.meta.env.DEV`; eliminated from production builds. **No required journey depends on one** |

---

## 8. The two `F` rows, stated plainly

Everything else above is `A`, `B`, `C`, `D` or `E`. These two are the whole of
what a cutover would ship without.

### `PROF-001` — a same-season entrant with no shared private league

ADR 0031 § 2 decided **YES**: same-season entrants may view each other's
bounded, reveal-safe profiles. **Contract 206 —
`get_season_player_profile_by_ref`, from PR #920 — is on this branch.** Three
things still stand between that and the capability:

1. **no vNext consumer.** `buildLeaguesModel.destinationOf` still returns
   `closed / not-shared` for a `compare` row, and the player profile still asks
   the UUID-addressed contract 151 read. Widening the first without building the
   second would put a door on a corridor;
2. **hosted Development has not applied it.** Repository, Development and
   Production reach a contract on their own schedules;
3. **generated Supabase types.** `PROF-001`'s own acceptance names them.

**It is not a cutover blocker and must not be treated as one.** The vNext
Leagues table behaves correctly for both answers, and the legacy product refuses
the same reader today — so cutover loses nothing here. What it means is that the
journey *league table → player → rank over time → comparison* stops at the first
step for a non-league-mate until the consumer is built on a database that has
the read.

### `PROF-002` — "people you follow"

Named in §4. Not built, not fakeable, and not silently dropped from the
programme.

---

## 9. Matches vs Games — audited, not renamed

The distinction is real and stays: **Matches are football fixtures; Games are
the prediction games played over them.** The Stage 7.6 decision to label the
catalogue `Games` rather than `Play` is settled and is not reopened here.

What was audited at phone width is whether the four labels are
self-distinguishing, and one was not:

| destination | subtitle before | after |
| --- | --- | --- |
| Matches | the round's own label — "Matchweek 12" — or "Across your 3 competitions" | unchanged |
| Games | "This season" | **"Ways to play this competition"** |

"This season" is true of all four destinations and therefore distinguishes
nothing, on the one destination whose noun is ambiguous. The correction is one
line of copy in a slot that already existed.

**What was NOT done, and would have been the wrong answer:** a third word in the
navigation, another level, a More menu, a duplicated destination, or renaming
either noun from intuition. A comprehension question answered with structure is
how a navigation acquires a fifth slot.


---

## 11. Stage 14 readiness, measured against its own predicate

The stage contract's `READY FOR CUTOVER` predicate, item by item, with what is
true rather than what is intended.

| Predicate | State | Evidence |
| --- | --- | --- |
| every Football Hub route has an intentional production behaviour | **Met** | The route matrix, all 39 rows, none unresolved |
| every user-facing CAPABILITY has a stated destination | **Met, with two named `F` rows** | This page. `PROF-001` and `PROF-002` are the whole of what is not `A`/`B`/`C`/`D`/`E`, and neither loses a capability the legacy product has |
| no required user journey depends on the workshop or a dev harness | **Met** | Every `/dev/*` route is behind `import.meta.env.DEV` and absent from a production build. No row above resolves to one |
| production build contains the intended vNext surfaces and only intentional legacy compatibility | **NOT YET — and this is the stage's remaining work** | vNext is still a parallel lane: no route is repointed, and the connected surfaces are reachable only from `/dev/*`. The cutover implementation itself is what closes this |
| auth, refresh, deep-link, navigation and error paths are tested | **Partially** | The vNext lane's own paths are; the repointed production routing does not exist yet to be tested |
| accessibility/performance/bundle regression acceptable | **Met for what exists** | Axe gates per surface, the CSS-module guard, the bundle budget and Lighthouse gates all green |
| monitoring and rollback ready | **Not this batch's scope** | Named by the stage contract and untouched here |
| current required CI/review green | **Met at this head** | See the branch's own checks |

### The two backend debts Stage 12 carried are paid

`config/vnext-programme.json` carried both past their own completion predicate,
on explicit authority and with the gap recorded rather than reinterpreted. Both
are now under `resolvedDebt`:

- **the elimination gap** — contract 208 puts the canonical entrant outcome on
  contract 193, so the Championship states elimination rather than staying
  silent, and the mapper's three former fallbacks are gone;
- **contract 120's indeterminate membership lookup** — contract 207 pins it to
  the caller's current phase. This one reached the PRODUCTION Football Hub, not
  only the vNext lane.

**Both are repository-only.** Hosted Development and Production are at contract
205 and each is a separately authorised rollout. A cutover cannot claim the
Championship is truth-complete until the environment it runs against has them.

### A hosted sequencing constraint, recorded because it outranks readiness

Contracts 207 and 208 are committed and applied nowhere. **Contract 206 must
reach Development and Production first**, and the reason is a deployment one
rather than a dependency between the migrations: advancing the repository
contract moves the Netlify deployment declaration with it, so landing 207/208
before 206 is reconciled forces another hosted cycle before production builds
can resume.

That is the owner's sequencing decision, and it is why the pull request carrying
this batch is deliberately held. **Nothing in this page is a reason to bring it
forward.** Everything below is about product readiness; the order in which
contracts reach an environment is a separate authority and wins.

### The honest verdict

**CUTOVER BLOCKED ONLY BY EXPLICIT PRODUCTION AUTHORITY — and by the cutover
implementation itself, which is Stage 14's remaining engineering.** The product
gaps that would have made a cutover lossy are closed; the routing switch, its
rollback plan and the hosted rollouts are not this batch's work and are not
claimed to be done.

---

## 10. How to use this page

A capability whose class changes — because a backend landed, or because a
surface was built — is edited HERE. The route matrix is a dated Stage 7.5
deliverable and is not rewritten to look current; where the two disagree about a
route's fate, the route matrix is the authority for the address and this page is
the authority for the doing.
