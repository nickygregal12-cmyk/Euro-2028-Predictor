-- Euro 2028 Predictor — seed data (v0.1)
--
-- The full fixture skeleton from docs/tournament-structure.md §§3–5:
-- one tournament, six groups, 24 placeholder teams in their A1–F4 slots, and
-- all 51 matches (36 group + 8 R16 + 4 QF + 2 SF + 1 final) with real dates,
-- venues, and slot-reference source fields.
--
-- Team names are PLACEHOLDERS ("Team A1" … "Team F4"); swap in the real
-- qualified teams after the Dec 2026 draw. Per-match kick-off times are left
-- null until UEFA confirms them (post-2027) — only the dates are known now.
--
-- Intended to run once on a fresh database. Re-running rolls back on the
-- unique constraints rather than duplicating data.

begin;

-- Tournament (idempotent guard so a re-run doesn't create a second one).
insert into tournaments (name, year, starts_on, ends_on)
select 'UEFA Euro 2028', 2028, '2028-06-09', '2028-07-09'
where not exists (select 1 from tournaments where name = 'UEFA Euro 2028');

-- Groups A–F.
insert into groups (tournament_id, letter)
select t.id, g.letter
from tournaments t
cross join (values ('A'),('B'),('C'),('D'),('E'),('F')) as g(letter)
where t.name = 'UEFA Euro 2028';

-- 24 placeholder teams: "Team A1" … "Team F4".
insert into teams (tournament_id, name)
select t.id, 'Team ' || g.letter || s.n
from tournaments t
cross join (values ('A'),('B'),('C'),('D'),('E'),('F')) as g(letter)
cross join (values (1),(2),(3),(4)) as s(n)
where t.name = 'UEFA Euro 2028';

-- Place each team in its group slot (A1 → group A slot 1, etc.).
insert into group_teams (group_id, team_id, slot)
select grp.id, tm.id, s.n
from tournaments t
join groups grp on grp.tournament_id = t.id
cross join (values (1),(2),(3),(4)) as s(n)
join teams tm on tm.tournament_id = t.id and tm.name = 'Team ' || grp.letter || s.n
where t.name = 'UEFA Euro 2028';

-- ---------------------------------------------------------------------------
-- Group matches (§3). home_source/away_source are the group slots; the
-- placeholder teams already in those slots are resolved into home/away_team_id.
-- ---------------------------------------------------------------------------
insert into matches (
  tournament_id, match_ref, round, group_id, matchday,
  home_source, away_source, home_team_id, away_team_id, match_date, venue
)
select t.id, m.match_ref, 'group', grp.id, m.matchday,
       m.home_slot, m.away_slot, ht.id, aw.id, m.match_date::date, m.venue
from tournaments t
cross join (values
  -- Group A
  ('GA-1','A',1,'A1','A2','2028-06-09','Cardiff'),
  ('GA-2','A',1,'A3','A4','2028-06-10','Glasgow'),
  ('GA-3','A',2,'A1','A3','2028-06-14','Cardiff'),
  ('GA-4','A',2,'A2','A4','2028-06-14','Liverpool'),
  ('GA-5','A',3,'A4','A1','2028-06-18','Cardiff'),
  ('GA-6','A',3,'A2','A3','2028-06-18','Tottenham'),
  -- Group B
  ('GB-1','B',1,'B1','B2','2028-06-10','Manchester'),
  ('GB-2','B',1,'B3','B4','2028-06-10','Dublin'),
  ('GB-3','B',2,'B1','B3','2028-06-14','Wembley'),
  ('GB-4','B',2,'B2','B4','2028-06-15','Birmingham'),
  ('GB-5','B',3,'B4','B1','2028-06-19','Wembley'),
  ('GB-6','B',3,'B2','B3','2028-06-19','Dublin'),
  -- Group C
  ('GC-1','C',1,'C1','C2','2028-06-11','Wembley'),
  ('GC-2','C',1,'C3','C4','2028-06-11','Birmingham'),
  ('GC-3','C',2,'C1','C3','2028-06-15','Tottenham'),
  ('GC-4','C',2,'C2','C4','2028-06-15','Newcastle'),
  ('GC-5','C',3,'C4','C1','2028-06-20','Manchester'),
  ('GC-6','C',3,'C2','C3','2028-06-20','Liverpool'),
  -- Group D
  ('GD-1','D',1,'D3','D4','2028-06-11','Liverpool'),
  ('GD-2','D',1,'D1','D2','2028-06-12','Tottenham'),
  ('GD-3','D',2,'D1','D3','2028-06-16','Wembley'),
  ('GD-4','D',2,'D2','D4','2028-06-16','Manchester'),
  ('GD-5','D',3,'D4','D1','2028-06-20','Birmingham'),
  ('GD-6','D',3,'D2','D3','2028-06-20','Newcastle'),
  -- Group E
  ('GE-1','E',1,'E1','E2','2028-06-12','Dublin'),
  ('GE-2','E',1,'E3','E4','2028-06-12','Newcastle'),
  ('GE-3','E',2,'E1','E3','2028-06-16','Dublin'),
  ('GE-4','E',2,'E2','E4','2028-06-17','Liverpool'),
  ('GE-5','E',3,'E4','E1','2028-06-21','Dublin'),
  ('GE-6','E',3,'E2','E3','2028-06-21','Tottenham'),
  -- Group F
  ('GF-1','F',1,'F1','F2','2028-06-13','Glasgow'),
  ('GF-2','F',1,'F3','F4','2028-06-13','Manchester'),
  ('GF-3','F',2,'F1','F3','2028-06-17','Glasgow'),
  ('GF-4','F',2,'F2','F4','2028-06-17','Newcastle'),
  ('GF-5','F',3,'F4','F1','2028-06-21','Glasgow'),
  ('GF-6','F',3,'F2','F3','2028-06-21','Cardiff')
) as m(match_ref, letter, matchday, home_slot, away_slot, match_date, venue)
join groups grp on grp.tournament_id = t.id and grp.letter = m.letter
join teams ht on ht.tournament_id = t.id and ht.name = 'Team ' || m.home_slot
join teams aw on aw.tournament_id = t.id and aw.name = 'Team ' || m.away_slot
where t.name = 'UEFA Euro 2028';

-- ---------------------------------------------------------------------------
-- Knockout matches (§§4–5). Teams are unknown at seed time, so home_team_id /
-- away_team_id stay null; home_source/away_source carry the slot references.
-- ---------------------------------------------------------------------------
insert into matches (
  tournament_id, match_ref, round, home_source, away_source, match_date, venue
)
select t.id, k.match_ref, k.round, k.home_source, k.away_source, k.match_date::date, k.venue
from tournaments t
cross join (values
  -- Round of 16 (§4)
  ('R16-1','r16','W-A','RU-C','2028-06-24','Cardiff'),
  ('R16-2','r16','RU-A','RU-B','2028-06-24','Liverpool'),
  ('R16-3','r16','W-B','3RD-WB','2028-06-25','Newcastle'),
  ('R16-4','r16','W-C','3RD-WC','2028-06-25','Manchester'),
  ('R16-5','r16','W-F','3RD-WF','2028-06-26','Glasgow'),
  ('R16-6','r16','RU-D','RU-E','2028-06-26','Tottenham'),
  ('R16-7','r16','W-E','3RD-WE','2028-06-27','Dublin'),
  ('R16-8','r16','W-D','RU-F','2028-06-27','Birmingham'),
  -- Quarter-finals (§5)
  ('QF-1','qf','W-R16-3','W-R16-1','2028-06-30','Wembley'),
  ('QF-2','qf','W-R16-5','W-R16-6','2028-06-30','Dublin'),
  ('QF-3','qf','W-R16-4','W-R16-2','2028-07-01','Cardiff'),
  ('QF-4','qf','W-R16-7','W-R16-8','2028-07-01','Glasgow'),
  -- Semi-finals (§5)
  ('SF-1','sf','W-QF-1','W-QF-2','2028-07-04','Wembley'),
  ('SF-2','sf','W-QF-4','W-QF-3','2028-07-05','Wembley'),
  -- Final (§5)
  ('FINAL','final','W-SF-1','W-SF-2','2028-07-09','Wembley')
) as k(match_ref, round, home_source, away_source, match_date, venue)
where t.name = 'UEFA Euro 2028';

commit;
