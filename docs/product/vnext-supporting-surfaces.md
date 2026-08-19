# vNext Stage 13 — Supporting Surfaces

**Status:** Stage 13 authority. Derived from the route migration matrix on
2026-08-19, against `src/App.tsx` and `src/vnext/` at `b6edcae`.
**Does not govern:** any production route. Nothing here repoints a route,
changes a guard or alters Netlify behaviour. Cutover is Stage 14 and needs
explicit authority.

---

## 1. What this stage is for

Stages 8–12 built the headline surfaces: Matches, Leagues, Player Profiles,
Last Man Standing, the Predictor Championship. Each is good and each is
reachable only if the application around it exists.

Stage 13's mission is that surround — **"a coherent application rather than a
collection of excellent core pages."** Its scope is not a wish-list; the
contract binds it:

> The exact list is derived from the **current route migration matrix at Stage
> 13 start**; this stage must not silently omit a route because it was not
> named in this file.

So the list below is derived, and the derivation is shown.

---

## 2. THE DERIVATION, AND ITS ONE CHECK

Every `path=` in `src/App.tsx` was extracted and set against every route named
in the matrix's first column.

**Result: the matrix is complete. No user-facing route is missing from it.**

**The method as first described here was not the method that would work, and
the correction matters more than the conclusion.** Eighteen of `App.tsx`'s route
registrations take `path={weeklyRoutes.…}` or `path={weeklyRoutePatterns.…}`
from `src/app/shellRoutes.ts` — including `/`, `/play`, `/matches`, `/leagues`,
`/competitions`, `/more` and every `/competitions/:c/:s/*`. An extraction of
`path="…"` string literals alone would have reported eighteen absences rather
than the one near-miss recorded below. The inventory behind the conclusion is
the 43 literals PLUS the 18 resolved through `shellRoutes.ts`, and the
conclusion was independently re-derived from that full set.

One near-miss is worth recording, because it is how such an omission would
actually present. A first pass reported `/auth/update-password` as absent. It is
not: it shares a row with `/auth/reset` (matrix line 139), and the extraction
had only taken the first backticked route per cell. The route was in the
matrix; the *reading* of the matrix was wrong. A tool that reads an authority
badly reports the authority as incomplete, and the fix is to re-read rather than
to start amending.

`/dev/*` addresses are covered by the matrix's single `/dev/**` row and are not
user-facing.

---

## 3. WHAT STAGE 13 OWNS, ROW BY ROW

Derived from the matrix's own `STAGE` column plus what `src/vnext/` actually
contains. A row is Stage 13's if its fate is undelivered and its stage is not
14 or 15.

| Route | Fate in the matrix | Why it is Stage 13's |
| --- | --- | --- |
| `/account` | RETAIN | **Pressing your own name drops you into the legacy visual system** — the predicate's own words. See §4 |
| `/profile` | RETAIN + REDESIGN | Platform identity and season history; the matrix says keep it platform-level, outside the tournament boundary |
| `/tournament/profile`, `/tournament/profile/:playerId` | MERGE | **Not built here — see §3.1.** The fate is intentional and recorded; performing the merge is Stage 15's |
| `/more` | ABSORB | *"A directory page is a symptom of a navigation that ran out of slots."* None of the three IA concepts has a More |
| `/more/scoring` | ABSORB | *"Rules belong beside the game they govern"* — placement, not a page |
| `/competitions` | RETAIN + HIDE | Deliberate discovery over the published catalogue; keeps its address, changes how it is reached |
| `/competitions/:c/:s/games` | REDESIGN | **Resolved at Stage 7.6 as one of the four permanent destinations** — the only surface where the three games are peers |
| `…/games/match-predictor/standings` | ABSORB | A game's standings and a private league's table answer one question at two scopes |
| `/join/:code` | RETAIN | A pending invitation must survive authentication and onboarding |
| `/welcome` | REDESIGN | Onboarding exists and is routed in production; what Stage 13 owes is its vNext presentation and the coherence the predicate names |
| `*` | RETAIN | *"Every concept still needs a deterministic parent from a not-found."* |

### 3.1 The tournament profile is targeted, not merged here

**An earlier draft of the table above put `/tournament/profile` in Stage 13's
build list. That was wrong and is corrected here.**

The matrix already decided it, in §9: those two rows are *"the tournament
profile system, and merging them into the season surface would be Stage 15's
Euro adoption pulled forward and out of order — the same reasoning Stage 9
applied to `/league/:id`."* Stage 10 deliberately left them, and Stage 13 has
been given no authority the matrix withheld from Stage 10.

The stage's predicate asks for something narrower than a completed merge, and
the distinction is the whole point of the wording:

> every remaining user-facing route in the migration matrix has an **intentional
> target fate**

`MERGE`, into the player surface Stage 10 built, is that fate. It is recorded,
it is not a placeholder, and nothing in this stage contradicts it. What the
predicate does NOT ask is that every fate be performed in Stage 13 — several are
explicitly Stage 14's and Stage 15's, and performing this one early would be a
stage taking work the programme assigned elsewhere.

### Not Stage 13's, and why

- `/league/:id` — the matrix stages it **15**, not 13.
- `/competitions/:c/:s/tv` — RETAIN, staged "later"; Stage 8 audited it and
  decided its relationship rather than rebuilding it. Outside the signed-in
  frame by design.
- `/admin/*` — the contract excludes admin redesign unless programme authority
  includes it. It does not.
- `/fixtures`, `/league`, `/more/points`, `/admin` — REDIRECT, already decided.
- `/auth/*` — RETAIN, unchanged.
- `/play`, `/matches`, `/leagues`, `/competitions/:c/:s/play` — HIDE / ABSORB,
  decided at Stages 8–9. Their *fate* is settled; Stage 14 performs it.

---

## 4. THE ANCHOR: PRESSING YOUR OWN NAME LEAVES vNEXT

The strongest single finding of the derivation, and the reason Account leads
this stage rather than trailing it.

**An earlier draft of this section called Account "the shell's fourth permanent
destination". That was wrong and is corrected here.** The four destinations are
`home | matches | games | leagues` (`shell.ts:236`), and Account is none of
them. Getting it right matters, because it changes where Account belongs: it is
*not* a navigation slot, which is consistent with the matrix keeping platform
identity outside the tournament boundary.

What is actually true is narrower and, if anything, worse.

`shell.ts:393` declares a separate shell intent:

```ts
| { readonly kind: 'account' }
```

and `VNextShell.tsx` emits it from **two** places — the desktop rail (`:412`)
and the mobile top bar (`:477`). Both are gated on `player`, and both render
**the signed-in player's own initials and name** as the button.

**No vNext surface answers it.** The only handlers for `kind: 'account'` in the
repository are the seven `/dev` harnesses, and all seven do the same thing:

```ts
case 'account':
  navigate('/account')
```

— the LEGACY production account page. (An earlier draft of this section said
they "write a note saying the intent fired". That is what the `default` branch
does for other intents; the `account` case was checked separately and does not.)

**So in every vNext surface Stages 8-12 built, a signed-in player presses their
own name and is dropped out of vNext into the old visual system.** That is not
merely a missing page — it is the exact failure this stage's completion
predicate names:

> account/discovery/help/error states no longer fall back **accidentally to an
> unrelated visual system** where the target IA says they belong to vNext.

The escape hatch is doing real work today, which is why it went unnoticed: the
button is not dead, it just leaves.

### What that implies for where Account sits

Because Account is not one of the four, it must not light one of them up while
the player is there. `VNextShellProps.destination` therefore takes `'none'` for
a page legitimately outside the four — the navigation compares
`item.id === activeId` and matches nothing, which is the wanted behaviour.
Stated in the shell's own prop docs so the next page outside the four does not
reach for one of them at random.

---

## 5. WHAT ACCOUNT MUST ANSWER, AND FROM WHERE

Read from the matrix rather than invented. Three current routes converge here:

| Current route | What it holds | Authority named by the matrix |
| --- | --- | --- |
| `/account` | Settings, follow/unfollow, favourite team | contract 157 `get_my_preferences` |
| `/profile` | Own platform identity and season history | contract 156 archive, contract 161 participation history |
| `/more` | A directory of the above | — (absorbed; it is a symptom, not a surface) |

**`/more` is absorbed rather than redesigned.** The matrix's note is the
argument and it is a good one: a directory page exists because a navigation ran
out of slots.

**An earlier draft finished that sentence with "and one of the four slots is
Account". That is the claim §4 had just retracted two paragraphs earlier, used
as the premise of the next section's argument.** The four are `home | matches |
games | leagues`, and Account is none of them.

The argument survives without it, and is better stated: `/more` exists because
its three links had nowhere else to be. They have somewhere now — Account is a
permanent control in the masthead and the rail, reachable from every vNext
surface without a directory, and the scoring rules sit beside the games they
govern. A directory whose every entry is reachable one press away is a page
with nothing left to do.

**The tournament profile merges in, and must not become a fourth system.**
The matrix names the hazard directly: platform, tournament and season profiles
already exist. Stage 10 built the season-scoped player surface. Account is the
platform-scoped one. Neither may grow a copy of the other.

---

## 5.5 THE GAMES HUB — and the rejoin it must not predict

The matrix resolved `/competitions/:c/:s/games` at Stage 7.6 as one of the four
permanent destinations, and gave the reason: **the only surface where Match
Predictor, Last Man Standing and the Predictor Championship are PEERS.** That is
not a layout preference. Last Man Standing was under-scoped for a whole
programme because nothing put it beside its peers, and a hub that draws one game
larger is doing the same thing again with better spacing. So every row is the
same size at every width, and the only grouping is whether the PLAYER is in a
game — a fact about them, not a ranking of the games.

### The entry rule is not restated here

`src/features/season/lmsRegistrationModel.ts` already resolves where
registration stands, and it is game-neutral by design. Its own words:

> `join_competition_game` governs entry for every game key, so a second copy of
> this logic per game would be three chances to disagree about one rule.

The mapper calls it and takes only its `state`. The WORDS are vNext's, because
that module's copy belongs to the production surfaces it was written for.

### `allow_rejoin` is not the rejoin rule

This is the stage's second binding refusal, and it comes from the SQL rather
than from taste.

Contract 126 changed what the flag means and said so in its own header: it
*"bites when the competition is running, and not before"*, because ADR 0013
fixes the field at the first round's lock and a player who left before that
*"is in precisely the position of one who never joined"*. The installed
function agrees — and it is `predictor_internal.enter_competition_game`, which
is where `20260810190000_private_season_lms.sql` moved the branch;
`join_competition_game` now delegates to it, so a reader looking for this rule
in the public function will not find it there:

```sql
if v_membership.status = 'disqualified' then
  raise exception 'A disqualified game entry cannot be rejoined'
...
if not v_definition.allow_rejoin
   and predictor_internal.competition_is_running(v_availability.id)
then
  raise exception 'This game cannot be rejoined once it has started'
```

And:

```sql
revoke all on function predictor_internal.competition_is_running(uuid)
  from public, anon, authenticated, service_role;
```

**No browser can learn whether a competition is running.** A hub rendering
"Rejoin" from `allow_rejoin` alone would be guessing at a fact the server
deliberately withholds, and would be wrong for exactly the player who left a
game that has since started.

So `RejoinOutlook` carries the RULE — *"it only takes you back if it has not
started yet"* — and the surface offers **no rejoin control at all**, in any
world, including the one where a rejoin would certainly succeed. Rejoining
belongs beside the game, with the flow that owns the write.

Disqualification is different and is stated absolutely: the server refuses it
*above* the flag, so there is nothing conditional to say.

---

## 6. WHAT THIS STAGE MUST NOT DO

From the contract, and from the two debts carried out of Stage 12:

- **No new social features.** Follow/unfollow presentation is over *existing*
  authority only.
- **No speculative analytics or vendor adoption.**
- **No production routing cutover.** That is Stage 14.
- **No admin redesign.**
- **No papering over an absent backend capability.** Stage 12 carried two owed
  backend items into this stage (`config/vnext-programme.json`). Neither was
  worked around in presentation here; **both were written as migrations in
  Stage 14** (contracts 207 and 208) and are now under `resolvedDebt`. The
  attention/action surface's rule stands unchanged: it *"must only claim event
  classes the backend can actually produce."*

### 6.1 Two things this stage deliberately left, named rather than implied

**The rest of `/account`'s settings.** The matrix defines the row as "settings,
follow/unfollow, favourite team". Follow and favourite are answered elsewhere by
design — Discovery owns the follow control, because it holds the read that knows
the current state, and the favourite is competition-scoped. Of the settings
proper, **sign out is built** and changing an email address and the
reminder-emails toggle are **not**. The split is a cutover judgement rather than
a preference: a player can go a season without either of the latter two, and a
cutover that shipped no way to sign out would strand every shared device. The
page heads no "Settings" section it cannot fill, and a test asserts it does not.

**The action/attention centre. BUILT IN STAGE 14 — see the note at the end of
this sub-section.** `buildShellModel` set `attention: []` for every connected
screen, and that was the decision rather than an oversight. The
stage contract scopes this work as "once its backend coverage is truthful
enough", and the predicate's own wording is the test:

> action/attention UI only claims event classes the backend can actually produce

An empty attention list claims none, which passes, and leaving it empty is
correct for THIS stage — nothing here has an attention story to tell.

**But the sentence that followed here was wrong, and the correction matters
because it changes what Stage 14 is allowed to assume.** It said populating the
layer "would mean inventing event classes across five surfaces from reads that
do not carry them". That is true of PER-SURFACE attention — what needs doing on
the page you are on — and false of the cross-competition half, which is the half
the route matrix actually depends on.

`useGlobalPlayInbox` and `playInboxModel` build the cross-competition inbox
TODAY, in production, from reads that already exist: each competition's week,
loaded concurrently from `PlayerCompetitions` and settled independently, with no
new capability of any kind. `InboxAction` carries `competitionName`, `gameName`,
`title`, `locksAt` and `outstanding`; `ShellAttentionItem` wants `contextId`,
`game`, `headline`, `detail` and `urgency`.

**One field short, and the shortfall is worth naming rather than discovering in
Stage 14.** No type in the inbox model carries a tournament id — `InboxAction`
identifies its competition by NAME, and even its `key` is built from that name.
`ShellAttentionItem.contextId` has to match `contexts[].competition.id`, which
is the tournament id. So a mapper written against `InboxAction` alone could only
join on a display name, and deriving identity from a name is the one thing this
codebase refuses everywhere else it comes up.

The join is available without that: `presentPlayInbox` is fed entries the caller
builds from `PlayerCompetitions`, which holds the tournament id beside each
competition. So the work is a mapper PLUS carrying `tournamentId` through
`PlayInboxEntry` and `InboxAction` — a small change to a production presentation
model, not a backend delta, and not a name join.

The only other gap is the `live` urgency, which has no source; emitting `urgent`
and `soon` only satisfies the predicate's rule rather than straining it.

So the ABSORB of `/play` and `/competitions/:c/:s/play` is a recorded fate whose
execution is **available to Stage 14**, not one waiting on the carried debts.
Stating it the other way would have let a cutover ship the loss with a citation
for it, and the loss is real: `/play` exists because "a player should never have
to choose a competition merely to discover what needs done", and vNext Home is
competition-scoped, so at cutover a player with games in two competitions has
nothing that tells them about the second.

### Built, in Stage 14, exactly as costed above

| piece | where |
| --- | --- |
| the id carried through the inbox | `InboxAction.tournamentId`, `PlayInboxEntry.tournamentId`, and `PlayInbox.unreadable` is now `{tournamentId, competitionName}` |
| the mapper | `src/vnext/integration/shell/buildShellAttention.ts` — pure, `PlayInbox → ShellAttentionItem[]` |
| the source | `ShellSource.elsewhere`: the player's competitions AND the inbox, because the shell drops an item naming a competition it holds no context for |
| the acquisition | `src/vnext/integration/shell/useVNextShellElsewhere.ts`, over `useGlobalPlayInbox` |
| the coverage | `tests/vnext/shellAttention.test.ts` (16 cases) and two browser cases in `e2e/vnext-shell.spec.ts` |

**No display-name join anywhere.** `InboxAction.key` used to be built from
`competitionName`, so two competitions sharing a display name — two seasons of
one competition, which is legal — produced colliding keys and a mapper written
against it could only have sent the player to whichever it matched first. The
key is now built from the tournament id and the test suite carries that exact
fixture.

**Two of three urgencies, said out loud.** `live` is never emitted, because
nothing in the inbox reports a match in play. Emitting `urgent` and `soon` is
the honest subset rather than a strained third.

**Settled actions are never attention.** `presentPlayInbox`'s `settled` list is
"done, waiting or settled"; an attention layer reporting a finished matchweek
would be a notification feed.

**It is OPTIONAL and the cost is why.** `useGlobalPlayInbox` issues one
play-context read plus up to three game reads *per competition*. A host that
called it per page would pay that on every navigation, so `shellElsewhere` is a
prop on every connected screen, defaults to the one-competition shape, and is
meant to be supplied once by the host that owns the shell across routes.

---

## 7. ORDER OF WORK

1. **Account / You** — the button that leaves vNext (§4). **DONE.**
2. **Games hub** — the one surface where the three games are peers, and the
   thing that stopped Last Man Standing being under-scoped a second time.
   **DONE**; see §5.5.
3. **Generic states** — not-found, access-refused, error, empty. The matrix's
   `*` row asks for *a deterministic parent from a not-found*, which is a
   statement about the shell as much as the page.
4. **Discovery, join and rules placement** — `/competitions`, `/join/:code`,
   `/more/scoring`. **DONE**; the scoring rules are a segmented control beside
   the games rather than one long list, because a page that explains three
   games at once explains none of them.
5. **Onboarding** — `/welcome`. **DONE**; see §8.

Each lands with its own model, mapper, source, tests and Storybook worlds, on
the presentation architecture the lane has used since Stage 8: reads → source →
pure mapper → model → visual component, with the production boundary test
holding `components → models` and `integration → services`.

---

## 8. ONBOARDING — AND THE COMMIT THIS LANE DID NOT WRITE TWICE

The matrix marks `/welcome` **REDESIGN** and scopes it in the row itself: the
four-step journey is *"built and routed"*, so what is owed is **vNext
presentation over an existing flow, not a flow to be written**. The predicate
then names the outcome:

> new-user onboarding → competition/game entry is coherent

Coherent means one visual system from the first screen through to the games hub.
A cutover that left `/welcome` on the production design would make a new
player's VERY FIRST screen the one place vNext does not reach — the Account
defect of §4, at the worse end of the journey.

### What was built

`models/onboarding.ts` → `integration/onboarding/` → `onboarding/VNextOnboarding.tsx`,
with fourteen Storybook worlds, a `/dev/vnext-onboarding` harness and two test
files. The four steps are the same four steps, in the same order, resumed from
the same contract 157 fields.

### What was deliberately NOT built, and this is the binding decision

**The commit.** Finishing onboarding writes follows, then game entries, then
completion, and reports which parts were refused without abandoning the parts
that worked. `OnboardingJourney` already does that, has done since contract 157,
and is the only place in the repository that does.

So this lane does not do it a second time. `finish` is an **intent** carrying
the draft and the catalogue it was made against; the host performs it, and at
Stage 14 the host is the page that already owns the commit. The screen therefore
writes **nothing at all** — not the progress stamp, not the follows, not the
entries — and the `/dev` harness reports the draft it would have committed
rather than committing it.

Two copies of a three-authority commit order would be three chances to disagree
about which of follows, entries and completion is allowed to fail, in a lane
that has not cut over and can gain nothing by holding the second copy.

### The step list is restated, and pinned

`ONBOARDING_STEP_ORDER` in the model duplicates `ONBOARDING_STEPS`, because the
production boundary forbids a vNext model from importing `src/features` — a
model that does drags the application into every story and fixture that touches
it. `tests/vnext/buildOnboardingModel.test.ts` asserts the two are identical, so
a build that adds a fifth step on one side only fails there. The same treatment
covers the catalogue's game keys.

### And the production route is untouched

`WelcomePage` still runs `OnboardingJourney`, still gates on `welcomed_at` and
still consumes the pending invite across sign-up. Repointing it is routing, and
routing is Stage 14's.

---

## 9. RECONCILIATION AGAINST THE STAGE 13 PREDICATE

Item by item, with what discharges it.

| Predicate item | Status | Evidence |
| --- | --- | --- |
| Every remaining user-facing route has an intentional target fate | Met | §2's derivation over every `path=` in `src/App.tsx`; §3's table; §3.1 for the two rows whose fate is recorded and whose execution is Stage 15's |
| Retained/merged/absorbed journeys needed for cutover have viable vNext presentation | Met | Account (§4–5), Games hub (§5.5), Discovery, Invite, generic states, scoring rules, onboarding (§8). `/more` and `/more/scoring` are ABSORBED, so their presentation is the surface that absorbed them |
| New-user onboarding → competition/game entry is coherent | Met | §8. The journey and the hub it hands off to are one visual system, and the hub is the surface where the three games are peers |
| Account/discovery/help/error states no longer fall back accidentally to an unrelated visual system | Met | §4 was the defect; `VNextAccountScreen` answers `kind: 'account'`, and the shared `src/vnext/states/` module carries a REQUIRED `destination` so a failing page never mislabels where the player is |
| Action/attention UI only claims event classes the backend can produce | Met | §5.5 — no rejoin control exists in any world, because `competition_is_running` is revoked from `authenticated`; the surface states the rule and never a verdict |
| No legally blocked or absent backend capability is papered over | Met | The two carried debts were stated rather than worked around, and were closed in Stage 14 by contracts 207 and 208 (`config/vnext-programme.json` → `resolvedDebt`) |
| Exact-head tests / browser / CI and independent review are green | Browser evidence exists; the rest is tracked on the pull request | `e2e/vnext-supporting.spec.ts` measures all five surfaces in a real engine — 34 checks for sideways scroll, clipped text, 44px targets and the one-main-one-h1 contract, plus the hub's no-promotion rule. It earned its place immediately: it found the onboarding club chips at 41px on a phone, which no jsdom test can see |

### `…/games/match-predictor/standings` — ABSORB, and it is absorbed

Worth stating because it is the one row whose fate is discharged by earlier
stages rather than by anything in this one. The matrix's note already records
why the row was blocked and why it no longer is: contract 191 supplies
`playerRef`, `reach` and `playerId`, Stage 9's league table links a player where
the server allows it, and Stage 10 built what is behind the link. A game's
standings and a private league's table are the same question at two scopes, and
both scopes now have a vNext surface. Nothing further is owed here; performing
the absorption on the live address is Stage 14's.

---

## 10. THE SECOND REVIEW ROUND, AND WHAT IT FOUND AFTER THE MERGE

Stage 13 merged as #923 while round two was still running. Its findings are
therefore recorded here and carried in a follow-up change rather than in the
stage's own pull request — which is the honest place for them, because two of
them are defects the stage shipped.

Round two **confirmed all eight corrections** from round one, each by applying
the mutation itself rather than by reading the commit messages. It then found
three things in the code round one never saw:

### The club read that was abandoned and never re-issued

`VNextOnboardingScreen` marked a competition as asked-for *before* awaiting its
club list, and discarded the answer if the effect had since torn down. The key
stayed marked, so nothing re-asked. Pressing **Back** on the favourite step
while a read was in flight, then **Continue**, left that competition on
"Loading clubs…" for the rest of the session — and the docblock claimed the
opposite in as many words.

The fix is not a smarter guard but a smaller one. A club list is keyed,
immutable and idempotent: an answer arriving after the step changed is still
the right answer, so it is stored. The only thing that must not happen is a
setState after unmount, and that is now the only thing guarded.

### Two Stage 13 surfaces disagreed about whether a game could be entered

The games hub refuses to offer a game whose registration has closed, because
`registrationOutlookOf` resolves the stored windows against the server's clock.
The onboarding games step had only the display catalogue, which keeps `active`
and discards the windows — so it drew a tick box for a closed or finished game
and promised Finish would enter the player, which `enter_competition_game`
refuses outright.

**The rule now has one home.** `registrationOutlookOf` moved into its own module
and both mappers call it; onboarding reads the windows from the same membership
rows the hub uses, and a season whose read carried no `serverNow` is omitted
entirely so the absence fails closed. A game the server would refuse gets no
control, the sentence names which refusal it is, and the review summary stops
listing it as something Finish will do.

### The connected screen had no tests at all

Every onboarding test targeted the presentational component against fixed
fixtures, or the pure mapper. All of the read and effect logic was untested,
and the blocker above was the direct consequence.
`tests/vnext/onboardingScreen.test.tsx` now covers the resume, the failure
fallback, the entry rule reaching the step, the fail-closed clock and the
abandoned-read regression — the last of which fails if the old guard returns.

### And a defect class no gate covered

Round one found `text.h2`, a typography class that has never existed, rendering
`class="undefined"` in the Championship. Generalising that scan to **every** CSS
module in the lane found two more, both in surfaces that had already shipped:
`styles.heroScore` in the Match Centre, so the headline score lost its display
font, weight, size and `white-space: nowrap` and rendered as body text; and
`styles.pickResult` in Last Man Standing, so the one paragraph saying what a
submitted pick did kept the browser's default margins.

Neither is visible to lint, typecheck, the unit suites, the axe scan or the
browser suite, because the markup is *fine* — a CSS module resolves an unknown
key to `undefined`, which is a perfectly ordinary class name to a renderer.
`tests/vnext/vnextStyleClasses.test.ts` is the gate that now catches it.
