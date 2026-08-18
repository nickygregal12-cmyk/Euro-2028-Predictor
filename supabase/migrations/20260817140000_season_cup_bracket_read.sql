-- Contract 193 — `CUP-003`: a season Championship entrant can see their own tie.
--
-- ---------------------------------------------------------------------------
-- THE GAP, MEASURED ON CONTRACT 192
-- ---------------------------------------------------------------------------
--
-- `get_season_cup_player_view` (contract 133) is the season Championship's
-- player read, and it is GROUP-SCOPED throughout: it resolves `v_group_id` from
-- the phase, lists members `where member.group_id = v_group_id`, and lists
-- fixtures `where cup_fixture.group_id = v_group_id`. There is no knockout
-- branch anywhere in it — no bracket, no tie, no opponent, no Penalty Number
-- state, no progression.
--
-- That was harmless while no season Championship could reach a knockout stage.
-- Contract 187 (`CUP-002`) ended that: qualification, seeding and the knockout
-- windows now exist for a league season. So an entrant who qualifies has NO
-- browser-reachable read of the tie they are about to play. Ninth instance of
-- the contract 86/98/116/118/120/128/129 shape — written for what existed,
-- never widened, and silent rather than wrong.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS *NOT* WRONG, WHICH IS WORTH RECORDING
-- ---------------------------------------------------------------------------
--
-- The Penalty Number WRITE authority is season-capable already and is not
-- touched here. `submit_cup_penalty_number` reads its lock through
-- `predictor_internal.cup_window_first_kickoff`, the competition-neutral
-- combiner contract 98 built precisely because the original joined
-- `bonus_window_fixtures` to `matches` and would have refused every season
-- submission with "this round's real fixtures are not scheduled yet". Reading
-- contract 56's original text rather than the installed definition suggests
-- otherwise, and that mistake was made and corrected while writing this.
--
-- This contract adds a READ. It writes nothing and moves no rule.
--
-- ---------------------------------------------------------------------------
-- THE OPPONENT'S PENALTY NUMBER IS NEVER RETURNED. NOT LATE, NEVER.
-- ---------------------------------------------------------------------------
--
-- Measured on `get_my_cup`, the tournament read: the Penalty Number block joins
-- `bonus_cup_penalty_numbers pn on pn.window_id = fixture.window_id and
-- pn.user_id = v_uid`. There is no branch, no post-settlement reveal and no
-- administrator path — the opponent's value is simply never in the payload.
--
-- That is the existing rule and it is reproduced exactly. This read also
-- withholds WHETHER the opponent has submitted, because a surface that showed
-- "your opponent has locked in" is a signal about their state that the
-- tournament does not give either, and the safe direction is to match.
--
-- ---------------------------------------------------------------------------
-- NO BRACKET ARITHMETIC IS RECOMPUTED
-- ---------------------------------------------------------------------------
--
-- Every structural fact is READ from the rows the canonical drivers wrote:
-- `stage`, `round_size` and `bracket_slot` come from `bonus_cup_fixtures`,
-- which contract 187's qualification driver populates through ADR 0014 § 7.2's
-- own arithmetic; `format_kind` and `group_stage_last_sequence` come from
-- contract 186's `bonus_cup_launches`. Nothing here derives a seat, a round
-- count or a pairing — recomputing any of them would be the second bracket
-- authority `CUP-003` exists to avoid.
--
-- **`single_group` is answered honestly rather than as an empty bracket.**
-- Contract 186 stores the format because a `single_group` competition finishes
-- with contract 124's SPLIT and never brackets at all. A read that returned
-- `bracket: []` for one would be describing a knockout that is not coming.
--
-- ---------------------------------------------------------------------------
-- WHO MAY LOOK
-- ---------------------------------------------------------------------------
--
-- Contract 133's boundary, reused unchanged: the caller must be an entrant, and
-- a non-entrant receives the same answer as an unknown id, so a private UUID is
-- not an existence oracle. The bracket is visible to entrants, matching
-- `get_my_cup`, which gates its own `bracket` on `v_is_entrant`.
--
-- ---------------------------------------------------------------------------
-- BOUNDED
-- ---------------------------------------------------------------------------
--
-- One request. ADR 0014 caps a Championship at twenty groups of twenty, so a
-- bracket is at most a few hundred rows and the caller's own ties at most a
-- handful; both are capped anyway so neither can become unbounded.

begin;

create or replace function public.get_season_cup_bracket(
  p_competition_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $bracket$
declare
  v_uid uuid := (select auth.uid());
  v_comp record;
  v_launch record;
  v_is_entrant boolean;
  v_brackets boolean;
  v_live record;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_competition_id is null then
    raise exception 'Competition is required' using errcode = '22023';
  end if;

  -- Contract 133's resolution, unchanged: a season Championship only.
  select competition.*
    into v_comp
  from public.bonus_competitions competition
  join public.tournaments tournament on tournament.id = competition.tournament_id
  where competition.id = p_competition_id
    and competition.game_key = 'predictor_cup'
    and tournament.kind = 'league_season';

  if not found then
    return jsonb_build_object('competition_id', p_competition_id, 'entered', false);
  end if;

  v_is_entrant := exists (
    select 1
    from public.bonus_competition_entrants entrant
    where entrant.competition_id = p_competition_id
      and entrant.user_id = v_uid
  );

  -- Deliberately the same response as an unknown id. Contract 133's reasoning,
  -- and its exact shape, so the two reads cannot disagree about what a
  -- non-member is told.
  if not v_is_entrant then
    return jsonb_build_object('competition_id', p_competition_id, 'entered', false);
  end if;

  select * into v_launch
    from public.bonus_cup_launches launch
   where launch.competition_id = p_competition_id;

  -- Contract 186's stored format decides whether a knockout is even coming.
  -- Absent means this competition predates the record or was never launched
  -- through the season launchers; `null` is reported rather than guessed.
  v_brackets := v_launch.format_kind = 'groups';

  -- The caller's own live tie: unsettled, not a group fixture, earliest first.
  select fixture.id as fixture_id,
         fixture.window_id,
         fixture.stage,
         fixture.round_size,
         fixture.bracket_slot,
         window_row.sequence as window_sequence,
         window_row.label as window_label,
         (fixture.home_user_id = v_uid) as is_home,
         case when fixture.home_user_id = v_uid
              then fixture.away_user_id else fixture.home_user_id end as opponent_id
    into v_live
    from public.bonus_cup_fixtures fixture
    join public.bonus_competition_windows window_row on window_row.id = fixture.window_id
   where fixture.competition_id = p_competition_id
     and fixture.stage <> 'group'
     and fixture.winner_user_id is null
     and v_uid in (fixture.home_user_id, fixture.away_user_id)
   order by window_row.sequence
   limit 1;

  return jsonb_build_object(
    'competition_id', p_competition_id,
    'entered', true,
    'server_now', now(),
    'visibility_kind', v_comp.visibility_kind,
    'availability_status', v_comp.availability_status,

    -- Which shape this competition is, from the record the launcher wrote.
    'format', jsonb_build_object(
      'kind', v_launch.format_kind,
      -- Stated rather than left to be inferred from an empty bracket: a
      -- `single_group` Championship finishes with contract 124's split and
      -- produces no knockout at all.
      'produces_knockout', v_brackets,
      'group_stage_last_sequence', v_launch.group_stage_last_sequence),

    'qualification', jsonb_build_object(
      -- Drawn, not merely due: the bracket exists once contract 187's driver
      -- has written knockout fixtures.
      'drawn', exists (
        select 1 from public.bonus_cup_fixtures fixture
         where fixture.competition_id = p_competition_id
           and fixture.stage <> 'group'),
      'qualifiers', (
        select count(*)::integer from public.bonus_cup_members member
         where member.competition_id = p_competition_id
           and member.seed is not null),
      'your_seed', (
        select member.seed from public.bonus_cup_members member
         where member.competition_id = p_competition_id
           and member.user_id = v_uid),
      'you_qualified', exists (
        select 1 from public.bonus_cup_members member
         where member.competition_id = p_competition_id
           and member.user_id = v_uid
           and member.seed is not null)),

    -- The tie in front of the caller, if there is one.
    'my_tie', case when v_live.fixture_id is null then null else jsonb_build_object(
      'fixture_id', v_live.fixture_id,
      'stage', v_live.stage,
      'round_size', v_live.round_size,
      'bracket_slot', v_live.bracket_slot,
      'window_sequence', v_live.window_sequence,
      'window_label', v_live.window_label,
      'is_home', v_live.is_home,
      'opponent', (
        select jsonb_build_object(
          'user_id', v_live.opponent_id,
          'display_name', coalesce(profile.display_name, 'Player'))
        from public.profiles profile where profile.id = v_live.opponent_id),
      'locks_at', predictor_internal.cup_window_first_kickoff(v_live.window_id))
    end,

    -- The Penalty Number, for the caller and nobody else. See the header: the
    -- opponent's value and the fact of their submission are both absent, which
    -- is what `get_my_cup` does and is the safe direction.
    'penalty_number', case when v_live.fixture_id is null then null else (
      select jsonb_build_object(
        'window_id', v_live.window_id,
        'window_label', v_live.window_label,
        -- §8.3: the home side (better seed) holds the ODD lane.
        'lane', case when v_live.is_home then 'odd' else 'even' end,
        'submitted', pn.value is not null,
        'value', pn.value,
        'version', pn.version,
        'locks_at', first_kickoff.at,
        'locked', first_kickoff.at is not null and now() >= first_kickoff.at,
        -- A round whose real fixtures are not scheduled cannot take a
        -- submission, and `submit_cup_penalty_number` refuses one. Said here
        -- so a surface can explain the refusal instead of discovering it.
        'open', first_kickoff.at is not null and now() < first_kickoff.at)
      from (select 1) placeholder
      left join public.bonus_cup_penalty_numbers pn
        on pn.window_id = v_live.window_id and pn.user_id = v_uid
      left join lateral (
        select predictor_internal.cup_window_first_kickoff(v_live.window_id) as at
      ) first_kickoff on true)
    end,

    -- Every tie the caller has played or is playing, with its outcome. This is
    -- the progression half: what happened, decided how, and against whom.
    'my_ties', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'fixture_id', fixture.id,
          'stage', fixture.stage,
          'round_size', fixture.round_size,
          'bracket_slot', fixture.bracket_slot,
          'window_sequence', window_row.sequence,
          'window_label', window_row.label,
          'is_home', fixture.home_user_id = v_uid,
          'opponent', jsonb_build_object(
            'user_id', opponent.user_id,
            'display_name', coalesce(opponent_profile.display_name, 'Player')),
          'settled', fixture.winner_user_id is not null,
          'winner_user_id', fixture.winner_user_id,
          'you_won', fixture.winner_user_id is not null
                     and fixture.winner_user_id = v_uid,
          -- 'points', 'extra_time', 'penalty_number', 'walkover' or
          -- 'admin_walkover' — the settlement authority's own vocabulary, read
          -- rather than re-derived from the scores.
          'decided_by', fixture.decided_by,
          'settled_at', fixture.settled_at)
        order by window_row.sequence)
      from public.bonus_cup_fixtures fixture
      join public.bonus_competition_windows window_row on window_row.id = fixture.window_id
      cross join lateral (
        select case when fixture.home_user_id = v_uid
          then fixture.away_user_id else fixture.home_user_id end as user_id
      ) opponent
      left join public.profiles opponent_profile on opponent_profile.id = opponent.user_id
      where fixture.competition_id = p_competition_id
        and fixture.stage <> 'group'
        and v_uid in (fixture.home_user_id, fixture.away_user_id)), '[]'::jsonb),

    -- The whole bracket, in `get_my_cup`'s shape and on its boundary: entrants
    -- only, which the early return above has already established.
    'bracket', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'fixture_id', fixture.id,
          'stage', fixture.stage,
          'round_size', fixture.round_size,
          'bracket_slot', fixture.bracket_slot,
          'window_sequence', window_row.sequence,
          'window_label', window_row.label,
          'home', jsonb_build_object(
            'user_id', fixture.home_user_id,
            'display_name', coalesce(home_profile.display_name, 'Player')),
          'away', jsonb_build_object(
            'user_id', fixture.away_user_id,
            'display_name', coalesce(away_profile.display_name, 'Player')),
          'is_yours', v_uid in (fixture.home_user_id, fixture.away_user_id),
          'winner_user_id', fixture.winner_user_id,
          'decided_by', fixture.decided_by)
        order by window_row.sequence, fixture.bracket_slot)
      from public.bonus_cup_fixtures fixture
      join public.bonus_competition_windows window_row on window_row.id = fixture.window_id
      left join public.profiles home_profile on home_profile.id = fixture.home_user_id
      left join public.profiles away_profile on away_profile.id = fixture.away_user_id
      where fixture.competition_id = p_competition_id
        and fixture.stage <> 'group'), '[]'::jsonb),

    'champion', (
      select jsonb_build_object(
        'user_id', fixture.winner_user_id,
        'display_name', coalesce(profile.display_name, 'Player'))
      from public.bonus_cup_fixtures fixture
      left join public.profiles profile on profile.id = fixture.winner_user_id
      where fixture.competition_id = p_competition_id
        and fixture.stage = 'knockout'
        and fixture.round_size = 2
        and fixture.winner_user_id is not null));
end;
$bracket$;

comment on function public.get_season_cup_bracket(uuid) is
  'Contract 193 / CUP-003. One season Championship entrant''s knockout tie, '
  'Penalty Number state, progression and the bracket around them. Reads the '
  'rows the canonical drivers wrote and recomputes no seat, round count or '
  'pairing. The opponent''s Penalty Number is never returned, matching '
  'get_my_cup exactly, and neither is whether they have submitted one.';

revoke all on function public.get_season_cup_bracket(uuid) from public, anon;
grant execute on function public.get_season_cup_bracket(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_read text := pg_get_functiondef(
    'public.get_season_cup_bracket(uuid)'::regprocedure);
begin
  -- THE ASSERTION THIS BLOCK EXISTS FOR. The caller's own Penalty Number is
  -- read with `pn.user_id = v_uid`, and no other predicate may appear against
  -- that table — an opponent's value must be unreachable by construction
  -- rather than by an `if` somebody can later relax.
  if v_read !~ 'pn.user_id = v_uid' then
    raise exception 'The Penalty Number must be read for the caller only';
  end if;

  if (length(v_read) - length(replace(v_read, 'bonus_cup_penalty_numbers', '')))
     / length('bonus_cup_penalty_numbers') <> 1 then
    raise exception 'The Penalty Number table may be reached exactly once';
  end if;

  -- The lock comes from the competition-neutral authority contract 98 built,
  -- never from the tournament relations it replaced.
  if v_read !~ 'cup_window_first_kickoff' then
    raise exception 'The lock must come from the neutral window-fact authority';
  end if;

  if v_read ~ 'bonus_window_fixtures' or v_read ~ 'join public.matches' then
    raise exception 'A season read must not reach a tournament-only relation';
  end if;

  -- No bracket arithmetic. Seats, rounds and pairings are read, never derived.
  if v_read ~ 'cup_bracket_order|log\(|power\(|ceil\(' then
    raise exception 'The bracket must be read rather than recomputed';
  end if;

  -- Contract 133's boundary, and the same answer for a non-entrant as for an
  -- unknown id.
  if v_read !~ 'bonus_competition_entrants' then
    raise exception 'The read must be gated on entry';
  end if;

  if v_read ~ 'p_now|p_as_of' then
    raise exception 'A reveal boundary must not accept a client-supplied time';
  end if;

  -- It writes nothing, asserted from the CATALOGUE rather than by searching the
  -- text for write keywords. Two reasons, and the second one is why this was
  -- rewritten: `stable` is enforced by PostgreSQL itself — a stable function
  -- that attempted an INSERT would fail at runtime — so the catalogue check is
  -- the stronger guarantee; and a guard that quotes `delete from` puts that
  -- literal into the migration, where `check-migration-additive.mjs` reads it
  -- and refuses the file as destructive. It did exactly that, which would have
  -- routed an additive read to the guarded destructive rollout lane.
  if (select p.provolatile
        from pg_catalog.pg_proc p
       where p.oid = 'public.get_season_cup_bracket(uuid)'::regprocedure) <> 's' then
    raise exception 'The bracket read must be stable, so that it cannot write';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name = 'get_season_cup_bracket'
       and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'The bracket read must not be executable anonymously';
  end if;
end;
$$;

commit;
