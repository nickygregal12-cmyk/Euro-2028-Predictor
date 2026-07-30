#!/usr/bin/env bash
# ACQ-R03 — knockout result cost, and a concurrency probe.
#
# Run AFTER acq-r03-bloat.sh has completed the group stage on the same database:
# the round of 16 populates automatically when the 36th group result confirms,
# and each round populates the next, so this walks the real cascade.
#
# Seeds a predicted bracket per entry first, so the per-entry knockout
# derivation is real work rather than a no-op.
#
# DISPOSABLE LOCAL DATABASE ONLY. Commits, like acq-r03-bloat.sh.
#
#   DB=bloat ./scripts/benchmarks/acq-r03-knockout.sh
set -euo pipefail
DB="${DB:-bloat}"
PSQL=(psql -d "$DB" -tAq -v ON_ERROR_STOP=1)

"${PSQL[@]}" -c "select 1 from public.matches where round='r16' and home_team_id is not null limit 1" >/dev/null \
  || { echo "R16 not populated — complete the group stage first (acq-r03-bloat.sh)." >&2; exit 1; }

# One bracket per entry: every R16 team, a quarter of them carried to 'qf'.
"${PSQL[@]}" <<'SQL' >/dev/null
begin;
set local session_replication_role = replica;
insert into public.predicted_progression (entry_id, team_id, stage)
select e.id, t.team_id, case when t.rn <= 4 then 'qf' else 'r16' end
from public.entries e
cross join (
  select team_id, row_number() over (order by team_id) as rn
  from (select home_team_id as team_id from public.matches where round='r16'
        union select away_team_id from public.matches where round='r16') x
) t
on conflict (entry_id, team_id) do nothing;
commit;
SQL
echo "seeded predicted brackets"

for RD in r16 qf sf final; do
  mapfile -t IDS < <("${PSQL[@]}" -c "
    select id from public.matches
    where round='$RD' and result_state='scheduled' and home_team_id is not null
    order by match_ref;")
  [ ${#IDS[@]} -eq 0 ] && continue
  for id in "${IDS[@]}"; do
    L0=$("${PSQL[@]}" -c "select pg_current_wal_lsn()::text;")
    T0=$(date +%s%N)
    # Knockout requires a decisive score: the shape constraint rejects a draw.
    "${PSQL[@]}" -c "select public.confirm_match_result('$id'::uuid,'regulation',2::smallint,1::smallint);" >/dev/null
    T1=$(date +%s%N)
    WAL=$("${PSQL[@]}" -c "select pg_wal_lsn_diff(pg_current_wal_lsn(),'$L0'::pg_lsn)::bigint;")
    printf "%-6s %6s ms  %6.1f MB\n" "$RD" "$(( (T1-T0)/1000000 ))" "$(echo "$WAL" | awk '{print $1/1048576}')"
  done
done
