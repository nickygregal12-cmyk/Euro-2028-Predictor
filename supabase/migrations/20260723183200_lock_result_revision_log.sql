-- DATA-002 hardening: the service role may invoke the protected lifecycle RPCs,
-- but it must not write, edit, delete or directly read the revision table. The
-- SECURITY DEFINER lifecycle owner records revisions transactionally.

begin;

revoke all on table public.match_result_revisions from service_role;

commit;
