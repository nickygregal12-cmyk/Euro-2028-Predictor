import { readFileSync, writeFileSync } from 'node:fs'

function read(path) { return readFileSync(path, 'utf8') }
function write(path, value) { writeFileSync(path, value) }
function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before)
  if (first < 0) throw new Error(`Missing target: ${label}`)
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Non-unique target: ${label}`)
  return source.slice(0, first) + after + source.slice(first + before.length)
}
function replaceRegexOnce(source, pattern, after, label) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))]
  if (matches.length !== 1) throw new Error(`Expected one ${label}, found ${matches.length}`)
  return source.replace(pattern, () => after)
}

const migrationPath = 'supabase/migrations/20260803070000_c1b_game_catalogue_memberships.sql'
let migration = read(migrationPath)

migration = replaceOnce(
  migration,
  `    on conflict (tournament_id, game_key) do update\n      set registration_closes_at = excluded.registration_closes_at,\n          availability_status = 'active',\n          updated_at = now()\n      where public.bonus_competitions.game_key = 'original_predictor'\n        and not public.bonus_competitions.published;`,
  `    on conflict (tournament_id, game_key) do update\n      set registration_opens_at = case\n            when excluded.registration_closes_at is null then\n              public.bonus_competitions.registration_opens_at\n            else least(\n              coalesce(\n                public.bonus_competitions.registration_opens_at,\n                excluded.registration_closes_at - interval '1 second'\n              ),\n              excluded.registration_closes_at - interval '1 second'\n            )\n          end,\n          registration_closes_at = excluded.registration_closes_at,\n          availability_status = 'active',\n          updated_at = now()\n      where public.bonus_competitions.game_key = 'original_predictor'\n        and not public.bonus_competitions.published;`,
  'monotonic hidden Original registration window',
)

migration = replaceOnce(
  migration,
  `      and availability.tournament_id = new.tournament_id\n      and availability.availability_status = 'active'\n      and definition.requires_prediction_entry`,
  `      and availability.tournament_id = new.tournament_id\n      and definition.requires_prediction_entry`,
  'trusted entry compatibility boundary',
)

migration = replaceRegexOnce(
  migration,
  /-- Existing bonus-game write RPCs continue to use their original payload tables,[\s\S]*?revoke all on function predictor_internal\.assert_active_game_payload_membership\(\)\n  from public, anon, authenticated, service_role;\n\n/,
  `-- Existing bonus-game payload tables remain private implementation details.\n-- C1b gates public participation through the join/leave RPCs and canonical\n-- entrant linkage; it does not add a second trigger-level write contract to\n-- trusted imports, administration or the established game RPC implementations.\n\n`,
  'over-broad payload membership trigger block',
)

write(migrationPath, migration)

const capPath = 'supabase/tests/100_operating_cap_enforcement.sql'
let cap = read(capPath)
cap = replaceOnce(
  cap,
  `insert into public.league_members (league_id, user_id, role)\nvalues (\n  '43000000-0000-0000-0000-000000000201',\n  current_setting('test.cap_owner_id')::uuid,\n  'owner'\n);\n\nselect set_config(`,
  `insert into public.league_members (league_id, user_id, role)\nvalues (\n  '43000000-0000-0000-0000-000000000201',\n  current_setting('test.cap_owner_id')::uuid,\n  'owner'\n);\n\n-- The legacy tournament-scoped league RPC now resolves the season's\n-- Main/Original game and therefore requires the same canonical membership as\n-- the product flow. Create that membership through the ordinary entry trigger.\ninsert into public.entries (user_id, tournament_id)\nvalues (\n  current_setting('test.cap_owner_id')::uuid,\n  current_setting('test.cap_tournament_id')::uuid\n);\n\nselect set_config(`,
  'operating-cap owner membership fixture',
)
write(capPath, cap)

const c1bPath = 'supabase/tests/118_c1b_game_catalogue_memberships.sql'
let c1b = read(c1bPath)
c1b = replaceOnce(
  c1b,
  `select is(\n  (select jsonb_agg(event.event_type order by event.recorded_at,event.id)\n   from public.game_membership_events event`,
  `reset role;\nselect is(\n  (select jsonb_agg(event.event_type order by event.recorded_at,event.id)\n   from public.game_membership_events event`,
  'private event-table test role reset',
)
c1b = replaceOnce(
  c1b,
  `  '["joined","left","rejoined"]'::jsonb,\n  'join, leave and rejoin history is append-only and ordered'\n);\n\nselect is(\n  public.get_competition_games`,
  `  '["joined","left","rejoined"]'::jsonb,\n  'join, leave and rejoin history is append-only and ordered'\n);\n\nset local role authenticated;\nselect is(\n  public.get_competition_games`,
  'restore authenticated C1b lifecycle role',
)
write(c1bPath, c1b)

writeFileSync('.c1b-pgtap-repair-applied', 'applied\n')
console.log('Applied exact C1b pgTAP compatibility repairs.')
