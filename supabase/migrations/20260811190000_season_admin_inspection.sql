-- ---------------------------------------------------------------------------
-- Contract 168 — the inspection reads the administrator commands assume.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS MEASURED
-- ---------------------------------------------------------------------------
--
-- Two administrator commands exist and neither has a read that supports it.
-- This is stated in the repository's own register, in `DFA-009`: "Provider
-- calendar approval and entrant disqualification are granted server-side and
-- deliberately absent — no browser read exposes the staged proposals or a
-- competition's entrants — and the page names both gaps."
--
-- Measured against the migrations rather than taken from that note:
--
--   * `admin_approve_initial_provider_fixtures(uuid, text, text)` and its
--     reject sibling decide a whole staged calendar. What they decide lives in
--     `predictor_internal.provider_fixture_proposals`, which is revoked from
--     every browser role. Contract 138's `get_provider_review_queue` reads the
--     review queues bounded per section, and a proposal is not one of them —
--     so an administrator approves 380 fixtures they have never seen;
--   * `admin_disqualify_competition_game_entry(uuid, uuid, text)` names an
--     entrant by user id, and nothing browser-reachable lists a competition's
--     entrants. Contract 165 lists a PRIVATE competition's entrants to its
--     OWNER, which is a different question with a different boundary.
--
-- Approving what you cannot see is not administration; it is a button.
--
-- ---------------------------------------------------------------------------
-- WHAT A DIFF MEANS FOR AN INITIAL CALENDAR
-- ---------------------------------------------------------------------------
--
-- The requirement asks for a field-level proposed change. For contract 132's
-- case — the FIRST publication of a season's calendar — there is usually
-- nothing to diff against: the fixture does not exist yet, so every field is
-- new. Reporting "changed from nothing" for 380 rows would be noise.
--
-- So the comparison this read actually performs is the one that matters at
-- approval time, and it is against the platform's own mapping rather than
-- against a previous value:
--
--   * is each provider team id MAPPED to one of our clubs, and to which;
--   * is the round mapped;
--   * would this proposal COLLIDE with a fixture we already hold.
--
-- Those are the three ways an approval goes wrong, and each is reported per
-- row as a named blocker rather than as a count — because "12 problems" tells
-- an administrator to refuse and tells them nothing about what to fix.
--
-- ---------------------------------------------------------------------------
-- WHAT IT DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It decides nothing and writes nothing. Approval and rejection remain contract
-- 132's, unchanged. It creates no fixture and no mapping.
--
-- It also does not widen who may administer: both reads gate on
-- `require_competition_admin`, the gate contract 127 introduced, and a caller
-- who fails it is refused before any row is read.
--
-- Additive: two new reads.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. The staged calendar, row by row, with what would block it
-- ===========================================================================

create or replace function public.admin_provider_proposal_detail(
  p_tournament_id uuid,
  p_provider text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $proposals$
declare
  v_limit integer;
  v_offset integer;
  v_total integer;
  v_summary jsonb;
  v_rows jsonb;
begin
  -- Gated BEFORE anything is read, so a caller who may not administer cannot
  -- learn from a timing difference whether a season has a staged calendar.
  perform predictor_internal.require_competition_admin();

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*)::integer into v_total
    from predictor_internal.provider_fixture_proposals proposal
   where proposal.tournament_id = p_tournament_id
     and (p_provider is null or proposal.provider = p_provider);

  -- The approval-state summary, which is the first thing an administrator
  -- needs: how many are pending, and has this calendar already been decided.
  select jsonb_object_agg(state, n) into v_summary
    from (
      select proposal.state, count(*)::integer as n
        from predictor_internal.provider_fixture_proposals proposal
       where proposal.tournament_id = p_tournament_id
         and (p_provider is null or proposal.provider = p_provider)
       group by proposal.state
    ) counted;

  select coalesce(jsonb_agg(page.entry order by page.ordinal), '[]'::jsonb)
    into v_rows
    from (
      select row_number() over (
               order by proposal.proposed_kickoff_at, proposal.provider_fixture_id
             ) as ordinal,
             jsonb_build_object(
               'proposal_id', proposal.id,
               'provider', proposal.provider,
               'provider_fixture_id', proposal.provider_fixture_id,
               'round_provider_id', proposal.round_provider_id,
               'proposed_kickoff_at', proposal.proposed_kickoff_at,
               'provider_status', proposal.provider_status,
               -- PROVENANCE. Which archived response this row was decoded from
               -- and when it was staged: an administrator approving a calendar
               -- is entitled to know how old the evidence is.
               'raw_response_id', proposal.raw_response_id,
               'staged_at', proposal.staged_at,
               -- Current approval state, so a re-opened page does not offer to
               -- decide something already decided.
               'state', proposal.state,
               'decided_at', proposal.decided_at,
               'decided_by', proposal.decided_by,
               'decision_reason', proposal.decision_reason,
               'created_fixture_id', proposal.created_fixture_id,
               -- WHAT THE PROVIDER SAID, beside WHAT WE MAKE OF IT. The two
               -- are kept apart deliberately: the provider's team name is
               -- evidence, and our club is the mapping's answer.
               'home', jsonb_build_object(
                 'provider_id', proposal.home_team_provider_id,
                 'provider_name', proposal.home_team_name,
                 'mapped_team_id', home_map.team_id,
                 'mapped_team_name', home_club.name),
               'away', jsonb_build_object(
                 'provider_id', proposal.away_team_provider_id,
                 'provider_name', proposal.away_team_name,
                 'mapped_team_id', away_map.team_id,
                 'mapped_team_name', away_club.name),
               -- THE BLOCKERS, named individually. "12 problems" tells an
               -- administrator to refuse and tells them nothing to fix.
               'blockers', (
                 select coalesce(jsonb_agg(blocker), '[]'::jsonb)
                   from (
                     select 'unmapped_home_team' as blocker where home_map.team_id is null
                     union all
                     select 'unmapped_away_team' where away_map.team_id is null
                     union all
                     select 'same_club_both_sides'
                      where home_map.team_id is not null
                        and home_map.team_id = away_map.team_id
                     union all
                     select 'kickoff_in_the_past'
                      where proposal.proposed_kickoff_at <= now()
                     union all
                     select 'fixture_already_exists'
                      where exists (
                        select 1 from public.season_fixtures existing
                         where existing.tournament_id = proposal.tournament_id
                           and existing.home_team_id = home_map.team_id
                           and existing.away_team_id = away_map.team_id)
                   ) found)
             ) as entry
        from predictor_internal.provider_fixture_proposals proposal
        left join public.provider_entity_map home_map
               on home_map.provider = proposal.provider
              and home_map.entity_kind = 'team'
              and home_map.provider_id = proposal.home_team_provider_id
              and home_map.tournament_id = proposal.tournament_id
        left join public.provider_entity_map away_map
               on away_map.provider = proposal.provider
              and away_map.entity_kind = 'team'
              and away_map.provider_id = proposal.away_team_provider_id
              and away_map.tournament_id = proposal.tournament_id
        left join public.teams home_club on home_club.id = home_map.team_id
        left join public.teams away_club on away_club.id = away_map.team_id
       where proposal.tournament_id = p_tournament_id
         and (p_provider is null or proposal.provider = p_provider)
       order by proposal.proposed_kickoff_at, proposal.provider_fixture_id
       limit v_limit offset v_offset
    ) page;

  return jsonb_build_object(
    'tournament_id', p_tournament_id,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'has_more', v_offset + v_limit < v_total,
    'states', coalesce(v_summary, '{}'::jsonb),
    -- The count an administrator actually decides on: how many of the whole
    -- staged calendar carry a blocker, not how many on this page do. A page
    -- with nothing wrong on it says nothing about the other 330 rows.
    --
    -- IT COUNTS EXACTLY THE CONDITIONS THE PER-ROW `blockers` LIST NAMES. An
    -- earlier draft counted only the mapping failures, so a calendar with one
    -- unmapped team and one past kickoff reported `blocked_total: 1` while two
    -- rows visibly carried a blocker. A summary that disagrees with the list it
    -- summarises is the same defect as a badge that disagrees with its inbox,
    -- and it was found by driving the read rather than by reading it.
    'blocked_total', (
      select count(*)::integer
        from predictor_internal.provider_fixture_proposals proposal
        left join public.provider_entity_map home_map
               on home_map.provider = proposal.provider
              and home_map.entity_kind = 'team'
              and home_map.provider_id = proposal.home_team_provider_id
              and home_map.tournament_id = proposal.tournament_id
        left join public.provider_entity_map away_map
               on away_map.provider = proposal.provider
              and away_map.entity_kind = 'team'
              and away_map.provider_id = proposal.away_team_provider_id
              and away_map.tournament_id = proposal.tournament_id
       where proposal.tournament_id = p_tournament_id
         and (p_provider is null or proposal.provider = p_provider)
         and (home_map.team_id is null
              or away_map.team_id is null
              or home_map.team_id = away_map.team_id
              or proposal.proposed_kickoff_at <= now()
              or exists (
                select 1 from public.season_fixtures existing
                 where existing.tournament_id = proposal.tournament_id
                   and existing.home_team_id = home_map.team_id
                   and existing.away_team_id = away_map.team_id))),
    'proposals', v_rows);
end;
$proposals$;

revoke all on function public.admin_provider_proposal_detail(uuid, text, integer, integer)
  from public, anon;
grant execute on function public.admin_provider_proposal_detail(uuid, text, integer, integer)
  to authenticated;

-- ===========================================================================
-- 2. A competition's entrants, which the disqualify command names by id
-- ===========================================================================
--
-- `admin_disqualify_competition_game_entry` takes a competition and a user id.
-- Nothing browser-reachable produced that user id, so the command was reachable
-- only by someone who already had it from somewhere else.
--
-- This is an ADMINISTRATOR read and contract 165 is an ORGANISER read, and they
-- are deliberately separate functions rather than one with two gates: an
-- administrator may inspect any competition including a public one, an
-- organiser may inspect only their own private container, and a single function
-- branching on which caller it has is a function whose disclosure boundary
-- depends on a runtime test.

create or replace function public.admin_competition_entrants(
  p_competition_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $entrants$
declare
  v_limit integer;
  v_offset integer;
  v_competition record;
  v_total integer;
  v_rows jsonb;
begin
  perform predictor_internal.require_competition_admin();

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  select competition.id, competition.name, competition.game_key,
         competition.tournament_id, competition.visibility_kind,
         competition.published, competition.availability_status,
         competition.registration_closes_at, competition.completed_at,
         season.name as season_name, season.season_key,
         definition.display_name as game_name
    into v_competition
    from public.bonus_competitions competition
    join public.tournaments season on season.id = competition.tournament_id
    left join public.game_definitions definition
           on definition.game_key = competition.game_key
   where competition.id = p_competition_id;

  if v_competition.id is null then
    raise exception 'No such competition' using errcode = 'no_data_found';
  end if;

  select count(*)::integer into v_total
    from public.bonus_competition_entrants entrant
   where entrant.competition_id = p_competition_id;

  select coalesce(jsonb_agg(page.entry order by page.ordinal), '[]'::jsonb)
    into v_rows
    from (
      select row_number() over (
               order by coalesce(player.display_name, ''), entrant.user_id
             ) as ordinal,
             jsonb_build_object(
               'user_id', entrant.user_id,
               'display_name', coalesce(player.display_name, 'Player'),
               'joined_at', entrant.joined_at,
               -- The settlement authority's own word.
               'outcome', entrant.outcome,
               -- The membership, which is where disqualification is recorded,
               -- so an administrator can see that a previous decision took
               -- effect rather than pressing the button again.
               'membership_status', membership.status,
               'left_at', membership.left_at,
               'disqualified_at', membership.disqualified_at,
               'rejoin_count', membership.rejoin_count,
               -- ELIGIBILITY for the command that names this row: an entrant
               -- already disqualified is not a candidate, and one who has left
               -- is not either. Reported so the surface can withhold a control
               -- the server would refuse, which is contract 140's lesson.
               'disqualifiable',
                 membership.status is not distinct from 'active'
                 and entrant.outcome <> 'eliminated'
             ) as entry
        from public.bonus_competition_entrants entrant
        left join public.profiles player on player.id = entrant.user_id
        left join public.game_memberships membership
               on membership.game_competition_id = entrant.competition_id
              and membership.user_id = entrant.user_id
       where entrant.competition_id = p_competition_id
       order by coalesce(player.display_name, ''), entrant.user_id
       limit v_limit offset v_offset
    ) page;

  return jsonb_build_object(
    'competition', jsonb_build_object(
      'id', v_competition.id,
      'name', v_competition.name,
      'game_key', v_competition.game_key,
      'game_name', v_competition.game_name,
      'season_name', v_competition.season_name,
      'season_key', v_competition.season_key,
      'visibility', v_competition.visibility_kind,
      'published', v_competition.published,
      'availability_status', v_competition.availability_status,
      'registration_closes_at', v_competition.registration_closes_at,
      'completed_at', v_competition.completed_at),
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'has_more', v_offset + v_limit < v_total,
    'counts', jsonb_build_object(
      'entrants', v_total,
      'active', (select count(*)::integer from public.bonus_competition_entrants e
                  where e.competition_id = p_competition_id and e.outcome = 'active'),
      'eliminated', (select count(*)::integer from public.bonus_competition_entrants e
                      where e.competition_id = p_competition_id and e.outcome = 'eliminated'),
      'disqualified', (select count(*)::integer from public.game_memberships m
                        where m.game_competition_id = p_competition_id
                          and m.status = 'disqualified')),
    'entrants', v_rows);
end;
$entrants$;

revoke all on function public.admin_competition_entrants(uuid, integer, integer)
  from public, anon;
grant execute on function public.admin_competition_entrants(uuid, integer, integer)
  to authenticated;

-- ===========================================================================
-- 3. Prove the boundaries, in the same transaction
-- ===========================================================================

do $$
declare
  v_proposals text := pg_get_functiondef(
    'public.admin_provider_proposal_detail(uuid,text,integer,integer)'::regprocedure);
  v_entrants text := pg_get_functiondef(
    'public.admin_competition_entrants(uuid,integer,integer)'::regprocedure);
begin
  -- BOTH ARE GATED, and gated before any row is read so a refused caller
  -- learns nothing from how long the refusal took.
  if v_proposals !~ 'require_competition_admin' or v_entrants !~ 'require_competition_admin' then
    raise exception 'Both administrator reads must gate on competition administration';
  end if;

  if position('require_competition_admin' in v_proposals)
       > position('provider_fixture_proposals' in v_proposals) then
    raise exception 'The proposal read must gate before it reads a proposal';
  end if;

  if position('require_competition_admin' in v_entrants)
       > position('bonus_competition_entrants' in v_entrants) then
    raise exception 'The entrant read must gate before it reads an entrant';
  end if;

  -- NEITHER DECIDES ANYTHING. Approval and rejection remain contract 132's.
  if (v_proposals || v_entrants) ~* 'insert[[:space:]]+into|update[[:space:]]+public\.|delete[[:space:]]+from' then
    raise exception 'These are inspection reads; the decisions stay where they are';
  end if;

  -- The proposal read must not disclose a raw provider payload. Contract 132's
  -- custody design keeps the archived response server-side; this returns its
  -- ID as provenance and never its body.
  if v_proposals ~* 'payload|response_body|raw_body' then
    raise exception 'A raw provider payload must never reach a client';
  end if;

  -- Both are bounded, for issue #129's reason: an initial Premier League
  -- calendar is 380 rows and a competition may hold thousands of entrants.
  if v_proposals !~ 'least\(greatest\(' or v_entrants !~ 'least\(greatest\(' then
    raise exception 'Both administrator reads must clamp their page size server-side';
  end if;

  -- Neither is anonymously reachable.
  if has_function_privilege('anon',
       'public.admin_provider_proposal_detail(uuid,text,integer,integer)', 'execute')
     or has_function_privilege('anon',
       'public.admin_competition_entrants(uuid,integer,integer)', 'execute')
  then
    raise exception 'An administrator read must not be reachable anonymously';
  end if;

  -- The proposal table itself stays revoked: the read is the only way in.
  if has_table_privilege('authenticated',
       'predictor_internal.provider_fixture_proposals', 'select') then
    raise exception 'The proposal store must stay unreachable from a browser role';
  end if;
end;
$$;
