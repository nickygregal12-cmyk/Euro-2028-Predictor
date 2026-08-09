# Batch A opened — contracts 135 and 136 — 9 August 2026

| Field | Value |
| --- | --- |
| Status | Dated handover at the commit it was written against |
| Purpose | Record what the first batch-A change contains, what it deliberately leaves for the next one, and what has to happen for it to reach Development |
| Pull request | [#612](https://github.com/nickygregal12-cmyk/Euro-2028-Predictor/pull/612) on `claude/backend-migrations-concurrent-cughog` |
| Preceded by | [`2026-08-09-backend-concurrency-and-migration-inventory.md`](2026-08-09-backend-concurrency-and-migration-inventory.md) |
| Authorities that outrank this | [`../current-status.md`](../current-status.md), [`../../adr/0020-football-prediction-hub-product-model.md`](../../adr/0020-football-prediction-hub-product-model.md), [`../accepted-requirements.md`](../accepted-requirements.md), [`../../ops/ops-pending-migrations.md`](../../ops/ops-pending-migrations.md) |
| Does not authorise | Any production movement, any provider spend, or any hosted claim not separately evidenced |

---

## The two owner decisions this implements

Both were taken on 9 August 2026 and both are recorded where they belong rather
than only here.

**1. The provider is final truth for awarding points, and it stays auditable and
correctable from the admin panel.** This reverses ADR 0020 § Ingestion and
supersedes `INGEST-006` *for a league season only*. It is written as an amendment
in ADR 0020 itself, and `INGEST-006` is marked superseded-in-part in the accepted
requirements register rather than deleted, because it still governs the
tournament path in full.

**2. `ClubIdentity` is acceptable, but the colours are not stored anywhere and it
renders a blank shirt.** Measured and confirmed: `resolveClubIdentity` has always
taken a three-letter code and a colour string, `public.teams` held neither, and
the only production caller passed neither — so every club fell to the neutral
fallback and the curated pattern overlay, which is keyed by the code, could never
match a club at all.

---

## What contract 135 does

| Piece | What it is |
| --- | --- |
| `provider_status_kinds` | Seeded vocabulary mapping each provider's status token to a neutral kind. A token that is not in it is `unknown`, and `unknown` can never be a result |
| `provider_status_observations` | Append-only record of tokens with no mapping, so a fail-closed vocabulary is visible rather than silently never settling |
| `season_fixture_live_state` | The provisional provider view of a fixture: status, score, observation time. Replaced on each observation, because the evidence is the archived response |
| `season_fixture_result_sources` | Which revisions the provider wrote. A revision without one was written by an administrator |
| `provider_result_refusals` | Every provider result declined, with the reason |
| `provider_response_consumption` | Which decoded responses the driver has handled — the idempotency record |
| `apply_provider_fixture_facts` | Replaces the live projection for every fixture, and turns a measured final status with both scores into the official result |
| `consume_provider_responses` | The driver, on `pg_cron` every five minutes at `2-59/5` |

### The rule, stated exactly

A result is written when **all** of these hold: the payload's identifiers are all
mapped; the fixture is one this platform already holds; the provider's status
maps to `final`; both scores are present; and **no administrator has ever
confirmed, corrected or cleared that fixture**.

The write goes through contract 125's `record_season_fixture_result` — the same
function an administrator uses — so the revision is numbered, records the result
it replaced, names a reason when it is a correction, and cannot be rewritten.
Nothing settles as a side effect: the hourly rederivation produces the points,
exactly as it does for an administrator's correction today.

### What it deliberately does not do

- **It never touches the tournament path.** Euro 2028 results remain confirmable
  only by a signed-in administrator, and pgTAP now asserts that no provider
  function so much as *names* `public.matches` or `public.match_result_revisions`.
- **It never creates a fixture.** `INGEST-002`, `INGEST-003` and `INGEST-005` are
  unchanged: a newly discovered, removed, cancelled or abandoned fixture still
  needs administrative approval. The amendment governs the result of a fixture
  already held, and nothing wider.
- **It refuses rather than guesses.** An unmeasured status is not a result. A
  final status with no score is not a nil-nil draw. One unmapped club fails the
  whole payload, exactly as contract 117 does.

### The gap it closes on the way

Measured on the commit before it, not assumed: `import_provider_fixture_revisions`
(contract 117) and `stage_provider_fixture_proposals` (contract 132) had **no
caller anywhere** in `supabase/`, `src/` or the Edge Function, and nothing else
read `normalized_payload`. The poll archived and decoded a provider response every
five minutes and the pipeline stopped there.

Shipping the result applier on its own would have made that three unreachable
authorities. So the driver is in the same contract as the rule it serves.

---

## What contract 136 does

The matchweek card now returns a club's three-letter code and its ordered colour
string, resolved at read time from `predictor_internal.club_identity_reference`
matched on a normalised name, plus the provisional live block from contract 135.
`seasonMatchPredictor.ts` passes both into `resolveClubIdentity`, which is where
they were always expected.

Two choices worth stating:

- **The colours are stored in the provider's own idiom** (`'Claret / Sky Blue'`)
  rather than as hex, because `parseClubColours` and its named-colour map already
  exist, are pure and are tested. Storing hex would have meant changing a domain
  authority to accept a second format for no gain.
- **It is a reference table, not two columns on `public.teams`.** A migration can
  only seed the clubs that exist when it runs — a rebuilt database loads its seed
  *after* the migrations, and contract 132 creates clubs later still — so columns
  would have been correct in hosted development and silently empty everywhere
  else. Resolving at read time means a club seeded, promoted or adopted at any
  point picks up its identity the first time it is read.

**No crest, logo or provider image is introduced.** The 8 August capability
audit's media rule is untouched: club colours are facts written from the owner's
own reference, not provider assets.

---

## What batch A still owes

The inventory's Tier A had four slots. Two are delivered here, and the shape of
the remaining work has changed slightly now that the owner's decision is known.

| Slot | State |
| --- | --- |
| Ingestion driver | **Delivered** as part of contract 135 |
| Live-state projection | **Delivered** as part of contract 135, and readable on the matchweek card |
| Season fixtures / Match Centre read | **Outstanding.** The matchweek card now carries live state, which covers the player's own card. A season-wide fixtures list ordered by kickoff and labelled by round — the open ADR 0020 ordering item — is still unbuilt |
| Provider result proposal queue | **No longer needed in its original form.** The owner's decision removed the confirmation step it existed to serve. What remains from that slot is the *administrator's* view: a read over the refusal queue, the unknown-status observations and contract 132's pending proposals, none of which any browser can see today |

That administrator read is the single most valuable next slice, and it is now
more important than it was before this batch, not less: contract 135 refuses
silently by design, and until somebody can see the refusal queue, the only place
those refusals exist is a table nobody is looking at.

---

## How this reaches Development

The guarded development fast lane runs **only from `main`** — it refuses any other
ref, and refuses the production project outright. So the order is:

1. **CI green on #612**, including `local-supabase`, which runs the new pgTAP
   suites `186` and `188` and the amended `171` against a database rebuilt from
   all 136 migrations. That is the run that counts; local verification here used a
   throwaway PostgreSQL 16 cluster because Docker image pulls are blocked in the
   authoring container.
2. **Merge to `main`.**
3. **Dispatch `development-fast-lane-rollout.yml`** with the development project
   ref and the confirmation phrase. It will find **three** pending migrations —
   contract 134 (`rate_limit_events_client_revoke`), 135 and 136 — and all three
   are additive, which `check-migration-additive.mjs` confirms, so the lane will
   accept them rather than sending them back to the ceremony lane.
4. **Verify against real football rather than against the migration ledger.**
   These two contracts change what a player sees, which the last several did not.
   The rollout is worth checking by: a Scottish or Premier League matchweek whose
   fixtures have finished, then `season_fixture_live_state` holding rows, then a
   `season_fixtures` row at `status = 'played'` with a revision whose `actor_id`
   is null and a matching `season_fixture_result_sources` row, then points
   appearing after the hourly rederivation, then the matchweek card returning a
   club code and colours.

**Production is not authorised by any of this** and is further behind.

## One thing to watch on the first real run

Contract 135's driver resolves which season a response belongs to from the
payload's own `seasonProviderId` first, and from a unique enabled poll target
second. If Development's poll targets or season mappings do not support either
route, responses will be consumed with outcome `unresolved_season` rather than
applied — visible immediately in `provider_response_consumption`, and harmless,
but it is the first thing to check if nothing settles.
