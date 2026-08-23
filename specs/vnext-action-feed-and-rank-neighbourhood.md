# vNext: the server action feed, the rank neighbourhood, and Stage 14's leftovers

**Status:** delivered, 23 August 2026, with one part explicitly not done — see § 10.
**Scope:** vNext presentation and its integration boundary, plus one browser
assertion for an accepted accessibility criterion.
**Migration effect:** **none.** Every read and write this spec consumes is
already installed, already granted to `authenticated`, and already generated
into `src/services/supabase/database.types.ts`. No SQL file is added, changed
or rolled out by this work.

## 1. Problem

Three separate gaps, delivered together because two of them are the same shape
— *an authoritative read the platform already owns and no surface consumes* —
and the third is the accessibility criterion the surface work would otherwise
walk straight past.

### 1.1 The Football Hub cutover left the persistent action feed behind

`src/app/AppShell.tsx` returns early once `vNextOwnsFrame(pathname)` is true.
That branch renders `<AdminUtilityEntry/>` and `<Outlet/>` and nothing else —
no AppBar, and therefore no Action Centre control. Stage 14 turned that branch
on for every Football Hub destination.

The consequence, stated exactly:

- `get_my_actions`, `mark_actions_seen` and `dismiss_action` are **unreachable
  from the production frame**. `src/app/ActionCentre.tsx` is their only
  consumer and it no longer mounts on a Hub route.
- Five server generators feed `player_action_items` —
  `generate_lms_pick_actions`, `generate_matchweek_prediction_actions`,
  `generate_matchweek_settled_actions`, `generate_cup_penalty_number_actions`
  and `generate_game_consequence_actions` — and `process_player_action_items`
  has had a `cron.schedule` caller since contract 172. The feed is generated,
  scheduled and read by nobody.
- Meanwhile `useGlobalPlayInbox` is still mounted at `AppShell.tsx:110`,
  *above* that early return, so the cost is still paid on every Hub route.
  `useVNextShellElsewhere` states that cost in its own header: **one
  play-context read plus up to three game reads PER COMPETITION.**

So the platform pays a per-competition browser fan-out to derive a weaker
answer than the bounded server read it already has, and the durable half of
that answer — whether the player has *seen* an item, on any device — is not
expressible at all.

The server feed is not merely cheaper. It carries facts the browser derivation
does not have: `matchweek_settled` carries `points`, `fixtures_scored` and
`joker_applied`; `matchweek_predictions_due` carries `predicted` against
`fixtures`, which is real progress rather than a restated deadline.

### 1.2 A rank is a dead number without its neighbours

`src/vnext/leagues/LeagueTables.tsx` renders page one of the season table plus
a detached "Your standing" row, and `src/vnext/models/leagues.ts` records that
there is deliberately no paging control. A player ranked 412th therefore learns
their rank and can never learn who is 411th or 413th — the two facts that make
a rank a chase rather than a label.

`get_season_leaderboard_neighbourhood` (contract 183, `MIG-UI-18`) was built
for precisely this. It returns a symmetric window around the caller with a
signed `pointsFromYou` on every row, states `atTop`/`atBottom` rather than
letting a caller infer them from the row count, and computes no rank of its own.
It has **zero consumers**.

### 1.3 Stage 14 named two things it did not close

`MASTER-TODO.md` records them: `UX-007` — the sticky masthead may obscure the
keyboard-focused control (WCAG 2.2 AA, 2.4.11), *suspected from the CSS and
deliberately never asserted* — and authenticated performance measurement at the
real routes. `UX-007` only became exercisable when the cutover made the vNext
shell the production frame and gave it a document-level scroller.

**Corrected on inspection, and it made this item smaller.** `UX-007` needed no
code at all: `src/vnext/foundations/useStickyScrollPadding.ts` already measures
the sticky chrome and writes `scroll-padding-block-start` on the document, and
`e2e/vnext-shell.spec.ts` already carries a hit-tested sixty-stop keyboard walk
against a frameless story. Neither had been run, which is exactly what the risk
register said — *"now reachable, and still unmeasured"*. The work is therefore
running it enough times to be evidence, not building it.

## 2. Outcome

- A player on any Football Hub destination can see everything the server says
  needs them or has happened to them, across every competition they play,
  from one bounded read; and an item read on one device is read on all of them.
- A player looking at a season table can see the players immediately above and
  below them, and how many points away each one is.
- The focus-obscuring criterion is measured against the real document scroller
  rather than suspected from a stylesheet.

## 3. In scope

1. A vNext action-feed integration adapter (source / pure mapper / acquisition
   hook) over the existing `playerActions.ts` service.
2. A vNext Action Centre surface, owned by the shell as application chrome.
3. A rank-neighbourhood service wrapper, pure model, vNext model, adapter and
   presentation on the season leaderboard.
4. Running the existing `UX-007` browser assertion enough times to be evidence,
   and the `scroll-padding-block-start` fix if — and only if — it fails.

## 4. Explicitly out of scope

- **Any migration.** If this work appears to need one, it has left its scope.
- **Re-pointing the attention layer at the action feed, and removing
  `useGlobalPlayInbox`.** Considered and deliberately dropped, because the two
  answer different questions rather than the same one twice. `buildShellAttention`
  reports what needs doing in a competition the player is not looking at, live,
  and excludes completed work on the stated ground that *"a completed matchweek
  is news, not a thing that needs you"*. The action feed carries that news on
  purpose, and its `priority` is not the attention layer's `urgency`. Collapsing
  them would either lose the durable half or assert an urgency the feed does not
  state, and it would rewrite 520 lines of passing tests to do it. **The cost of
  keeping both is real and is recorded rather than hidden:** the shell still pays
  `useGlobalPlayInbox`'s per-competition fan-out, which its own header measures
  at one play-context read plus up to three game reads per competition. Reducing
  that is a separate piece of work with its own argument to make.
- Changing what the generators produce, when they run, or what any action
  means. Presentation composes copy from `action_type` and `context`; it does
  not decide that an action exists, when it expires, or that it is urgent.
- The legacy `src/app/ActionCentre.tsx` and `AppShell`'s non-vNext branch.
  The Euro tournament frame keeps the surface it has.
- Paging the season leaderboard. The neighbourhood is a window around the
  caller, not the "load more" control `models/leagues.ts` deliberately refuses.
- Reminders / `DFA-012`. Contract 216 gave the sender its caller; the delivery
  half is gated on `SITE-007` and no part of it is touched here.
- Production promotion of anything.

## 5. Governing authorities

| Question | Authority |
| --- | --- |
| vNext boundaries | [`src/vnext/AGENTS.md`](../src/vnext/AGENTS.md) |
| Shell chrome, attention layer, one-competition contract | [`docs/product/vnext-shell-ia.md`](../docs/product/vnext-shell-ia.md) |
| Leagues surface | [`docs/product/vnext-leagues.md`](../docs/product/vnext-leagues.md) |
| UI direction | [`docs/product/ui.md`](../docs/product/ui.md) |
| The accepted gaps | `MIG-UI-14`, `MIG-UI-18`, `UX-007` in [`docs/quality/accepted-requirements.md`](../docs/quality/accepted-requirements.md) and [`docs/quality/risk-register.md`](../docs/quality/risk-register.md) |
| The reads themselves | `20260811130000_action_centre.sql`, `20260812050000_season_clubs_and_leaderboard_neighbourhood.sql` and the four later action generators |

## 6. Acceptance scenarios

**Action feed**

1. A player with an open matchweek card, an LMS round and a settled matchweek
   sees three items, in the server's own `priority` order, each naming its
   competition and its game.
2. Items the server marks `seen` render as read; unseen items are marked seen
   when the panel opens, through `mark_actions_seen`, and a subsequent read on
   a different device returns them already seen. **A failed seen-write leaves
   the items unread rather than showing them as read.**
3. An action whose `tournament_id` matches no competition the shell knows is
   dropped, not rendered with a placeholder.
4. `null` renders as nothing, and is not an empty feed. "Nothing is waiting" is
   a claim, and a read that has not landed has not made it.
5. Dismissing an item calls `dismiss_action` and the item leaves the list only
   after the server accepts it.
6. Needs-you items (`matchweek_predictions_due`, `lms_pick_due`,
   `cup_penalty_number_due`) reach the cross-competition attention layer.
   News items (`matchweek_settled`, `game_consequence`) do not — an attention
   layer that reported completed work would be a notification feed, which is
   the rule `buildShellAttention` already holds.
7. Copy is composed only from fields the payload carries. A settled matchweek
   with no `points` in its context says so rather than showing zero.

**Rank neighbourhood**

8. A player mid-table sees the players immediately above and below with a
   signed points gap; the caller's own row is marked and carries no gap to
   itself.
9. `atTop` renders as the top of the table rather than as missing rows;
   `atBottom` likewise. Neither is inferred from the row count.
10. A neighbour is openable only where the already-loaded leaderboard page
    supplies that player's server-issued identity for the same `position`.
    `position` is the join key because pgTAP
    `232_season_clubs_and_neighbourhood.sql` requires the two reads to agree on
    it. **Display names are never matched, and no identity, reach or ref is
    derived in the browser.**
11. A failed neighbourhood read leaves the existing table intact and reports
    itself; it never empties the table and never renders as "no neighbours".

**UX-007**

12. A browser assertion moves keyboard focus to a control that would sit under
    the sticky masthead and reads back rendered coordinates, asserting the
    focused control's box is not overlapped by the masthead's. The assertion
    holds across runs.

## 7. Privacy, security and authority constraints

- Every read is `security definer` with its own membership boundary and is
  granted to `authenticated` only. Presentation adds no boundary and removes
  none.
- The neighbourhood payload carries **no** `playerRef`, `reach` or `playerId`
  — it predates contract 191. Presentation must therefore treat a neighbour as
  unopenable unless contract 191's own page supplies that identity for the same
  server-issued `position`. Deriving reachability from the presence of a name,
  or matching players by display name, is the defect contract 191 exists to
  make impossible.
- No scoring, lock, reveal, settlement, membership or progression rule is
  read, restated or decided in this work.
- No clock decides anything. Urgency is the server's `priority` and
  `deadline_at`; presentation formats them and compares nothing.

## 8. Rollout and rollback

Repository-only. No hosted mutation, no migration, no environment change, no
Production promotion. Rollback is the revert of this branch.

The reads are installed on both hosted environments (they predate the current
development contract), so no surface here is gated on a rollout.

## 9. Completion predicate

Every acceptance scenario above is covered by an executable test or a browser
assertion actually observed to pass; `npm run lint`, `npx tsc -b`,
`bash scripts/agent-tools/architecture-check.sh` and the affected `vitest`
suites are green; and the one live authority for each of `MIG-UI-14`,
`MIG-UI-18` and `UX-007` records the new position.

## 10. What was delivered, and the one part that was not

**Delivered and verified.**

| Part | Evidence actually observed |
| --- | --- |
| Action Centre | `tests/vnext/actionsIntegration.test.ts` (23), `tests/vnext/actionsSource.test.tsx` (13), `tests/vnext/actionCentre.test.tsx` (23) |
| Rank neighbourhood | `tests/services/seasonLeaderboardNeighbourhoodModel.test.ts` (13), `tests/vnext/leaguesNeighbourhood.test.ts` (11), `tests/vnext/leaguesChase.test.tsx` (10) |
| `UX-007` | `e2e/vnext-shell.spec.ts`, three consecutive runs at 375×720 and 1440×900 — six passes, zero obscured stops |
| Whole suite | `npx vitest run` — 674 files, 8,772 tests |
| Gates | `npx tsc -b`, `npm run lint`, `npm run lint:css`, `npm run check:dead-code`, `scripts/agent-tools/architecture-check.sh` |

**Not delivered: authenticated performance measurement at the real routes.**
Stage 14's other named leftover is not blocked by design or by scope — it is
blocked by infrastructure. It requires a signed-in session against a real
database, and the environment this work was done in has no Supabase CLI and no
running Docker daemon, so no local stack could be stood up and no hosted
credentials were present. Producing a number here would have meant measuring
something other than what the item asks for. It stays open in `MASTER-TODO.md`
alongside monitoring and alerting for the new surfaces, both of which belong to
the same milestone.

Note that this work makes that measurement slightly more interesting rather than
less: the Hub now issues one additional bounded read per player at the seam, and
the pre-existing per-competition fan-out named in § 4 is still there.
