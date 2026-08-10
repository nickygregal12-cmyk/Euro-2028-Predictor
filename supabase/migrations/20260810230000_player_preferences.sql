-- ---------------------------------------------------------------------------
-- Contract 157 — MIG-UI-10 and MIG-UI-09: Follow, favourite team, onboarding
-- progress, and the pinned rival.
--
-- ---------------------------------------------------------------------------
-- THE AUDIT BOTH REGISTER ROWS DEMANDED, AND ITS ANSWER
-- ---------------------------------------------------------------------------
--
-- Both items say to audit the existing account/preference authority FIRST and
-- to add "the narrowest possible contract if it cannot hold them". The audit
-- was run against hosted Development rather than reasoned about:
--
--   `public.profiles` holds `id`, `display_name`, `created_at`, `last_seen_at`,
--   `last_seen_points`, `welcomed_at`, `reminder_emails`.
--
-- That is the whole of it. There is no preferences table anywhere in `public`
-- or `predictor_internal`, and nothing holding a follow, a favourite, an
-- onboarding step or a rival. So the audit's answer is that no existing
-- authority can hold these, and the narrowest contract is this one.
--
-- ---------------------------------------------------------------------------
-- WHY FOLLOW IS A ROW AND NOT A COLUMN
-- ---------------------------------------------------------------------------
--
-- `profiles.welcomed_at` and `profiles.reminder_emails` are the precedent for
-- a per-user scalar, and Follow is deliberately NOT one. `MIG-UI-10` asks for
-- persistence "keyed on canonical competition and team identity, supporting
-- many competitions without a schema change per league" — a column per
-- competition is exactly the schema change per league it forbids, and the
-- platform is built for twenty competitions rather than two.
--
-- Onboarding progress IS a per-user scalar, and it goes on `profiles` beside
-- `welcomed_at`, which is the same kind of fact recorded the same way. Putting
-- it in a preferences table because it arrived in the same contract would be
-- filing by arrival date.
--
-- ---------------------------------------------------------------------------
-- FOLLOW IS NOT GAME MEMBERSHIP, AND THIS DOES NOT BLUR THEM
-- ---------------------------------------------------------------------------
--
-- CLAUDE.md is explicit: "Following a competition is not game entry." The
-- register says the same, and `playerCompetitions.ts` currently reports
-- `followed: 'unknown'` everywhere precisely because no authority exists —
-- which is honest, and is the thing this closes.
--
-- So the follow table stores a follow and nothing else. It grants no entry,
-- creates no membership, and the game memberships keep their own authorities
-- untouched. A player may follow a competition they have never entered and
-- enter one they have never followed.
--
-- ---------------------------------------------------------------------------
-- THE RIVAL IS DELIBERATELY THIN
-- ---------------------------------------------------------------------------
--
-- `MIG-UI-09` is recorded as optional and explicitly not a blocker, with a
-- hard boundary: "Never followers, friend requests, public social graphs or
-- user discovery." A pin is therefore one row naming one player in one season,
-- readable only by the person who pinned it, and it confers nothing — no
-- notification, no visibility, no relationship the other player can see or is
-- told about. Contract 151's disclosure boundary still decides what the pinner
-- may actually see about them.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Onboarding progress, beside the scalar it resembles.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists onboarding_step text,
  add column if not exists onboarding_completed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_onboarding_step_allowed') then
    alter table public.profiles
      add constraint profiles_onboarding_step_allowed
      check (onboarding_step is null or onboarding_step in
             ('competition', 'games', 'identity', 'done'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Follow, keyed on canonical competition identity.
-- ---------------------------------------------------------------------------

create table if not exists public.competition_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  favourite_team_id uuid references public.teams(id) on delete set null,
  followed_at timestamptz not null default now(),
  primary key (user_id, tournament_id)
);

alter table public.competition_follows enable row level security;
revoke all on table public.competition_follows from public, anon, authenticated;

create index if not exists competition_follows_tournament_idx
  on public.competition_follows (tournament_id);

-- ---------------------------------------------------------------------------
-- 3. The pinned rival.
-- ---------------------------------------------------------------------------

create table if not exists public.pinned_rivals (
  user_id uuid not null references auth.users(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  rival_user_id uuid not null references auth.users(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (user_id, tournament_id, rival_user_id),
  -- Pinning yourself is not a rivalry.
  constraint pinned_rivals_not_self check (user_id <> rival_user_id)
);

alter table public.pinned_rivals enable row level security;
revoke all on table public.pinned_rivals from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. The writes.
-- ---------------------------------------------------------------------------

create or replace function public.set_competition_follow(
  p_tournament_id uuid,
  p_following boolean,
  p_favourite_team_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $follow$
declare
  v_uid uuid := (select auth.uid());
  v_kind text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select season.kind into v_kind
    from public.tournaments season where season.id = p_tournament_id;

  if v_kind is null then
    raise exception 'That competition does not exist' using errcode = '22023';
  end if;

  if not p_following then
    delete from public.competition_follows
     where user_id = v_uid and tournament_id = p_tournament_id;
    return jsonb_build_object('following', false);
  end if;

  -- A favourite team has to be a team in the competition being followed.
  -- Otherwise a player could pin a club from another league to this one.
  if p_favourite_team_id is not null and not exists (
    select 1 from public.teams team
     where team.id = p_favourite_team_id and team.tournament_id = p_tournament_id
  ) then
    raise exception 'That team does not play in this competition'
      using errcode = '23514';
  end if;

  insert into public.competition_follows (user_id, tournament_id, favourite_team_id)
  values (v_uid, p_tournament_id, p_favourite_team_id)
  on conflict (user_id, tournament_id) do update
    set favourite_team_id = excluded.favourite_team_id;

  return jsonb_build_object('following', true, 'favourite_team_id', p_favourite_team_id);
end;
$follow$;

create or replace function public.set_onboarding_progress(
  p_step text,
  p_completed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $onboarding$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  update public.profiles
     set onboarding_step = p_step,
         -- Completion is recorded once. Re-running onboarding later must not
         -- rewrite when the player first finished it.
         onboarding_completed_at = case
           when p_completed then coalesce(onboarding_completed_at, now())
           else onboarding_completed_at
         end
   where id = v_uid;

  return jsonb_build_object('step', p_step, 'completed', p_completed);
end;
$onboarding$;

create or replace function public.set_pinned_rival(
  p_tournament_id uuid,
  p_rival_user_id uuid,
  p_pinned boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $rival$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if not p_pinned then
    delete from public.pinned_rivals
     where user_id = v_uid and tournament_id = p_tournament_id
       and rival_user_id = p_rival_user_id;
    return jsonb_build_object('pinned', false);
  end if;

  if p_rival_user_id = v_uid then
    raise exception 'You cannot pin yourself as a rival' using errcode = '23514';
  end if;

  -- A pin is a note to self about somebody the caller can ALREADY see.
  -- Contract 151 decided who that is — a private-league co-member — and this
  -- reuses that boundary rather than inventing a second one, because a pin
  -- that worked on a stranger would be user discovery by another name.
  if not exists (
    select 1
      from public.league_members mine
      join public.league_members theirs on theirs.league_id = mine.league_id
      join public.leagues league on league.id = mine.league_id
     where mine.user_id = v_uid
       and theirs.user_id = p_rival_user_id
       and league.tournament_id = p_tournament_id
  ) then
    raise exception 'You can only pin a rival you share a private league with'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.pinned_rivals (user_id, tournament_id, rival_user_id)
  values (v_uid, p_tournament_id, p_rival_user_id)
  on conflict do nothing;

  return jsonb_build_object('pinned', true);
end;
$rival$;

-- ---------------------------------------------------------------------------
-- 5. The read.
-- ---------------------------------------------------------------------------

create or replace function public.get_my_preferences()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $prefs$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select * into v_profile from public.profiles where id = v_uid;

  return jsonb_build_object(
    'onboarding', jsonb_build_object(
      'step', v_profile.onboarding_step,
      'completed_at', v_profile.onboarding_completed_at),
    'follows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tournament_id', follow.tournament_id,
               'favourite_team_id', follow.favourite_team_id,
               'followed_at', follow.followed_at)
             order by follow.followed_at)
        from public.competition_follows follow
       where follow.user_id = v_uid), '[]'::jsonb),
    'pinned_rivals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tournament_id', pin.tournament_id,
               'rival_user_id', pin.rival_user_id)
             order by pin.pinned_at)
        from public.pinned_rivals pin
       where pin.user_id = v_uid), '[]'::jsonb));
end;
$prefs$;

revoke all on function public.set_competition_follow(uuid, boolean, uuid) from public, anon;
revoke all on function public.set_onboarding_progress(text, boolean) from public, anon;
revoke all on function public.set_pinned_rival(uuid, uuid, boolean) from public, anon;
revoke all on function public.get_my_preferences() from public, anon;

grant execute on function public.set_competition_follow(uuid, boolean, uuid) to authenticated;
grant execute on function public.set_onboarding_progress(text, boolean) to authenticated;
grant execute on function public.set_pinned_rival(uuid, uuid, boolean) to authenticated;
grant execute on function public.get_my_preferences() to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_follow text := pg_get_functiondef('public.set_competition_follow(uuid,boolean,uuid)'::regprocedure);
  v_rival text := pg_get_functiondef('public.set_pinned_rival(uuid,uuid,boolean)'::regprocedure);
begin
  -- Follow is not game entry. If this function ever writes a membership or an
  -- entry, the distinction CLAUDE.md draws has been lost in code.
  if v_follow ~* 'game_memberships|bonus_competition_entrants|insert into public\.entries' then
    raise exception 'Following a competition must not create game entry';
  end if;

  -- The rival pin reuses contract 151's disclosure boundary rather than
  -- inventing user discovery.
  if v_rival !~ 'league_members' then
    raise exception 'A pinned rival must be someone the caller already shares a private league with';
  end if;

  -- Neither preference table is browser-selectable; both are written and read
  -- through the definer functions only.
  if exists (
    select 1 from information_schema.table_privileges
     where table_schema = 'public'
       and table_name in ('competition_follows', 'pinned_rivals')
       and grantee in ('anon', 'authenticated', 'PUBLIC')
  ) then
    raise exception 'Preferences must not be readable directly by a browser role';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name in ('set_competition_follow', 'set_onboarding_progress',
                            'set_pinned_rival', 'get_my_preferences')
       and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'Preferences must not be reachable anonymously';
  end if;
end;
$$;
