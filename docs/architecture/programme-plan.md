# Programme plan — how a product organisation would build this

**Status:** Parent planning document. Proposal, not implementation authority.  
**Status date:** 30 July 2026  
**Child engineering workstream:** [`multi-competition-hub-build-plan.md`](multi-competition-hub-build-plan.md)  
**Decision authority:** [`../adr/0011-multi-competition-platform.md`](../adr/0011-multi-competition-platform.md) through [`../adr/0018-pre-launch-promotion-cadence.md`](../adr/0018-pre-launch-promotion-cadence.md).  
**Implementation authority:** [`../quality/current-status.md`](../quality/current-status.md).

This plan explains how the product programme is run. It does not restate competition rules, lock rules, scoring, commercial boundaries, client strategy or brand decisions; the ADRs above own those decisions. The child build plan owns the engineering sequence only.

The programme has **Phase 0 plus seven gated delivery phases (1–7)**. Phase 0 is discovery running alongside platform work; the seven delivery phases move from definition through the Euro 2028 peak. Seven parallel workstreams operate across those phases.

## 1. What the engineering plan was missing

The Stage A–L engineering sequence is necessary but not sufficient. A product organisation also needs:

- **Discovery:** talk to organisers and players before committing to the product shape.
- **Design ahead of build:** validate the shell and core flows before game screens are implemented.
- **Instrumentation:** define the event taxonomy before the first feature commit so the rehearsal can be measured.
- **Go-to-market:** begin positioning, content, app-store and first-user planning before launch readiness.
- **Failable success criteria:** prove not only that the software works, but that the product deserves public launch.

## 2. Seven parallel workstreams

| Workstream | Owns | Runs |
| --- | --- | --- |
| **Product** | Problem definition, prioritisation, success metrics and decision records | Continuously |
| **Research & Design** | Discovery, information architecture, prototypes, usability testing, visual identity and design system | Ahead of engineering |
| **Engineering** | Context engine, schema, ingestion, games, shell, security and clients | From now, sequenced by the child build plan |
| **Data** | Event taxonomy, instrumentation, dashboards and analysis | Defined before feature build |
| **Go-to-market** | Positioning, launch, content, app-store optimisation and community | From February 2027 |
| **Operations** | Monitoring, alerting, runbooks, incident response and support | Hardens before each exposure |
| **Legal & compliance** | Terms, privacy, intellectual-property posture, provider terms and store requirements | Milestone-triggered |

## 3. Phases and failable gates

Dates are planning windows, not proof of completion. A phase exits only when its evidence gate passes.

### Phase 0 — Discovery · Aug–Oct 2026 · parallel to platform work

**Partially evidenced as of 30 July 2026.** [`phase-0-world-cup-evidence.md`](phase-0-world-cup-evidence.md) records owner observation of a live World Cup predictor, roughly sixty users, across a full tournament. It is the only user evidence the programme holds and it already corrects six recorded assumptions. It does **not** discharge this phase: the sample is one product, one audience, and all sixty users arrived through one person.

Outstanding:

- Interview 10–15 people who run or play in office, pub and mates' competitions, with organisers treated as the primary acquisition unit. **Outstanding — and the binding gap is reach, not count: nobody outside the owner's own network has been observed.**
- Play the closest competing products for a full cycle and record strengths, friction and genuine differentiation. **Outstanding.** Forescore and kicktipp are named and unplayed; the existing evidence does not supersede this.
- Observe a real spreadsheet-and-group-chat competition. **Outstanding.**
- Define success metrics and thresholds. **Outstanding**, though the Phase 4 gate below already carries thresholds.

Evidenced:

- ~~Define the organiser, committed player and casual participant personas.~~ **Corrected 30 July 2026 (S1, stated).** The evidence names a different and sharper set, and one of the differences is substantive rather than a rename:
  - **The regular** — the target. Watches football on a Saturday, comfortable with betting culture but not gambling on this product, gets a buzz from posting into the group chat. Plays weekly across a season, plausibly across several games. Corresponds to the earlier "committed player".
  - **The organiser** — a role rather than necessarily a distinct person. Carries the score-explanation burden (O5), and remains the primary acquisition unit.
  - **The tournament-only participant** — **not a casual user to be converted.** Older, wants a sweepstake every two years, was observed refusing email signup. Previously recorded as a signup barrier costing users; the evidence reclassifies them as **out of segment and served by managed entrants** (ADR 0013). This is real evidence for managed entrants rather than speculation about pub competitions.

  Marked *stated* rather than *observed*: the refusal was observed, the segmentation conclusion drawn from it is the owner's judgement. It is the correction most worth revisiting if later evidence disagrees.

**Gate:** a written research summary, three validated personas and a product-choice hypothesis grounded in direct user evidence. **Not yet met.** Personas are now evidence-informed rather than assumed, but the gate requires evidence from outside the owner's network and a full cycle in each competitor product. Failure means the product positioning or scope changes before shell design proceeds.

**Phase 0 now has a dependent it did not have before:** ADR 0019 defers the brand decision until this phase completes, so slippage here delays brand selection as well as design.

### Phase 1 — Definition and design · Oct 2026–Mar 2027

- Define navigation for many competitions across several games and the purpose of Home.
- Wireframe weekly picks, cross-competition following, joining, organiser operation and first-run onboarding.
- Run two rounds of prototype usability testing and iterate between them.
- Establish visual identity and the badge-free club-identity system governed by [ADR 0017](../adr/0017-brand-and-club-identity.md).
- Extend the design system before Stages E–H implement screens.
- Define the analytics event taxonomy, ownership and expected properties before feature code.

**Gate:** a tested prototype, a build-ready design system and an approved event taxonomy. **No season-game or hub screen is built before this gate passes.**

### Phase 2 — Platform · Aug 2026–Mar 2027 · parallel to Phases 0–1

This is Stages B–D of the child engineering plan: the competition-context foundation, competition-season schema and headless ingestion rehearsal.

**Gate:** the shared context foundation has behaviour-preserving Euro evidence; the season model preserves existing safeguards; and the provisional ingestion path has replayable real-world evidence with no manual intervention in normal operation.

### Phase 3 — Product build · Mar–Aug 2027

Stages E–H implement the season games and hub into the validated shell. Every feature emits its agreed events from its first commit.

**Gate:** a full simulated season across the launch games, including corrections, reschedules, late-entry rules and exceptional states, with the built shell matching the tested prototype.

### Phase 4 — Closed cohort · Jan–Aug 2027

Run a small invited cohort as a research instrument, not merely a soak test:

- 10–30 testers;
- at least two real organisers where possible;
- weekly qualitative feedback;
- quantitative dashboards using the Phase 1 taxonomy.

**Entry conditions added 6 August 2026 by [ADR 0026](../adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md).** These gate the cohort opening, not the metrics above:

- **the cohort is adults only** (`AGE-001`) — a server-side signup rule with matching eligibility wording and test fixtures, standing until a Children's Code and age-risk assessment supports a different model;
- **Euro 2028 is hidden** (`EURO-001`–`EURO-004`) — the first external cohort must not be able to see or reach a competition whose publication state is hidden, by catalogue, navigation, metadata, sitemap, share preview or guessable route;
- **the operating caps are a deliberate setting, not an inherited one** (`CAP-001`, `CAP-006`) — custom SMTP is live, so email delivery no longer justifies the current public-user cap; whatever the cap is when the cohort opens should be a decision someone made, with the burst-load rehearsal behind it.

Account closure and formal erasure (`PRIV-003`–`PRIV-007`) remain **blocked** for the cohort, not merely unbuilt: Stage C2 needs qualified independent UK data-protection review first. A cohort that cannot close an account is a recorded, accepted position for a small invited group; it is not a position that survives Phase 6.

**Failable product gate:**

| Metric | Threshold | Meaning if missed | Evidence position (30 July 2026) |
| --- | ---: | --- | --- |
| Weekly Predictor completion | at least 70% by mid-season | Activate the reduced-set fallback already recorded by ADR 0012 | **Weakly supported.** The full World Cup card was completed, and 10–16 matches a week is judged acceptable (S3, stated). Tournament-shaped and owner-judged, so it lowers the risk without testing the threshold |
| Multi-game entry | at least 50% enter two or more games | The hub thesis is not validated; revisit positioning rather than add features | **No evidence either way.** The World Cup product had one game plus a second that players did not understand was separate (O4). This is the gate metric with the least support and the most riding on it |
| Group formation | at least one organiser brings four or more people | Rework the organiser proposition and managed-entry assumptions | **Weakly supported.** All ~60 users arrived through one organiser, which evidences the mechanism but in a sample where the organiser was the product's author |
| Week-four retention | at least 40% | Stop public-launch preparation until the underlying problem is understood | **Contra-indicated, and the threshold may be optimistic.** Low scorers churned across a four-week tournament and it was the main retention failure (O1, observed). A thirty-eight-week season is a harder case, not an easier one — this is the metric most likely to be missed |

**Reading the column:** *observed* findings are behaviour the owner watched; *stated* findings are the owner's judgement. Only O-numbered findings are observed. Nothing here changes a threshold — the thresholds are the gate and moving them because evidence looks unfavourable would defeat the point. It records where the programme is walking in with support and where it is walking in blind.

### Phase 5 — Launch readiness and go-to-market · Feb–Aug 2027

- Derive positioning and messages from Phase 0 evidence.
- Prepare app-store listings, screenshots and keywords.
- Name the route to the first thousand users; do not rely on organic luck.
- Complete rules, help, onboarding and support content.
- Define the support channel, ownership and response expectation.
- Complete monitoring, alerting, incident, restore and administrator-readiness evidence.
- Deliver the client/distribution sequence governed by [ADR 0016](../adr/0016-client-and-distribution.md).

**Gate:** the operational launch checklist passes and there is a named, owned acquisition plan for the first thousand users.

### Phase 6 — Public domestic season · Aug 2027–May 2028

Operate, measure and improve the product. Avoid adding new games mid-season; the operating record, retention and reliability evidence are the deliverables.

**Gate:** the platform completes the public season with trustworthy scoring, sustainable operations and measured evidence for the Euro 2028 peak.

### Phase 7 — Euro 2028 peak · Jun–Jul 2028

Unpark the remaining Euro 2028 scope in January 2028, complete the full rehearsal and run the tournament as one configured competition on the platform.

**Gate:** exact official data, full state rehearsal, recovery/rollback proof and launch controls pass without weakening the platform seam or the preserved tournament behaviour.

## 4. Solo translation

A solo owner with agents does not need team-coordination ceremony. Drop sprint ritual, cross-team status reporting and handoff bureaucracy.

Do not drop discovery, design-before-build, instrumentation, go-to-market or failable success thresholds. Agents can accelerate implementation, testing, documentation, review and research synthesis; they cannot replace user conversations, design judgement, positioning or the decision to stop when evidence fails.

A short external product-design engagement remains the one discretionary spend most likely to improve a saleable asset, but it is a budget decision rather than a repository fact.

## 5. Rehearsal-year operating constraint

The 2026/27 rehearsal targets zero or near-zero platform cost. Provider, hosting, analytics, monitoring and design-tool selections remain subject to dated verification and their current terms; this plan does not promote an earlier research note into a permanent technology authority.

## 6. Relationship to repository authorities

- ADRs 0011–0018 own the decisions. [ADR 0026](../adr/0026-public-site-separation-shared-accounts-and-euro-2028-acquisition.md) adds the two-site, shared-account, Euro-publication and 18+ cohort decisions, which bear on Phases 4–7.
- This file owns phases, workstreams and product gates.
- [`../quality/accepted-requirements.md`](../quality/accepted-requirements.md) owns the stable identifier, dependency and acceptance evidence for each accepted requirement that is not yet built. This file names which phase they gate; it does not restate their status.
- [`multi-competition-hub-build-plan.md`](multi-competition-hub-build-plan.md) owns engineering sequencing and engineering exit evidence.
- [`../roadmap.md`](../roadmap.md) records the current position and next executable slice; it points here for programme phases and to the child plan for engineering stages rather than maintaining another complete sequence.
- [`../quality/current-status.md`](../quality/current-status.md) owns what is actually implemented and hosted.

Where these disagree, keep the disagreement visible. A planning document does not silently override an ADR, executable test, current code or verified hosted evidence.

## 7. Delivery progress overlay — 5 August 2026

The programme phases and gates above remain the authority of this document, but the implementation has moved materially beyond the repository snapshot originally recorded below.

Delivered backend foundations now include:

- shared competition context, competition-season and game-membership identity;
- recurring domestic Match Predictor scheduling, lock handling, scoring and standings;
- season Last Man Standing persistence, settlement and the complete Contract 107–109 wipeout-restart lifecycle, including the past-window guard and idempotent successor calendar scheduler;
- Predictor Championship neutral Cup sources, split-stage persistence, one-parent ancestry, a continuing table derived across both phases the Contract 110 round calendar that finally lets a season Championship persist a fixture at all, and the Contract 111 launch driver that draws and schedules one;
- the Contract 113 round play window and the Contract 114 bounded season-card browser path (the matchweek card read and its three own-entry writes, every rule enforced by the triggers that already own it), the authority `fixtureReassignment.ts` needs and never had;
- the Contract 116 season Last Man Standing round read, which gives a season entrant the fixtures `get_my_lms` cannot see and the server's own survival verdict for their pick;
- the Contract 119 rescheduled-fixture lock, which lets a moved fixture stay editable to its own kickoff while an ordinary matchweek still locks together;
- the Contract 120 Championship phase read: contract 102 persists the Predictor Championship split as a distinct phase and contract 105 derives the continuing table for it, but nothing browser-reachable could see either — measured on hosted development, zero functions `authenticated` may execute read `cup_split_group_tables`, `parent_group_id` or `cup_final_group_tables`. `get_season_cup_phase` returns the caller's own phase and their own group's table from whichever authority owns that phase, adding no rule and recomputing nothing. Fifth instance of the defect behind contracts 86, 98, 116 and 118; Contract 121 adds the season play-context read — which season a URL means and which matchweek its card opens at — which is what lets that surface be registered on a production route. Contract 122 makes ADR 0012's two retention tables answerable: the monthly table, whose month comes from a round's `window_opens_at` read in the competition's own timezone, and rolling form, which needs only round ordinal. Contract 123 keeps that window fresh: contract 117 moves the kickoffs contract 113's stored span is derived from, and a refresh whose proposed span would overlap another round's window leaves the old window intact and queues a row for review rather than raising, which is what stops a derived view's recomputation being able to fail a provider import. Contract 124 then makes the Championship split actually happen — the phase-transition driver contracts 102, 105 and 120 were all waiting on, reading its plan from the launch record, carrying points and draw numbers, eliminating nobody, and letting the smaller half finish its round-robin early rather than giving it a calendar of its own. Contract 125 then closes the one that was holding all of them: a season fixture could not be given a result at all, so nothing downstream of a result had anything to show. Contract 126 then narrows a refusal that was firing too early: leaving a Last Man Standing competition blocked re-entry from the moment it was published, when ADR 0013 closes entry only once the first round locks. Both are derived views and neither touches the canonical total. Contract 127 then opens a season competition for play at all: measured, both season Last Man Standing competitions hold no round and no setup row, and both season Championships hold no group because contract 111's launch driver has never had a caller — so an administrator call writes the public Classic setup ADR 0022 pins, generates a first instance's calendar from the same derivation contract 109 uses for a successor, and hands the Championship to contract 111 unchanged. It is an operator action rather than a job, because the launch fixes the draw at whatever field size it finds. Contract 128 then gives a season league a standings table of its own: `get_league_members` derives every metric from `standing_metrics`, `score_events`, `matches` and `match_predictions`, which a competition season writes none of, so a league on a season returned every member on zero in alphabetical order with no error — the sixth instance of that shape. It is a new read rather than a widened one, because ADR 0012 ranks a season on cumulative points and pairs the total with matchweeks played while the tournament table carries five approved final tie-breakers; the totals come from `season_standings` so a league cannot disagree with the season, the rank is recomputed inside the league because a private league is its own table, and the tournament read now refuses a season league by naming the one that answers. Contract 129 then gives a season a head-to-head at all — `get_rival_entry` reads `entry_totals`, `match_predictions` over `public.matches` and `predicted_progression`, none of which a competition season writes — and its reveal boundary is the MATCHWEEK's own lock rather than the one tournament instant, hiding rather than revealing when a round's kickoffs are incomplete. Contract 130 adds the prediction consensus keyed on the round for the same reason, reusing contract 61's minimum cohort of ten but counting the entries that predicted THAT matchweek, since a season with fifty entrants of whom six played matchweek 30 is exactly what the protection exists for. Contract 131 makes contract 122's retention tables able to name their players, optionally and off by default, adding the flag as a required fourth parameter and retiring the three-argument form by revoking rather than dropping it, and mapping over what the parity-checked authorities returned so their order and their agreement with `standings.ts` are untouched.
- the Contract 117 provider fixture revision import, which revises a kickoff and refuses to create, delete or move a fixture between rounds;
- the Contract 115 provider poll dispatch, which installs `pg_net`, forbids any browser-reachable function in an exposed schema from calling into `net` — pg_net's own grants belong to whoever owns the extension, and where the platform owns it `postgres` cannot revoke them — and drives the deployed Edge Function from `pg_cron`;
- the Contract 112 provider identity map, the precondition for importing a real fixture list, which resolves and reports gaps but writes nothing;
- provider-response custody and strict decoding boundaries;
- repeatable competition instances with explicit live/current resolution and correction-safe rederivation.

These are backend capabilities, not proof that the programme's product gates have passed. The Contract 107–109 LMS restart lifecycle is now complete: settlement reports the wipeout, the lifecycle creates the successor, the guard refuses inherited past rounds and the scheduler derives the first eligible future matchweek from the existing lock authority without guessing when fixtures are incomplete. The Championship still lacks its phase-transition driver, bounded product reads and completed user surface. The first bounded provider rehearsal, season-game surfaces, instrumentation, external-user discovery and cohort evidence also remain open.

Moving repository, hosted and deployment contract values belong only in [`../quality/current-status.md`](../quality/current-status.md), the machine contract records and operational inventory. This programme plan deliberately does not duplicate them.

## 8. Historical repository-verification snapshot — 29 July 2026

The following section is retained as dated evidence of what was verified when this plan was written. It is **not current implementation authority**; later code, tests and verified hosted records supersede it.


Verified against `main` at `1fb8ffd36ad113079181829a8bcc47175c43b6da` on 29 July 2026:

- the repository baseline is contract 63, not contract 60;
- tournament-wide automatic valid-entry submission exists;
- the recurring season matchweek scheduler does not exist;
- **correction recorded:** authenticated desktop/phone Bonus Games browser lifecycle coverage exists; it must not be listed as a missing launch-readiness control;
- the current risk register is contract-63 aligned, while the feature baseline still contains contract-60 classification text;
- fixed test-count snapshots are deliberately omitted from planning documents because they become stale; current suite evidence belongs in [`../quality/current-status.md`](../quality/current-status.md), executable CI and dated validation records;
- no fixture-provider ingestion adapter was found on `main`;
- the competition-context engine is absent from `main`, while open PR #201 proposes an isolated, unwired foundation.

Hosted state, provider capabilities, market claims and legal analysis require their own current evidence. They are not treated as verified merely because an earlier planning draft described them that way.

Contract 118 closes the fourth instance of the tournament-only read defect (after 86, 98 and 116), in the games hub listing, and pairs it with the CI guard that catches the fifth.

## Contract 132 architecture checkpoint

The provider ingestion programme now has a controlled initial-publication stage between normalized evidence and canonical season fixtures. Complete-season approval is an explicit competition-admin action; later fixture revisions remain under the existing revision authority and official results remain separately protected.

> **Contract 133 boundary (8 August 2026):** Contract 133 is an implementation detail within the accepted Domestic Frontend Alpha: it provides bounded private Championship player reads after Contract 132 and does not change programme phase order or product gates.

> **Contract 151 boundary (10 August 2026):** Contract 151 closes `MIG-UI-02`: one player's season and what they predicted, which blocks domestic player profiles and every player link from a league table or the Match Centre. It takes the disclosure boundary the register recommended and the owner did not vary: identity is visible to **private-league co-members and nobody else** — sharing a competition is not enough, because a season may have fifty thousand entrants and none of them agreed to be looked up, whereas sharing a private league is a mutual act — prediction detail only after **that matchweek's own lock**, the boundary contract 149 established, and **no player directory**: it answers about one named player and cannot enumerate, search or rank the population. A player may always read their own profile including unlocked matchweeks, because those are their own picks. Points are never recomputed; they come from the same banked authorities the season and the leagues use. Exact-score and correct-outcome counts are derived here and are **not** a second scoring authority — counting how often a prediction matched a result is a fact about predictions, no point value appears in the function, and the counts run over settled matchweeks only so a count cannot leak an unlocked prediction.

> **Contract 150 boundary (10 August 2026):** Contract 150 closes `MIG-UI-03`: how a league table moved over one settled matchweek. The gap to a rival is already derivable in the browser because both players are on screen; movement is not, because "5th to 3rd" needs the table as it stood BEFORE the matchweek and history is not on screen. It is **derived, never stored** — `season_matchweek_scores` already holds every banked total with its round, so the before-table is the sum of the rounds ordered before it; a snapshot would add a second thing that can disagree with the first and would need backfilling. Only **settled** matchweeks move anything: `settled_at` is the gate rather than the presence of a row, because a matchweek being scored is one whose totals are still changing and reporting a climb from it would show a player a position they never held. An unsettled matchweek is answered `settled: false` rather than refused. Ordering is by round **ordinal**, never by `settled_at`, so a postponed matchweek that settles late does not appear to come after matchweeks played after it.

> **Contract 149 boundary (10 August 2026):** Contract 149 closes `MIG-UI-01`: what a private league predicted, once the matchweek has locked. The tournament has had `get_league_match_picks` since before a season existed and a season had nothing, so the Match Centre's "Your leagues" section, the mobile per-fixture comparison, the desktop matchweek matrix and every "See league predictions" journey had no read to call — the same shape of gap as contracts 116, 118, 120, 122, 124, 128 and 129. **The reveal boundary is the matchweek's own lock**, resolved server-side from `season_matchweek_lock_at` with no client-supplied time anywhere, because a boundary a caller can pass an argument to is not a boundary. Before the lock it **hides rather than refuses** — a refusal would be indistinguishable from "you may not see this league" — and hides completely: no member rows, not even redacted ones, and a predicted count of zero rather than a leak of who has played. Membership is the boundary rather than game entry, as contract 128 chose, so a member who entered nothing appears with no predictions rather than being dropped. Points come from `season_matchweek_scores` and are null until settled, never recomputed, so a league cannot disagree with the season about what a matchweek was worth.

> **Contract 147–148 boundary (10 August 2026):** Two bounded season reads, closing `MIG-UI-12` and `MIG-UI-11` from the UI finalisation register. Contract 147 is the published weekly catalogue with its **route slug**: publishing a league previously needed a frontend code change for it to exist, because every catalogue read began from a static array and `competitions.slug` is revoked from every browser role by contract 121 — so a frontend could learn a season existed and not learn where it lived. It returns league seasons only, which is an `EURO-001` safety property rather than a filter of convenience: a catalogue enumerating `tournaments` without discriminating on kind would put Euro 2028 on the weekly platform's own discovery surface. Draft seasons are excluded, so Production correctly returns nothing until one is opened. Contract 148 is one season fixture addressed by its own id, a sibling of contract 139 rather than a widening of it, returning contract 139's entry shape field for field so a fixture looks the same whether it arrived from the calendar or from a link — `result` stays null until the fixture is played and a provider opinion stays in `live`. Neither adds a rule, and both are granted to `authenticated` only: making a third function anonymously executable is a publication decision, and this is not where it gets taken.

> **Contract 146 boundary (10 August 2026):** Contract 146 makes the provider poll affordable, and makes its question move. Measured on hosted Development: the one live target polled every five minutes — 288 requests a day — while the next fixture in either league was eleven days away, and it asked for a date range already in the past, so it could never have seen the fixtures it was paid to find. `cadence_minutes` keeps its name and becomes the **idle** cadence, now defaulting to one call a day; `live_cadence_minutes` applies only inside a window that opens `live_lead_minutes` before a kickoff and closes `live_tail_minutes` after it, and only while that fixture still has no result — so contract 135 writing the official result is what ends the expensive polling, rather than anyone deciding it should. A stored path may now carry `{{date:+N}}` placeholders resolved at dispatch in the competition's own timezone, so the window rolls forward on its own. It records no poll target, writes no fixture, result or status, grants nothing new to a browser role, and moves no scoring, lock, settlement, progression or reveal rule.

> **Contract 145 boundary (10 August 2026):** Contract 145 closes the atomicity half of risk-register `DATA-007`. `enforce_rate_limit` counted, compared and then inserted with nothing between the read and the write, so under the read-committed isolation the Data API uses, concurrent transactions for one caller each observed a count below the ceiling and all proceeded — a limit that could be overshot simply by running the attempts in parallel, which a scripted client does and a human never does. It now takes a transaction-scoped advisory lock keyed on the caller before the prune, the count and the insert, the same idiom `20260727191942_operating_cap_enforcement.sql` has always used for the two site-wide counters. One key per caller and never per action, so the function cannot hold two of its own locks and cannot deadlock against itself. It moves **no** relation, policy, trigger, threshold, grant or rule, and changes no scoring, lock, settlement, progression or reveal. It closes the atomicity half **only**: invalid operations still consume no limit, the expensive read RPCs are still unbounded, and there are still no edge/IP controls or alerting — so `DATA-007` stays open, reduced, and `SEC-001` is reduced rather than closed.

> **Contract 144 boundary (9 August 2026):** Contract 144 gives an already-mapped provider team a place to keep its current provider-supplied profile facts — name, short code, founded year, country, venue and image reference — in `predictor_internal.provider_team_profiles`, with a definer writer that derives provider and fetch instant from contract 112's custody row rather than accepting them from its caller, refuses evidence older than the fact it would replace, and advances `last_changed_at` only when a fact actually changed. It is **not** a second identity system: `provider_entity_map` remains the authority for which provider team is which of ours, and the profile row is keyed on that mapping. It is **not** a result path — nothing in it writes a fixture, score, status, lock, settlement or progression, and missing enrichment stays a normal no-data state rather than becoming a game-correctness dependency. The writer is granted to **nobody**, `service_role` included, so the provider poll gains no enrichment side effect merely because storage now exists; a Development backfill is an explicit operator action through its own `workflow_dispatch` job, which refuses unless Development already holds contract 144 and refuses the Production project by name. Provider image URLs are retained for provenance only and establish no right to render or re-host club imagery — the shirt a player sees still comes from contract 136's owner-controlled reference.

> **Contract 143 boundary (9 August 2026):** Contract 143 implements ADR 0026's `EURO-002`: one server-owned Euro 2028 publication state with the lifecycle `hidden -> prelaunch -> registration-open -> live -> completed -> archived`, defaulting to `hidden` so publication fails closed before any owner acts. A bounded `euro_publication_state()` read exposes the state and the instant it last changed and nothing else, and it is the second function an anonymous visitor may execute — deliberately, because ADR 0026 requires the public site and its route guard to fail closed from server truth rather than from a client-side catalogue filter. Mutation is narrower than ordinary competition administration: `admin_transition_euro_publication_state` is granted to `authenticated` only, refuses inside on `super_admin`, advances one adjacent state at a time, and demands both an expected current state and a reason it appends to an immutable history. **It does not publish Euro 2028 and it does not address `EURO-001`** — Euro is still reachable from the weekly platform, which stays a recorded defect. `EURO-003` and `EURO-004` are its consumers and remain unbuilt.

> **Contract 142 boundary (9 August 2026):** Contract 142 maps SportMonks state 22 to `in_play`, measured from retained payloads rather than documentation — the same fixture carried that token with a different score at different times, and a score cannot change after full time. It writes no result and settles nothing: it fixes the live projection for a fixture observed during its second half. It is the first thing contract 135's fail-closed vocabulary and contract 138's review queue found together, and it is the case those two were built for. Stage D operations; no phase moves.

> **Contract 140–141 boundary (9 August 2026):** Contract 140 gives a Leave control the fact it needs to predict itself — `leave_competition_game` refuses once a `bonus_score_events` row exists for the caller and nothing exposed that, so the dashboard could only render a control the server would refuse or hide one that would have worked. Contract 141 derives recent club form and club head-to-head from settled season fixtures alone, which the enrichment plan classes as derive-ourselves work and which contract 135 made possible by producing results at all. Neither reads a prediction, an entry or a score event, and neither costs a provider request. Both sit inside the accepted Domestic Frontend Alpha.

> **Contract 138–139 boundary (9 August 2026):** Contract 138 gives an administrator the provider review queues nothing could see — measured, seven append-only queues existed and the only browser-reachable functions naming any of them were contract 132's two decision writers, so an administrator could approve a calendar they could not see and could not see the other six at all. It reads all of them bounded per section and lets an administrator acknowledge an item, which contracts 117 and 123 had always anticipated with a `reviewed_at` nothing ever set; acknowledging is never a decision about the item. Contract 139 gives a season a fixtures read at all, ordered by kickoff and labelled by round, closing the ADR 0020 amendment item that had no implementation because a season had no fixture list: a match postponed out of matchweek 5 into November now sorts into November while still saying Matchweek 5. Both sit inside the accepted Domestic Frontend Alpha.

> **Contract 137 boundary (9 August 2026):** A correction within the accepted Domestic Frontend Alpha, not
> a phase change.

> **Contract 135–136 boundary (9 August 2026):** Contract 135 is a rule change inside the accepted
> Domestic Frontend Alpha rather than a phase change, and it is the owner's, recorded as an amendment to
> ADR 0020: the provider becomes final truth for awarding points in a league season, auditable and
> correctable. It also closes the measured Stage D gap where the five-minute poll archived and decoded a
> response that nothing read. Contract 136 serves `DFA-003` with club codes and colours.

> **Contract 134 boundary (9 August 2026):** Contract 134 is a security hardening detail inside the accepted Domestic Frontend Alpha, not a phase change: it revokes browser privileges left on the rate-limit log by Supabase's default grants, closing risk-register `DB-005`.

> **Contract 152–157 boundary (10 August 2026):** Contracts 152 to 157 close the six remaining `MIG-UI` items as one batch — the private container's identity and a single invite-code namespace (152), private Last Man Standing creation, invite and join (153, `MIG-UI-05`), private Predictor Championship creation and launch (154, `MIG-UI-06`), one code entry point resolving either container (155, `MIG-UI-07`), the permanent season Wrapped archive (156, `MIG-UI-08`), and Follow, favourite team, onboarding progress and the pinned rival (157, `MIG-UI-10`/`MIG-UI-09`). Contract 153 also closes a hole it would otherwise have opened: `join_competition_game` never checked `visibility_kind`, so a private competition could have been joined by its id. None is applied to a hosted environment by this note.
