-- Browser-only fixture adjustments for the disposable local Supabase stack.
--
-- The canonical 3/14/102 catalogue is published first by
-- scripts/bonus-games/publish-catalogue.sql. This file only opens registration,
-- opens the first LMS round and gives one knockout match a future kickoff so
-- Playwright can exercise real writes. It must never run against a hosted DB.

begin;

do $$
begin
  if not exists (
    select 1
    from public.tournaments tournament
    where tournament.name = 'UEFA Euro 2028'
  ) then
    raise exception 'Browser E2E requires the seeded UEFA Euro 2028 tournament';
  end if;

  if (
    select count(*)
    from public.bonus_competitions competition
    join public.tournaments tournament
      on tournament.id = competition.tournament_id
    where tournament.name = 'UEFA Euro 2028'
      and competition.published
  ) <> 3 then
    raise exception 'Browser E2E requires the complete published Bonus Games catalogue';
  end if;
end;
$$;

update public.bonus_competitions competition
set registration_opens_at = now() - interval '1 hour',
    registration_closes_at = case
      when competition.game_key = 'ko_predictor' then null
      else now() + interval '30 days'
    end,
    completed_at = null,
    updated_at = now()
from public.tournaments tournament
where tournament.id = competition.tournament_id
  and tournament.name = 'UEFA Euro 2028'
  and competition.game_key in (
    'ko_predictor',
    'last_man_standing',
    'predictor_cup'
  );

update public.bonus_competition_windows competition_window
set opens_at = now() - interval '1 hour',
    locks_at = now() + interval '30 days',
    settles_at = null,
    updated_at = now()
from public.bonus_competitions competition
join public.tournaments tournament
  on tournament.id = competition.tournament_id
where competition_window.competition_id = competition.id
  and tournament.name = 'UEFA Euro 2028'
  and competition.game_key = 'last_man_standing'
  and competition_window.sequence = 1;

update public.matches match
set kickoff_at = now() + interval '14 days'
from public.tournaments tournament
where tournament.id = match.tournament_id
  and tournament.name = 'UEFA Euro 2028'
  and match.match_ref = 'R16-1';

commit;
