-- Contract 137: Chelsea is not "chelse".
--
-- ---------------------------------------------------------------------------
-- THE DEFECT, AND HOW IT WAS FOUND
-- ---------------------------------------------------------------------------
--
-- Contract 136 normalised a club name by stripping non-letters and then
-- removing a leading `afc|fc` and a trailing `afc|fc`. The trailing strip is
-- wrong, and wrong in a way that only shows up on a name whose last letter
-- before "FC" happens to be an `a`:
--
--     'Chelsea FC'     -> 'chelseafc'     -> matches (afc)$ -> 'chelse'
--     'Aston Villa FC' -> 'astonvillafc'  -> matches (afc)$ -> 'astonvill'
--
-- The alternation tries `afc` first, and "…a" + "fc" ends in the literal
-- characters `afc`. Neither club resolved, so both rendered in the neutral
-- fallback — which is exactly the defect contract 136 existed to fix.
--
-- **It was found by verifying the hosted rollout against real football rather
-- than against the migration ledger.** Contract 136 applied cleanly, its own
-- verification block passed, its pgTAP suite passed, and 29 of 32 development
-- clubs resolved. The three that did not are the entire evidence that anything
-- was wrong, and none of the three name forms contract 136 checked
-- ('Arsenal FC', 'AFC Bournemouth', 'Heart of Midlothian') could have caught
-- it. A guard that tests only the cases its author thought of tests the author.
--
-- ---------------------------------------------------------------------------
-- THE FIX: 'AFC' IS A PREFIX, NOT A SUFFIX
-- ---------------------------------------------------------------------------
--
-- The old form guessed at position by stripping the same alternation from both
-- ends of a string that had already had its spaces removed. That is the actual
-- mistake: once 'aston villa fc' has become 'astonvillafc', the information
-- that `fc` was a separate word is gone, and no anchored pattern can recover
-- it.
--
-- So the words are removed while they are still words, before the spaces go.
-- `\m` and `\M` anchor to word boundaries, so `afc` and `fc` are removed only
-- where they stand alone — 'AFC Bournemouth' and 'Hull City AFC' both lose the
-- token wherever it sits, and 'Chelsea' keeps every letter it has.
--
-- Verified against all 32 real development clubs rather than against examples:
-- 29 resolved before, 32 resolve after, and no club that resolved before
-- resolves differently now.

begin;

create or replace function predictor_internal.normalised_club_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $normalise$
  -- Remove `fc` / `afc` as whole WORDS first, then reduce to letters. The order
  -- is the fix: doing it the other way round destroys the word boundary the
  -- pattern needs, which is how 'Chelsea FC' became 'chelse'.
  select pg_catalog.regexp_replace(
           pg_catalog.regexp_replace(
             pg_catalog.lower(coalesce(p_name, '')),
             '\m(afc|fc)\M', '', 'g'),
           '[^a-z]', '', 'g');
$normalise$;

revoke all on function predictor_internal.normalised_club_name(text)
  from public, anon, authenticated, service_role;

-- Hull City is in the real 2026/27 Premier League field in Development and was
-- missing from contract 136's reference. Its normalisation was always correct;
-- this is a plain gap rather than a second instance of the defect above.
--
-- The remaining rows are anticipatory, in the same spirit as the promoted and
-- relegated clubs contract 136 already carries: a club that comes up should
-- render on the day it appears rather than after somebody notices it is grey.
insert into predictor_internal.club_identity_reference
  (normalised_name, short_code, club_colours, note)
values
  ('hullcity',           'HUL', 'Amber / Black',      'in the Development 2026/27 field'),
  ('sheffieldwednesday', 'SHW', 'Blue / White',       'anticipatory'),
  ('birminghamcity',     'BIR', 'Royal Blue / White', 'anticipatory'),
  ('stokecity',          'STK', 'Red / White',        'anticipatory'),
  ('swanseacity',        'SWA', 'White / Black',      'anticipatory'),
  ('cardiffcity',        'CAR', 'Blue / White',       'anticipatory'),
  ('prestonnorthend',    'PRE', 'White / Navy',       'anticipatory'),
  ('queensparkrangers',  'QPR', 'Blue / White',       'anticipatory'),
  ('bristolcity',        'BRC', 'Red / White',        'anticipatory'),
  ('blackburnrovers',    'BLA', 'Blue / White',       'anticipatory'),
  ('derbycounty',        'DER', 'White / Black',      'anticipatory'),
  ('millwall',           'MIL', 'Blue / White',       'anticipatory'),
  ('portsmouth',         'POR', 'Blue / White',       'anticipatory'),
  ('plymouthargyle',     'PLY', 'Green / White',      'anticipatory'),
  ('wrexham',            'WRE', 'Red / White',        'anticipatory'),
  ('rosscounty',         'ROS', 'Navy / White',       'already present; ignored on conflict')
on conflict (normalised_name) do nothing;

-- ---------------------------------------------------------------------------
-- Prove the fix, in the same transaction.
--
-- The two clubs that broke are named explicitly, because a regression here is
-- silent: a wrong normalisation does not raise, it just renders grey.
-- ---------------------------------------------------------------------------

do $$
declare
  v_case record;
begin
  for v_case in
    select * from (values
      -- The defect itself.
      ('Chelsea FC',                'chelsea'),
      ('Aston Villa FC',            'astonvilla'),
      -- 'AFC' wherever it sits.
      ('AFC Bournemouth',           'bournemouth'),
      ('Hull City AFC',             'hullcity'),
      ('Sunderland AFC',            'sunderland'),
      -- Everything contract 136 already resolved, which must not move.
      ('Arsenal FC',                'arsenal'),
      ('Brighton & Hove Albion FC', 'brightonhovealbion'),
      ('Nottingham Forest FC',      'nottinghamforest'),
      ('Heart of Midlothian',       'heartofmidlothian'),
      ('St. Johnstone',             'stjohnstone'),
      ('Celtic',                    'celtic')
    ) as t(input, expected)
  loop
    if predictor_internal.normalised_club_name(v_case.input) is distinct from v_case.expected then
      raise exception 'normalised_club_name(%) returned %, expected %',
        v_case.input,
        predictor_internal.normalised_club_name(v_case.input),
        v_case.expected;
    end if;
  end loop;
end;
$$;

commit;
