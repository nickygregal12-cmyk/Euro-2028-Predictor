-- The read that contends with the burst: everybody checking the table.
\set player random(1, :players)
select public.cap_burst_standings(:player);
