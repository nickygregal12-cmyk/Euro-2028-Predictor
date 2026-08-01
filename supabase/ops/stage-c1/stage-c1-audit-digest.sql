-- Canonical preservation digest for the historical Bonus Games audit log.
--
-- Intentionally excludes tournament_id: Stage C1 adds and backfills that derived
-- scope column. Every pre-existing field promised unchanged by the migration is
-- represented in a deterministic JSONB payload before SHA-256 hashing.

with canonical as (
  select
    count(*)::bigint as row_count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'competition_id', competition_id,
          'action', action,
          'detail', detail,
          'actor_id', actor_id,
          'recorded_at_utc',
            to_char(
              recorded_at at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            )
        )
        order by id
      ),
      '[]'::jsonb
    ) as payload
  from public.bonus_competition_audit
)
select
  row_count,
  encode(
    extensions.digest(convert_to(payload::text, 'UTF8'), 'sha256'),
    'hex'
  ) as audit_digest
from canonical;
