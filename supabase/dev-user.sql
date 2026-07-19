-- Euro 2028 Predictor — DEV-ONLY seeded auth user (docs/auth-plan.md §1)
--
-- ⚠️  DEV PROJECT ONLY. Never run this against production. It provisions the
--     single "dev user" the app auto-signs-in as while auth screens are deferred.
--
-- Two steps, because Supabase Auth owns password hashing — you cannot safely
-- hand-insert into auth.users from SQL across Supabase versions.
--
-- STEP 1 — create the auth user (Supabase dashboard, once):
--   Authentication → Users → "Add user" → "Create new user"
--     Email:    dev@euro28.local   (must match VITE_DEV_USER_EMAIL in .env.local)
--     Password: <choose one>       (must match VITE_DEV_USER_PASSWORD in .env.local)
--     ✅ Auto Confirm User          (required — signInWithPassword needs a
--                                    confirmed email and a linked identity)
--
--   Equivalent via the Admin API with the service-role key (not the anon key):
--     await supabase.auth.admin.createUser({
--       email: 'dev@euro28.local', password: '…', email_confirm: true,
--     })
--
-- STEP 2 — create the matching profiles row (run THIS file in the SQL editor).
--   Idempotent: safe to re-run; refreshes the display name if the row exists.
--   Adjust the email below if you created the user with a different one.
--
-- Additional test users (for leaderboard/league testing) are provisioned the
-- same way and switched via the .env.local vars — never special-cased in code.

insert into profiles (id, display_name)
select u.id, 'Dev Tester'
from auth.users u
where u.email = 'dev@euro28.local'
on conflict (id) do update set display_name = excluded.display_name;

-- Verify:
--   select p.display_name, u.email
--   from profiles p join auth.users u on u.id = p.id
--   where u.email = 'dev@euro28.local';
