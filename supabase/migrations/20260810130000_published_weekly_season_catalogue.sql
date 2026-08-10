-- ---------------------------------------------------------------------------
-- Contract 147 — MIG-UI-12: the published weekly catalogue, with its route slug.
--
-- Publishing a league needed a frontend code change for it to EXIST. Every
-- catalogue read began from a static array, so a season could be fully set up
-- in the database and still be invisible, or visible but unopenable because
-- nothing could tell the browser which URL it lives at.
--
-- The `MIG-UI-12` audit had already reduced this to one field. Season discovery
-- itself needs no migration — `public.tournaments` is browser-reachable and
-- pinned as RLS-only — but `competitions.slug` is revoked from every browser
-- role by contract 121, and the slug is what a URL is built from. So a frontend
-- could learn that a season existed and could not learn where it lived.
--
-- This is a catalogue read rather than a grant on `competitions.slug`, for two
-- reasons. A grant would expose every competition including ones with no season
-- and the tournament shape; and the slug is only half an address — the season
-- key is the other half, and the pair is what contract 121's
-- `get_season_play_context` already accepts. Returning them together means the
-- browser never has to compose an identity out of two reads.
--
-- IT RETURNS LEAGUE SEASONS ONLY, WHICH IS A SAFETY PROPERTY AND NOT A FILTER
-- OF CONVENIENCE. ADR 0026's `EURO-001` requires Euro 2028 to be completely
-- hidden from the weekly platform until an owner-approved publication state,
-- and a catalogue that enumerated `tournaments` without discriminating on kind
-- would put the tournament on the weekly platform's own discovery surface. The
-- Euro site has its own catalogue and its own publication state (contract 143).
--
-- Draft seasons are excluded for the same reason a draft is a draft: it is set
-- up and not open. Production holds two league seasons and both are `draft`
-- today, so this correctly returns nothing there until one is opened — which is
-- the honest answer, not an empty catalogue bug.
--
-- Granted to `authenticated` only. Making it the third function an anonymous
-- visitor may execute is a publication decision, and contract 143 shows what
-- taking one deliberately looks like; the weekly platform requires sign-in to
-- play, so nothing here needs it and this migration does not decide it.
-- ---------------------------------------------------------------------------

create or replace function public.get_published_weekly_seasons()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $catalogue$
declare
  v_uid uuid := (select auth.uid());
  v_seasons jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(entry order by sort_name, sort_season), '[]'::jsonb)
    into v_seasons
    from (
      select
        competition.name as sort_name,
        season.season_key as sort_season,
        jsonb_build_object(
          -- Both halves of the address, together, in the order
          -- `get_season_play_context(slug, season_key)` wants them.
          'competition_slug', competition.slug,
          'season_key', season.season_key,

          'competition_id', competition.id,
          'competition_name', competition.name,

          'season_id', season.id,
          'season_name', season.name,
          'status', season.status,
          'time_zone', season.display_timezone
        ) as entry
        from public.tournaments season
        join public.competitions competition on competition.id = season.competition_id
       where season.kind = 'league_season'
         and season.status <> 'draft'
       order by competition.name, season.season_key
       limit 200) published;

  return jsonb_build_object('server_now', now(), 'seasons', v_seasons);
end;
$catalogue$;

revoke all on function public.get_published_weekly_seasons() from public, anon;
grant execute on function public.get_published_weekly_seasons() to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_definition text := pg_get_functiondef('public.get_published_weekly_seasons()'::regprocedure);
begin
  -- The kind filter is the EURO-001 property and must not be lost to a later
  -- edit that only meant to add a column.
  if v_definition !~ 'kind = ''league_season''' then
    raise exception 'The catalogue must return league seasons only, so Euro 2028 cannot appear on the weekly platform';
  end if;

  if v_definition !~ 'auth.uid\(\)' then
    raise exception 'The catalogue must require authentication';
  end if;

  -- Anonymous execution is a publication decision, not a default.
  if exists (
    select 1
      from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name = 'get_published_weekly_seasons'
       and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'The weekly catalogue must not be executable anonymously';
  end if;
end;
$$;
