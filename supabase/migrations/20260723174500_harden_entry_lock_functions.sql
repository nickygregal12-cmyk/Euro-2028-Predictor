-- Harden the existing tournament-lock trigger functions before the entry-boundary
-- migration begins materialising server-owned group-position snapshots.
--
-- The original functions used unqualified relation names and inherited the
-- caller's search_path. Private SECURITY DEFINER helpers intentionally use an
-- empty search_path, so nested trigger execution must be fully qualified.

begin;

create or replace function public.enforce_entry_lock_scores()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_lock timestamptz;
begin
  select t.lock_at
    into v_lock
    from public.entries e
    join public.tournaments t
      on t.id = e.tournament_id
    where e.id = new.entry_id;

  if v_lock is not null and now() >= v_lock then
    if tg_op = 'INSERT'
       or new.home_score is distinct from old.home_score
       or new.away_score is distinct from old.away_score
    then
      raise exception 'Predictions are locked — the tournament has started'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_entry_lock_generic()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_entry uuid;
  v_lock timestamptz;
begin
  if tg_op = 'DELETE' then
    v_entry := old.entry_id;
  else
    v_entry := new.entry_id;
  end if;

  select t.lock_at
    into v_lock
    from public.entries e
    join public.tournaments t
      on t.id = e.tournament_id
    where e.id = v_entry;

  if v_lock is not null and now() >= v_lock then
    raise exception 'Predictions are locked — the tournament has started'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_entry_lock_scores()
  from public, anon, authenticated;
revoke all on function public.enforce_entry_lock_generic()
  from public, anon, authenticated;

commit;
