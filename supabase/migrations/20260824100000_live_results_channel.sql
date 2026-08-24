-- Contract 218: publish public.matches on the realtime channel.
--
-- ONE TABLE, AND THE CHOICE IS THE SECURITY ARGUMENT. ADR 0008 accepted a
-- narrow live-results channel that INVALIDATES standings queries, and rejected
-- subscribing to broad user-owned or scoring tables on privacy and fan-out
-- grounds. `public.matches` is the authoritative result lifecycle -- a row
-- reaching 'confirmed' or 'corrected' is what moves every standing downstream --
-- and it is reference data, owned by nobody and scoring nothing.
--
-- Its policy is already `for select to authenticated using (true)`, so every
-- authenticated subscriber can read every row this publishes. The ADR's rule
-- that a payload may carry only what the caller could already read is therefore
-- satisfied by construction, not by review. The browser goes further and reads
-- no payload at all: the channel says "something changed" and the numbers are
-- refetched from get_leaderboard, which is the only thing that ranks anything.
--
-- REPLICA IDENTITY IS LEFT AT ITS DEFAULT ON PURPOSE. Setting it to FULL would
-- add the pre-update row image to every message. Nothing needs the old row to
-- decide to refetch, and not sending it is less exposure and less traffic for
-- no loss.
--
-- Idempotent in both directions. The publication is normally created and owned
-- by Supabase itself, but a bare Postgres used for an isolated test run has no
-- such thing -- so create it empty rather than fail, and never re-add a table
-- that is already published.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end
$$;
