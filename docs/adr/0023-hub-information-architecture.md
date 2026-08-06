# ADR 0023 — Hub information architecture and private competition model

- **Status:** Accepted direction — partially implemented
- **Date:** 3 August 2026
- **Amends:** [ADR 0020](0020-football-prediction-hub-product-model.md) (public domestic game name, Hub/competition navigation and onboarding), [ADR 0013](0013-last-man-standing-season-rules.md) (creator limits around the private competitions it already permits), and [ADR 0015](0015-commercial-and-social-model.md) (the concrete private-container model). It supersedes the navigation clause in [`../architecture-and-tournament-states.md`](../architecture-and-tournament-states.md) §0 and the navigation/catalogue section in [`../competition-structure.md`](../competition-structure.md).

- **Amended by:** [ADR 0026](0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md), 6 August 2026 — this record is scoped to the weekly platform and gains a Euro visibility boundary. Three sections were also clarified on that date without changing any decision: § Operating-limit classes separates the four kinds of limit, § Administration and provider changes states the automatic/approval boundary by change class, and neither alters a value or a rule.

> **Implementation progress — 5 August 2026.** Competition/game identity, separate memberships, private/public competition instances, game leagues, bounded standings authorities and the Match Predictor public name exist in the backend. The permanent Hub rail/tab shell, onboarding, full private-creation/managed-entrant UX and the complete phone-first competition journeys remain unbuilt.

## Context

ADR 0020 established the Football Prediction Hub, competition seasons and separately joined games, but it deliberately stopped short of a complete information architecture. Older documents still described a tournament-only five-tab shell in which Bonus Games sat under More. That model cannot make three games across several competition seasons legible, and it contradicts the accepted product hierarchy.

A design workshop on 3 August 2026 settled the missing navigation, onboarding, game naming, private-competition, standings-visibility, managed-entrant and administration decisions. They are recorded here rather than left in chat or silently folded into older records.

## Decision

### Hub and competition modes

> **Scoped by [ADR 0026](0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md), 6 August 2026.** Everything in this record describes **the weekly platform's** information architecture. There are two frontend sites over one shared backend, and the Euro 2028 site's surfaces are a separate, later design that this record does not attempt. Nothing below changes: the routes, shells, onboarding, private-container model, standings visibility and managed-entrant rules are the weekly platform's and remain in force. What is added is a boundary — see [§ Euro visibility boundary](#euro-visibility-boundary) — because a competition catalogue is exactly where a hidden competition leaks.

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

### Operating-limit classes

Added 6 August 2026. **The per-owner limits above are unchanged** — this section adds a classification, because four different kinds of limit had begun to be discussed as though they were one, and a recommendation about the global circuit breaker was being read as licence to change a product rule.

There are four classes, and a change to one is not a change to another:

1. **Global operational circuit breaker** (`CAP-001`) — the platform-wide public-user cap and total-league ceiling. These are rollout safeguards against an unproven system, not capacity limits and not product features. They are the only class that exists to be raised in stages as evidence accumulates.
2. **Per-owner product limits** (`CAP-002`) — the active-container totals, per-type maxima and creation-rate control decided above. These are product rules with reasoning of their own, they remain in force exactly as written, and **no recommendation about the circuit breaker changes them.**
3. **Per-league membership limits** (`CAP-003`) — how many members one ordinary private league may hold. **No value is currently approved.** A figure of 100 has been proposed and is a recommendation only.
4. **Future commercial entitlement limits** (`CAP-004`) — Free, Pro, League Plus and organisation allowances. None exists. When they do they stay separate from the circuit breaker, because an operational safeguard and a paid entitlement that happen to be the same number for a while are still different things, and conflating them means a commercial decision silently moves a safety limit.

On the circuit breaker specifically, three positions are recorded and **none of them is an authorisation to change a limit**:

- **Custom SMTP is configured and live-verified through the Euro 2028 Predictor domain** (`CAP-005`, [`../auth-plan.md`](../auth-plan.md) § 5). Email delivery was the original stated reason for holding public registration at its current cap; that reason no longer applies, and the cap's remaining justification is `CAP-001` — an untested system — rather than an email prerequisite that has since been met.
- **Raising the public-user cap to 250 is the next recommended controlled test stage** (`CAP-006`), not a current production change. Hosted headroom is not the constraint; the constraint is that deadline-burst load has not been rehearsed.
- **The global league ceiling should be redesigned to count active leagues rather than every row ever created** (`CAP-007`). A lifetime count fills permanently even when the platform is nearly idle, which makes the safeguard fail in the direction of blocking legitimate use. A figure of 1,000 active leagues has been proposed and is a recommendation. Changing the count from lifetime to active is an additive migration with pgTAP coverage and hosted verification, not a configuration change.

No limit in any class is altered by this section.

### Euro visibility boundary

Added 6 August 2026 under [ADR 0026](0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md), which is the decision authority; this section is where the Hub's own architecture honours it.

A competition season carries a **server-owned publication state** — hidden, prelaunch, registration-open, live, completed or archived (`EURO-002`). While Euro 2028's state is `hidden`, it must be absent from every weekly-platform surface (`EURO-001`, `EURO-003`):

- landing-page content;
- signed-in Hub discovery and the competition catalogue;
- competition cards and switchers;
- navigation;
- page metadata;
- the sitemap;
- Open Graph and share content;
- guessable public routes.

**Absence is enforced by the state and a route guard, not by a client catalogue omitting an entry** (`EURO-004`). A constant that happens not to list a competition is a presentation choice the next contributor can reverse without noticing; a guard that refuses the route is a control. The distinction matters here more than elsewhere, because the Hub's competition catalogue is currently a static constant and it currently lists Euro 2028 — which is the violation this section exists to name rather than to quietly fix.

This is a visibility rule only. It does not change any competition's rules, entry model, scoring or standings, and a competition that becomes visible is still separately and voluntarily entered (`ACCOUNT-004`).

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

**Clarified 6 August 2026 — which changes are automatic and which are not.** "Applied automatically" above covers one change class, and reading it as covering all of them would authorise a provider to create and delete this platform's fixtures. The boundary is:

| Provider change | Handling | ID |
| --- | --- | --- |
| An existing, **correctly mapped** fixture's kickoff is revised | **Automatic**, under the delivered safeguards: archive before decode, fail closed on any unmapped identifier, refuse a kickoff moved into the past or a fixture no longer scheduled, and record the move append-only | `INGEST-001` |
| A **newly discovered** fixture | **Administrative approval.** Proposed, never created automatically | `INGEST-002` |
| Removal, cancellation, abandonment, material identity change or material round change | **Administrative approval** | `INGEST-003` |
| Anything ambiguous — contradictory round data, unresolvable identity, invalid state | **Fails closed**, on the whole payload rather than per row | `INGEST-004` |

An approval or rejection records **the provider evidence, the operator, the decision and the resulting calendar change** (`INGEST-005`). All four: an approval that does not say what it was approving, or who approved it, is not an audit record.

**Provider data never becomes official result truth automatically** (`INGEST-006`). The protected confirmation and correction authority remains the only gate for scoring and progression, and nothing in the approval workflow may route around it. This is the boundary that lets the kickoff-revision path be permissive in the first place: the worst outcome of a wrong automatic revision is a mistimed lock, which is recoverable and audited — not a wrong score.

Automatic fixture *creation* is therefore deliberately not the target. The target is a reliable proposal-and-approval workflow.

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
