-- Browser E2E still exercises the legacy Euro profile, H2H and private-league
-- surfaces. Contract 143 correctly defaults a fresh database to `hidden`, so
-- those journeys must opt into publication rather than weakening the route
-- guard or changing the migration default.
--
-- This file is executed only against the disposable local Supabase container.
-- It records the same hidden -> prelaunch state/history pair the owner RPC would
-- produce, with no actor because there is no real operational approver in a
-- throwaway browser fixture.

begin;

do $fixture$
declare
  v_now timestamptz := clock_timestamp();
  v_current predictor_internal.euro_publication_status;
begin
  select state
    into v_current
    from predictor_internal.euro_publication_state
   where singleton = true
   for update;

  if v_current <> 'hidden'::predictor_internal.euro_publication_status then
    raise exception 'Browser E2E expected Euro publication state hidden, found %', v_current;
  end if;

  insert into predictor_internal.euro_publication_transitions (
    from_state,
    to_state,
    reason,
    actor_id,
    created_at
  ) values (
    'hidden'::predictor_internal.euro_publication_status,
    'prelaunch'::predictor_internal.euro_publication_status,
    'Disposable Browser E2E fixture',
    null,
    v_now
  );

  update predictor_internal.euro_publication_state
     set state = 'prelaunch'::predictor_internal.euro_publication_status,
         changed_at = v_now,
         changed_by = null
   where singleton = true;
end;
$fixture$;

commit;
