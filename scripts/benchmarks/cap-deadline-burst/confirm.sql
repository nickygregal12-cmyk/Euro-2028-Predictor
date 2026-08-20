-- Explicit card confirmation, which a player does once — and, near a
-- deadline, sometimes twice because they are not sure it took.
\set player random(1, :players)
select public.cap_burst_confirm(:player);
