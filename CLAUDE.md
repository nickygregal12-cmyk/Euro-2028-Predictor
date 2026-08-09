# CLAUDE.md — Football Prediction Hub

Convenience summary for coding-agent sessions. [`AGENTS.md`](AGENTS.md), [`docs/quality/current-status.md`](docs/quality/current-status.md) and the machine contract records are authoritative. This file deliberately does not repeat the moving repository, development, production or Netlify contract values.

## Start every session

1. Read current `main`, open pull requests and the exact branch ancestry before changing anything.
2. Read `config/deployment-contract.json` and `config/development-hosted-contract.json`; do not infer hosted state from an older report.
3. Read [`docs/quality/current-status.md`](docs/quality/current-status.md) for implementation/hosted truth and [`docs/roadmap.md`](docs/roadmap.md) for the current executable sequence.
4. Treat dated audits, investigations, reconciliations and automation handovers as evidence at their recorded commit—not as a current task list.
5. Read [`docs/quality/accepted-requirements.md`](docs/quality/accepted-requirements.md) before concluding something was never decided. It is the register of requirements that were **accepted and are not built**, each with a stable identifier, its blocker and what would prove it done. A row leaves it by being marked implemented, never by deletion.
6. Keep concurrent work separate. Do not restack, renumber, rewrite or merge another session's branch without first establishing ownership and overlap.

## Project framing

- This is a mobile-first, multi-competition football prediction platform.
- Euro 2028 is the recoverable first tournament baseline at `euro-2028-baseline`; its remaining tournament-specific scope returns in January 2028.
- A competition season supplies real football. Each prediction game is joined separately and owns its own rules, entry/state, scoring or progression and standings.
- Following a competition is not game entry. Joining a private league is not game enrolment.
- **Two frontend sites, one shared backend, one account** (ADR 0026, accepted and unbuilt): the weekly platform and Euro 2028 are separate deployments on separate domains. Euro 2028 must stay **completely hidden from the weekly platform** until an owner-approved publication state — and today it is not, which is a recorded defect (`EURO-001`), not a licence to add more.
- Platform and game decisions live in [`docs/adr/README.md`](docs/adr/README.md). Do not infer season rules from the tournament implementation or presentation copy.
- The finished presentation target lives in [`docs/design/README.md`](docs/design/README.md); it cannot change a scoring, lock, membership, settlement, progression or reveal rule.

## Current implementation boundary

The shared competition context/lock foundation and its Home, Matches, Match Centre and entry-lock consumers are delivered. The repository also contains the competition-season/game catalogue and backend authorities for season Match Predictor, season Last Man Standing and Predictor Championship, including recurring jobs, scoring/settlement, standings, repeatable competition instances, the idempotent LMS wipeout restart transition, the Contract 108 past-window calendar guard, the Contract 109 successor-window scheduler, split persistence, the Contract 110 season Championship round calendar, the Contract 111 Championship launch driver the Contract 112 provider identity map and the Contract 113 round play window and the Contract 115 provider poll dispatch and the Contract 117 provider fixture revision import and the Contract 118 neutral window fixture facts (the games hub could not see a season window's fixtures, so the window could never settle and the hub card stuck on the first locked round; the fix follows contract 98's tournament/season/neutral shape, and the CI guard alongside it catches the next instance) and the Contract 119 rescheduled-fixture lock and the Contract 120 Championship phase read (contract 102 persists the split phase and 105 derives its continuing table; neither was reachable from a browser, the fifth instance of the contract 86/98/116/118 defect) and the Contract 114 bounded season-card browser path (the matchweek card read and its three own-entry writes, every rule enforced by the triggers that already own it) and the Contract 116 season Last Man Standing round read (the entrant's own round with the fixtures the tournament read cannot see for a season, and the survival verdict from the settlement authority rather than from the browser). Contract 121 adds the season play-context read — which season a URL means and which matchweek its card opens at — which is what lets that surface be registered on a production route. Contract 122 makes ADR 0012's two retention tables answerable: the monthly table, whose month comes from a round's `window_opens_at` read in the competition's own timezone, and rolling form, which needs only round ordinal. Both are derived views and neither touches the canonical total. Contract 123 makes a stale round play window refreshable: contract 117 moves the kickoffs contract 113's stored span is derived from, and a refresh whose proposed span would overlap another round's window leaves the old window intact and queues a row rather than failing the import — which is why contract 122 left the driver to an owner decision. Contract 124 makes the Championship split happen at last: the phase-transition driver creates the two child groups from the final initial table, reads its plan from the launch record rather than re-deriving a format, and lets the smaller half finish early rather than inventing a second matchday numbering. Contract 125 gives a season fixture a result at all: measured, nothing in the repository could write `season_fixtures.home_score`, so no matchweek settled and every season surface downstream of a result was honest and empty. It writes the result, records an immutable revision and settles nothing — the existing cron rederivation does that — and keeps the protected confirmation gate by construction, since the provider importer writes only a kickoff. Contract 126 then narrows a refusal that was firing too early: leaving a Last Man Standing competition blocked re-entry from the moment it was published, when ADR 0013 closes entry only once the first round locks — so the flag is now read together with whether the competition is running. Contract 127 then opens a season competition for play at all: measured, both season Last Man Standing competitions hold no round and no setup row, and both season Championships hold no group because contract 111's launch driver has never had a caller — so an administrator call writes the public Classic setup ADR 0022 pins, generates a first instance's calendar from the same derivation contract 109 uses for a successor, and hands the Championship to contract 111 unchanged. It is an operator action rather than a job, because the launch fixes the draw at whatever field size it finds. Contract 128 then gives a season league a standings table of its own: `get_league_members` derives every metric from `standing_metrics`, `score_events`, `matches` and `match_predictions`, which a competition season writes none of, so a league on a season returned every member on zero in alphabetical order with no error — the sixth instance of that shape. It is a new read rather than a widened one, because ADR 0012 ranks a season on cumulative points and pairs the total with matchweeks played while the tournament table carries five approved final tie-breakers; the totals come from `season_standings` so a league cannot disagree with the season, the rank is recomputed inside the league because a private league is its own table, and the tournament read now refuses a season league by naming the one that answers. Contract 129 then gives a season a head-to-head at all — `get_rival_entry` reads `entry_totals`, `match_predictions` over `public.matches` and `predicted_progression`, none of which a competition season writes — and its reveal boundary is the MATCHWEEK's own lock rather than the one tournament instant, hiding rather than revealing when a round's kickoffs are incomplete. Contract 130 adds the prediction consensus keyed on the round for the same reason, reusing contract 61's minimum cohort of ten but counting the entries that predicted THAT matchweek, since a season with fifty entrants of whom six played matchweek 30 is exactly what the protection exists for. Contract 131 makes contract 122's retention tables able to name their players, optionally and off by default, adding the flag as a required fourth parameter and retiring the three-argument form by revoking rather than dropping it, and mapping over what the parity-checked authorities returned so their order and their agreement with `standings.ts` are untouched.

Do not mistake backend presence for a completed product. The remaining work is governed by the roadmap and includes the Championship phase driver, bounded browser reads and season-game surfaces, provider rehearsal, instrumentation/cohort evidence and launch operations. Stage C2 ownership/erasure work remains blocked by issue #272.

## Architecture

- Shared competition rules live under `src/domain/competition/`.
- Tournament-only rules live under `src/domain/tournament/`; season-only rules live under `src/domain/season/`.
- Shared domain code may not import tournament or season implementations; tournament and season implementations may not import one another.
- One game's scoring or progression code never imports another's.
- Domain code is pure: no storage, network or ambient clock reads; time is an input.
- Components render domain/read-model output and never call Supabase directly.
- Browser database access goes through `src/services/supabase/` and bounded RPC/read-model contracts.
- The database is authoritative for locks, submissions, official results, progression, scoring, lifecycle state and server-enforced reveal/access.
- Live/provider data is provisional. Protected confirmation/correction remains the official scoring and progression gate.
- Predicted and real brackets never blend.
- Competition and game separation must be visible in the interface as well as true in storage.

## Scoring and game rules

[`docs/scoring-rules.md`](docs/scoring-rules.md) remains authoritative for the preserved Euro Original Predictor configuration. It is not a platform default.

Season Match Predictor, Last Man Standing and Predictor Championship rules come from ADRs 0012–0014 and their later amendments. Keep TypeScript, PostgreSQL, pgTAP and source guards aligned whenever a rule authority changes.

## Development and verification

- Normal work targets the development environment. Production promotion is a separately approved milestone.
- Additive development migrations use the guarded fast lane only after its checker derives the pending set and accepts every migration.
- UI/copy/docs: CI, plus a targeted preview or interaction check when appearance/behaviour changes.
- Application features or development schema: CI plus relevant Browser E2E and/or Database parity.
- Scoring, locks, lifecycle, auth, destructive work or production changes: the full applicable evidence, explicit approval and target-specific verification.
- A green repository check is not evidence that a hosted environment was changed.

## Hard boundaries

- No direct push to `main`.
- No unapproved production mutation, reset, repair or contract-declaration change.
- No guard bypass or direct-table fallback around a protected RPC.
- No Supabase/Netlify environment crossing and no modification of the historic World Cup deployment.
- No scoring, lifecycle or rule change without its authority and executable evidence.
- Do not put successor-window generation inside the Contract 107 restart transition; the next eligible league round requires its own calendar authority and idempotent driver.
- No hosted claim without fresh target-specific evidence.
- No combined cross-competition entry, score, survival, progression or standings authority.
- No rewriting dated evidence to make the current position look cleaner; correct the live authority and preserve history.

## Contract 132 — provider initial publication boundary

The repository is at contract 132. Fresh provider calendars must follow archive/normalize → stage pending proposals → explicit competition-admin approval. Contract 132 does not authorize automatic provider result confirmation, and it must not be used to copy Development football rows into Production.

> **Contract 133 boundary (8 August 2026):** Contract 133 adds authenticated-only season Predictor Championship instance discovery and an explicit selected-instance player read. The reads reuse the existing phase/table and neutral Cup scoring authorities; private Cup tables remain browser-revoked.

> **Contract 142 boundary (9 August 2026):** Contract 142 maps SportMonks state 22 to `in_play`, measured from retained payloads rather than documentation — the same fixture carried that token with a different score at different times, and a score cannot change after full time. It writes no result and settles nothing: it fixes the live projection for a fixture observed during its second half. It is the first thing contract 135's fail-closed vocabulary and contract 138's review queue found together, and it is the case those two were built for.

> **Contract 140–141 boundary (9 August 2026):** Contract 140 gives a Leave control the fact it needs to predict itself — `leave_competition_game` refuses once a `bonus_score_events` row exists for the caller and nothing exposed that, so the dashboard could only render a control the server would refuse or hide one that would have worked. Contract 141 derives recent club form and club head-to-head from settled season fixtures alone, which the enrichment plan classes as derive-ourselves work and which contract 135 made possible by producing results at all. Neither reads a prediction, an entry or a score event, and neither costs a provider request.

> **Contract 138–139 boundary (9 August 2026):** Contract 138 gives an administrator the provider review queues nothing could see — measured, seven append-only queues existed and the only browser-reachable functions naming any of them were contract 132's two decision writers, so an administrator could approve a calendar they could not see and could not see the other six at all. It reads all of them bounded per section and lets an administrator acknowledge an item, which contracts 117 and 123 had always anticipated with a `reviewed_at` nothing ever set; acknowledging is never a decision about the item. Contract 139 gives a season a fixtures read at all, ordered by kickoff and labelled by round, closing the ADR 0020 amendment item that had no implementation because a season had no fixture list: a match postponed out of matchweek 5 into November now sorts into November while still saying Matchweek 5.

> **Contract 137 boundary (9 August 2026):** Contract 137 corrects a defect contract 136 shipped: the club name normaliser stripped `(afc|fc)` from the end of a name whose spaces had already been removed, so 'Chelsea FC' normalised to 'chelse' and 'Aston Villa FC' to 'astonvill' and both rendered in the neutral fallback. The tokens are now removed as whole words before the spaces go. It was found by verifying the hosted Development rollout against real football rather than against the migration ledger — 29 of 32 clubs resolved, and the three that did not were the only evidence anything was wrong.

> **Contract 135–136 boundary (9 August 2026):** Contract 135 implements the owner decision of 9 August 2026 amending ADR 0020: a measured provider final status writes the official result of a league-season fixture with no human action, through contract 125's audited writer, and an administrator's correction ends provider authority over that fixture. It also supplies the driver that contracts 117 and 132 had never had — measured rather than assumed, neither had a caller anywhere in `supabase/`, `src/` or the Edge Function, so the poll archived and decoded every five minutes and nothing read the result. Contract 136 gives a club a code and colours, resolved at read time from an owner-controlled reference, so `ClubIdentity` stops rendering every club as the same blank shirt; it alters no existing table and adds no browser-reachable relation.
> The tournament path is untouched and keeps the protected confirmation gate in full; `INGEST-002`,
> `INGEST-003` and `INGEST-005` are unchanged, so a newly discovered, removed or cancelled fixture
> still needs administrative approval.

> **Contract 134 boundary (9 August 2026):** Contract 134 closes risk-register `DB-005`, a privileges-only change: `public.rate_limit_events` and its identity sequence are revoked from `anon` and `authenticated`. Row-level security, the thresholds, `enforce_rate_limit`, both triggers and `service_role` are untouched, and no rule, relation or read moves.
