-- Euro 2028 Predictor — lint-safe Predictor Cup progression
--
-- Contract 59. The contract-56 settle function used a session-local temporary
-- table to hand playoff winners and byes into the fixed seeded bracket. That
-- lifecycle is correct and fully covered by pgTAP, but hosted `supabase db lint`
-- cannot resolve the pg_temp relation while statically analysing the function.
-- Replace only that handoff with an equivalent CTE and remove the shadowed loop
-- variable. Cup rules, stored decisions, bracket seats and privileges are
-- unchanged.

begin;

do $migration$
declare
  v_definition text;
  v_old_block constant text := $old$
    -- Seats: byes keep their seed's seat; the winner of playoff tie t takes
    -- seat 2P − Q + t. The bracket is fixed from here (§7.3).
    drop table if exists pg_temp.cup_round_seats;
    create temporary table cup_round_seats on commit drop as
      select member.seed as seat, member.user_id
      from public.bonus_cup_members member
      where member.competition_id = p_competition_id
        and member.seed between 1 and v_byes
      union all
      select v_byes + fixture.bracket_slot, fixture.winner_user_id
      from public.bonus_cup_fixtures fixture
      where fixture.competition_id = p_competition_id
        and fixture.window_id = p_window_id
        and fixture.stage = 'playoff';

    v_layout := predictor_internal.cup_bracket_order(v_p);
    for k in 1..(v_p / 2) loop
      insert into public.bonus_cup_fixtures
        (competition_id, stage, window_id, round_size, bracket_slot,
         home_user_id, away_user_id)
      select p_competition_id, 'knockout', v_next_window, v_p, k,
             home_seat.user_id, away_seat.user_id
      from pg_temp.cup_round_seats home_seat,
           pg_temp.cup_round_seats away_seat
      where home_seat.seat = v_layout[2 * k - 1]
        and away_seat.seat = v_layout[2 * k];
    end loop;
$old$;
  v_new_block constant text := $new$
    -- Seats: byes keep their seed's seat; the winner of playoff tie t takes
    -- seat 2P − Q + t. The bracket is fixed from here (§7.3). Keep the seat set
    -- inside the statement so static database analysis can resolve every
    -- relation without changing the deterministic layout.
    v_layout := predictor_internal.cup_bracket_order(v_p);
    for v_slot in 1..(v_p / 2) loop
      insert into public.bonus_cup_fixtures
        (competition_id, stage, window_id, round_size, bracket_slot,
         home_user_id, away_user_id)
      with cup_round_seats as (
        select member.seed as seat, member.user_id
        from public.bonus_cup_members member
        where member.competition_id = p_competition_id
          and member.seed between 1 and v_byes
        union all
        select v_byes + fixture.bracket_slot, fixture.winner_user_id
        from public.bonus_cup_fixtures fixture
        where fixture.competition_id = p_competition_id
          and fixture.window_id = p_window_id
          and fixture.stage = 'playoff'
      )
      select p_competition_id, 'knockout', v_next_window, v_p, v_slot,
             home_seat.user_id, away_seat.user_id
      from cup_round_seats home_seat
      cross join cup_round_seats away_seat
      where home_seat.seat = v_layout[2 * v_slot - 1]
        and away_seat.seat = v_layout[2 * v_slot];
    end loop;
$new$;
begin
  select pg_get_functiondef(
    'public.admin_settle_predictor_cup_round(uuid,uuid)'::regprocedure
  ) into v_definition;

  if position('  k integer;' in v_definition) = 0 then
    raise exception 'Expected Predictor Cup settle loop declaration was not found';
  end if;
  if position(v_old_block in v_definition) = 0 then
    raise exception 'Expected Predictor Cup temporary-seat block was not found';
  end if;

  v_definition := replace(v_definition, '  k integer;', '  v_slot integer;');
  v_definition := replace(v_definition, v_old_block, v_new_block);

  if position('pg_temp.cup_round_seats' in v_definition) > 0
    or position('for k in' in v_definition) > 0
  then
    raise exception 'Predictor Cup lint-safe rewrite was incomplete';
  end if;

  execute v_definition;
end;
$migration$;

comment on function public.admin_settle_predictor_cup_round(uuid, uuid) is
  'Service-only Predictor Cup round settle. Uses a lint-resolvable CTE for deterministic playoff-to-bracket seat progression.';

commit;
