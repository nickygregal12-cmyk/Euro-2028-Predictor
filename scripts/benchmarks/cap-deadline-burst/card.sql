-- The matchweek card, re-read as a player scrolls back over their picks.
\set player random(1, :players)
select public.cap_burst_card(:player);
