# Synthetic journey probe and public status page

Stage 6 of the player-value and reliability delivery programme
(`config/player-value-programme.json`).

## What was measured first, because it changes the stage

**Production answers `401` to everyone.** `.github/workflows/production-anonymous-smoke.yml`
probes `/`, `/auth/login` and `/release.json` every six hours and asserts the
status is `401` — *"protected as expected"* — failing if it is anything else,
because a change away from it "can mean an outage, a routing failure, or an
unapproved perimeter change". `scripts/production-site-session.mjs` records the
same: anonymous, basic-auth and password-as-user all return `401`, and the
anonymous `401` carries no `WWW-Authenticate` header at all.

Two consequences, neither of them optional:

1. **A journey cannot be walked on Production without the site password.**
   `EURO28_SITE_PASSWORD` is a secret this repository does not hold, and
   `scripts/production-health.mjs` already refuses without it. Obtaining or
   using it is an operator action.
2. **"Public" is not currently a state Production has.** A status page served
   from that origin sits behind the same `401`. Making it reachable would mean
   changing the perimeter, which the check above treats as a failure and which
   is outside this programme's authority.

So the stage delivers the probe in full, and the status document with it, while
recording honestly that its *public* half depends on a decision that is not
this programme's to make. Nothing here punches a hole in the perimeter.

## What already exists, and is therefore not rebuilt

- `production-anonymous-smoke.yml` — DNS, TLS and perimeter, every six hours.
  Everything anonymous access can prove about Production, already proven.
- `production-smoke.mjs` — headers, CSP parity, release identity, route status.
  **Infrastructure, not a journey**: it never walks a player through anything.
- `production-health.mjs` — password-bearing, operator-invoked.
- `deploy-preview-smoke` — a preview check inside the browser-E2E workflow.

The gap is a probe that walks the journey a **new player** actually takes, on a
schedule, against an environment where it can be walked, and leaves a record a
human can read afterwards.

## Outcome

The acquisition journey is exercised end to end against a reachable deployment,
and its most recent result is recorded and rendered honestly.

## In scope

- A probe that walks the anonymous acquisition journey against a given origin.
- Its checks expressed as data and evaluated by a pure function, so each one is
  unit-testable without a network.
- A record of each run, printed to the job summary and kept as an artifact.
- A committed record of the most recent **published** run, which `/status` renders.
  Publishing is a deliberate commit, not something the scheduled job can do: it
  holds read-only permissions and no push credential, because granting a
  scheduled job write access to the repository is an operator decision and
  `OPS-010` is already the open row about records failing to reach `main`.
- A status document rendered from that record, built the same way the invite
  document is, and honest that it is a snapshot rather than a live heartbeat.

## Explicitly out of scope

- **Any perimeter change.** Production stays `401`.
- **Any use of the site password**, and any Production account, test or otherwise.
- A generic dashboard framework, a second admin application, or any new
  abstraction beyond the document-derivation the invite page already established
  — this is its second caller, which is what justifies sharing it.
- Rebuilding the perimeter, header, CSP or release-identity checks that already
  exist and already run.
- Closing `OPS-003`. That row asks for named monitoring/backup/Cron owners,
  retention, escalation and an incident procedure — organisational facts a probe
  does not supply. Adjacent, not the same, and not claimed.

## Governing authorities

- `docs/ops/` — existing operational runbooks.
- `.github/workflows/production-anonymous-smoke.yml` — the perimeter's asserted state.
- The programme's own boundary: reliability instrumentation never becomes result,
  scoring, lock, membership or model-selection authority.

## Privacy, security and authority constraints

- Anonymous and read-only. No account, no credential, no mutation, no provider call.
- The record carries no player data of any kind; it holds check names, outcomes,
  durations and an origin.
- **The status document reports availability only.** It must never state whether
  predictions are open or locked: that would make a reliability surface into a
  lock authority, which the programme forbids outright.

## Acceptance scenarios

1. Each check fails the probe when the thing it checks is broken, and every check
   is proved to bite without a network.
2. A transport error is retried; a genuine finding is not.
3. The record round-trips: what the probe writes, the status document renders.
4. The status document never claims a live state, and names the moment it describes.

## Migration / provider / Production effects

No migration and no contract change. **No Production effect**: nothing is
deployed, promoted, mutated or unlocked, and the perimeter is untouched.

## Completion predicate

The journey is walked against a reachable deployment on a schedule, each check is
proved to bite, the record is written, and the document renders it without
overclaiming.
