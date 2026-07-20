-- Euro 2028 Predictor — app-level rate limiting (prediction save + league join)
--
-- Follow-up migration; append-only.
--
-- Supabase already rate-limits its own AUTH endpoints; this covers app actions
-- that weren't protected. Server-enforced via a small event log + a check called
-- from BEFORE triggers, so a crafted client can't bypass it. Thresholds
-- (per user, per minute) and their rationale mirror src/domain/rateLimit.ts:
--   * prediction_save    — 60/min: the autosave is debounced, so real editing is
--                          far below this; 60 only trips runaway loops / scripts.
--                          Abuse is self-scoped (RLS: own entry only).
--   * league_membership  — 5/min: joining/creating leagues is discrete; 5/min
--                          stops join-spam / invite-code probing.
--
-- Idempotent.

begin;

create table if not exists rate_limit_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  action     text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_events_lookup
  on rate_limit_events (user_id, action, created_at);

-- No client access at all — only the definer function below reads/writes it.
alter table rate_limit_events enable row level security;

-- enforce_rate_limit: raise if the user already hit the limit in the last
-- minute, else log this event. Opportunistically prunes this user's stale rows
-- so the log can't grow unbounded.
create or replace function enforce_rate_limit(p_action text, p_max_per_min int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    return; -- no authenticated user (shouldn't happen through the app); skip
  end if;

  delete from rate_limit_events
  where user_id = v_uid and action = p_action and created_at < now() - interval '1 hour';

  select count(*) into v_count
  from rate_limit_events
  where user_id = v_uid and action = p_action and created_at > now() - interval '1 minute';

  if v_count >= p_max_per_min then
    raise exception 'You''re doing that too fast — please wait a moment and try again.'
      using errcode = 'check_violation';
  end if;

  insert into rate_limit_events (user_id, action) values (v_uid, p_action);
end;
$$;

revoke all on function enforce_rate_limit(text, int) from public;

-- Prediction autosave (writes to match_predictions).
create or replace function trg_rate_limit_prediction_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform enforce_rate_limit('prediction_save', 60);
  return new;
end;
$$;

drop trigger if exists rate_limit_prediction_save on match_predictions;
create trigger rate_limit_prediction_save
  before insert or update on match_predictions
  for each row execute function trg_rate_limit_prediction_save();

-- League join / create (both insert into league_members).
create or replace function trg_rate_limit_league_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform enforce_rate_limit('league_membership', 5);
  return new;
end;
$$;

drop trigger if exists rate_limit_league_membership on league_members;
create trigger rate_limit_league_membership
  before insert on league_members
  for each row execute function trg_rate_limit_league_membership();

commit;
