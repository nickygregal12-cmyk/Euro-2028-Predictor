-- The cross-competition attention feed, loaded on every navigation.
\set player random(1, :players)
select public.cap_burst_actions(:player);
