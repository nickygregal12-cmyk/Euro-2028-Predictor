# Football Prediction Hub

A mobile-first, multi-competition football prediction platform. Follow real competition
seasons, join prediction games independently, and play them against friends in private
leagues.

Built with **React 19 · TypeScript · Vite · Supabase · Netlify**.

> **Start here for current state:** [`NOW.md`](NOW.md) — one generated page of current
> facts (contracts, pending migrations, feature flags, where each authority lives).
> This README describes what the project *is* and how to run it. It deliberately holds
> **no** contract number, hosted status or release claim, because those move and a
> README is the last place anyone updates.

---

## Features

| | |
| --- | --- |
| **Competition seasons** | Domestic league seasons and tournaments. Following a competition gives you its football — fixtures, results, form, head-to-head — and joins you to nothing |
| **Match Predictor** | Score every fixture in a matchweek. Exact scores and correct outcomes score; a Joker doubles a matchweek |
| **Last Man Standing** | One club per round, never twice. Survive or go out |
| **Predictor Championship** | Head-to-head groups against other entrants, a split into phases, and a table |
| **Private leagues** | Play any game against people you invite, with a table, a matchweek comparison and members |
| **Match Centre** | Per-fixture: your prediction and points, football context, what your league predicted after the lock, and the anonymous consensus |
| **Player & league insight** | Rank with field size, movement over a settled matchweek, rival gaps and a season player profile |
| **Euro 2028** | The preserved first tournament baseline, on its own publication lifecycle and its own site |

Each prediction game is **joined separately** and owns its own rules, entry, scoring and
standings. Following a competition is not game entry, and joining a private league is not
game enrolment.

---

## Quick start

Requires **Node 22.22.2** (see [`.nvmrc`](.nvmrc)).

```bash
npm ci
cp .env.example .env.local     # fill in DEVELOPMENT Supabase values
npm run dev
```

> **Never point local development, a deploy preview or a branch deploy at the production
> Supabase project.** Development is the normal target; production promotion is a
> separately approved milestone with its own guarded process.

### Everyday commands

```bash
npm run dev            # Vite dev server
npm run test           # unit / component / contract suite (vitest)
npm run test:watch     # the same, watching
npm run lint           # oxlint, zero warnings tolerated
npm run lint:css       # stylelint over src/**/*.css
npm run build          # tsc -b && vite build
```

### Before opening a pull request

```bash
npm run lint && npm run lint:css && npm run test && npm run build
npm run check:documentation-authorities   # docs that name contracts are current
npm run check:now                         # NOW.md is regenerated, not hand-edited
```

Browser journeys and database work have their own gates — see
[Verification](#verification).

---

## Environment variables

All browser configuration is `VITE_`-prefixed and therefore **public**. No secret
belongs in this file; Supabase holds the service keys and the Turnstile secret.
[`.env.example`](.env.example) is the complete list with the full reasoning — this is a
summary.

### Required

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Development Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable (anon) key for that project |

### Development convenience — dev builds only

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_DEV_AUTOLOGIN` | `false` | Silently sign in as the seeded dev user so sessions, `auth.uid()` and RLS are live. **A production build refuses to build with this on** |
| `VITE_DEV_USER_EMAIL` | — | Must match the seeded dev user |
| `VITE_DEV_USER_PASSWORD` | — | Must match the seeded dev user |

### Optional

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_TURNSTILE_SITE_KEY` | unset | Public Cloudflare Turnstile key. Must be enabled in the Supabase dashboard at the same time — the two move together |
| `VITE_TURNSTILE_DEV_TOKEN` | unset | Token for headless dev auto-login when CAPTCHA is on |
| `VITE_SUPPORT_EMAIL` | unset | Builds the Account page's contact link. Blank renders an honest unavailable state, never a dead action |
| `VITE_SENTRY_ENABLED` | `false` | Must be exactly `"true"`. Fail-quiet: a bad value disables reporting rather than throwing |
| `VITE_SENTRY_DSN` | unset | Public browser DSN on an approved ingest host, kept in step with the CSP in `netlify.toml` |
| `VITE_SENTRY_VERIFICATION_EVENT` | `false` | One synthetic startup event to prove the SDK reaches the project |

### Route flags

Migration flags in [`src/app/routeFlags.ts`](src/app/routeFlags.ts). **An unset flag
fails closed to the legacy journey.**

| Variable | Opens |
| --- | --- |
| `VITE_UI_SEASON_MATCH_PREDICTOR` | The season Match Predictor route |
| `VITE_UI_PUBLIC_LANDING` | The public landing page |

---

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, React Router 8, CSS Modules over design tokens |
| Language / build | TypeScript (strict, project references), Vite 8 |
| Motion & polish | Framer Motion, Lucide icons, Fontsource (Inter / Space Grotesk), flag-icons |
| Backend | Supabase — Postgres, Auth, Row Level Security, RPC functions, Edge Functions, pg_cron |
| Hosting | Netlify, with a CSP kept in step with the app by a parity test |
| Testing | Vitest + Testing Library, Playwright (desktop and phone), pgTAP, TypeScript↔Postgres parity checks |
| Quality | oxlint (zero warnings), stylelint, knip, Lighthouse budgets, Sentry |

No UI component library and no CSS framework: every primitive lives in
[`src/design-system/`](src/design-system) and renders from the tokens in
[`src/styles/`](src/styles).

---

## Project structure

```text
src/
  app/            # shell, routing, providers, route flags
  design-system/  # token-driven UI primitives (MatchCard, ClubMatchCard, tables, nav…)
  dev/            # DEV-only component gallery and harnesses; never ships
  domain/
    competition/  # shared, pure competition context, timing and neutral rules
    tournament/   # tournament-only rules
    season/       # season-only rules
    clubIdentity/ # club colours, monogram and display name
  features/       # hub, auth, predict, matches, season, games, leagues, profile, admin
  services/
    supabase/     # the only browser database access: RPC wrappers and read models
  shared/time/    # the one kickoff / date presentation authority
  styles/         # tokens, fonts, identity assets

supabase/
  migrations/     # append-only migration chain
  tests/          # pgTAP behaviour and permission tests
  functions/      # Edge Functions

tests/            # domain, features, services, app contracts, database parity
e2e/              # Playwright journeys and visual contracts
scripts/          # seeding, migration rollout, parity and repository checks
docs/             # decisions, architecture, design, quality and operations
```

### Architecture rules

These are enforced by tests, not just convention.

- **Domain code is pure.** No storage, no network, no ambient clock — time is an input.
- **Shared domain code may not import tournament or season implementations**, and those
  two may not import one another.
- **One game's scoring or progression code never imports another's.**
- **Components render domain and read-model output** and never call Supabase directly.
- **All browser database access goes through `src/services/supabase/`** and bounded
  RPC contracts.
- **The database is authoritative** for locks, submissions, official results,
  progression, scoring, lifecycle state and server-enforced reveal and access.
- **Live provider data is provisional.** Protected confirmation and correction remain
  the official scoring and progression gate.
- **Predicted and real brackets never blend.**
- **One kickoff formatter.** Kickoffs render in the viewer's own timezone through
  [`src/shared/time/kickoff.ts`](src/shared/time/kickoff.ts), and no raw timestamp
  reaches a player.
- **Competition and game separation is visible in the interface**, not only true in
  storage.

---

## Verification

Scale the evidence to the risk of the change.

| Change | Required evidence |
| --- | --- |
| UI, copy, docs | CI, plus a targeted preview or interaction check when appearance or behaviour moves |
| Application features, development schema | CI plus the relevant browser E2E and/or database parity run |
| Scoring, locks, lifecycle, auth, destructive or production work | The full applicable evidence, explicit approval and target-specific verification |

CI runs a reproducible install, build and type-check, zero-warning lint, the application
suite and a high-severity production dependency audit. Database-backed changes
additionally rebuild every migration on a disposable local Supabase and run database
lint, pgTAP, permission and contract checks, and TypeScript↔Postgres parity.

**A green repository check is not evidence that a hosted environment changed.** Hosted
claims need target-specific evidence.

---

## Documentation

Documentation is governed rather than accumulated: which files may name a contract
number, and what naming one obliges them to, is declared in
[`config/documentation-authorities.json`](config/documentation-authorities.json) and
enforced in CI. Dated audits, investigations, reconciliations and automation runs are
**historical evidence at their commit** and are never refreshed to look current.

| Question | Source |
| --- | --- |
| What is true right now | [`NOW.md`](NOW.md) → [`docs/quality/current-status.md`](docs/quality/current-status.md) |
| What was decided, and what was rejected | [`docs/adr/README.md`](docs/adr/README.md) |
| What was accepted and is **not** built | [`docs/quality/accepted-requirements.md`](docs/quality/accepted-requirements.md) |
| What happens next, in order | [`docs/roadmap.md`](docs/roadmap.md) |
| The detailed task inventory | [`MASTER-TODO.md`](MASTER-TODO.md) |
| Experimental product opportunities / differentiators | [`docs/product/innovation-lab.md`](docs/product/innovation-lab.md) |
| Current risks and findings | [`docs/quality/risk-register.md`](docs/quality/risk-register.md) |
| How to contribute, and the rules an agent follows | [`AGENTS.md`](AGENTS.md) · [`CLAUDE.md`](CLAUDE.md) |
| Design system as built | [`docs/design-system.md`](docs/design-system.md) |
| Design target and what "finished" means | [`docs/design/README.md`](docs/design/README.md) |
| Competition and game structure | [`docs/competition-structure.md`](docs/competition-structure.md) |
| Scoring (preserved Euro configuration) | [`docs/scoring-rules.md`](docs/scoring-rules.md) |
| Migration inventory and hosted state | [`docs/ops/ops-pending-migrations.md`](docs/ops/ops-pending-migrations.md) |
| Operational procedures | [`docs/ops/`](docs/ops) |

Planning documents describe intent and sequencing. **Code, tests and verified hosted
evidence decide implementation truth.**

---

## Security

Report vulnerabilities per [`SECURITY.md`](SECURITY.md). Do not open a public issue for
a suspected vulnerability.