# ADR 0023 — Hub information architecture and private competition model

- **Status:** Accepted direction — unimplemented
- **Date:** 3 August 2026
- **Amends:** [ADR 0020](0020-football-prediction-hub-product-model.md) (public domestic game name, Hub/competition navigation and onboarding), [ADR 0013](0013-last-man-standing-season-rules.md) (creator limits around the private competitions it already permits), and [ADR 0015](0015-commercial-and-social-model.md) (the concrete private-container model). It supersedes the navigation clause in [`../architecture-and-tournament-states.md`](../architecture-and-tournament-states.md) §0 and the navigation/catalogue section in [`../competition-structure.md`](../competition-structure.md).

## Context

ADR 0020 established the Football Prediction Hub, competition seasons and separately joined games, but it deliberately stopped short of a complete information architecture. Older documents still described a tournament-only five-tab shell in which Bonus Games sat under More. That model cannot make three games across several competition seasons legible, and it contradicts the accepted product hierarchy.

A design workshop on 3 August 2026 settled the missing navigation, onboarding, game naming, private-competition, standings-visibility, managed-entrant and administration decisions. They are recorded here rather than left in chat or silently folded into older records.

## Decision

### Hub and competition modes

The authenticated root route `/` always opens the **Football Prediction Hub**. It never redirects to the last competition.

The global Hub navigation is:

```text
Home · Play · Matches · Leagues · More
```

Opening a competition season enters a focused competition mode. The global tab bar or rail is replaced by:

```text
Overview · Play · Matches · Games · Leagues
```

A persistent, obvious **Back to Hub** control remains available. Account, notifications and profile remain available from the competition shell.

`Matches` owns football-information subviews rather than giving Table or Bracket a permanent top-level tab:

- domestic season: `Fixtures · Results · Table · Stats`;
- tournament: `Fixtures · Groups · Bracket · Stats`.

The selected Matches subview and its useful scroll position survive a match/team/detail round trip.

### Onboarding and following

After account and display-name creation:

1. choose one or more competition seasons to follow;
2. choose games separately within each selected competition, with a brief description of every game;
3. join, create or skip private leagues/competitions.

Following a competition does not join a game. Joining one game never joins another. One followed competition may be marked favourite; favourite affects ordering and prominence only. Urgency always outranks favourite status.

### Public game names

The domestic accumulation game is named **Match Predictor** in every user-facing surface. `Main Predictor` becomes compatibility/developer language only until internal identifiers are deliberately migrated.

The public set is:

- Match Predictor — domestic score predictions;
- Original Predictor — full pre-tournament entry;
- Last Man Standing;
- Predictor Championship;
- KO Predictor — supported knockout tournaments only.

Existing `bonus_cup_*` and other Cup identifiers remain compatibility names; Predictor Championship is the interface name.

### Private containers from the first domestic release

Users may create:

- a private **Match Predictor league**;
- a private **Last Man Standing competition**;
- a private **Predictor Championship**.

Private LMS and Predictor Championship are launch scope for the first domestic release, not later enhancements. Their rules remain platform-standard: creators do not customise scoring, and Championship structure is selected deterministically from field size and remaining rounds.

A user may own at most **10 active private containers per competition season** across those three types. Within that total:

- no more than 5 active private LMS competitions;
- no more than 5 active Predictor Championships;
- no more than 3 successful creations in a rolling 24-hour period.

Completed or archived containers do not count. A transferred container counts against its new owner and a transfer that would exceed the cap fails unless an authorised administrator grants an exception. Limits are enforced server-side and may be raised later only by a new recorded decision or an explicit administrator exception.

### Leagues and competitions are both first-class

The global Leagues surface groups, but does not conflate:

- `My leagues` — Match/Original Predictor tables;
- `My competitions` — LMS and Predictor Championship lifecycles.

Every card and invitation names all three levels:

```text
Competition season → Game → League or competition
```

A durable cross-season friend-group entity is still not introduced.

### Standings visibility

For a public game, a signed-in non-entrant may see:

- the top 10;
- total field size;
- the current status and format;
- an entry/join action while registration is open.

An active entrant in that game may see the full paginated standings and their neighbourhood.

Private leagues and competitions expose the full field only to their participants and authorised creator. Anonymous invitation previews show bounded name, creator, competition/game, entrant count and entry status, not a member list.

This is a leaderboard-visibility rule only. Prediction/entry detail continues to follow its game-specific pre-lock and post-lock reveal authority.

### Managed entrants

Managed/offline entrants remain **Last Man Standing only**.

A private LMS creator may add and manage offline players before the first round locks, use a bulk-selection surface, and later invite a managed entrant to claim the preserved history. Managed entrants use the ordinary lock, cannot be added late, carry a visible managed marker, and every action records actor and time. The creator receives no override or late-submission privilege.

### Hub priority and competition dashboards

Hub Home shows one primary action and at most two compact secondary actions. It then prioritises live football, followed competitions, recent results/league movement and discovery.

A competition dashboard prioritises live matches whenever any are live, while retaining an urgent incomplete-action warning. Joined games appear before available games.

The global Matches surface combines followed competitions chronologically with clear competition labels and filters.

### Administration and provider changes

The first release has one Super Admin. Authorisation is nevertheless capability-based so Results Admin, Competition Admin and Support Moderator can be added later without replacing a universal boolean.

Normal provider fixture changes are archived, strictly decoded, applied automatically to the canonical fixture model, audited and surfaced in an administrator review queue. Ambiguous identity, contradictory round data or invalid state fails closed. Result confirmation remains a separate protected authority.

## Detailed architecture authority

The route tree, page ownership, shell behaviour, onboarding copy, private-container presentation and responsive interaction rules live in [`../architecture/hub-information-architecture.md`](../architecture/hub-information-architecture.md). That document may elaborate this decision but may not reverse it.

## Consequences

- The old `/games`-as-directory and League-is-Original-only information architecture is retired as the future Hub design. Existing Euro compatibility routes may remain until migrated.
- Global and competition shells are separate navigation contexts; implementation must preserve a clear return path rather than nesting two full navigation systems.
- Table, Groups and Bracket are switchable Matches subviews, not permanent competition tabs.
- Match Predictor becomes a user-facing rename that must be applied consistently to onboarding, routes, help and game cards without casually renaming persisted identifiers.
- Creator caps need one server-side authority and auditable exceptions; hiding the create button is insufficient.
- Private LMS managed entrants remain intentionally asymmetric with other games.
- Page-shaped read models should follow the surface list in the information-architecture document from the first implementation.
- No hosted database, Netlify or production change is authorised by this record.

## Rejected alternatives

- **Keep Home / Predict / Matches / League / More inside every competition.** Rejected: it preserves the tournament shell and makes the Hub hierarchy visually invisible.
- **Show global and competition navigation at the same time.** Rejected: two five-item systems compete for the same phone viewport and blur the user's current scope.
- **A permanent Table or Bracket competition tab.** Rejected: both are football-information views and belong in a well-designed, state-preserving Matches switcher.
- **Automatically join Match Predictor during onboarding.** Rejected: it breaks the independent opt-in law and repeats the observed failure where players did not understand games were separate.
- **Unlimited private creation.** Rejected: free creation without an active/rate cap invites abandoned and spam containers, while a lifetime cap punishes legitimate repeat organisers.
- **Managed entrants in Match Predictor or Championship.** Rejected: proxying a full weekly card is an organiser workload that will not survive a season; ADR 0013's LMS-only boundary remains correct.
- **Expose the complete public table to every signed-in account.** Rejected: top-ten discovery is useful, while the full field is a participation benefit and creates unnecessary browsing/privacy surface for non-players.
