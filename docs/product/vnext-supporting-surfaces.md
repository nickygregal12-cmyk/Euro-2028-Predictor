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
| `/tournament/profile`, `/tournament/profile/:playerId` | MERGE | Three profile systems exist; the matrix's rule is that vNext must not add a fourth |
| `/more` | ABSORB | *"A directory page is a symptom of a navigation that ran out of slots."* None of the three IA concepts has a More |
| `/more/scoring` | ABSORB | *"Rules belong beside the game they govern"* — placement, not a page |
| `/competitions` | RETAIN + HIDE | Deliberate discovery over the published catalogue; keeps its address, changes how it is reached |
| `/competitions/:c/:s/games` | REDESIGN | **Resolved at Stage 7.6 as one of the four permanent destinations** — the only surface where the three games are peers |
| `…/games/match-predictor/standings` | ABSORB | A game's standings and a private league's table answer one question at two scopes |
| `/join/:code` | RETAIN | A pending invitation must survive authentication and onboarding |
| `/welcome` | REDESIGN | Onboarding exists and is routed in production; what Stage 13 owes is its vNext presentation and the coherence the predicate names |
| `*` | RETAIN | *"Every concept still needs a deterministic parent from a not-found."* |

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
out of slots. vNext's navigation has four slots and one of them is Account, so
the directory has nothing to do.

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
*"is in precisely the position of one who never joined"*. The installed function
agrees:

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
  backend items into this stage (`config/vnext-programme.json` → `carriedDebt`).
  Neither may be worked around in presentation here, and the attention/action
  surface in particular *"must only claim event classes the backend can actually
  produce."*

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
   `/more/scoring`.

Each lands with its own model, mapper, source, tests and Storybook worlds, on
the presentation architecture the lane has used since Stage 8: reads → source →
pure mapper → model → visual component, with the production boundary test
holding `components → models` and `integration → services`.
