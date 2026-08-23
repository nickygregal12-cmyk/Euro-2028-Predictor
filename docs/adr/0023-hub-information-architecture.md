# ADR 0023 — Hub information architecture and private competition model

- **Status:** Accepted direction — partially implemented
- **Date:** 3 August 2026
- **Amends:** [ADR 0020](0020-football-prediction-hub-product-model.md) (public domestic game name, Hub/competition navigation and onboarding), [ADR 0013](0013-last-man-standing-season-rules.md) (creator limits around the private competitions it already permits), and [ADR 0015](0015-commercial-and-social-model.md) (the concrete private-container model). It supersedes the navigation clause in [`../architecture-and-tournament-states.md`](../architecture-and-tournament-states.md) §0 and the navigation/catalogue section in [`../competition-structure.md`](../competition-structure.md).

- **Amended by:** [ADR 0026](0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md), 6 August 2026 — this record is scoped to the weekly platform and gains a Euro visibility boundary. Three sections were also clarified on that date without changing any decision: § Operating-limit classes separates the four kinds of limit, § Administration and provider changes states the automatic/approval boundary by change class, and neither alters a value or a rule.
- **Navigation clause superseded 23 August 2026:** the two navigation bars in [§ Hub and competition modes](#hub-and-competition-modes) — `Home · Play · Matches · Leagues · More` and `Overview · Play · Matches · Games · Leagues` — are **superseded for the domestic Hub** by the selected vNext information architecture, the **Competition Deck** (`Home · Matches · Games · Leagues`), recorded in [`../product/vnext-shell-ia.md`](../product/vnext-shell-ia.md) and selected by [`../product/ui.md`](../product/ui.md). **Only those two bars are obsolete.** Every other decision in this record — deterministic parent navigation, the canonical game routes, `Matches` owning the football subviews, game-level secondary navigation, onboarding, the private-container model, standings visibility, managed entrants and administration — remains in force. Competition Play's *job* also remains in force and moved to Home; see the note in § Game status, weekly action and subordinate navigation.
- **Reconciled 7 August 2026:** the owner-approved **Domestic Frontend Alpha** direction is incorporated here rather than kept as a parallel planning authority. This amendment adds the one-time onboarding completion model, optional favourite-team preference, deterministic parent navigation, game-level navigation, action-state rule, reusable shirt-style club identity, Scottish Development rehearsal, Development competition-admin journey and two-stage public landing-page timing. It does not claim any of those additions are implemented.

> **Implementation progress — current implementation belongs in [`../quality/current-status.md`](../quality/current-status.md).** Competition/game identity, separate memberships, private/public competition instances, game leagues, bounded standings authorities and the Match Predictor public name exist in the backend, and several domestic surfaces have landed. This ADR records the accepted product boundary, not a moving route-by-route implementation report.

## Context

ADR 0020 established the Football Prediction Hub, competition seasons and separately joined games, but it deliberately stopped short of a complete information architecture. Older documents still described a tournament-only five-tab shell in which Bonus Games sat under More. That model cannot make three games across several competition seasons legible, and it contradicts the accepted product hierarchy.

A design workshop on 3 August 2026 settled the missing navigation, onboarding, game naming, private-competition, standings-visibility, managed-entrant and administration decisions. On 7 August the owner then named the next product milestone **Domestic Frontend Alpha**: a genuinely usable Development frontend for the Premier League 2026/27 and Scottish Premiership 2026/27, rather than continued accumulation of isolated backend and UI slices. The additions below reconcile that direction into this existing decision instead of creating another permanent product authority.

## Decision

### Domestic Frontend Alpha boundary

The weekly platform's immediate product milestone is **Domestic Frontend Alpha**.

For this milestone the visible weekly scope is:

- Premier League 2026/27;
- Scottish Premiership 2026/27;
- Match Predictor;
- Last Man Standing;
- Predictor Championship.

`Match Predictor` is the public name. Compatibility identifiers such as `main_predictor` may remain internal where a migration has no product justification.

Euro 2028 remains a separate later frontend under ADR 0026 and, while its publication state is `hidden`, is absent from the weekly platform. The Alpha therefore proves the domestic weekly product rather than carrying tournament-era weekly routes forward as a parallel information architecture.

The player-level acceptance principle is:

> Within a few seconds, a player should understand what needs action, when it locks, what is happening in the football, and how they are doing.

### Hub and competition modes

> **Scoped by [ADR 0026](0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md), 6 August 2026.** Everything in this record describes **the weekly platform's** information architecture. There are two frontend sites over one shared backend, and the Euro 2028 site's surfaces are a separate, later design that this record does not attempt. Nothing below changes: the routes, shells, onboarding, private-container model, standings visibility and managed-entrant rules are the weekly platform's and remain in force. What is added is a boundary — see [§ Euro visibility boundary](#euro-visibility-boundary) — because a competition catalogue is exactly where a hidden competition leaks.

The authenticated root route `/` always opens the **Football Prediction Hub**. It never redirects to the last competition.

> ### ⚠ The two navigation bars below are SUPERSEDED for the domestic Hub
>
> **Superseded on 23 August 2026 by the selected vNext information
> architecture — the Competition Deck.** The current domestic navigation is
> `Home · Matches · Games · Leagues`, scoped to the active competition. There is
> no `Play` destination and no `More` destination: `/play`'s job split between
> Home (what needs doing *here*) and the shell's cross-competition attention
> layer, and `/more` was absorbed into the account surface. The authority is
> [`../product/vnext-shell-ia.md`](../product/vnext-shell-ia.md), selected by
> [`../product/ui.md`](../product/ui.md), and it is what the shipping product
> implements.
>
> **The two bars are retained, not deleted**, because the decisions that hang
> off them — deterministic parent navigation, `Matches` owning the football
> subviews, game-level secondary navigation, the private-container model, the
> onboarding sequence and everything else in this record — remain in force and
> are read from here. Only the two navigation shapes below are obsolete.
>
> **What survives, and matters, is `Play`'s *job* rather than its tab:**
> Competition Play was defined below as *"the cross-game answer to 'What do I
> need to do this week?'"*, aggregating authoritative game state across all
> three games. That requirement is unchanged and is now **Home's**. See
> `DFA-006` and `DFA-010` in
> [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md).

The global Hub navigation *(superseded — see above)* was:

```text
Home · Play · Matches · Leagues · More
```

Opening a competition season enters a focused competition mode. The global tab bar or rail *(superseded — see above)* was replaced by:

```text
Overview · Play · Matches · Games · Leagues
```

A persistent, obvious **Back to Hub** control remains available. Account, notifications and profile remain available from the competition shell.

`Matches` owns football-information subviews rather than giving Table or Bracket a permanent top-level tab:

- domestic season: `Fixtures · Results · Table · Stats`;
- tournament: `Fixtures · Groups · Bracket · Stats`.

The selected Matches subview and its useful scroll position survive a match/team/detail round trip.

### Canonical weekly routes and deterministic parent navigation

The weekly frontend converges on one Hub → competition → game route tree. The canonical domestic game paths are:

```text
/competitions/:competition/:season/games/match-predictor
/competitions/:competition/:season/games/lms
/competitions/:competition/:season/games/championship
```

Implementation should ultimately derive route construction from one typed/generated route authority rather than scattering hard-coded strings through the application. Compatibility paths may redirect during migration; they do not remain a second information architecture.

Browser history is not the sole escape path from a deep URL. Every shipped non-root weekly route has a deterministic logical parent:

- competition pages → **Back to Hub**;
- game pages → **Back to Games**, with competition navigation retained;
- private-container pages → **Back to Leagues**;
- Match Centre → **Back to Matches**, restoring useful date/filter/scroll context where practical;
- player/H2H pages → the originating standings/container where known, otherwise safe competition context;
- failures/not-found → a logical parent and Hub.

This receives executable route/navigation coverage so a shipped weekly route cannot silently become an orphan.

### Onboarding, following and personalisation

After required account identity/display-name setup, a newly authenticated player receives one short guided setup. Nothing is silently joined.

1. **Choose competitions to follow.** The player may follow Premier League 2026/27, Scottish Premiership 2026/27 or both. Following personalises football information; it is not game membership.
2. **Choose an optional favourite team.** One visible domestic club may be selected, or the player may skip. The favourite team is a changeable profile preference only. It does not join a competition or game, change scoring, predictions, rankings or permissions, and never outranks an urgent/incomplete action.
3. **Choose games independently for each followed competition.** Match Predictor, Last Man Standing and Predictor Championship are separate opt-ins. Every game explains what the player actually does, its cadence and its current availability/lock/start state.
4. **Private play.** Enter an invitation, create an available private league/competition, or skip.
5. **Finish into the personalised Hub.** The Hub primarily reflects the competitions, games and actions relevant to that player rather than presenting the whole catalogue at equal weight.

A returning user who completed onboarding goes directly to the personalised Hub. Interrupted onboarding resumes rather than restarting. Pending invitation context survives authentication and onboarding and resumes at the intended competition, game and private container.

Players may later change followed competitions and favourite team through normal preferences. Game participation remains subject to each game's lifecycle rules.

### Public game names

The domestic accumulation game is named **Match Predictor** in every user-facing surface. `Main Predictor` becomes compatibility/developer language only until internal identifiers are deliberately migrated.

The public set is:

- Match Predictor — domestic score predictions;
- Original Predictor — full pre-tournament entry;
- Last Man Standing;
- Predictor Championship;
- KO Predictor — supported knockout tournaments only.

Existing `bonus_cup_*` and other Cup identifiers remain compatibility names; Predictor Championship is the interface name.

### Game status, weekly action and subordinate navigation

Competition/game cards are not static directories. They expose server-authoritative state and a direct next action.

Match Predictor may show completion, complete/incomplete state, next lock, useful points/rank and `Continue predictions` / `View predictions`.

Last Man Standing may show pick required/current pick, active/eliminated state, current round, next lock and `Make pick` / `View pick`.

Predictor Championship may show current opponent, fixture/result state, table position, phase/group and a direct matchup/table action, with clear wording that Match Predictor points feed the Championship fixture automatically.

The cross-game answer to **“What do I need to do this week?”** aggregates authoritative game state; it does not invent a fifth prediction workflow. An incomplete Match Predictor card leads to predictions, a missing LMS selection leads to the pick, and Championship normally exposes matchup/status because its points arrive through Match Predictor automatically. The same action model may later feed reminder eligibility.

> **Where this surface lives, updated 23 August 2026.** This clause originally placed the job on a competition **Play** destination. The destination is superseded with the navigation above; **the job is not, and is now Home's** — “what needs doing *here*” is answered by the competition's Home, and “what needs doing *elsewhere*” by the shell's cross-competition attention layer. Nothing else in this clause changes: the ordering is still the games' own authoritative state, and the Championship still reports rather than asks.

Each game may use compact subordinate navigation, always beneath the competition context:

```text
Match Predictor:       Play · Standings · Trends · History
Last Man Standing:     Pick · Standings · History · Rules
Predictor Championship: My Fixture · Table · Fixtures · History
```

Every game context keeps an obvious route back to Competition Games.

### Shirt-style club identity

The weekly design language includes one reusable **shirt-style club identity** treatment. It is an abstract recognition aid, not a replica-kit requirement: for example Rangers may read as blue and Celtic as green-and-white hoops.

The reusable component supports a bounded vocabulary such as solid, horizontal hoops, vertical stripes, halves/panels where appropriate, and primary/secondary colour combinations. It:

- keys from canonical team identity rather than provider identifiers;
- keeps an accessible team name/label and never becomes the sole identifier;
- has a neutral initials/identity fallback;
- works in light and dark themes;
- remains layout-stable in repeated rows;
- fits the restrained premium visual system rather than becoming a decorative hero.

Initial high-value uses are favourite-team onboarding, Match Predictor rows, Matches/results, Match Centre, LMS club selection, relevant Championship contexts and team selectors.

### Private containers from the first domestic release

Users may create:

- a private **Match Predictor league**;
- a private **Last Man Standing competition**;
- a private **Predictor Championship**.

Private LMS and Predictor Championship are launch scope for the first domestic release, not later enhancements. Their rules remain platform-standard: creators do not customise scoring, and Championship structure is selected deterministically from field size and remaining rounds.

Competition Leagues distinguishes **My leagues** (Match Predictor) from **My competitions** (LMS and Predictor Championship). The explicit creation journeys converge on game-specific routes such as:

```text
/competitions/:competition/:season/leagues/new/match-predictor
/competitions/:competition/:season/leagues/new/lms
/competitions/:competition/:season/leagues/new/championship
```

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

**Absence is enforced by the state and a route guard, not by a client catalogue omitting an entry** (`EURO-004`). A constant that happens not to list a competition is a presentation choice the next contributor can reverse without noticing; a guard that refuses the route is a control.

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

### Scottish Premiership Development rehearsal

Scottish Premiership is the first truthful complete domestic Development rehearsal.

**Matchweek 1** uses real completed football results. Historical test-user prediction state may be synthetic only where it is timestamped/state-consistent with the original lock and then processed through the ordinary protected result, scoring and rederivation authorities. Football results are never invented. Provider data remains provisional evidence until protected result confirmation.

**Matchweek 2** is the first playable LMS round and the starting round for the seeded Development Predictor Championship. LMS needs no invented Matchweek 1 history. A player can join, see the real Matchweek 2 clubs, select one, change it before lock and reload with the choice preserved. The seeded Championship field uses the deterministic format authority and makes opponent, fixtures, phase/group and table reachable through normal frontend routes. Match Predictor points feed it through the existing authoritative mechanism.

### Hub priority and personalised Home

The current competition chooser may serve as an intermediate shell. The final signed-in Hub becomes action-led once supporting reads exist.

Priority is:

1. one primary urgent/next action;
2. at most two compact secondary actions;
3. live football;
4. favourite-team and followed-competition context;
5. current rank/league movement;
6. recent matchweek results/recap;
7. private league/competition activity;
8. appropriate domestic discovery.

A competition dashboard similarly prioritises live matches when any are live while retaining an urgent incomplete-action warning. Joined games appear before available games.

The global Matches surface combines followed competitions chronologically with clear competition labels and filters.

### Development competition administration

The first release has one Super Admin. Authorisation remains capability-based so Results Admin, Competition Admin and Support Moderator can be added later without replacing a universal boolean.

Development exposes a visible competition-readiness journey showing at least provider/fixture readiness, current matchweek, Match Predictor availability, LMS setup/current round, Championship launch/field/phase, result-confirmation readiness and refusal/review conditions.

Where existing protected authorities permit it, Competition Admin may preview/execute setup actions such as starting LMS at a permitted round or launching Championship from a permitted round. The UI is only a caller of server-owned rules; it is not a second rules engine.

Normal provider fixture changes are archived, strictly decoded, applied automatically to the canonical fixture model, audited and surfaced in an administrator review queue. Ambiguous identity, contradictory round data or invalid state fails closed. Result confirmation remains a separate protected authority.

**Clarified 6 August 2026 — which changes are automatic and which are not.** "Applied automatically" above covers one change class, and reading it as covering all of them would authorise a provider to create and delete this platform's fixtures. The boundary is:

| Provider change | Handling | ID |
| --- | --- | --- |
| An existing, **correctly mapped** fixture's kickoff is revised | **Automatic**, under the delivered safeguards: archive before decode, fail closed on any unmapped identifier, refuse a kickoff moved into the past or a fixture no longer scheduled, and record the move append-only | `INGEST-001` |
| A **newly discovered** fixture | **Administrative approval.** Proposed, never created automatically | `INGEST-002` |
| Removal, cancellation, abandonment, material identity change or material round change | **Administrative approval** | `INGEST-003` |
| Anything ambiguous — contradictory round data, unresolvable identity, invalid state | **Fails closed**, on the whole payload rather than per row | `INGEST-004` |

An approval or rejection records **the provider evidence, the operator, the decision and the resulting calendar change** (`INGEST-005`). All four: an approval that does not say what it was approving, or who approved it, is not an audit record.

**Provider data never becomes official result truth automatically** (`INGEST-006`). The protected confirmation and correction authority remains the only gate for scoring and progression, and nothing in the approval workflow may route around it.

Automatic fixture *creation* is therefore deliberately not the target. The target is a reliable proposal-and-approval workflow.

### Match Centre, reminders and history

After the basic playable Alpha, Match Centre increases in priority as the place where football activity connects to prediction consequences. Appropriate combinations include score/state, the player's prediction, provisional/final points, scoring explanation, post-lock consensus, H2H/rival comparison, private-league movement, LMS relevance and Championship matchup context. Provider/live state remains visibly provisional until protected official-result confirmation.

Deadline reminders move higher in the post-Alpha order. Initial eligibility is Match Predictor incomplete near lock and LMS selection missing near lock, derived from server-owned game/lock state and controlled by a simple user enable/disable preference.

Player/game history follows the core Alpha: Match Predictor matchweek/performance history, LMS runs/picks/elimination history and Championship fixture/result/table/phase/opponent history.

### Public landing page: define early, final visual build late

The acquisition landing page uses a two-stage approach.

**Define early:** settle the headline/proposition, Create account / Sign in actions, domestic positioning, concise three-game explanation, reserved phone-preview region, responsive order and accessibility requirements.

**Build the final visual landing page late:** the final phone-framed product walkthrough is implemented only after the principal signed-in journeys and visual language are settled. Any earlier landing implementation is an intermediate acquisition shell, not the final visual reference. The final page reuses the actual signed-in design language, shirt-style club identity, representative states and interaction patterns rather than forcing the application to copy a mock landing design.

The hero may contain a scripted, presentation-only phone walkthrough such as personalised Hub → Match Predictor completion → LMS selection → Championship context → Match Centre prediction impact → Hub. It uses fixed/local demonstration data and has no account/session dependency, live competitive API calls, prediction submission, clickable simulated controls or keyboard focus inside the simulated UI. Real acquisition CTAs stay outside the phone. It is labelled subtly as `Demo` / `Product preview`, respects `prefers-reduced-motion`, has a useful static reduced-motion state, pauses when page visibility is lost and avoids rapid flashing or distracting perpetual motion. Prefer one coherent walkthrough that comes to rest; a continuous loop has an external pause/play control.

On phone the conversion order is headline → proposition → Create account / Sign in → product preview. The landing page primarily **shows** how the product works instead of explaining every feature in long copy.

### Domestic Frontend Alpha delivery order

After currently active work settles and the present Development contract batch is stabilised/applied, the frontend programme proceeds in this order:

1. canonical weekly route/navigation replacement;
2. Euro/tournament-route absence on the weekly site;
3. deterministic parent/back navigation;
4. first-use onboarding and personalisation;
5. reusable shirt-style club identity;
6. truthful Scottish Matchweek 1 settled test state;
7. Scottish LMS beginning at Matchweek 2;
8. Scottish Predictor Championship beginning at Matchweek 2;
9. all-three-game usable surfaces for both domestic competitions;
10. private creation/join for all three game types;
11. Competition Play weekly-action aggregation;
12. Development competition-admin setup;
13. Match Centre engagement;
14. final personalised Hub Home;
15. lock the final signed-in visual language and representative product states;
16. build the final public landing page and scripted non-interactive phone preview from those settled states;
17. reminders and player history;
18. full phone-first Development acceptance journey.

The Development contract stabilisation/apply that precedes item 1 is operational prerequisite work, not a frontend step. Production promotion remains a separate controlled programme and is not authorised by this sequence.

## Detailed architecture authority

The route tree, page ownership, shell behaviour, onboarding detail, private-container presentation and responsive interaction rules live in [`../architecture/hub-information-architecture.md`](../architecture/hub-information-architecture.md). That document may elaborate this decision but may not reverse it.

Presentation/delivery sequencing lives in [`../design/ui-modernisation-execution.md`](../design/ui-modernisation-execution.md) and [`../roadmap.md`](../roadmap.md). Accepted-but-unimplemented additions are retained in [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md) until implementation evidence exists.

## Consequences

- The old `/games`-as-directory and League-is-Original-only information architecture is retired as the future Hub design. Compatibility paths may exist only during migration and do not remain a parallel weekly route tree.
- Global and competition shells are separate navigation contexts; implementation preserves a clear deterministic return path rather than nesting two full navigation systems.
- Table, Groups and Bracket are switchable Matches subviews, not permanent competition tabs.
- Match Predictor is the user-facing name; internal identifiers are not renamed merely for presentation consistency.
- Following, favourite-team preference and game membership are distinct concepts. None silently creates another.
- Creator caps keep one server-side authority and auditable exceptions; hiding the create button is insufficient.
- Private LMS managed entrants remain intentionally asymmetric with other games.
- The final public landing preview follows the signed-in product rather than becoming a second visual authority.
- Page-shaped read models should follow the surface list in the information-architecture document from the first implementation.
- No hosted database, Netlify, provider request, feature exposure or production change is authorised by this record.

## Rejected alternatives

- **Keep Home / Predict / Matches / League / More inside every competition.** Rejected: it preserves the tournament shell and makes the Hub hierarchy visually invisible.
- **Show global and competition navigation at the same time.** Rejected: two five-item systems compete for the same phone viewport and blur the user's current scope.
- **A permanent Table or Bracket competition tab.** Rejected: both are football-information views and belong in a well-designed, state-preserving Matches switcher.
- **Automatically join Match Predictor during onboarding.** Rejected: it breaks the independent opt-in law and repeats the observed failure where players did not understand games were separate.
- **Make favourite team a game/ranking input.** Rejected: it is personalisation only and must never affect competitive truth or urgency ordering.
- **Use browser history as the only back path.** Rejected: a deep link can be the first page opened and therefore has no useful history stack.
- **Use replica kits as the club identity requirement.** Rejected: the product needs recognisable reusable identity without making licensed-kit reproduction a dependency.
- **Unlimited private creation.** Rejected: free creation without an active/rate cap invites abandoned and spam containers, while a lifetime cap punishes legitimate repeat organisers.
- **Managed entrants in Match Predictor or Championship.** Rejected: proxying a full weekly card is an organiser workload that will not survive a season; ADR 0013's LMS-only boundary remains correct.
- **Expose the complete public table to every signed-in account.** Rejected: top-ten discovery is useful, while the full field is a participation benefit and creates unnecessary browsing/privacy surface for non-players.
- **Build the final landing animation before the signed-in UI settles.** Rejected: it either makes the real application copy a mock design or creates a second visual system that must be repeatedly reconciled.
