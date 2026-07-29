-- Euro 2028 Predictor — lint-safe Predictor Cup qualification
--
-- Contract 60. Hosted lint exposed the same temporary-table visibility issue in
-- the service-only group-finalisation gate. Replace its pg_temp cache with
-- repeated reads from the same authoritative, deterministic table function.
-- Qualification criteria, wildcard ordering, seeding and fixture creation are
-- unchanged. Remove declarations for integer FOR-loop variables (PL/pgSQL
-- creates those variables implicitly) and type the empty seed arrays explicitly.

begin;

do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure
  ) into v_definition;

  if position('drop table if exists pg_temp.cup_gate_tables;' in v_definition) = 0
    or position('create temporary table cup_gate_tables on commit drop as' in v_definition) = 0
    or position('from pg_temp.cup_gate_tables gate' in v_definition) = 0
  then
    raise exception 'Expected Predictor Cup qualification temporary-table block was not found';
  end if;

  v_definition := replace(
    v_definition,
    $old$
  -- The complete §5.2 tables, stored once as the immutable gate basis.
  drop table if exists pg_temp.cup_gate_tables;
  create temporary table cup_gate_tables on commit drop as
    select * from predictor_internal.cup_final_group_tables(p_competition_id);

  select count(*) into v_total from pg_temp.cup_gate_tables;
$old$,
    $new$
  -- The complete §5.2 table function remains the immutable gate basis. Read it
  -- directly in each bounded statement so hosted static analysis can resolve
  -- every relation without altering the deterministic qualification output.
  select count(*) into v_total
    from predictor_internal.cup_final_group_tables(p_competition_id);
$new$
  );

  v_definition := replace(
    v_definition,
    'from pg_temp.cup_gate_tables gate',
    'from predictor_internal.cup_final_group_tables(p_competition_id) gate'
  );
  v_definition := replace(
    v_definition,
    '  v_home_seeds integer[] := ''{}'';',
    '  v_home_seeds integer[] := array[]::integer[];'
  );
  v_definition := replace(
    v_definition,
    '  v_away_seeds integer[] := ''{}'';',
    '  v_away_seeds integer[] := array[]::integer[];'
  );
  v_definition := replace(
    v_definition,
    E'  t integer;\n  u integer;\n  v_swap integer;\n  k integer;',
    '  v_swap integer;'
  );

  if position('pg_temp.cup_gate_tables' in v_definition) > 0
    or position('create temporary table cup_gate_tables' in lower(v_definition)) > 0
    or position(E'  t integer;\n' in v_definition) > 0
    or position(E'  u integer;\n' in v_definition) > 0
    or position(E'  k integer;\n' in v_definition) > 0
  then
    raise exception 'Predictor Cup qualification lint-safe rewrite was incomplete';
  end if;

  execute v_definition;

  -- Contract 59 used an explicit declaration for the integer FOR-loop variable.
  -- PL/pgSQL creates that variable automatically; remove the declaration to
  -- eliminate the shadowed/unused warning without changing the loop body.
  select pg_get_functiondef(
    'public.admin_settle_predictor_cup_round(uuid,uuid)'::regprocedure
  ) into v_definition;
  if position('  v_slot integer;' in v_definition) = 0
    or position('for v_slot in' in lower(v_definition)) = 0
  then
    raise exception 'Expected Predictor Cup settle slot loop was not found';
  end if;
  v_definition := replace(v_definition, E'  v_slot integer;\n', '');
  execute v_definition;
end;
$migration$;

comment on function public.admin_finalise_predictor_cup_groups(uuid) is
  'Service-only Predictor Cup qualification gate. Reads the authoritative final group table function directly for lint-safe deterministic qualification and seeding.';

commit;
