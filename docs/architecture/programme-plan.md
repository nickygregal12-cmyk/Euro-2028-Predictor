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

- ADRs 0011–0018 own the decisions.
- This file owns phases, workstreams and product gates.
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
- the Contract 113 round play window, the authority `fixtureReassignment.ts` needs and never had;
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
