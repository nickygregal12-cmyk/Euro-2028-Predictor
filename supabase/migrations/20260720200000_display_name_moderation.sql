-- Euro 2028 Predictor — display-name moderation (server-side)
--
-- Follow-up migration; append-only.
--
-- The real gate for display-name policy: a BEFORE trigger on profiles rejects
-- disallowed names on insert (including the sign-up path via handle_new_user)
-- and on any display_name change. The client mirror lives in
-- src/features/auth/displayNamePolicy.ts (friendly pre-submit errors); this is
-- what actually enforces it, so a crafted request can't bypass it.
--
-- Rejects: impersonation / official-sounding names (exact, so "Modric" ≠ "mod"),
-- and profanity/slur basics (substring). Empty/whitespace and length are already
-- enforced by the profiles CHECK (btrim length 1..40). Keep the two lists in
-- sync with displayNamePolicy.ts.
--
-- Idempotent (create or replace / drop-if-exists).

begin;

create or replace function enforce_display_name_policy()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_norm text;
  banned_exact text[] := array[
    'admin','administrator','moderator','mod','official','staff','support',
    'system','root','owner','help','euro 2028','euro2028','euro 2028 predictor'
  ];
  banned_substr text[] := array['fuck','shit','cunt','nigger','faggot','rape','official'];
  frag text;
begin
  v_norm := lower(regexp_replace(btrim(new.display_name), '\s+', ' ', 'g'));

  if v_norm = any (banned_exact) then
    raise exception 'display name not allowed' using errcode = 'check_violation';
  end if;

  foreach frag in array banned_substr loop
    if position(frag in v_norm) > 0 then
      raise exception 'display name not allowed' using errcode = 'check_violation';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists enforce_display_name on profiles;
create trigger enforce_display_name
  before insert or update of display_name on profiles
  for each row execute function enforce_display_name_policy();

commit;
