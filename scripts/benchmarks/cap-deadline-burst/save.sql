-- One player writes one prediction. The burst is mostly this.
\set player random(1, :players)
\set fixture random(1, 10)
select public.cap_burst_save(:player, :fixture);
