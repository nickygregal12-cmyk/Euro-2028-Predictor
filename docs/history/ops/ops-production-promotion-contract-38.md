# Production promotion — contract 36 to 38

> **Archived 29 July 2026** by the documentation consolidation, moved unchanged from `docs/ops-production-promotion-contract-38.md`. It sat among the live `docs/ops-*.md` runbooks while being a completed one-off window, not a reusable procedure. Production milestones follow [`AGENTS.md`](../../../AGENTS.md); current hosted facts are owned by [`current-status.md`](../../quality/current-status.md). Retained as dated operator evidence.

> **Completed 27 July 2026.** Retained as historical operator evidence; do not reuse it as the current promotion checklist. Future production milestones follow `AGENTS.md`.

**Target:** production Supabase `vkfnsqdyhvtwyqkisxhk` and Netlify `production`  
**Scope:** exactly migrations `20260727075922` and `20260727080159`  
**Authority:** operator checklist; every stop condition is mandatory

This runbook authorizes no action by itself. One named operator executes the window only after the owner approves the exact preflight evidence.

## 1. Precondition — fresh recovery point

- [ ] Run the GitHub Actions workflow named **Production backup** against current `main`.
- [ ] Require a green run completed within 24 hours of the planned migration window.
- [ ] Download the `.age` artifact and store it privately off GitHub.
- [ ] Confirm the matching age private key is available to the recovery owner without placing it in GitHub, logs or this repository.
- [ ] Record the run URL, UTC completion time, encrypted filename/checksum and custody location in the private change record.

**Stop:** no backup, no promotion. The 27 July exception must never be repeated: there is no owner override this time.

## 2. Read-only preflight

- [ ] Freeze unrelated production changes.
- [ ] Confirm the connected project reference is exactly `vkfnsqdyhvtwyqkisxhk`.
- [ ] List production migration history read-only and require exactly 36 canonical versions, ending:

```text
20260725010000 authoritative_reference_integrity
```

- [ ] Compare the repository inventory with production. The only absent versions must be:

```text
20260727075922 admin_result_authorization
20260727080159 admin_result_revision_timestamp
```

- [ ] Run:

```bash
supabase db push --dry-run
```

- [ ] Require the dry run to list exactly those two files, in that order, and nothing else.
- [ ] Reconfirm `.github/workflows/production-backup.yml` still expects production’s current pre-promotion state: `36`, `20260725010000`, `authoritative_reference_integrity`.

**Stop:** wrong project, history count other than 36, a missing/extra/reordered dry-run migration, changed SQL, or any preflight error.

## 3. Explicit owner approval

- [ ] Present the owner with the backup evidence, exact repository commit, migration-history output, exact two-file dry run, operator identity, planned UTC window and recovery owner.
- [ ] Obtain an explicit approval that names the 36→38 production promotion and both canonical versions.
- [ ] Record the approval in the private change record.

**Stop:** silence, generic approval, stale evidence, a moved repository head or a changed window requires a fresh gate.

## 4. Apply and verify

- [ ] Run one `supabase db push` from the approved clean repository commit.
- [ ] Stop immediately on the first error; do not skip, repair or rerun blindly.
- [ ] Require production history to contain exactly 38 canonical versions, ending `20260727080159`.
- [ ] Run these read-only SQL checks in the production SQL console or `psql`.

### Function shape, security and grants

```sql
with expected(signature) as (
  values
    ('admin_confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)'),
    ('admin_correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)'),
    ('admin_clear_match_result(uuid,text)'),
    ('admin_match_result_revisions(uuid)')
)
select
  e.signature,
  p.oid is not null as exists,
  p.prosecdef as security_definer,
  p.proconfig = array['search_path='] as empty_search_path,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from expected e
left join pg_proc p
  on p.oid = to_regprocedure('public.' || e.signature)
order by e.signature;
```

**Require:** four rows; every `exists`, `security_definer`, `empty_search_path` and `authenticated_execute` value is `true`.

```sql
select
  p.oid::regprocedure as function,
  pg_get_functiondef(p.oid) like
    '%perform predictor_internal.require_result_admin();%' as capability_guard_present
from pg_proc p
where p.oid in (
  'public.admin_confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)'::regprocedure,
  'public.admin_correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)'::regprocedure,
  'public.admin_clear_match_result(uuid,text)'::regprocedure,
  'public.admin_match_result_revisions(uuid)'::regprocedure
)
order by 1;
```

**Require:** four rows and every `capability_guard_present` value is `true`.

```sql
select
  p.oid::regprocedure as function,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
where left(p.proname, 6) = 'admin_'
  and p.pronamespace = 'public'::regnamespace
order by 1;
```

**Require:** exactly the four approved signatures; `public_execute=false`, `anon_execute=false`, `authenticated_execute=true`.

```sql
select
  p.oid::regprocedure as function,
  p.prosecdef as security_definer,
  p.proconfig = array['search_path='] as empty_search_path,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
where p.oid = 'predictor_internal.require_result_admin()'::regprocedure;
```

**Require:** one row; `security_definer=false`, `empty_search_path=true`, and all three execute values are `false`.

- [ ] Confirm `admin_match_result_revisions(uuid)` returns the `recorded_at` column, not the superseded `created_at` projection.
- [ ] Run the repository’s pgTAP-equivalent privilege assertions or compare the concrete results above with `supabase/tests/080_function_privileges.sql`.
- [ ] Rerun `supabase db push --dry-run` and require zero pending migrations.

**Stop:** history is not exactly 38, any function is absent/surplus, any search path is not empty, any wrapper is not `SECURITY DEFINER`, any wrapper lacks the capability guard, or grants differ.

## 5. Post-promotion sequence

Perform these in order:

1. In the Netlify dashboard, change only production `EURO28_DEPLOYED_DB_CONTRACT` from `36` to `38`; do not change Supabase URLs/keys or non-production contexts.
2. Open a follow-up PR updating `.github/workflows/production-backup.yml` expectations to:

   ```text
   EXPECTED_MIGRATION_COUNT=38
   EXPECTED_LATEST_MIGRATION_VERSION=20260727080159
   EXPECTED_LATEST_MIGRATION_NAME=admin_result_revision_timestamp
   ```

3. Publish from the exact approved repository head and restore exact-head production smoke.
4. Require `/release.json`, HTTP smoke and browser smoke to prove production context, contract 38, exact commit and production Supabase.
5. Record who holds `app_metadata.admin_role=super_admin` or the `admin_capabilities` result capability in production, who approved it and how it was granted. JWT `app_metadata` has revocation latency up to token expiry and provides no grant audit trail; record this residual control explicitly.
6. Write a dated production-promotion reconciliation containing the backup, approval, before/after history, dry run, apply output, SQL verification, Netlify change and smoke evidence.

**Stop:** do not publish contract-38 application code while production still declares or hosts contract 36. Do not call the promotion complete without exact-head smoke and the dated record.

## 6. Failure and recovery

- **Dry-run or preflight failure:** make no write. Correct the discrepancy in a reviewed follow-up and repeat every gate with a fresh backup if the window moves outside 24 hours.
- **Push fails before either migration commits:** retain production contract 36, capture logs, inspect history read-only and prepare a reviewed retry or forward fix.
- **Push fails mid-chain:** freeze deployment; do not use migration repair, skip migration 38 or edit either canonical file. Capture exact history and schema evidence, keep Netlify production at 36, and obtain owner/database review for a forward repair or recovery decision.
- **Post-verification failure:** do not lift Netlify. Preserve evidence and determine whether a reviewed forward migration can restore the intended contract.
- **Recovery required:** use the downloaded, off-GitHub encrypted backup as the recovery path. Decrypt only in an approved restricted environment, restore to an isolated target first, verify it, then follow a separately owner-approved production recovery plan. A Netlify rollback is not a database rollback.

No failure path authorizes remote reset, history repair, migration renumbering, development fallback or guard weakening.
