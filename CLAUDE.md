# CLAUDE.md — Football Prediction Hub

Convenience summary for coding-agent sessions. [`AGENTS.md`](AGENTS.md), [`docs/quality/current-status.md`](docs/quality/current-status.md) and the machine contract records are authoritative. This file deliberately does not repeat the moving repository, development, production or Netlify contract values.

## Start every session

1. Read current `main`, open pull requests and the exact branch ancestry before changing anything.
2. Read `config/deployment-contract.json` and `config/development-hosted-contract.json`; do not infer hosted state from an older report.
3. Read [`docs/quality/current-status.md`](docs/quality/current-status.md) for implementation/hosted truth and [`docs/roadmap.md`](docs/roadmap.md) for the current executable sequence.
4. Treat dated audits, investigations, reconciliations and automation handovers as evidence at their recorded commit—not as a current task list.
5. Keep concurrent work separate. Do not restack, renumber, rewrite or merge another session's branch without first establishing ownership and overlap.

## Project framing

- This is a mobile-first, multi-competition football prediction platform.
- Euro 2028 is the recoverable first tournament baseline at `euro-2028-baseline`; its remaining tournament-specific scope returns in January 2028.
- A competition season supplies real football. Each prediction game is joined separately and owns its own rules, entry/state, scoring or progression and standings.
- Following a competition is not game entry. Joining a private league is not game enrolment.
- Platform and game decisions live in [`docs/adr/README.md`](docs/adr/README.md). Do not infer season rules from the tournament implementation or presentation copy.
- The finished presentation target lives in [`docs/design/README.md`](docs/design/README.md); it cannot change a scoring, lock, membership, settlement, progression or reveal rule.

## Current implementation boundary

The shared competition context/lock foundation and its Home, Matches, Match Centre and entry-lock consumers are delivered. The repository also contains the competition-season/game catalogue and backend authorities for season Match Predictor, season Last Man Standing and Predictor Championship, including recurring jobs, scoring/settlement, standings, repeatable competition instances, the idempotent LMS wipeout restart transition and split persistence.

Do not mistake backend presence for a completed product. The remaining work is governed by the roadmap and includes the LMS successor-window scheduler, Championship phase driver, bounded browser reads and surfaces, provider rehearsal, instrumentation/cohort evidence and launch operations. Stage C2 ownership/erasure work remains blocked by issue #272.

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
- No hosted claim without fresh target-specific evidence.
- No combined cross-competition entry, score, survival, progression or standings authority.
- No rewriting dated evidence to make the current position look cleaner; correct the live authority and preserve history.
