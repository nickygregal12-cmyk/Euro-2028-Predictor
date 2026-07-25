-- Euro 2028 Predictor — prepare an empty disposable target for logical restore
--
-- TARGET-ONLY DDL.
--
-- Run after roles.sql but BEFORE schema.sql. Supabase target projects grant
-- default table privileges to browser roles. Without this temporary preparation,
-- restored objects can inherit privileges that the source object explicitly
-- revoked.
--
-- schema.sql subsequently restores the source project's own default privileges
-- and explicit object grants. This file must never be run against production.

begin;

do $prepare_restore_target$
begin
  if current_database() <> 'postgres' then
    raise exception
      'Restore target database must be postgres; found %',
      current_database();
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
  ) then
    raise exception
      'Disposable restore target public schema is not empty';
  end if;
end
$prepare_restore_target$;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

commit;
