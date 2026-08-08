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
