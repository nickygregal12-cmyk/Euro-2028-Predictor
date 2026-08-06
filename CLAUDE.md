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

The shared competition context/lock foundation and its Home, Matches, Match Centre and entry-lock consumers are delivered. The repository also contains the competition-season/game catalogue and backend authorities for season Match Predictor, season Last Man Standing and Predictor Championship, including recurring jobs, scoring/settlement, standings, repeatable competition instances, the idempotent LMS wipeout restart transition, the Contract 108 past-window calendar guard, the Contract 109 successor-window scheduler, split persistence, the Contract 110 season Championship round calendar, the Contract 111 Championship launch driver the Contract 112 provider identity map and the Contract 113 round play window and the Contract 115 provider poll dispatch and the Contract 117 provider fixture revision import and the Contract 118 neutral window fixture facts (the games hub could not see a season window's fixtures, so the window could never settle and the hub card stuck on the first locked round; the fix follows contract 98's tournament/season/neutral shape, and the CI guard alongside it catches the next instance) and the Contract 119 rescheduled-fixture lock and the Contract 120 Championship phase read (contract 102 persists the split phase and 105 derives its continuing table; neither was reachable from a browser, the fifth instance of the contract 86/98/116/118 defect) and the Contract 114 bounded season-card browser path (the matchweek card read and its three own-entry writes, every rule enforced by the triggers that already own it) and the Contract 116 season Last Man Standing round read (the entrant's own round with the fixtures the tournament read cannot see for a season, and the survival verdict from the settlement authority rather than from the browser). Contract 121 adds the season play-context read — which season a URL means and which matchweek its card opens at — which is what lets that surface be registered on a production route. Contract 122 makes ADR 0012's two retention tables answerable: the monthly table, whose month comes from a round's `window_opens_at` read in the competition's own timezone, and rolling form, which needs only round ordinal. Both are derived views and neither touches the canonical total. Contract 123 makes a stale round play window refreshable: contract 117 moves the kickoffs contract 113's stored span is derived from, and a refresh whose proposed span would overlap another round's window leaves the old window intact and queues a row rather than failing the import — which is why contract 122 left the driver to an owner decision. Contract 124 makes the Championship split happen at last: the phase-transition driver creates the two child groups from the final initial table, reads its plan from the launch record rather than re-deriving a format, and lets the smaller half finish early rather than inventing a second matchday numbering.

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
