-- Euro 2028 Predictor — known managed-schema customization
--
-- RESTORE-ONLY EVIDENCE. Do not run against production as part of backup
-- creation. Supabase's normal logical schema dump excludes managed schemas such
-- as auth and storage. The project nevertheless has one intentional custom
-- trigger on auth.users, originally introduced by migration 15.
--
-- Apply this only to an explicitly verified disposable restore target, after
-- public.handle_new_user() exists. The statement is idempotent so a restore
-- rehearsal can prove the trigger without duplicating it.

begin;

do $$
begin
  if to_regprocedure('public.handle_new_user()') is null then
    raise exception 'public.handle_new_user() must exist before restoring the auth signup trigger';
  end if;

  if to_regclass('auth.users') is null then
    raise exception 'auth.users must exist on the restore target';
  end if;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

commit;
