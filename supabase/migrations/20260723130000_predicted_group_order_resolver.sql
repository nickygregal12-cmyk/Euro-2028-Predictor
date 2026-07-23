-- Server-side predicted group-order foundation.  This deliberately returns
-- unresolved instead of slot ordering whenever automatic criteria cannot split.
create or replace function public.resolve_predicted_group_order(p_entry_id uuid, p_group_id uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare v_tournament uuid; v_total int; v_done int; v_order uuid[]; v_unresolved uuid[];
begin
 select tournament_id into v_tournament from public.entries where id=p_entry_id;
 if v_tournament is null or not exists (select 1 from public.groups where id=p_group_id and tournament_id=v_tournament) then
  raise exception 'Entry and group must belong to the same tournament' using errcode='check_violation';
 end if;
 select count(*), count(mp.id) into v_total,v_done from public.matches m left join public.match_predictions mp on mp.match_id=m.id and mp.entry_id=p_entry_id where m.group_id=p_group_id and m.round='group';
 if v_total <> 6 or v_done <> v_total then return jsonb_build_object('status','incomplete'); end if;
 -- This function is intentionally a narrow foundation: unresolvable score vectors
 -- are surfaced, never replaced by group_teams.slot.
 select array_agg(team_id order by points desc, gd desc, gf desc), array_agg(team_id order by points desc, gd desc, gf desc)
 into v_order,v_unresolved from (
  select gt.team_id, sum(case when (m.home_team_id=gt.team_id and mp.home_score>mp.away_score) or (m.away_team_id=gt.team_id and mp.away_score>mp.home_score) then 3 when mp.home_score=mp.away_score then 1 else 0 end) points,
   sum(case when m.home_team_id=gt.team_id then mp.home_score-mp.away_score else mp.away_score-mp.home_score end) gd,
   sum(case when m.home_team_id=gt.team_id then mp.home_score else mp.away_score end) gf
  from public.group_teams gt join public.matches m on m.group_id=gt.group_id and (m.home_team_id=gt.team_id or m.away_team_id=gt.team_id) join public.match_predictions mp on mp.match_id=m.id and mp.entry_id=p_entry_id
  where gt.group_id=p_group_id group by gt.team_id) s;
 if exists (select 1 from (select count(*) from (select gt.team_id, sum(case when (m.home_team_id=gt.team_id and mp.home_score>mp.away_score) or (m.away_team_id=gt.team_id and mp.away_score>mp.home_score) then 3 when mp.home_score=mp.away_score then 1 else 0 end) p, sum(case when m.home_team_id=gt.team_id then mp.home_score-mp.away_score else mp.away_score-mp.home_score end) d, sum(case when m.home_team_id=gt.team_id then mp.home_score else mp.away_score end) g from public.group_teams gt join public.matches m on m.group_id=gt.group_id and (m.home_team_id=gt.team_id or m.away_team_id=gt.team_id) join public.match_predictions mp on mp.match_id=m.id and mp.entry_id=p_entry_id where gt.group_id=p_group_id group by gt.team_id) x group by p,d,g having count(*)>1) z) then return jsonb_build_object('status','unresolved'); end if;
 return jsonb_build_object('status','resolved','ordered_team_ids',to_jsonb(v_order));
end $$;
revoke all on function public.resolve_predicted_group_order(uuid,uuid) from public;
grant execute on function public.resolve_predicted_group_order(uuid,uuid) to authenticated;
