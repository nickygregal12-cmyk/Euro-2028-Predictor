> **Repository status.** This is the owner-supplied *Football Prediction Hub —
> Architecture and Modernisation Plan, revision 1.5* (4 August 2026), added to the
> repository verbatim as the **target design and UX authority**: what the product
> should look like and behave like when it is finished.
>
> It is a **presentation and delivery** authority. It does not change scoring,
> locks, memberships, settlement or any other rule — those remain governed by the
> ADRs, migrations and executable tests, exactly as the plan's own Document
> Control section states.
>
> **Its baseline is contract 93.** Section 2.1 reviews a snapshot of 93
> migrations and 69 pgTAP suites. `main` has since reached 97 / 73. Read
> Appendix D.2's reconciliation list against
> [`../quality/current-status.md`](../quality/current-status.md) before working
> from it — some of it may already be resolved.
>
> Converted from the supplied `.docx` for reviewability and diffing. The `.docx`
> remains the owner's master copy; if the two disagree, the `.docx` wins.

FOOTBALL PREDICTION HUB
Backend Readiness, Target Architecture and Frontend Replacement Plan
A controlled modernisation programme for the current Football Prediction Hub repository
Recommended decision
Stabilise and prove the backend contracts first, design the new product architecture in parallel, then replace the frontend journey by journey behind feature flags. Do not restart the repository and do not delete the existing UI before parity is proven.
Document status
Approved repository-confirmed architecture and UI/UX implementation plan
Snapshot reviewed
Euro-2028-Predictor-main (4).zip
Snapshot date
4 August 2026
Primary objective
Preserve tested backend/domain capability while replacing the signed-in product UI and introducing a premium public acquisition surface safely
Scope
Architecture, backend readiness, preserved product contracts, information architecture, public acquisition, standalone Euro positioning, UI states, design system, testing and rollout
Revision
1.5 - public acquisition landing page and standalone Euro 2028 authority integrated, 4 August 2026
Prepared from the repository snapshot and its current architecture, ADR, quality and design documentation.

# Document control
Item
Position
Authority
Accepted ADRs, later amendments, migrations, executable tests and explicit rule authorities govern implementation. Appendix D now restates the repository-confirmed contracts. This plan may organise delivery and presentation, but must not silently change those rules.
Change principle
Additive and reversible. Existing journeys remain available until their replacement passes behavioural, accessibility and operational gates.
Backend principle
Stable contracts matter more than an abstract claim that the backend is permanently finished.
Frontend principle
New pages consume typed read models and commands; they do not depend on raw Supabase table shapes.
Release principle
No big-bang cutover. Use flags, internal cohorts, comparison evidence and immediate rollback.

# Amendment — 6 August 2026: the Euro 2028 boundary is two sites, and Euro is hidden

**[ADR 0026](../adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md) supersedes this plan's Euro positioning.** Revision 1.5 integrated a "standalone Euro 2028 authority" written when there was one deployment; the owner has since decided a stronger boundary, and the parts of this plan that assume Euro 2028 is a visible section of the weekly product are **no longer the target**.

What changed:

| This plan says | Now |
| --- | --- |
| Euro reuses "the same account, **domain** and backend contracts" (§ Information architecture) | Same account and backend; **its own domain**. Two frontend deployments over one shared backend (`SITE-001`, `SITE-002`, `SITE-004`) |
| "Domestic users may discover Euro 2028" (§ E.6) | **Not while its publication state is hidden** (`EURO-001`). Discovery resumes only at an owner-approved publication state |
| Euro appears as an acquisition band on the weekly landing page, after the domestic competitions (§ E.3, § E.7) | **Absent from the weekly platform entirely** while hidden — landing content, Hub discovery, cards, navigation, metadata, sitemap, Open Graph and guessable routes (`EURO-003`). The landing band, the prototype band and the three `index.html` meta descriptions were removed on 9 August 2026; the server-owned guard is still `EURO-002`'s |
| The Euro experience is a shell within this design | **A separate site with its own information architecture**, not yet designed. It is not Appendix E with different copy |

What is unchanged: the domestic landing hierarchy, content order and design decisions in Appendix E that do not concern Euro; the E.4 token discipline; the E.6 rule that membership is never implied and no cross-product aggregate ranking exists — which ADR 0026 restates as `ACCOUNT-004` and strengthens rather than relaxes.

**This amendment changes presentation scope only.** It sets no scoring, lock, membership, settlement, progression or reveal rule, consistent with the Authority line above.

**The landing half is now implemented, 9 August 2026.** This paragraph used to say the opposite — that nothing was implemented and the sections below were deliberately not rewritten, because Appendix E, [`hub-landing-prototype.html`](hub-landing-prototype.html), `tests/design/landingPrototypeContract.test.ts` and `src/features/landing/` all agreed with each other and with revision 1.5, so removing Euro had to be one atomic change across all of them rather than a rewrite of this appendix alone.

That change has been made, across **five** files rather than four: the fifth is `index.html`, whose `description`, `og:description` and `twitter:description` all named Euro 2028 and which no list of the affected surfaces had caught. The prototype carries no Euro band and no Euro anything; the contract test asserts that absence instead of pinning the band's position; `LandingSectionId` has seven members rather than eight and `EuroSection` is gone; and `tests/features/landing/LandingPage.test.tsx` asserts the rendered page mentions Euro nowhere, over the whole document rather than over the removed section's id — a stray mention in the hero or the final call to action breaks the same requirement and leaves no `#euro` to look for.

**`EURO-003` is not thereby closed, and neither is `EURO-004`.** This is client-side absence from the landing and metadata surfaces. The server-owned publication state and the route guard that enforces visibility from the server remain unbuilt, which is `EURO-002`'s work; until they exist, absence is a property of this build rather than a rule the platform holds. The Hub catalogue, the retired tournament routes and now the landing page all point the same way, and none of them is the guard.

The weekly landing page is not publicly exposed in the meantime: `VITE_UI_PUBLIC_LANDING` is set for deploy previews only and production keeps the login redirect.

# Contents
1. Executive decision and guiding principles
2. Current repository baseline
3. Modernisation programme and operating model
4. Target technical architecture
5. Backend readiness programme
6. Frontend-facing contracts and read models
7. Target site and information architecture
8. Page and journey architecture
9. Complete UI state model
10. Feedback, toast, alert and notification architecture
11. Design system and interaction standards
12. Core product state machines
13. Frontend replacement and rollout sequence
14. Testing, quality and evidence strategy
15. Security, observability and operations
16. Governance, risks and definition of done
Appendix A. Canonical route map
Appendix B. UI state reference matrix
Appendix C. Suggested source structure
How to use this document
Treat Sections 4-6 as the technical boundary, Sections 7-12 as the product/UI authority, and Sections 13-16 as the controlled delivery method. A frontend journey should not enter build until its backend contract and state model are agreed.
Appendix D. Confirmed product contracts and owner-approved UI/UX authority
Appendix E. Public acquisition landing page and standalone Euro 2028 authority
01
Executive decision and guiding principles
The professional approach is a controlled replacement, not a repository restart.

## 1.1 Decision
The repository should keep its database, migrations, RLS policies, RPCs, domain rules, scoring engines, settlement logic, service modules, shared types and existing test evidence. The product interface should be rebuilt on top of stable, typed frontend contracts, with the outgoing UI retained as a behavioural oracle until each replacement journey is proven.
The target outcome
The core product remains operational even if every current page component is removed, because the product behaviour is available through tested commands, read models, jobs and administrator workflows.

## 1.2 Guiding principles
Principle
Required behaviour
Preserve proven behaviour
Do not rewrite scoring, locks, progression or settlement merely to support a visual redesign.
Stable contracts before screens
Agree the data, actions, errors and states needed by a journey before implementing its replacement page.
One source of truth
Competition, game, membership, prediction, result and standing state must each have one authoritative backend owner.
Fail closed
Unknown lock, permission, result or contract state prevents a dangerous write and explains the problem to the user.
Incremental release
Old and new journeys coexist only temporarily; flags and redirects provide safe activation and rollback.
Explainability
Every score, lock, ranking movement and blocked action must be explainable in the UI.
Mobile first, not mobile only
Core actions are optimised for phones while desktop gains density and persistent navigation.
Accessible by construction
Focus, semantics, contrast, reduced motion and error recovery are component-level contracts.
Operational evidence
A change is complete only when logs, metrics, tests and release evidence prove it in the hosted environment.

## 1.3 What this plan deliberately avoids
A new repository with duplicated history, migrations and deployment controls.
A simultaneous backend and frontend rewrite.
A frontend that queries raw tables from page components.
A permanent second information architecture made from legacy Euro routes.
A big-bang release across all routes and game types.
Waiting for every possible future game before starting any UI replacement.
Treating visual parity as sufficient when behavioural states are missing.
02
Current repository baseline
The snapshot already contains the hard parts worth protecting.

## 2.1 Scale of the reviewed snapshot
Area
Snapshot scale
Interpretation
Application source
364 files
Substantial feature, domain, service and design-system implementation.
Routes
50 Route elements
A mature but transitional route structure containing Hub, Euro and bonus-game paths.
Design system
29 React components
Useful behavioural components exist, even if the visual language is replaced.
Vitest-style tests
257 files
Broad unit, integration and contract coverage.
Browser tests
21 Playwright specs
Important user journeys and accessibility checks are already represented.
Database migrations
93 files
The database is a versioned product, not incidental storage.
Database tests
69 pgTAP suites
RLS, RPC and data-rule behaviour can be preserved through change.
Documentation
201 files
The repository includes ADRs, architecture, risk, reconciliation and rollout evidence.

## 2.2 Existing strengths to retain
Pure domain modules for tournament and season rules.
Supabase service modules that already keep most components away from direct database calls.
Competition-season and game-membership architecture already progressing beyond a single tournament.
Separate tournament, Match Predictor, Last Man Standing and Predictor Cup authorities.
Row-level security, RPC permission tests and migration parity controls.
Prediction save coordination, write-conflict handling and foreground refresh behaviour.
Admin result entry, revision and third-place resolution workflows.
Reusable loading, alert, toast, modal, skeleton, empty-state and status components.
Sentry integration and release identity foundations.
Extensive quality documentation that can act as regression evidence during replacement.

## 2.3 Current structural tension
The codebase has moved from a single Euro tournament product toward a multi-competition Football Prediction Hub. The backend and ADRs increasingly model competition seasons and independent games, while many visible routes and journeys remain Euro-first. That is a valid reason to replace the interface architecture, but not to discard the underlying rules and data controls.
Current tension
Target correction
Global and Euro-specific routes coexist at the same level
Introduce canonical Hub -> competition season -> game routes and redirect legacy paths.
Some season games exist more strongly in database/domain code than UI
Finish backend read models and settlement jobs before building their final surfaces.
Pages may assemble data from several services
Introduce one page-oriented query/read model per major surface.
UI components contain product state decisions
Extract state machines and action policies into application/domain modules.
Historical quality material increases repository complexity
Retain evidence but separate active authority, generated evidence and archive navigation.
03
Modernisation programme and operating model
Backend stabilisation and frontend design overlap, but implementation crosses stable contracts only.

## 3.1 Parallel workstreams
Workstream
Starts now
Gate before production use
A. Backend readiness
Schema, permissions, game engines, settlement, read models, jobs, reliability, observability.
Core journeys pass database, service and hosted rehearsal evidence.
B. Product and UI discovery
Information architecture, journey maps, wireframes, states, component contracts, prototypes.
Design authority covers happy, empty, loading, locked, failed and recovery states.
C. Frontend contract layer
Typed page models, commands, error taxonomy, cache and invalidation rules.
No replacement page requires raw database knowledge.
D. Incremental replacement
Begins once the relevant A-C slice is stable.
Parity, accessibility, performance, telemetry and rollback gates pass.

## 3.2 Team model used by a larger company
Product/architecture owns scope, route hierarchy, state definitions and acceptance criteria.
Backend/database owns migrations, policies, RPCs, jobs, idempotency and operational evidence.
Frontend owns page models, shell, components, accessibility, performance and feature-flag integration.
Design owns information architecture, prototypes, responsive behaviour and state coverage.
Quality owns regression packs, exploratory evidence, accessibility and release sign-off.
Operations/security owns monitoring, backup restore, incident response and permission review.

## 3.3 Delivery rule
Vertical slices, not horizontal completion
A company would not declare the entire backend finished and only then begin all frontend implementation. It would stabilise the backend contract for one journey, build and release that journey safely, then repeat. Backend platform work and UI design can continue in parallel.
04
Target technical architecture
A layered system with explicit dependency direction and frontend-facing contracts.

## 4.1 System context
Target dependency flow
Users / Administrators        |        vWeb/PWA client (React)        |        vApplication contract layer(page queries, commands, state policies, cache/invalidation)        |        +--------------------+        |                    |        v                    vDomain authorities      Supabase service adapters(scoring, locks,        (RPC/query mapping,progression, games)      auth/session, errors)        |                    |        +---------+----------+                  v      Supabase PostgreSQL + Auth(schema, RLS, RPCs, jobs, audit, realtime where justified)                  |                  vProvider ingestion / email / monitoring / backups

## 4.2 Layer responsibilities
Layer
Owns
Must not own
Presentation
Layout, responsive rendering, accessible interaction, local view state.
Scoring rules, permission truth, raw SQL/RPC mapping.
Application
Use cases, page queries, commands, orchestration, cache keys, invalidation, state policies.
Visual styling or database-specific row shapes.
Domain
Pure rules: scoring, locks, ranking, progression, eligibility, settlement calculations.
Network calls, React, browser storage.
Service adapters
Supabase calls, DTO mapping, error normalisation, auth/session access.
Page layout or duplicated business rules.
Database
Authoritative persistence, constraints, RLS, atomic RPCs, audit, scheduled settlement.
Presentation-specific formatting.
Operations
Ingestion, monitoring, backup, restore, release and incident workflows.
User-interface state decisions.

## 4.3 Dependency rules
1. Pages import application queries/commands and design-system components.
2. Application modules may import domain authorities and service interfaces.
3. Service implementations map to Supabase but expose database-neutral types.
4. Domain modules import neither React nor Supabase.
5. Database rules that affect competitive truth have TypeScript parity or an explicit single-authority decision.
6. No page component calls supabase.from or supabase.rpc directly.
7. No UI flag overrides server-side permission, lock or eligibility truth.

## 4.4 Suggested runtime boundaries
Boundary
Purpose
Public/auth shell
Anonymous conversion landing page, authentication, invitation recovery, capacity checks and onboarding. It must not expose the full signed-in information architecture before the user needs it.
Hub shell
Global Home, Play, Matches, Leagues and More across followed competitions.
Competition shell
Overview, Play, Matches, Games and Leagues for one competition season.
Game shell
Game-specific home, entry/picks, standings, rules and private containers.
Admin shell
Capability-scoped result, user, competition and operations tools.
Background workers/jobs
Submission, result confirmation effects, settlement, standings refresh and notifications.
05
Backend readiness programme
Backend-ready means stable, tested and operable through contracts - not merely present in tables.

## 5.1 Backend readiness definition
Backend-ready milestone
A user can authenticate, join a supported game, create or resume an entry, save valid predictions, lock correctly, receive official scoring, appear in standings, join private play and survive result correction through tested services and administrator processes without depending on current page-specific logic.

## 5.2 Workstream A - schema and migration integrity
Reconcile repository, development and production migration contracts and document intentional differences.
Prove zero-to-current rebuild on disposable infrastructure.
Classify migrations as schema, data, policy, RPC, operational or compatibility changes.
Remove or quarantine obsolete WC26/early Euro assumptions only when evidence proves they are no longer referenced.
Make competition-season and game identifiers mandatory at authoritative boundaries where the product model requires them.
Ensure every uniqueness, foreign-key and same-season safeguard matches the multi-competition model.
Keep production promotion deliberate and separately gated from development progress.

## 5.3 Workstream B - authentication, identity and authorisation
Capability
Backend requirement
Authentication
Sign-up, login, reset, update-password, email verification and session refresh behave consistently.
Profile identity
Moderated display name and profile ownership have one authoritative lifecycle.
Invitation recovery
Pending invite survives authentication and resumes at the intended competition/game/container.
Capacity
Public caps are server enforced and return a typed capacity state.
RLS
Anonymous, authenticated, owner, member, organiser and admin access are tested adversarially.
Admin capabilities
Access is capability-based, server verified and fail closed; UI visibility is not security.
Account erasure
Blocked until the approved legal/data-protection boundary is settled; no convenience implementation.

## 5.4 Workstream C - competition, season and game platform
Competition season is the football context; game membership is separate for every game.
Following a competition is not the same as joining a game.
Each game has explicit availability, entry status, lock policy, scoring policy and private-play capability.
Competition and game catalogues remain visible in unavailable/not-open states rather than disappearing silently.
Historical seasons, honours and standings remain independently queryable.
No aggregate cross-game score is introduced unless an explicit future product decision creates one.

## 5.5 Workstream D - game engines and settlement
Game/system
Readiness requirement
Euro Original Predictor
Groups, third-place selection, bracket, awards/jokers, review, editable-until-lock submission intent, complete-entry auto-submission, scoring, standings and correction remain regression-safe.
Match Predictor
Recurring matchweek scheduling, empty-start cards, blank fixtures scoring zero, untouched matchweeks remaining unbanked, entered-pick submission at lock, rolling entry, whole-matchweek Jokers, fixture reassignment, scoring and standings are complete.
KO Predictor
Round-specific rolling entry, drawn-score advancement choice, per-match lock, scoring and separate standings are complete; it does not invent a tournament-wide submit event.
Last Man Standing
Season LMS and tournament LMS retain separate missed-pick rules. Season LMS uses deterministic eligible-team auto-assignment; tournament LMS retains no-pick elimination. Selection, reuse, reset, postponement and settlement jobs are proven.
Predictor Championship
The user-facing Championship contract is complete while compatibility identifiers may remain Predictor Cup. It compares the same underlying Match Predictor matchweek points and keeps separate football-style standings and progression.
Result administration
Confirm, correct, clear and replay produce audited, deterministic downstream effects.

## 5.6 Workstream E - commands and transactional safety
Command property
Required implementation
Atomic
A user action either completes fully or leaves no partial competitive state.
Idempotent
Retries do not create duplicate entries, submissions, results, points or notifications.
Version aware
Writes carry expected version/updated-at evidence where concurrent editing matters.
Lock aware
The server evaluates lock state at write time using authoritative competition time.
Permission aware
The server verifies membership, ownership and capability on every mutation.
Audited
High-impact admin and settlement commands record actor, time, reason and before/after evidence.
Replay safe
Result corrections can recompute affected derived data deterministically.

## 5.7 Workstream F - read models
The replacement frontend should not compose complex screens by calling many unrelated services. Create page-oriented read models that return everything needed to render a surface consistently, with explicit freshness and partial-data rules.
Read model
Includes
HubHomeModel
Followed competitions, favourite, primary action, urgent actions, live matches, recent movement and discovery.
GlobalPlayModel
Actions grouped by urgency/deadline with competition and game identity.
CompetitionOverviewModel
Competition status, next/live fixtures, joined games, progress, rank, leagues and available games.
GameHomeModel
Membership, entry, status, next action, deadline, progress, rank and rule summary.
PredictionWorkspaceModel
Fixtures/stages, existing values, lock, validation, save version and submission state.
MatchCentreModel
Official/live state, user pick, provisional/final points, explanation, league context and related game state.
LeagueDetailModel
Container metadata, table, movement, member permissions, pagination and invitation state.
AdminResultWorkspaceModel
Fixture result state, provider evidence, revisions, downstream impact and available commands.

## 5.8 Workstream G - background processing and operations
Official/provisional provider ingestion remains separate from confirmed competitive truth.
Recurring submission and settlement jobs are observable, retryable and idempotent.
Every job records last success, last failure, processed range, retry count and correlation ID.
Stale provider data fails closed for competitive mutations but may render clearly labelled information.
Manual administrator fallback exists for every tournament-critical automated process.
Backup restore and application rollback are rehearsed rather than assumed.

## 5.9 Backend-ready exit checklist
Gate
Evidence required
Contracts
Versioned query/command schemas and typed errors are documented.
Database
Rebuild, migration parity, lint, pgTAP and generated types pass.
Security
RLS/grant/capability tests pass for positive and adversarial cases.
Core journeys
Headless integration tests prove join -> predict -> lock -> result -> points -> standings -> correction.
Jobs
Scheduled/retry behaviour is demonstrated with failure injection.
Operations
Monitoring, backup restore, incident and admin fallback are rehearsed.
Performance
Representative weekend and tournament traffic remains within agreed budgets.
06
Frontend-facing contracts and read models
The new interface should depend on product concepts, not database implementation details.

## 6.1 Query and command separation
Type
Purpose
Examples
Query
Returns render-ready state; safe to repeat and cache.
getHubHome, getCompetitionOverview, getPredictionWorkspace, getMatchCentre.
Command
Attempts a user/admin state transition; returns authoritative result.
joinGame, savePredictions, submitEntry, confirmResult, correctResult.
Policy
Explains whether an action is available and why.
canEditPrediction, canJoinGame, canCreateLeague, availableAdminActions.

## 6.2 Standard query envelope
Illustrative TypeScript
type QueryEnvelope<T> = {  data: T;  generatedAt: string;  freshness: 'live' | 'recent' | 'stale';  partial: boolean;  warnings: ProductWarning[];  contractVersion: number;};

## 6.3 Standard command result
Illustrative TypeScript
type CommandResult<T> =  | {      ok: true;      data: T;      message?: string;      newVersion?: string;      invalidates: CacheKey[];    }  | {      ok: false;      error: ProductError;      retryable: boolean;      currentVersion?: string;    };

## 6.4 Error taxonomy
Code family
Meaning
Default UI treatment
validation.*
Input is incomplete or invalid.
Inline field/section message; preserve user input.
auth.*
Session or identity problem.
Re-auth flow or blocking page; preserve intended destination.
permission.*
User lacks required capability.
Blocked state with explanation; no retry button unless access may change.
lock.*
Action is outside the valid time window.
Locked state showing authoritative deadline and saved value.
conflict.*
Stored state changed since the user loaded it.
Conflict panel with refresh/compare; never silently overwrite.
capacity.*
Public or owner limit reached.
Capacity state with next permitted action.
availability.*
Game, provider or competition is not currently available.
Unavailable state with status/reason.
network.*
Connection failed or request timed out.
Retryable alert/toast; offline state where detected.
contract.*
Client/server contract mismatch.
Fatal update-required screen and telemetry.
server.*
Unexpected backend failure.
Generic recovery message plus correlation ID; detailed error only in telemetry.

## 6.5 Cache and invalidation rules
Cache by competition season, game, entry, league and fixture identifiers - never by screen title.
A successful command returns the exact cache keys to invalidate or update.
Live match information may refresh frequently; official standings refresh only after authoritative settlement.
Returning to the foreground revalidates lock-sensitive and live-sensitive models.
Stale locked predictions may render read-only offline when last-known data is explicitly labelled.
Unknown freshness is not presented as live or official.
07
Target site and information architecture
The signed-in Hub is global for the recurring domestic product; competition season is context; each game remains independently joined and scored. Euro 2028 may use a separate acquisition shell while reusing the same account, domain and backend contracts.

> **Amended 6 August 2026 — see the amendment above Contents.** Euro 2028 reuses the account and backend contracts but **not the domain**: it is a separate frontend deployment on the purchased tournament domain (`SITE-004`), and it is hidden from this Hub entirely until an owner-approved publication state (`EURO-001`).

## 7.1 Product hierarchy
Football Prediction Hub (recurring domestic product)|+-- Scottish Premiership season+-- Premier League season|   +-- Overview|   +-- Play / action inbox|   +-- Matches and football information|   +-- Independently joined games|   +-- Private leagues / competitions|+-- Shared account, identity and platform services|+-- Euro 2028 standalone acquisition experience    +-- Dedicated public entry and tournament shell    +-- Reuses approved tournament rules and backend contracts    +-- Offers an explicit, optional path into the domestic Hub

## 7.2 Global shell
Navigation item
Purpose
Hub
Cross-competition dashboard with one primary action, live football, followed competitions and direct return to the platform home.
Predict
Global action inbox grouped by urgency and deadline. The route may remain /play for compatibility while the public label becomes Predict.
Leagues
All joined private leagues and private competitions, clearly separated by game and competition season.
Games
Game and competition discovery, joined games first and available formats second.
More
Profile, account, notifications, preferences, rules, accessibility, support, legal and capability-gated administration.

## 7.3 Competition shell
Navigation item
Purpose
Overview
State-driven competition dashboard.
Play
Actions for all games joined in this competition.
Matches
Fixtures/results/table or groups/bracket/stats.
Games
Joined games first, available games second.
Leagues
Competition-scoped private leagues and competitions.
Navigation ruleThe global desktop rail remains global and remains visible inside competition context. It never swaps its destinations. Competition identity lives in a masthead at the top of the content column, followed by a horizontal sub-navigation: Overview, Play, Matches, Games and Leagues. The Hub therefore remains one click away without a compensating Back to Hub control.

## Desktop rail contract
Expanded width: 240px. Collapsed width: 64px icon rail. The user's choice is persisted.
The rail contents are always Hub, Predict, Leagues, Games and More; competition context never mutates their order or meaning.
Competition masthead contains the competition mark, name and a live status strip such as deadline, matchday and current rank.
Competition sub-navigation uses a shared-layout underline transition and remains horizontally scrollable on narrow screens.
Provide a command palette opened by Command-K on macOS and Control-K elsewhere. Initial commands: jump to a league, team or fixture; open a competition/game; toggle theme; and navigate to core destinations.

## 7.4 Game shell
Every game uses the same structural contract while retaining game-specific content. A typical game shell contains Home, Play/Picks, Standings, Leagues/Competitions and Rules. Tournament Original Predictor may use stage-specific steps inside Play rather than exposing every stage as a global route.

## 7.5 Onboarding
1. Complete account identity and verification.
2. Choose competitions to follow; optionally mark a favourite.
3. Choose supported games independently. Nothing is silently preselected.
4. Join or create private play, or skip.
5. Resume any invitation at its exact competition, game and container.
08
Page and journey architecture
Each page has a defined purpose, primary action and complete state coverage.

## 8.1 Hub Home
Order
Surface
Behaviour
1
Compact masthead
Brand, live/season context and notification access without consuming the viewport.
2
Primary action
Single highest-value action based on urgency, lock and current game state.
3
Secondary actions
At most two compact actions.
4
Live matches
Moves above ordinary browsing when any followed match is live.
5
Favourite competition
Progress, next action, live/next fixture and key movement.
6
Other competitions
Compact cards with honest status.
7
Recap
Recent results, weekly performance and league movement.
8
Discovery
Available competitions/games without displacing urgent work.

## 8.2 Play/action inbox
Groups actions as Urgent, This week and Complete/waiting.
Names competition season and game on every card.
Shows deadline, remaining work, lock state and exact destination.
Keeps completed/locked tasks visible in a quiet waiting state so users understand what happens next.
Does not require users to visit each game home merely to discover an action.

## 8.3 Competition Overview
State
Dominant content
Pre-season/open
Join/start action, opening deadline, available games and setup progress.
Active, no live match
Next action, upcoming fixtures, joined games, standings movement.
Live
Live fixtures dominate; urgent locks remain visible.
Between rounds/matchweeks
Recap, next opening time, standings and upcoming actions.
Completed
Final standings, honours, recap and archive/share actions.
Unavailable/maintenance
Reason, impact, last-known safe information and recovery guidance.

## 8.4 Prediction workspace
Persistent stage/matchweek identity and authoritative lock time.
Progress summary showing completed, incomplete, invalid and locked items.
Fast phone entry with appropriate numeric controls and keyboard behaviour.
Auto-save with visible local/saving/saved/error/conflict state.
Review step for high-impact tournament submissions or whole-card actions.
Locked view preserves the user entry and explains scoring/next steps.
Correction-safe refresh when official fixtures, teams or kickoff times change.

## 8.5 Match Centre
Block
Content
Match status
Scheduled, delayed, live, suspended, postponed, abandoned, finished, confirmed or corrected.
User prediction
Saved value, joker/method choice, lock state and change history where appropriate.
Scoring
Provisional/final points and human-readable explanation.
Context
Table/group/bracket implications and relevant LMS/Championship state.
Social
Pre-lock entry detail is owner-only. After the relevant lock, reveal follows the game authority; Euro Original Predictor detail is public to any signed-in player, while league-context named picks remain scoped to that league.
Navigation
Previous/next match and return location preserving date/filter context.

## 8.6 League and private competition detail
Header names competition season -> game -> container.
Standings table explains ties, movement and provisional/final state.
Member list and creator tools are capability-driven.
Invitation, ownership transfer, archive/copy and participant actions are auditable.
Pagination or virtualisation is supported for realistic field sizes.
Empty/new league state provides invite action and explains when standings will appear.

## 8.7 Admin workspace
Optimised for certainty and auditability rather than consumer visual style.
Provider evidence and current official truth are visually distinct.
Confirm/correct/clear actions display downstream impact before commitment.
Every destructive or competitive-impact action requires explicit confirmation and reason.
Revision history, actor, timestamp, job status and correlation IDs remain visible.
Bulk operations are bounded, previewable and restartable.

## 8.8 Sharing and acquisition surfaces
Sharing is contextual; there is no standalone Share destination.
Place share actions on overall/private-league standings, weekly performance recaps and relevant competition results. Tournament bracket/champion cards remain a format-specific tournament artefact.
Generate share images on the server with a deterministic renderer such as Satori/Resvg or an equivalent. Do not use client-side canvas screenshots.
Use one generator with entity-specific templates: standings snippet, weekly recap and bracket/champion card.
Phone: invoke the native share sheet. Desktop: provide copy-link and image download actions.
Every image includes a readable competition mark and a deep link. Shared artefacts are treated as acquisition surfaces and must meet the same typography, crest and contrast standards as the product UI.
09
Complete UI state model
The new UI is designed around states first, then screens.

## 9.1 Page data states
State
Definition
Required treatment
Initial loading
No usable model is available yet.
Layout-matched skeleton; stable shell/navigation; no false empty state.
Refreshing
Usable data exists while newer data is requested.
Keep content visible; subtle progress; disable only actions whose truth is uncertain.
Ready
Complete current model is available.
Normal rendering.
Partial
Some non-critical blocks failed or are unavailable.
Render usable content plus block-level warning/retry.
Empty
Successful query returned no domain items.
Purpose-built empty state with explanation and next action.
Unavailable
Feature/data intentionally cannot be supplied.
Explain scope, reason and expected recovery where known.
Error - retryable
Request failed and repeating may succeed.
Alert with retry; preserve previous content/input.
Error - blocking
Contract/security/config failure prevents safe rendering.
Full-page error, support/correlation information and telemetry.
Stale
Last-known data is usable but freshness threshold is exceeded.
Label timestamp/freshness; restrict sensitive writes.
Offline
Browser has no network or request confirms disconnection.
Offline banner; preserve local/last-known state; queue only explicitly safe actions.

## 9.2 User action states
State
Meaning
UI behaviour
Idle
Action is available and untouched.
Normal enabled control.
Dirty/local
User changed a value not yet acknowledged by server.
Local indicator; avoid implying saved.
Saving
Command is in progress.
Prevent duplicate command while keeping the edited control readable and responsive; show persistent inline Saving… status beside the affected workspace.
Saved
Server acknowledged current version.
Persistent inline acknowledgement: Saved · HH:MM. Fade from Saving to Saved using opacity only. Auto-save never produces a toast.
Validation blocked
Input does not meet rules.
Inline messages and summary; focus first invalid field on submit.
Conflict
Server state changed after load.
Do not overwrite; offer refresh/compare/reapply.
Failed - retryable
Command failed without changing competitive state.
Preserve input; inline error and retry.
Failed - unknown outcome
Network ended before outcome is known.
Re-query authoritative state before allowing another mutation.
Completed
One-time action succeeded.
Replace action with result/next step.
Disabled by policy
Not permitted for current user/state.
Explain reason; do not rely on colour alone.

## 9.3 Prediction and lock states
State
Definition
Presentation
Not started
No values saved.
Start action and deadline.
In progress
Some valid values saved.
Progress count, continue action, auto-save state.
Complete draft
All required values valid but final submission not required/complete.
Review or submitted-as-draft explanation.
Submitted
Entry/card explicitly confirmed where the game records completion intent; this does not itself create the authoritative lock.
Confirmation and timestamp; remain editable until the game-owned deadline where the repository rule permits reopening.
Lock approaching
Within warning threshold.
Persistent deadline warning; no panic animation.
Locked
Authoritative deadline passed.
Read-only values, lock timestamp and next scoring step.
Auto-submitted
A game-specific lock process banked eligible saved work.
Explain exactly what was included or left blank. Never create a default prediction.
Incomplete at lock
The deadline passed with missing work; consequence is game-specific.
Euro incomplete entries are not submitted; Match Predictor banks only entered fixtures on an interacted card; season LMS applies deterministic missed-pick assignment; tournament LMS retains no-pick elimination.
Fixture changed
Kickoff/team/round changed after entry.
Explain impact and whether re-entry is required.
Voided/cancelled
Prediction no longer scores.
Retain history and explain why.

## 9.4 Match and result states
State
Authoritative meaning
Scoring treatment
Scheduled open
Fixture exists and relevant prediction window is open.
Editable if game policy allows.
Scheduled locked
Fixture exists but prediction window is closed.
Read-only; no points yet.
Delayed
Kickoff delayed but fixture remains active.
Lock policy follows authoritative rule; do not guess.
Live provisional
Provider/live score available but not confirmed.
Display clearly provisional; provisional points optional and labelled.
Suspended
Match started but is temporarily stopped.
No final settlement.
Postponed
Fixture will not complete as scheduled.
Apply the game authority. Domestic Match Predictor reassigns the fixture to the new round and makes its prediction editable under that round lock; the locked originating round never reopens.
Abandoned
Started but not validly completed.
Await official policy/confirmation.
Finished unconfirmed
Provider says complete but admin/system has not confirmed official truth.
No final competitive settlement.
Confirmed
Official result accepted.
Settle scores and standings.
Corrected
Official result changed after confirmation.
Replay affected scoring with visible revision.
Voided
Fixture excluded from scoring.
Explain zero/neutral treatment.

## 9.5 Membership and availability states
Object
States
Competition follow
not followed, followed, favourite, archived/unfollowable.
Game catalogue
available, recommended, not open, unavailable, closed, retired.
Game membership
not joined, joining, active, left, rejoined, disqualified, completed.
Entry
not created, creating, active, locked, submitted, withdrawn where lawful, disqualified.
Private container
not joined, invited, pending approval, active, full, archived, removed, ownership transfer pending.
Admin capability
checking, authorised, unauthorised, expired/revoked, temporarily unavailable.

## 9.6 Standings and scoring states
No standings yet: competition/game has not generated score-bearing events.
Provisional: live or unconfirmed results are included only if product policy permits and are visibly labelled.
Settling: official result is confirmed but downstream job is still processing.
Final/current: all confirmed events through the displayed cutoff are settled.
Corrected/recalculating: a revision is replaying; prior positions remain labelled as superseded or temporarily stale.
Tied: ranking explanation exposes the exact tiebreak sequence.
Unavailable: standings cannot be trusted due to contract/job failure; do not show stale values as current.

## 9.7 Authentication and session states
State
Required behaviour
Anonymous
Public/invite preview only; preserve intended destination through auth.
Authenticating
Disable duplicate submit; announce progress.
Authenticated, profile incomplete
Route to onboarding without losing invite.
Authenticated, ready
Enter Hub or intended destination.
Session refreshing
Keep safe content visible; temporarily pause mutations if token truth is uncertain.
Session expired
Explain and re-authenticate; preserve unsent local input where safe.
Email unverified
Show verification action and resend throttling.
Rate limited
Show retry timing where supplied; prevent repeated requests.
Capacity blocked
Explain account/competition capacity and permitted alternatives.
10
Feedback, toast, alert and notification architecture
Messages are selected by persistence, urgency and whether the user must act.

## 10.1 Feedback hierarchy
Pattern
Use for
Do not use for
Inline field message
Input validation tied to one control.
System-wide failure or transient save confirmation.
Inline section status
Auto-save, completeness, lock and local conflict within a workspace.
Unrelated global notices.
Alert/banner
Persistent warning/error, partial data, offline, maintenance, lock urgency.
Routine success after every keystroke.
Toast
Brief non-blocking events that happened away from the user's current interaction, such as an invite being accepted, results being published or a rival moving above them.
Auto-save, visible on-screen results, destructive confirmation, validation detail or long instructions. If the outcome is already visible where the user acted, do not toast it.
Modal
High-impact decision requiring explicit confirmation.
Routine navigation or information that can be inline.
Bottom sheet
Mobile choice/action set with clear dismissal.
Critical content that must remain visible.
Notification/inbox item
Time-shifted event the user may need later.
Immediate validation or current-page errors.
Full-page state
Blocking auth, contract, maintenance or unrecoverable route error.
Small partial-data failure.

## 10.2 Toast catalogue
Variant
Example
Rules
Success
Invite accepted. Results published. Weekly recap ready.
3-5 seconds. Use only when the event is not already evident in the active surface. Undo appears only when truly reversible.
Info
You are back online. A background refresh completed.
Neutral; may link to more detail.
Warning
Deadline changed. A remote change needs review.
Use only when user attention is beneficial but work is not blocked.
Error
Background action failed - retry. Copy/share failed.
Keep until dismissed or actioned when recovery is required.

## 10.3 Toast behaviour contract
Top-level toast region is announced with an appropriate ARIA live priority.
Toasts never steal focus.
Duplicate events are coalesced. Auto-save never creates a toast.
Show at most two toasts. Critical or persistent failures are promoted to an alert anchored to the failing surface.
Error toasts include a direct retry only when retry is safe and idempotent.
A toast is not the sole evidence of a completed competitive action; the page state also updates.
Motion respects reduced-motion preferences.
Phone placement: bottom-centre above the global navigation and device safe area. Desktop placement: bottom-right.
Auto-save is ambient inline state beside the edited object: Saving... -> Saved · 14:02. Transition between states with opacity only; do not congratulate routine persistence.
Toasts are reserved for events away from the user's cursor or current focus. When the result is visible in the active surface, update the surface and omit the toast.

## 10.4 Persistent banners and alerts
Situation
Treatment
Offline
Global persistent banner; explain which information is last-known and which actions are unavailable.
Maintenance
Global or competition-scoped banner with impact and status link/message.
Approaching lock
Competition/game-scoped warning attached to relevant action; countdown uses authoritative time.
Partial data
Block-level warning so usable sections remain visible.
Contract mismatch
Blocking full-page update-required state.
Result correction
Contextual information banner in affected match/standings surfaces.
Admin settlement backlog
Admin-only warning with job age and recovery action.

## 10.5 Confirmation patterns
Action type
Pattern
Routine save
No modal and no toast. Commit optimistically, then show persistent inline status beside the edited object: Saving... -> Saved · HH:MM, or an anchored error/conflict state.
Confirm completed entry/card
Review page or confirmation sheet summarising missing items and scoring effect. State clearly that confirmation records intent and edits remain possible until the authoritative deadline where the game permits them.
Leave game/league
Confirmation showing lost access or scoring effect.
Delete/archive/correct result
Typed reason plus impact preview; admin audit evidence.
Overwrite after conflict
Never a single generic confirm. Show current server state and proposed resolution.

## 10.6 Notifications
Deadline reminders are consolidated by competition/game to avoid notification fatigue.
Result, rank and league movement notifications link to the exact context.
Operational incidents notify administrators separately from user-facing product messages.
Users control preferences by event family and channel; competition/game membership is not changed by notification preference.
Notification generation is idempotent and auditable.
The canonical history is one /notifications route and one shared component. On desktop the bell presents it as an overlay/panel; on phone the bell pushes the full-screen route.
Opening the notification centre never marks everything read. Read state clears per item on interaction, or through an explicit Mark all read action.
Group bursty events by entity and context, for example: 3 updates in Saturday Night League, rather than emitting three near-identical rows.
Use a dot for ordinary unread state. Counts cap at 9+. Red is reserved for genuine action-required urgency such as an incomplete entry with under one hour to lock; social updates use neutral treatment.
Repository-confirmed rehearsal rule: send in-app and email reminders one hour before lock only when that game has incomplete predictions.
Users control reminders separately by competition and by game. Web push remains a later PWA/app-shell phase rather than first-release scope.
11
Design system and interaction standards
Reuse behavioural contracts; replace visual styling deliberately and consistently.

## 11.1 Token architecture
Token group
Examples
Colour
A 12-step neutral ramp; three distinguishable surface levels in both themes; a separate border ramp; semantic text/status tokens; one competition hue token with derived contrast-safe tint, border and on-colour stops.
Typography
Six-step type scale. Retain a competent UI/body grotesque, add one display family for mastheads, scores and major stat moments, and apply tabular numerals to every numeric surface. Tracking tightens above 24px and opens below 13px through tokens.
Spacing
Strict 4px base scale only. Shell gutters, component padding, row gaps and section rhythm must resolve to the scale; remove arbitrary off-scale values.
Shape
Exactly three radii: controls/chips, cards and sheets/dialogs. Never use nested-equal radii; an inner radius is derived from outer radius minus the surrounding padding.
Elevation
Light theme may use restrained shadow where required. Dark theme elevates by moving to a lighter surface step, not by adding shadow. Sticky navigation, modal and toast elevation remain tokenised.
Motion
120ms micro feedback, 180ms enter, 240ms sheets; ease-out entering and ease-in exiting. Nothing over 300ms except the single 400ms points-resolution signature. Reduced-motion preserves feedback but removes travel.
Responsive
phone, large phone, tablet, desktop, wide data view.
Z-index
content, sticky, navigation, overlay, modal, toast.
Borders
1px low-contrast hairlines for structure only, never emphasis. Border colour is selected from the separate border ramp rather than reusing text or accent colours.
Competition accent
Accent may touch only: active navigation indicator, the single primary action in a view, focus ring and masthead treatment. It never recolours semantic statuses, body text, prose links, chart series or table emphasis. Build-time contrast checks substitute the nearest passing derived stop when required.

## Primitive re-derivation rule
Preserve semantic names, theme switching and tested accessibility behaviour, but re-derive the primitive token values before rebuilding layouts. The replacement should not inherit the current visual values by default.
Dark surfaces must be distinguishable without relying on borders. Hairlines organise content; surface steps communicate elevation.
Competition masthead treatment is a flat tint band or subtle geometric mark, never a gradient-heavy hero treatment.

## 11.2 Foundation components
Button, icon button, link and destructive action.
Text, email, password, numeric and score inputs.
Checkbox, radio, segmented control, tabs and choice sheet.
Alert, toast, badge, status chip and progress indicator.
Layout-matched skeleton, empty state, error state and unavailable state. Do not use generic loading spinners for known page/component shapes.
Modal, dialog, bottom sheet, popover and menu.
App bar, global bottom navigation, persistent 64/240px desktop rail, competition masthead, horizontal sticky sub-navigation, page shell and constrained contextual rail.
Table, canonical repeated-row primitive, responsive action-card list, pagination and virtualised list where required.

## 11.3 Domain components
Competition card, game card, action card and deadline card.
Match card, live match card, score input, team/club identity and venue line.
Group table, league table, third-place table and bracket round.
Prediction progress, save status, lock banner and scoring explanation.
Player chip/profile summary, rank movement and head-to-head summary.
LMS pick card, lives/saves indicator and elimination state.
Championship fixture/table card and Predictor Cup tie card.
Admin result editor, provider evidence panel, revision timeline and impact preview.

## 11.4 Repeated rows and table contract
A card is used only for an object with state the user can act on. Everything else is a row.
Cards include entry status, deadline blocks, league invitations and unstarted bonus games. Rows include fixtures, standings, results, settings, notifications, league members and match predictions.
Every numeric table/list uses a fixed column grid, right-aligned values and font-variant-numeric: tabular-nums so rank, score and points changes never cause horizontal jitter.
Render every team/club crest inside the same square identity box with consistent optical padding and a greyscale-safe initials fallback.
Long lists use sticky matchday/group section headers, low-contrast hairlines, sentence case and secondary text colour.
Canonical row height is 52px on phone and 48px on desktop. Live score updates must not change row height or shift surrounding layout.
Never place a card inside another card. Internal separation uses padding and a hairline.

## 11.5 Responsive behaviour
Area
Phone
Desktop
Navigation
Global bottom navigation remains stable. Competition context uses masthead plus horizontally scrollable sub-navigation.
Persistent global left rail: 240px expanded, 64px collapsed, persisted. Competition context never replaces its destinations.
Actions
One dominant full-width action; sheets for secondary choices.
Inline actions and a constrained contextual rail; do not duplicate information already present in the main column.
Tables
Priority columns, sticky identity/rank, expandable rows or card alternative.
Full table with sorting/filtering where useful.
Prediction entry
Vertical fixture cards, numeric keyboard, large touch targets.
Denser list/grid while preserving keyboard flow.
Admin
Supported for urgent actions but not forced into consumer card patterns.
Primary operational workspace with tables and side panels.
Shell and contextual rail
Single content column with normal phone gutters; no squeezed desktop rail.
Maximum shell width about 1440px. Reading/list column 760-820px; widen only for data tables. Contextual rail 320px, sticky with its own scroll region, and removed entirely below 1280px.
Contextual rail slots
Not shown as a separate rail.
Exactly three derived slots: one time-critical, one live and one social. New content must displace a slot; it may not turn the rail into a dumping ground.
Repeated rows
52px canonical height.
48px canonical height. Numeric columns remain fixed and tabular.

## 11.6 Motion contract
Baseline motion is quiet and consistent: 120ms micro feedback, 180ms enter, 240ms sheets; ease-out on enter and ease-in on exit. Nothing routine exceeds 300ms.
Use skeletons shaped like the final layout instead of generic spinners. Prediction inputs commit optimistically and reconcile silently unless an error/conflict occurs.
Use the shared-layout underline for competition section navigation. Never animate ambient backgrounds, parallax, every polling tick or content while the user is scrolling.
Signature moment 1 - rank change: standings rows move to their new position with a FLIP transition and the rank-delta chip fades in.
Signature moment 2 - points resolution: when a match settles, points count up once with a short spring and the status pip transitions live -> settled. Target duration: 400ms; never replay on ordinary re-render.
Reduced motion keeps the state change and confirmation but applies it instantly or with a cross-fade. It removes travel, not feedback.

## 11.7 Typography contract
Retain the current UI/body face only if it remains a competent, legible grotesque across hostile data. Add one display family for mastheads, scorelines and major statistical moments.
Apply font-variant-numeric: tabular-nums to scores, ranks, points, dates, times, percentages and all table statistics.
Use a fixed six-step type scale. Tracking tightens above 24px and opens below 13px through tokens; components may not invent intermediate sizes or tracking values.
The display face is deliberately limited to high-signal sports surfaces so the interface retains reading clarity and does not become typographically noisy.

## 11.8 Accessibility contract
Every route sets a meaningful document title and moves focus to the new page heading.
All interactive controls work by keyboard and have visible focus.
Dialogs trap focus, close predictably, restore focus and announce title/description.
Status is not conveyed by colour alone; live, locked, provisional and error states include text/icon semantics.
Validation errors are associated with fields and summarised on submit.
Tables use proper headers and accessible labels; responsive alternatives preserve relationships.
Animations honour prefers-reduced-motion; countdowns do not announce every second.
Touch targets, contrast, zoom/reflow and screen-reader journeys are tested manually and automatically.
12
Core product state machines
Explicit state transitions prevent UI-specific interpretations of competitive truth.

## 12.1 Prediction lifecycle
COMMON AUTHORITATIVE STATESNOT_CREATED -> ACTIVE_EMPTY -> ACTIVE_IN_PROGRESS -> ACTIVE_COMPLETEACTIVE_* -> LOCKED -> SCORED_FINALSCORED_FINAL -> RECALCULATING -> SCORED_FINALINTENT MARKERACTIVE_COMPLETE -> CONFIRMED/SUBMITTED_INTENT -> ACTIVE_* until authoritative lockGAME-SPECIFIC LOCK BRANCHESEuro Original Predictor: complete valid entry -> AUTO_SUBMITTED; incomplete entry -> NOT_SUBMITTEDMatch Predictor: interacted card -> bank entered fixtures; blanks score zero; untouched matchweek -> UNBANKEDSeason LMS: missing pick -> deterministic eligible-team AUTO_ASSIGNEDTournament LMS: missing pick -> ELIMINATEDKO Predictor: each match locks independently; earlier rounds can remain UNBANKEDEXCEPTIONALACTIVE_* -> DISQUALIFIEDitem -> VOIDEDany load -> CONFLICT_REQUIRES_REFRESH

## 12.2 Match/result lifecycle
SCHEDULED  -> DELAYED -> SCHEDULED or LIVE  -> LIVE -> SUSPENDED -> LIVE  -> LIVE -> FINISHED_UNCONFIRMED  -> FINISHED_UNCONFIRMED -> CONFIRMED  -> CONFIRMED -> CORRECTED -> CONFIRMEDAlternative paths:SCHEDULED/LIVE -> POSTPONEDLIVE -> ABANDONEDany eligible state -> VOIDED (official policy)

## 12.3 Game membership lifecycle
NOT_JOINED -> JOINING -> ACTIVEACTIVE -> LEFT -> REJOINING -> ACTIVEACTIVE -> COMPLETEDACTIVE -> DISQUALIFIEDAvailability is separate:NOT_OPEN | AVAILABLE | CLOSED | UNAVAILABLE | RETIRED

## 12.4 Result settlement lifecycle
PROVISIONAL_PROVIDER_DATA    -> ADMIN/SYSTEM CONFIRMATION    -> RESULT_CONFIRMED    -> SETTLEMENT_QUEUED    -> SETTLING    -> SETTLEDCorrection:SETTLED -> REVISION_CREATED -> RECALCULATING -> SETTLEDFailure:SETTLING -> FAILED_RETRYABLE -> SETTLINGSETTLING -> FAILED_REQUIRES_ADMIN

## 12.5 Why state machines matter
They define which commands are legal without relying on button visibility.
They let old and new interfaces consume the same truth.
They make unusual states - correction, conflict, abandonment, stale data - testable.
They support explainable disabled actions and reliable monitoring.
They prevent the UI from inventing unofficial intermediate competitive states.
13
Frontend replacement and rollout sequence
Replace the interface as a series of reversible, measured vertical slices.

## 13.1 Preparation
1. Freeze major visual expansion in the outgoing UI; continue critical fixes only.
2. Capture route inventory, screenshots, state scenarios and browser tests as the behavioural baseline.
3. Create the new token/component package and application contract layer alongside the old pages.
4. Add feature flags at route/journey level, not scattered arbitrary component branches.
5. Define telemetry comparing save failures, completion, performance and abandonment across old/new journeys.

## 13.2 Recommended migration order
Phase
Replacement slice
Why this order
1
New visual foundations and component gallery
Proves tokens, accessibility and states without product risk.
2
Public/auth/onboarding shell
Creates the new first-use experience and route foundations.
3
Global Hub shell and Hub Home
Establishes the new product hierarchy.
4
Competition shell and Overview
Creates competition context before individual game journeys.
5
Global/competition Play inbox
Provides one action surface that can link to old or new game pages during transition.
6
Match Predictor entry
Proves recurring high-frequency save/lock behaviour.
7
Euro Original Predictor journey
Migrates the most extensive tournament flow using preserved rules.
8
Matches and Match Centre
Connects live/provisional/final and scoring explanation states.
9
Standings, profiles, H2H and private leagues
Moves social/retention surfaces after core actions.
10
LMS, Championship/Cup and KO Predictor surfaces
Uses completed backend engines and shared game shell.
11
Admin workspaces
Rebuild only after command/audit contracts are stable; keep old admin fallback until proven.
12
Legacy redirects and deletion
Remove old pages only after flags are fully rolled out and evidence is archived.

## 13.3 Route-level feature flag strategy
internal: developers/administrators only;
cohort: selected test users or private leagues;
competition: enabled for one competition season;
percentage: controlled public exposure where deterministic assignment is suitable;
default-on with rollback: new route is primary but old implementation remains immediately available;
retired: old route redirects and its code is removed after the rollback window.

## 13.4 Per-journey release gate
Gate
Pass condition
Contract
Typed query/command/error model is stable and tested.
State coverage
Loading, empty, partial, locked, conflict, offline and error states are implemented.
Behavioural parity
Existing supported outcomes remain correct; intentional product changes are documented.
Accessibility
Automated and manual keyboard/screen-reader evidence passes.
Performance
Route and interaction budgets pass on representative mobile hardware/network.
Telemetry
Errors, save outcomes, completion and abandonment are observable by old/new version.
Rollback
Flag or route switch restores the prior journey without data rollback.

## 13.5 Legacy UI retirement
Retire by journey, not by folder.
Keep old browser tests until equivalent new tests pass and the rollback window closes.
Convert valuable old page-specific behaviour into shared policies/tests before deletion.
Redirect old public URLs permanently only after invitations, bookmarks and analytics have been assessed.
Archive screenshots and parity notes as quality evidence; do not leave two active design systems indefinitely.
14
Testing, quality and evidence strategy
The existing test footprint becomes the safety net for architectural change.

## 14.1 Test pyramid and responsibilities
Level
Primary purpose
Domain unit tests
Pure scoring, locking, ranking, progression, eligibility and state transitions.
Database pgTAP
Constraints, RLS, grants, RPC behaviour, audit and cross-season isolation.
Service contract tests
DTO mapping, typed error conversion and Supabase adapter behaviour.
Application integration tests
Queries/commands, cache invalidation, orchestration and conflict recovery.
Component tests
Accessible interaction and visual/state contracts for shared components.
Page integration tests
Rendering and actions across all page states using contract fixtures.
Playwright journeys
Critical user/admin flows against realistic hosted/local infrastructure.
Production smoke
Authentication, contract identity, core reads and safe critical actions after deployment.

## 14.2 Contract fixtures
Every page model has fixtures for ready, empty, partial, stale and error states.
Every prediction workspace has open, lock-approaching, locked, conflict and changed-fixture fixtures.
Match Centre fixtures cover scheduled, live, suspended, postponed, unconfirmed, confirmed and corrected.
Admin result fixtures cover no provider data, conflicting evidence, correction and settlement failure.
Fixtures are versioned with the contract so visual development cannot silently drift from backend reality.

## 14.3 Non-functional tests
Area
Evidence
Accessibility
axe scans plus manual keyboard, focus, screen-reader, zoom/reflow and reduced-motion checks.
Performance
Bundle budgets, route load, interaction latency, image/font loading and low-end mobile profiles.
Resilience
Offline, timeout, duplicate submission, unknown outcome, stale data and job retry tests.
Security
RLS/grant adversarial tests, admin capability tests, dependency audit, CSP and secret/config gates.
Load
Realistic weekend/tournament concurrency, standings reads, save bursts and settlement jobs.
Visual regression
Key component and page-state screenshots across phone and desktop widths.

## 14.4 Parallel-run evidence
Where feasible, old and new clients should perform equivalent actions against the same contract in controlled environments. The evidence should compare resulting database state, returned model, audit record and scoring effect - not merely screenshots.
15
Security, observability and operations
A replacement UI is safe only when failures and competitive effects are visible.

## 15.1 Security baseline
RLS and server-side capabilities remain the enforcement boundary.
Content Security Policy and production environment validation fail closed.
No service-role or database secret reaches the client bundle.
Rate limits cover auth, invites, saves, search, joins and administrator commands as appropriate.
High-impact actions require recent authentication or elevated confirmation where justified.
Audit logs are append-only for result changes, settlement overrides, ownership changes and disqualification.
Data minimisation governs public profiles, prediction disclosure and aggregate trends.

## 15.2 Observability model
Signal
Dimensions
Client errors
release, route, old/new UI, competition, game, browser; no sensitive prediction payloads.
Command outcomes
command, success/failure, error code, duration, retry, contract version.
Save health
dirty duration, save latency, conflict rate, unknown-outcome recovery.
Journey metrics
start, completion, abandonment, deadline proximity, device class.
Jobs
last success, lag, processed count, retry count, failure reason.
Settlement
result confirmation to final standings latency; correction replay duration.
Availability
query error rate, stale-model rate, provider freshness and contract mismatch.

## 15.3 Operational runbooks
Provider outage or stale data.
Prediction save degradation near lock.
Incorrect kickoff/fixture data.
Result confirmation error and correction replay.
Settlement backlog or failed job.
Standings mismatch.
Authentication/email outage.
Database migration rollback or production restore.
Frontend release rollback by feature flag.

## 15.4 Release evidence pack
Evidence
Contents
Build identity
Commit, contract version, migration contract, environment and feature flags.
Automated checks
CI, database parity, pgTAP, unit/integration, E2E, a11y and bundle budgets.
Hosted verification
Post-deploy smoke, key route screenshots and command evidence.
Operational readiness
Dashboards, alerts, runbook owner and rollback route.
Decision record
Intentional behaviour/product differences from the outgoing UI.
16
Governance, risks and definition of done
Scope control and explicit completion gates prevent the modernisation becoming an endless rewrite.

## 16.1 Governance artefacts
Architecture decision records for product hierarchy, contracts and any rule authority changes.
Journey specification containing routes, page model, commands, states, analytics and acceptance criteria.
State catalogue with named fixtures and design references.
Contract changelog and compatibility policy.
Migration/production contract inventory.
Release evidence and rollback record for every activated journey.
Risk register with owner, probability, impact, mitigation and trigger.

## 16.2 Principal risks
Risk
Impact
Mitigation
Hidden behaviour in old pages
New UI loses edge cases despite correct visual design.
Behaviour inventory, old tests, state fixtures and parallel outcome comparison.
Backend-first becomes endless
No visible product progress.
Deliver contract-stable vertical slices; design and component work proceed in parallel.
Two UIs remain indefinitely
Duplicated maintenance and inconsistent experience.
Journey retirement dates and no feature expansion in outgoing pages.
Raw database leakage into new UI
Future schema changes force widespread rewrites.
Page models, service interfaces and lint/import boundaries.
Contract drift between environments
Hosted failures or incorrect assumptions.
Explicit contract identity and fatal mismatch gates.
Live/provisional data presented as official
Competitive trust failure.
Separate data states, confirmation boundary and labelled UI.
Result correction produces inconsistent standings
Loss of user trust.
Audited deterministic replay and correction scenario tests.
Over-engineering delays core use
Complexity without user value.
Prioritise core actions, reuse one game shell and defer speculative abstractions.

## 16.3 Scope boundaries
Do not block the replacement on every future feature
The backend must be structurally stable for the core product and for the journey currently being replaced. Later competitions, native shells, web push and advanced social features can remain staged work provided the contracts anticipate extension without inventing unused generality.

## 16.4 Definition of backend done
Core competitive truth is server enforced and independently testable.
Every core page has one stable read model and required commands.
All high-impact commands are atomic, idempotent, lock/permission aware and audited.
Settlement and correction are deterministic and observable.
Hosted development proves the full headless journey; production promotion is deliberately gated.
Backup restore, failure recovery and administrator fallback have been rehearsed.

## 16.5 Definition of frontend journey done
Uses the target route hierarchy and application contracts.
Implements every required page/action state, not just ready/success.
Meets mobile, desktop and accessibility standards.
Has component, page and browser tests plus telemetry.
Runs behind a reversible flag and passes cohort evidence.
Old journey is retired after the rollback window and compatibility redirects are documented.

## 16.6 Programme completion
Modernisation complete
The canonical Hub, competition and game architecture is the only active information architecture; all core journeys use stable frontend-facing contracts; outgoing UI code is removed; competitive truth, operations and rollback are proven; and future competitions can be added without copying Euro-specific screens or database assumptions.
17
Appendix A - canonical route map
Proposed route structure with compatibility redirects during migration. The anonymous public landing page, signed-in Hub and standalone Euro acquisition shell have distinct route responsibilities.

## A.1 Public and authentication
/ public pre-sign-in acquisition landing page/auth/login/auth/signup/auth/reset/auth/update-password/invites/:code public invitation preview / resume/welcome first-run onboarding/euro-2028 standalone tournament acquisition entry

## A.2 Global Hub
/hub signed-in Hub/play Predict - global action inbox/leagues all joined private containers/games global games/competition discovery/more settings/help/account directory/notifications canonical notification history/matches direct aggregate match surface, not a primary rail destination/account account details/profile current player profile/players/:playerId other player profile

## A.3 Competition season
/competitions/:competition/:season/competitions/:competition/:season/play/competitions/:competition/:season/matches/competitions/:competition/:season/matches/:fixtureId/competitions/:competition/:season/games/competitions/:competition/:season/leagues/competitions/:competition/:season/leagues/:containerId/competitions/:competition/:season/players/:playerId

## A.4 Games
/competitions/:competition/:season/games/:game/competitions/:competition/:season/games/:game/play/competitions/:competition/:season/games/:game/standings/competitions/:competition/:season/games/:game/leagues/competitions/:competition/:season/games/:game/rulesGame identifiers:match-predictororiginal-predictorlmschampionshippredictor-cup (if represented separately)ko-predictor

## A.5 Admin
/admin/admin/results/admin/users/admin/competitions/admin/games/admin/jobs/admin/audit/admin/operations

## A.6 Compatibility
Legacy pattern
Migration treatment
/predict/*
Route flag to new Original Predictor play journey, then redirect.
/games/*
Redirect to competition-season game route once competition context is known.
/league/*
Resolve container and redirect to canonical competition/game/container route.
/match/:ref
Resolve competition season and redirect to canonical match route.
/competitions/euro/2028/original
Temporary compatibility entry; canonical public/tournament target is the standalone /euro-2028 shell, with authenticated tournament routes resolved behind it.
18
Appendix B - UI state reference matrix
Minimum state coverage expected for every replacement journey.
Area
Required fixtures/stories
Shell/navigation
anonymous, onboarding required, authenticated, competition context, admin authorised, session expired, offline.
Hub Home
no competitions, one favourite, multiple competitions, urgent action, live matches, partial block failure, stale.
Competition Overview
not started, open, live, between rounds, completed, unavailable, maintenance.
Game card
not joined, recommended, joining, active, action due, waiting, closed, unavailable, completed, disqualified.
Prediction workspace
empty, partial, complete, saving, saved, save error, unknown outcome, conflict, lock approaching, locked, auto-submitted, fixture changed.
Match card/centre
scheduled open, scheduled locked, delayed, live, suspended, postponed, abandoned, unconfirmed, confirmed, corrected, voided.
Standings
empty, provisional, settling, current, tied, recalculating, unavailable, paginated.
League detail
new/empty, invited, active, full, no permission, creator, archived, member removed, ownership transfer.
Admin result
no provider data, matching evidence, conflicting evidence, confirming, confirmed, correction, settlement queued, failed job.
Feedback
success/info/warning/error toast; persistent offline/maintenance/partial/contract banner; confirmation and destructive modal.

## B.1 State naming rule
Use the same state names in backend contracts, TypeScript unions, design files, component stories/fixtures, analytics and tests. Avoid synonyms such as done/complete/finished when they represent different competitive meanings.
19
Appendix C - suggested source structure
A gradual target structure that can coexist with the current repository during migration.
src/  app/    routing/    shells/    providers/    flags/    telemetry/  application/    queries/    commands/    policies/    models/    cache/  domain/    competition/    tournament/    season/    scoring/    standings/    lms/    cup/  infrastructure/    supabase/      queries/      commands/      auth/      mapping/    observability/    storage/  ui/    tokens/    foundations/    feedback/    navigation/    data-display/    football/  features/    auth/    onboarding/    hub/    competition/    games/      match-predictor/      original-predictor/      lms/      championship/      ko-predictor/    matches/    leagues/    profiles/    admin/  legacy-ui/                 temporary onlytests/  domain/  application/  contracts/  pages/  e2e/supabase/  migrations/  tests/  seed/  functions/ or jobs/docs/  authority/  architecture/  journeys/  operations/  quality/  archive/

## C.1 Import boundary examples
Allowed
Disallowed
feature page -> application query/command
feature page -> Supabase client
application -> domain + service interface
domain -> application or React
Supabase adapter -> generated DB types
design-system component -> game service
UI domain component -> render model
UI component -> raw database row
legacy page -> shared application contract during migration
new page -> legacy page helper with hidden database assumptions

## C.2 First implementation package
1. Create application/model and application/errors packages with linted import boundaries.
2. Implement HubHomeModel and CompetitionOverviewModel against current services.
3. Create the new shell/navigation and feedback region using the full state catalogue.
4. Ship Hub Home internally behind a route flag while all game links may still target legacy journeys.
5. Measure, refine and then continue into Competition Overview and Play.
Final recommendation
Proceed with backend readiness immediately, but begin architecture, information design, state definitions and the new design system in parallel. Start production-facing replacement only when each vertical slice has a stable contract, full state coverage and a reversible release path.
20
Appendix D - confirmed product contracts and owner-approved UI/UX authority
This appendix separates competitive rules already settled by the repository from owner-approved presentation authority. Sections D.1 and D.2 remain backend/product truth. Sections D.3 and Appendix E govern the replacement interface and acquisition surfaces unless a later recorded design decision supersedes them.

## D.1 Repository-confirmed product contracts
Contract area
Confirmed rule
Repository authority / implementation effect
Product hierarchy
The recurring signed-in product is Football Prediction Hub -> domestic competition season -> independently joined game. Euro 2028 uses a standalone acquisition and tournament shell, while sharing the approved account, domain and backend platform contracts.
Repository ADRs remain authority for competition/game rules. The later owner decision changes presentation and acquisition routing only: domestic Hub first, Euro 2028 standalone, and no automatic membership transfer between them.
Membership and standings
Following a competition does not join a game; joining one game never joins another. Every game keeps separate state, points/standings or survival status. No cross-game aggregate ranking.
ADRs 0011, 0020 and 0023. Frontend cards must never imply bundled entry or a universal score.
Predictions and private play
One Match/Original Predictor entry is reused across every private league for that competition. Predictor Championship compares the same underlying Match Predictor matchweek points. LMS keeps competition-specific entrant state and selections.
ADR 0020 and ADRs 0013-0014. Private containers change comparison/format, not the underlying score card, except LMS by design.
Manual confirmation
Submitting or confirming records that the player considers the work complete; it does not itself become the authoritative lock. Editing remains possible until the game-owned deadline where the rule permits it.
ADR 0012 amendment, scoring rules and lock tests. UI copy must distinguish Confirmed from Locked.
Euro auto-submission
At tournament lock, a complete server-valid Original Predictor entry is auto-submitted if the player forgot the button. An incomplete entry is not submitted and does not enter standings. Optional jokers/Golden Boot do not invalidate the core entry.
docs/scoring-rules.md. The locked summary must state whether the entry was manual, automatic or incomplete.
Domestic Match Predictor lock
Cards start empty. Blank fixtures score zero; no default is inserted. An interacted card banks only entered predictions at matchweek lock. A completely untouched matchweek remains unbanked.
ADR 0012 amendment and contract 82. Remove any prefill, auto-completion or free-score language from the new UI.
Last Man Standing missed pick
Season LMS auto-assigns the alphabetically first eligible unused team. Tournament LMS retains no-pick elimination. The two authorities must not be merged.
ADR 0013 and tournament scoring rules. State labels and explanations must name which LMS format applies.
KO Predictor
Entry is round/match scoped with rolling entry; matches lock independently and earlier rounds remain unbanked. It has separate scoring and standings.
Existing KO Predictor authority and tests. Do not add a whole-entry submission ceremony merely for visual consistency.
Lock ownership and reschedules
Lock policy belongs to the game. Locks are derived, monotonic, server-enforced and fail closed. A domestic fixture postponed/materially rescheduled moves to its new round; the fixture becomes editable under the new round lock while the old round remains locked.
ADRs 0011 and 0020. UI wording must say fixture reassigned, never round reopened.
Prediction visibility
Pre-lock entry detail is owner-only. After Euro Original Predictor locks, any signed-in player may inspect frozen profile/breakdown/full-entry detail. League-context named match picks remain league scoped.
docs/design-system.md reveal authority. Backend co-membership gates are implementation drift to reconcile, not a new UX decision.
Live and official truth
Live scores and provisional points may display as Provisional / As it stands only. They are never persisted as final competitive truth and cannot drive permanent standings, progression or elimination before official confirmation.
design-system and result authorities. Match Centre must display provenance/status explicitly.
Names and navigation
Signed-in Hub desktop navigation is Hub, Predict, Leagues, Games and More in a persistent global rail. Competition context uses a masthead plus Overview, Play, Matches, Games and Leagues horizontal sub-navigation. The public acquisition header is a separate anonymous shell and must not mimic the signed-in rail.
ADR 0023 supplies the destination meanings; the owner-approved UI authority dated 4 August 2026 supersedes the earlier rail-swap/Back-to-Hub presentation. Record the override in a design ADR before implementation.
Notifications
Initial rehearsal channels are in-app and email. Reminders send one hour before lock only for incomplete predictions and are configurable per competition and game. Web/native push is later phase work.
ADR 0020. Replace older 48/24-hour copy where it remains.

## D.2 Known reconciliation work - not owner questions
Area
Current inconsistency
Required action
Post-lock reveal
Accepted design makes frozen Euro entries visible to any signed-in player, but existing rival/profile RPCs still contain shared-league gates.
Remove shared-league membership as the general gate for frozen Euro Original Predictor entry and profile reveal after lock. This does not alter season-leaderboard entrant scoping under contract 95 or league-context match-pick reads. Add it as an append-only backend change; the authoritative server-side tournament lock gate remains mandatory. (Scope confirmed by ADR 0025 on 4 August 2026: this item and contract 95 address different competitions and different reads, and neither privacy boundary moves. Contract 95's season leaderboard requires an `entries` row in that competition season and never required co-membership, so it was never an instance of this drift.)
Reminder timing
Older design copy refers to 48/24-hour emails; ADR 0020 later sets the rehearsal rule at one hour before lock.
Use the one-hour in-app/email rule and update stale documentation/tests before delivery.
Match Predictor defaults
Earlier contract/history described pre-filled cards and lock-time completion; ADR 0012 amendment and contract 82 supersede it.
Follow the append-only after-state: empty card, blanks zero, no generated prediction, untouched matchweek unbanked.
Domestic postponement
Older ADR 0012 wording froze a postponed prediction; ADR 0020 explicitly changes the rule to fixture reassignment.
Move the fixture to the round containing its new kickoff. Never reopen the already locked originating round.
Follow/favourite persistence
The Hub information architecture accepts following/favourite as product behaviour, but parts remain target architecture rather than fully hosted capability.
Implement and test the backend preference model before the replacement onboarding and Hub Home rely on it.

## D.3 Owner-approved UI/UX implementation authority
All ten original UI/UX decisions, plus the later public-acquisition and standalone-Euro decisions, are confirmed and integrated into Sections 7-11 and Appendix E. They are implementation authority unless a later recorded decision explicitly supersedes them.
Decision
Confirmed owner authority
Implementation boundary
1. Visual redesign scope
Preserve semantic token architecture, theme switching, accessibility work, Broadcast Grid and football identity. Rebuild primitive token values before layouts.
12-step neutral ramp; separate border ramp; three surface levels; three radii; 4px spacing scale; dark elevation by lighter surface; low-contrast hairlines only.
2. Desktop navigation
Persistent global 240/64px rail: Hub, Predict, Leagues, Games, More. Competition masthead and horizontal sub-nav never replace it.
Persist collapse state. No Back to Hub repair control. Add Command-K/Control-K palette for league, team, fixture, theme and navigation jumps.
3. Desktop layout
Main column plus a constrained contextual right rail.
Shell about 1440px; reading/list column 760-820px; 320px sticky rail removed below 1280px; exactly time-critical, live and social slots; derive, never duplicate.
4. Cards and density
A card is for state the user can act on; everything else is a row.
Fixed tabular numeric grid, normalised crests, sticky section headers, 52px phone/48px desktop rows, no nested cards.
5. Toasts
Auto-save never toasts. Phone bottom-centre; desktop bottom-right; maximum two.
Use toasts only for events away from the active interaction. Visible outcomes update inline. Persistent failure becomes an anchored alert.
6. Notification centre
One /notifications component/route; desktop overlay and phone full-screen presentation.
Do not auto-mark read. Group by entity. Dot or capped 9+ indicator; red only for genuine action-required urgency.
7. Motion
Quiet baseline motion with two signature moments: rank movement and one-time points resolution.
120/180/240ms baseline; 400ms points resolution once; skeletons not spinners; no ambient/poll/scroll animation; reduced motion removes travel, not feedback.
8. Competition identity
Neutral Hub; controlled competition masthead/accent.
Accent only on active nav indicator, one primary button, focus ring and masthead. One hue derives contrast-safe stops; semantic statuses never change.
9. Sharing
Contextual sharing only; no Share destination.
Server-rendered templates, native phone sharing, copy/download desktop, entity-specific formats, readable mark and deep link on every artefact.
10. Typography
Keep the competent UI/body grotesque, but introduce the numeric and display identity in stage one rather than deferring typography.
Apply tabular numerals to all numeric content; add one display face used only for mastheads, scorelines and major stat moments; use a fixed six-step scale with tighter tracking above 24px and looser tracking below 13px.
11. Public acquisition landing page
The anonymous landing page is a premium conversion surface, not the signed-in dashboard. It leads with one promise and one primary sign-up action, uses Scottish Premiership and Premier League as the recurring-product proof, previews the signed-in Hub accurately and progressively reveals private leagues and optional games.
Do not overload the first viewport. No false user counts, fabricated endorsements or unsupported claims. Sign-up flows into explicit competition/game selection; nothing is silently joined. Public navigation remains separate from the signed-in global rail.
12. Euro 2028 standalone acquisition
Euro 2028 is presented as a distinct tournament acquisition experience that may recruit a wider audience and later invite those users into the domestic Hub.
Reuse account, identity, tournament rules and backend authorities where appropriate, but keep public shell, information architecture and onboarding distinct. Conversion into domestic competitions/games is explicit and optional; tournament membership never creates domestic membership.

## D.4 Authority and change control
There are no outstanding owner clarifications in this revision. Any exception to these contracts requires a recorded design decision, a stated reason, and evidence that accessibility, responsive behaviour, competitive clarity and acquisition intent remain intact.

# Appendix E - Public acquisition landing page and standalone Euro 2028 authority
This appendix records the later owner direction that supersedes the earlier assumption that every competition must share the same public product shell. It changes acquisition and presentation architecture only; it does not change scoring, locks, memberships, settlement or other repository-confirmed game rules.

## E.1 Public landing-page purpose
The root anonymous experience is a conversion page. Its job is to make the recurring domestic product understandable and desirable before exposing its full depth.
The first viewport contains one proposition, one dominant create-account action, one secondary product-preview action and concise trust information. It does not attempt to explain every game, state or tournament.
Scottish Premiership and Premier League are the primary proof of the weekly product. Private leagues are the main social reason to join. Last Man Standing and Predictor Championship are progressively disclosed as optional depth.
The signed-in preview must accurately reflect the approved Hub architecture: permanent global navigation, one prioritised action, row-led competition/league summaries, ambient save state and a constrained contextual rail where desktop space permits.

## E.2 Public and signed-in shell separation
Surface
Owns
Must not do
Anonymous landing page
Value proposition, product proof, public navigation, sign-up/sign-in entry and concise acquisition content.
Expose the full signed-in rail, imply the user has joined competitions, or overload the first viewport with every game.
Authentication/onboarding
Account creation, verification, invitation recovery, explicit competition following and independent game joining.
Silently preselect competitions/games or bundle LMS/Championship membership into Match Predictor.
Signed-in Hub
Hub, Predict, Leagues, Games and More; cross-competition action priority; live and social context.
Behave like a marketing page or let public conversion copy displace competitive actions.
Competition shell
Competition masthead, status strip and Overview/Play/Matches/Games/Leagues sub-navigation.
Mutate the global rail or require a compensating Back to Hub control.

## E.3 Landing-page content order
Order
Surface
Purpose
1
Hero
One promise: make every match mean more. Primary create-account action and a truthful signed-in Hub preview.
2
Domestic proof
Scottish Premiership and Premier League establish the recurring weekly product.
3
How it works
Three concise steps: predict, compete, follow the outcome.
4
Signed-in experience
One next action, quiet rank/competition/league access and accurate mobile navigation.
5
Private leagues
The principal social and retention proposition.
6
Optional games
Match Predictor first; LMS and Predictor Championship disclosed later and independently joined.
7
Euro 2028
Lower-page standalone tournament acquisition surface, not the dominant weekly proposition.
8
Final conversion
Repeat the create-account action and make explicit that competition/game choice follows.

## E.4 Visual and interaction alignment
Use the approved 12-step neutral ramp, separate border ramp, three surface levels, three component radii, 4px spacing scale and fixed six-step typography scale.
Dark-mode hierarchy is created by lighter surfaces, not decorative shadows. Hairlines organise; they do not become emphasis. Avoid gradient-heavy application previews.
The public page may use the global brand accent, while competition accents remain constrained by the competition-identity contract inside product context.
Application previews use 48px desktop and 52px phone data rows, tabular numerals, normalised identity boxes and cards only for actionable state.
Auto-save is shown as ambient inline status. The acquisition page does not invent save toasts, fake live alerts or noisy motion.
Baseline motion remains 120/180/240ms and reduced-motion removes travel rather than feedback. Marketing ornament must not introduce ambient animation or parallax.
Theme switching, keyboard access, focus restoration, semantic landmarks and meaningful labels remain functional requirements even in the prototype.

## E.5 Standalone Euro 2028 boundary
Keep shared
Keep distinct
Account and identity services; accepted tournament rules; scoring and lock authorities; audited result administration; shared accessibility, security, observability and design-system primitives.
Public landing and campaign positioning; tournament navigation and onboarding; tournament-specific prediction journey; acquisition analytics; post-tournament invitation into domestic competitions and games.

## E.6 Conversion and membership safety
A Euro account may be offered the domestic Hub, but the invitation is explicit. It must not silently follow a domestic competition, join Match Predictor, enter LMS or create a private-league membership.
Domestic users may discover Euro 2028, but the tournament remains independently joined and scored. No cross-game or cross-product aggregate ranking is introduced.

> **Amended 6 August 2026 by [ADR 0026](../adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md).** The first sentence is superseded: **domestic users may not discover Euro 2028 while its publication state is hidden** (`EURO-001`). Discovery resumes only at an owner-approved publication state, and is then produced by that server-owned state rather than by a client catalogue (`EURO-004`). The rest of this section stands and is strengthened — the tournament remains independently joined and scored, membership is never implied (`ACCOUNT-004`), and no cross-product aggregate ranking exists.
Acquisition telemetry distinguishes anonymous landing conversion, account creation, tournament entry, domestic follow, domestic game join and private-league join. These are separate events and funnels.

## E.7 Prototype acceptance checklist
The first viewport communicates the product in under ten seconds and contains one dominant sign-up action.
Both domestic competitions are visible before Euro 2028 and neither is represented as automatically joined.
The signed-in preview uses the permanent global rail and, when shown at full desktop scale, exactly three contextual slots: time-critical, live and social.
Repeated sports information is row-led with stable numeric columns; informational sections do not become nested cards.
The sign-up mock explains that competition and game selection follows, and the selection step starts empty.
Euro 2028 appears as a separate acquisition/tournament proposition and its conversion into the domestic Hub is optional.

> **Amended 6 August 2026.** The two Euro items in this checklist — "both domestic competitions are visible before Euro 2028" and the line directly above — describe a landing page on which Euro 2028 appears at all. While Euro's publication state is hidden it must not appear on the weekly platform in any form (`EURO-003`), so both items lapse rather than being reordered. Every other item in this checklist stands unchanged.
>
> The checklist is **not** rewritten here because `tests/design/landingPrototypeContract.test.ts` pins these two items against [`hub-landing-prototype.html`](hub-landing-prototype.html), and `src/features/landing/` implements them. Authority, prototype, test and component change together under `EURO-003`, or they drift apart.

End of plan - revision 1.5