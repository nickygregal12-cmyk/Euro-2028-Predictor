# Metabase — internal analytics

Ad-hoc business and operations reporting over Supabase, without building
another bespoke admin dashboard in React.

**Nothing here is deployed.** This repository contains the view definitions,
the read-only role, a local container configuration and the rules of
engagement. No hosted Metabase exists, no analytics role has been created on
any database, and no view has been applied anywhere. Treat every instruction
below as "how to stand this up", not "how it runs".

## Boundaries

- **Internal only.** Metabase is never a player-facing dependency. It is not
  imported by the frontend, adds no package, and appears in no route.
  `tests/scripts/metabaseAnalytics.test.ts` holds that.
- **Read-only, and narrow.** The `metabase_readonly` role can `SELECT` from
  schema `analytics` and nothing else. It gets no service-role key, no
  superuser, no write, no DDL, and no grant on `public` or `ai`.
- **Aggregates only.** No view exposes an identifiable player.
- **Non-production first.** Point it at a development database. Reporting
  against Production is a separate owner decision, and it must still go
  through the same read-only role.

## Why views, and not just RLS

This is the part worth understanding before granting anything.

Metabase authenticates as **one** database role for everybody who opens it. It
has no notion of the signed-in player, so `auth.uid()` is `null` for every
query it issues. Row Level Security written in terms of the current player
therefore cannot express "this analyst may see this row" — pointing Metabase
at the base tables would not circumvent RLS so much as make it irrelevant, and
one role would read every player's predictions.

So Metabase never sees a base table:

```text
Supabase / Postgres  (base tables, RLS, player-owned rows)
        v
schema analytics     (aggregate views, owned by a privileged creator)
        v
metabase_readonly    (SELECT on schema analytics; nothing else)
        v
Metabase
```

The views are aggregates. There is no row in them that describes one
identifiable person's choices, so a leak through the reporting layer would have
to be an aggregate — and the grants make anything else unreachable.

Deliberately absent: `auth.users`, email addresses, display names, user ids,
individual predictions or selections, and `leagues.invite_code`, which is a
credential rather than a datum.

## What is defined

`ops/metabase/analytics-views.sql`.

| Area | Views |
| --- | --- |
| Platform | `platform_signups_daily`, `platform_prediction_activity_daily`, `platform_entries_by_tournament`, `platform_prediction_completion`, `platform_leagues_by_tournament`, `platform_lms_participation` |
| Providers | `provider_poll_health` |
| AI Lab | `ai_model_register`, `ai_model_status_by_league`, `ai_forecast_volume_daily`, `ai_provider_usage_daily` |
| Betting evidence | `ai_recommendation_decisions`, `ai_recommendation_reasons`, `ai_betting_evidence` |

### Metrics that are deliberately not claimed

**True DAU/WAU is not derivable here.** This database holds no session or
page-view record. `platform_prediction_activity_daily` counts distinct entries
that *wrote a prediction*, which is a narrower thing, and it is named as a
proxy rather than presented as daily actives. PostHog is where product
behaviour lives; inventing a DAU from write timestamps would produce a number
that looks authoritative and is not.

**Betting figures separate settled from advised.** `ai_betting_evidence`
reports `advised`, `settled` and `unsettled` beside every total, and `roi` is
`NULL` rather than `0` when nothing has settled — a strategy that has resolved
no bet has not broken even. Closing-line value is averaged only over bets that
have a closing benchmark, with `without_closing_benchmark` reported beside it.

**Reason codes are an array.** One PASS commonly carries several, so
`ai_recommendation_reasons` unnests them and counts *reasons*. Summing it would
double-count, which is why decision totals live in their own view.

**Model metrics show the market too.** `ai_model_register` carries
`baseline_log_loss` and `market_log_loss` alongside `val_log_loss`. A model
beating its own baseline and losing to the closing line is the expected result;
showing only the first invites reading it as success.

## Standing it up

1. **Apply the views to a non-production database.**
   `psql "$DEV_DATABASE_URL" -f ops/metabase/analytics-views.sql`
   This is applied by hand and is **not** a migration — see below.
2. **Set the role's password out of band.**
   `alter role metabase_readonly with password '<generated>';`
   Never in a file. The SQL creates the role without one on purpose, because a
   password committed once stays in git history after it is deleted.
3. **Run Metabase locally.**
   `cp ops/metabase/.env.example ops/metabase/.env` (gitignored), then
   `docker compose --env-file ops/metabase/.env -f ops/metabase/docker-compose.yml up`.
   The UI binds to `127.0.0.1:3000` only: its first-run wizard is
   unauthenticated, and publishing that on every interface offers an admin
   account to whoever reaches it.
4. **Add the analytics connection through the Metabase UI**, as
   `metabase_readonly`, restricted to schema `analytics`. Entering it in the UI
   keeps it encrypted in Metabase's own application database rather than in a
   file.

Metabase keeps its dashboards in its own Postgres container, never in the
Predictor database. A BI tool writing its state into the product's database
would need a write grant it must never have, and would entangle two backup and
migration stories.

## Why this is not a migration

The repository's contract numbers govern **application** schema — the tables,
functions and policies the product depends on and the hosted rollout process
promotes. These views add nothing the application reads and nothing any test
asserts; they provision a reporting surface for an operations tool.

Consuming a contract number for that would put an ops concern into the sequence
that governs application schema, and every future migration would inherit the
confusion. So this integration adds **zero migrations**, and the SQL is applied
deliberately by an operator against a chosen database.

If persisted Metabase state ever genuinely needs application schema, that is a
separate decision under the existing migration authority — not something to
fold in here.

## Verification

`tests/scripts/metabaseAnalytics.test.ts` runs without a database and checks
that every table the views read exists in the committed migrations (so a rename
cannot leave a reporting layer that only breaks when somebody opens a
dashboard), that every view is created in `analytics`, that no identifying or
credential column is selected, that no grant reaches outside `analytics` or
carries a write, that the role is created without a committed password, that
the image is pinned and bound to loopback, and that no Metabase package or
import reaches the frontend.
