#!/usr/bin/env bash
# ACQ-R03 — table bloat from delete-and-rederive scoring.
#
# Each confirmation must COMMIT separately, which is why this is a shell loop
# rather than SQL: holding all 36 in one transaction hides the dead tuples from
# the stats collector and prevents autovacuum from ever being a factor, which
# is not how production behaves.
#
# DISPOSABLE LOCAL DATABASE ONLY. Unlike the other harnesses this one COMMITS —
# it cannot roll back, because committing is the point. Build a throwaway
# database first; do not point it at anything you want to keep.
#
#   createdb bloat
#   psql -d bloat -f scripts/benchmarks/local-postgres-shim.sql
#   for f in supabase/migrations/*.sql; do psql -d bloat -f "$f"; done
#   psql -d bloat -f supabase/seed.sql
#   ENTRIES=250 DB=bloat ./scripts/benchmarks/acq-r03-bloat.sh
set -euo pipefail

DB="${DB:-bloat}"
ENTRIES="${ENTRIES:-250}"
PSQL=(psql -d "$DB" -tAq -v ON_ERROR_STOP=1)

"${PSQL[@]}" -c "select 1 from public.matches where round='group' limit 1" >/dev/null \
  || { echo "No group matches. Load supabase/seed.sql first." >&2; exit 1; }

"${PSQL[@]}" <<SQL >/dev/null
begin;
set local session_replication_role = replica;
insert into auth.users (instance_id,id,aud,role,email,encrypted_password,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',
       ('acf6acf6-0000-0000-0001-'||lpad(s::text,12,'0'))::uuid,
       'authenticated','authenticated','bloat-'||s||'@example.local','',now(),now()
from generate_series(1,$ENTRIES) s;
insert into public.profiles (id, display_name)
select ('acf6acf6-0000-0000-0001-'||lpad(s::text,12,'0'))::uuid,'Bloat '||s
from generate_series(1,$ENTRIES) s;
insert into public.entries (id,user_id,tournament_id,submitted_at)
select ('acf6acf6-0000-0000-0002-'||lpad(s::text,12,'0'))::uuid,
       ('acf6acf6-0000-0000-0001-'||lpad(s::text,12,'0'))::uuid,
       (select id from public.tournaments where name='UEFA Euro 2028'), now()-interval '2 hours'
from generate_series(1,$ENTRIES) s;
insert into public.match_predictions (entry_id,match_id,home_score,away_score)
select ('acf6acf6-0000-0000-0002-'||lpad(s::text,12,'0'))::uuid, m.id,
       (s+m.matchday)%4, (s*2+m.matchday)%3
from generate_series(1,$ENTRIES) s
cross join (select id,matchday from public.matches
            where tournament_id=(select id from public.tournaments where name='UEFA Euro 2028')
              and round='group') m;
update public.tournaments set lock_at=now()-interval '1 day' where name='UEFA Euro 2028';
commit;
SQL
echo "seeded $ENTRIES entries"

mapfile -t IDS < <("${PSQL[@]}" -c "
  select id from public.matches
  where tournament_id=(select id from public.tournaments where name='UEFA Euro 2028')
    and round='group'
  order by match_date, match_ref;")

i=0
for id in "${IDS[@]}"; do
  i=$((i+1))
  "${PSQL[@]}" -c "select public.confirm_match_result('$id'::uuid,'regulation',($i%4)::smallint,(($i+1)%3)::smallint);" >/dev/null
done
echo "confirmed ${#IDS[@]} results, one committed transaction each"

"${PSQL[@]}" -c "
select 'after stage:      '||n_live_tup||' live / '||n_dead_tup||' dead / '
       ||pg_size_pretty(pg_total_relation_size('public.score_events'))
       ||' / autovacuum ran '||autovacuum_count||' times'
from pg_stat_user_tables where relname='score_events';"
"${PSQL[@]}" -c "vacuum public.score_events;" >/dev/null
"${PSQL[@]}" -c "
select 'after VACUUM:     '||n_live_tup||' live / '||n_dead_tup||' dead / '
       ||pg_size_pretty(pg_total_relation_size('public.score_events'))
from pg_stat_user_tables where relname='score_events';"
"${PSQL[@]}" -c "vacuum full public.score_events;" >/dev/null
"${PSQL[@]}" -c "
select 'after VACUUM FULL: '||pg_size_pretty(pg_total_relation_size('public.score_events'))||' — the live size'
from pg_stat_user_tables where relname='score_events';"
