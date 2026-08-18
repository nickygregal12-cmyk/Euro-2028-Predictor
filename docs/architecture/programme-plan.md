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

- ~~**the cohort is adults only** (`AGE-001`)~~ — **rejected 11 August 2026 by owner decision**; the clause below is retained struck through so the reversal is visible rather than silent — a server-side signup rule with matching eligibility wording and test fixtures, standing until a Children's Code and age-risk assessment supports a different model;
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

The delivered backend foundations are **not listed here**. They were, until 11 August
2026, as a bullet list that had grown into a contract-by-contract narrative — one of its
bullets carried twelve contracts in a single paragraph — and every line of it restated
[`../quality/current-status.md`](../quality/current-status.md), which owns that fact. A
programme plan that maintains a second copy of the implementation record is maintaining
the competing authority its own child plan's § 18 warns against.

What that list was for is preserved in full below, because it is the part a programme
plan owns and a status document does not: **backend capability is not a passed product
gate.**

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

## Contracts, and what they moved in this programme

The provider ingestion programme has a controlled initial-publication stage between
normalized evidence and canonical season fixtures (contract 132). Complete-season approval
is an explicit competition-admin action; later fixture revisions remain under the existing
revision authority and official results remain separately protected.

**This table records only what each contract meant for a programme PHASE or GATE.** What
each contract *is* belongs to `CLAUDE.md`, [`../quality/current-status.md`](../quality/current-status.md)
and the migration chain, and until 11 August 2026 this file carried a verbatim copy of it:
nine paragraphs, 10,839 characters, byte-identical to `CLAUDE.md` and to the child build
plan. Three copies of one narrative, maintained so that each file could append a single
clause of its own. The clauses are what survive; the copy is gone.

A row saying no phase moved is a fact worth recording — silence is indistinguishable from
an oversight, which is the same reason the sweep rule asks a document to say when it has
nothing to say.

| Contract | Effect on programme phases and gates |
| --- | --- |
| 133 | An implementation detail within the accepted Domestic Frontend Alpha: bounded private Championship player reads after contract 132. No phase order or product gate moves |
| 134 | Security hardening inside the accepted Domestic Frontend Alpha. No phase moves |
| 135–136 | **A rule change, and the owner's** — recorded as an amendment to [ADR 0020](../adr/0020-football-prediction-hub-product-model.md): a provider result becomes official for a league season. Inside the accepted Domestic Frontend Alpha rather than a phase change. Contract 136 serves `DFA-003` |
| 137 | A correction within the accepted Domestic Frontend Alpha. No phase moves |
| 138–139 | Both inside the accepted Domestic Frontend Alpha. No phase moves |
| 140–141 | Both inside the accepted Domestic Frontend Alpha. No phase moves |
| 142 | Stage D operations. No phase moves |
| 143 | Implements ADR 0026's `EURO-002`, one of the Phase 4 cohort entry conditions above. **It does not discharge that condition** — `EURO-001` remains a recorded defect and `EURO-003`/`EURO-004` are unbuilt |
| 144–151 | Backend capability and bounded reads inside the accepted Domestic Frontend Alpha. No phase moves |
| 152–157 | The remaining `MIG-UI` backend, landed as one batch with no frontend consumer and no hosted application. No phase moves, and no gate is closer to passing for it |
| 158 | Closes the first three items `SEC-001` names: the invite-code keyspace, the confirmation oracle in `get_league_preview`, and probe rate-limiting on a wrong guess. Security hardening; no phase moves. It is **destructive** and takes the guarded rollout lane rather than the additive fast lane |

| 159–168 | The backend-completion batch. 159 closes the last `SEC-001` door; 160 closes `MIG-UI-13`; 161–164 close season history, `MIG-UI-14`, `DFA-012`'s delivery half and LMS social; 165–168 close organiser reads, the multi-group Championship draw and its reader, and the administration inspection `DFA-009` records as absent. **No frontend consumer exists for any of them** |
| 169 | Corrects a defect contract 167 shipped: a season Championship group table ranked thirty-eight matchdays on the tie-breakers of its first three. **No frontend consumer exists for it either** |
| 170 | The action centre's matchweek generator. **No frontend consumer exists for it** |
| 171 | Deterministic and self-declaring league prediction caps. **No frontend consumer reads the new keys yet** |
| 172 | The retention machinery starts running. It moves no phase: nothing sends, and `SITE-007` still blocks the sender on the brand decision |
| 173 | The settled-matchweek recap. **No frontend consumer**, and the AppBar still carries no notification control |
| 174 | Provider change approval. It moves no phase and adds no provider authority; it closes the gap where a change was counted and discarded. **No frontend consumer** |
| 175–178 | Innovation Lab backend foundations under ADR 0027. **They move no phase.** Contract 178 is the one that touches the programme's instrumentation ambition: an independent post-settlement scoring check is the first control here that can detect a job which succeeded and was wrong. **No frontend consumer, and no scheduled caller** |
| 179–180 | Private-play lifecycle integrity, under issue #728. **They move no phase and they close a delivery gate**: `DFA-008` may not be called complete on create/join RPCs existing, because a mutation is not delivered until its result survives an authoritative reread. Contract 180 is the first contract to separate a prediction capability from a game membership, which is the shape every future card-reading game inherits |

| 181 | `CAP-003` under ADR 0028 § 3. **It moves no phase** and it is the first per-league operating ceiling the platform has had; the two that existed were site-wide |

| 182 | `CUP-005` under ADR 0028 § 7. **It moves no phase** and unblocks `CUP-002` by settling which authority that driver must read |

| 183 | `MIG-UI-16` and `MIG-UI-18`. **They move no phase.** Both replace a browser workaround that works, so neither is urgent alone; the clubs read closes a real data-loss path for a club with no fixture |
| 185 | **Moves no platform phase.** Private modelling/paper-betting evidence and secret-safe paid odds under ADR 0029; no player surface or platform-result authority |

| 184 | `CUP-001` under ADR 0028 § 6. **It moves no phase** and unblocks `CUP-002`, which is the driver that would actually run it |

| 186 | `CUP-002`'s prerequisite. **It moves no phase** |
| 187 | `CUP-002` itself. **It moves no phase**, and it closes the last thing preventing a season Championship from finishing its group stage. `CUP-003` and `CUP-004` remain |
| 188 | The private AI Lab's multi-model forecasting evidence, its provider identity custody and its quarantine authority. **It moves no phase** |

**This table accounts for every contract up to and including contract 189.** Saying so is
the point: a reader can tell at a glance whether the mapping has kept up, which a pile of
blockquotes could never show without being read end to end.

> **Contract 190 programme effect:** the AI Lab Production-activation prerequisite for actionable bookmaker evidence is closed in repository code; hosted rollout remains the next programme gate.

> **Contract 191 programme effect:** the vNext Profiles/H2H stage gains its missing prerequisite — a global weekly standings row that can be addressed as a player — without a programme reordering and without widening disclosure.

> **Contract 192 programme effect:** the vNext Profiles/H2H stage gains rank over time and a season-long comparison, so that surface no longer needs a per-matchweek browser loop. No programme reordering.

> **Contract 193 programme effect:** the vNext Predictor Championship stage gains the entrant-facing bracket read it had none of. No programme reordering.

> **Contract 194 programme effect:** closes a settlement correctness defect ahead of any Championship launch. No programme reordering.

> **Contract 195 programme effect:** the cross-competition attention surface gains its Championship source, so a qualified entrant is no longer silently responsible for remembering a deadline the platform knows. No programme reordering.

> **Contract 196 programme effect:** the cross-competition attention surface gains its consequence source, leaving only the private-league invitation — which is blocked on an invitation event rather than on a generator. No programme reordering.

> **Contract 197 programme effect:** the Stage 8 Matches system gains the cross-competition read it would otherwise have had to assemble in the browser. It designs none of that system. No programme reordering.

> **Contract 198 programme effect:** the last Championship blocker is cleared, so Workstream B is complete. No programme reordering.

> **Contract 199 programme effect:** the private AI Lab's paper-betting record becomes countable — one advised bet per fixture and market — and a played bet no longer waits on a closing line to settle. No programme reordering.

> **Contract 200 programme effect:** the private AI Lab collects paid prices often enough for its own freshness gate, so a weekend's fixtures can be assessed on the days before it. No programme reordering.

> **Contract 201 programme effect:** the private AI Lab can be operated without a database console — every relevant fixture, why it is or is not actionable, whether each stage of the pipeline is current, and what happened last weekend one row per fixture. No programme reordering.
