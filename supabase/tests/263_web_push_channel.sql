-- Contract 217: push as a second channel through the ledger that already
-- exists.
--
-- THE ASSERTIONS THIS FILE EXISTS FOR are the four that would each be a real,
-- visible failure and that a happy-path test would never reach:
--
--   * ONE REMINDER IS ONE ROW. Adding the channel to the once-per-action key
--     would tell a player with both channels on the same thing twice, which is
--     the exact duplicate contract 163's key exists to prevent;
--   * A DEAD ENDPOINT FALLS BACK TO EMAIL. The channel is recomputed on every
--     claim, so a pruned subscription becomes an email on the retry. Stamp it
--     at scheduling instead and the player silently gets nothing, for ever;
--   * BOTH HALVES OF THE PREFERENCE MOVED TOGETHER. A widened gate with an
--     un-widened sweep would schedule every push-only player and immediately
--     withdraw them, five minutes at a time;
--   * NO BROWSER ROLE MAY WRITE A SUBSCRIPTION. The save reassigns an endpoint
--     across accounts, which is right for a shared device and is exactly why
--     it cannot be an own-row insert policy.

begin;

select plan(38);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('c217-push')::uuid, 'c217-push@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now()),
       (md5('c217-mail')::uuid, 'c217-mail@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now()),
       (md5('c217-none')::uuid, 'c217-none@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now()),
       (md5('c217-both')::uuid, 'c217-both@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at, reminder_emails) values
  -- Emails OFF and a device: the case that could not be reminded at all before.
  (md5('c217-push')::uuid, 'Push Only', now(), false),
  (md5('c217-mail')::uuid, 'Mail Only', now(), true),
  -- Both off: still nobody, and that must stay true.
  (md5('c217-none')::uuid, 'Neither', now(), false),
  (md5('c217-both')::uuid, 'Both', now(), true);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C217 Push', 2049, t.competition_id, 'push-channel', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.c217_season',
  (select id::text from public.tournaments where season_key = 'push-channel'), true);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (md5('c217-lms')::uuid, current_setting('test.c217_season')::uuid,
        'last_man_standing', true, 'active', false, 'public', now() - interval '10 days');

insert into public.player_action_items (
  user_id, action_key, action_type, priority, tournament_id, competition_id,
  deadline_at, expires_at)
-- TEN hours out, not thirty. With a twenty-four hour lead the scheduler writes
-- `scheduled_for = greatest(deadline_at - lead, now())`, so a deadline further
-- away than the lead is queued for the future and nothing in this file could
-- claim it. Ten hours is the "joined late" path: queued for now, due now.
select id, 'lms_pick_due:push-channel:one', 'lms_pick_due', 1,
       current_setting('test.c217_season')::uuid, md5('c217-lms')::uuid,
       now() + interval '10 hours', now() + interval '10 hours'
  from auth.users where email like 'c217-%@example.test';

-- Two real-shaped subscriptions. `p256dh` is the browser's PUBLIC key, so it is
-- valid P-256 material and cannot be patterned; `auth` is a shared secret and
-- is deliberately the sequential bytes 00..0f, because a throwaway value that
-- LOOKS like a credential is one a reader has to stop and check. Both are
-- literals so the structural constraints are exercised by something shaped like
-- the real thing rather than by padding.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  (md5('c217-push')::uuid, 'https://push.example.test/c217-push',
   'BJALxoN96LLa2NxsmXagWXK3fzGLZtzl2VqCd1v1yhE-IW0QVtmfC9Qmejh0RJolHh_fK4titymTJRnLqzQBBhw',
   'AAECAwQFBgcICQoLDA0ODw'),
  (md5('c217-both')::uuid, 'https://push.example.test/c217-both',
   'BCWiVOGr0ZzQENGF-sSe47c6Sgqf9ufuLsW0x-ykdk9NVWOspcv1colEhpmBhGjKY7sM1Vnm2Q07IZs1f7hVjIQ',
   'EBESExQVFhcYGRobHB0eHw');

-- ---------------------------------------------------------------------------
-- THE WIDENED PREFERENCE
-- ---------------------------------------------------------------------------

select is(
  (public.process_reminder_schedule(interval '24 hours', false) ->> 'scheduled')::integer,
  3,
  'three of four identical actions are queued: emails-on, push-on, and the player with both'
);

select ok(
  exists (select 1 from public.reminder_deliveries
           where user_id = md5('c217-push')::uuid),
  'A PLAYER WITH EMAILS OFF AND A DEVICE IS NOW REMINDED — before this contract the '
  'preference gate read only reminder_emails, so granting a browser permission reached nobody'
);

select ok(
  not exists (select 1 from public.reminder_deliveries
               where user_id = md5('c217-none')::uuid),
  'and a player who has turned both channels off still has no row at all, which is a '
  'stronger statement than a row we decided not to send'
);

select is(
  (select count(*)::integer from public.reminder_deliveries
    where user_id = md5('c217-both')::uuid),
  1,
  'ONE REMINDER IS ONE ROW. A player with both channels available gets a single delivery, '
  'not one per channel — the second would be the duplicate a player actually notices'
);

-- ---------------------------------------------------------------------------
-- THE CHANNEL, DECIDED AT CLAIM
-- ---------------------------------------------------------------------------

select is(
  (select delivery.channel from public.reminder_deliveries delivery
    where delivery.user_id = md5('c217-push')::uuid),
  'email',
  'a scheduled row starts on the default channel: scheduling does not decide the destination'
);

select set_config('test.c217_claim',
  (select jsonb_object_agg(claimed.user_id::text, claimed.channel)::text
     from public.claim_due_reminders(50, false) claimed), true);

select is(
  current_setting('test.c217_claim')::jsonb ->> md5('c217-push')::uuid::text,
  'push',
  'the claim stamps push for a player with a live subscription'
);

select is(
  current_setting('test.c217_claim')::jsonb ->> md5('c217-mail')::uuid::text,
  'email',
  'and email for a player with none'
);

select is(
  current_setting('test.c217_claim')::jsonb ->> md5('c217-both')::uuid::text,
  'push',
  'PUSH WINS WHERE BOTH ARE AVAILABLE — it is the channel the player took a deliberate, '
  'revocable action to enable, and only one of the two may carry a given reminder'
);

-- ---------------------------------------------------------------------------
-- THE FALLBACK NOBODY WROTE, AND THE ONE CASE IT MUST NOT COVER
--
-- A push service answers 410 for a subscription that no longer exists. Prune
-- it, fail the attempt, let the retry come due — and the next claim finds no
-- device and chooses email. That is a consequence of recomputing the channel
-- per attempt, not a branch anybody wrote.
--
-- BUT IT MAY NOT REACH SOMEBODY WHO SWITCHED EMAIL OFF, which is exactly what
-- this contract's first draft did: `c217-push` has `reminder_emails` FALSE, and
-- losing their last device made the claim fall through to the one thing they
-- had said no to. The withdrawal sweep could not catch it either, because by
-- then the row is `failed` and retrying rather than `pending`.
--
-- Both players lose their only device here, and the difference between them is
-- the whole point: one accepts email and one does not.
-- ---------------------------------------------------------------------------

select is(
  public.prune_push_subscription('https://push.example.test/c217-both') ->> 'endpoint_removed',
  '1',
  'a push service that answered 410 gets its endpoint removed'
);

select is(
  public.prune_push_subscription('https://push.example.test/c217-push') ->> 'endpoint_removed',
  '1',
  'and so does the other player''s, so neither has a device left'
);

select set_config('test.c217_failed',
  (public.record_reminder_result(
     (select id from public.reminder_deliveries where user_id = md5('c217-both')::uuid),
     false, 'web-push', null, '410 gone') ->> 'status'), true);

select is(
  current_setting('test.c217_failed'), 'failed',
  'the attempt is recorded as failed, so contract 163''s retry policy schedules another'
);

select set_config('test.c217_failed_push',
  (public.record_reminder_result(
     (select id from public.reminder_deliveries where user_id = md5('c217-push')::uuid),
     false, 'web-push', null, '410 gone') ->> 'status'), true);

update public.reminder_deliveries
   set next_attempt_at = now() - interval '1 minute'
 where user_id in (md5('c217-both')::uuid, md5('c217-push')::uuid);

-- ONE CLAIM, BOTH PLAYERS. Taking a single snapshot rather than claiming twice
-- is what makes this a comparison: the same call, at the same instant, under
-- the same conditions, answering differently for the two of them.
select set_config('test.c217_guard',
  (select coalesce(
            jsonb_object_agg(claimed.user_id::text, claimed.channel), '{}'::jsonb)::text
     from public.claim_due_reminders(50, false) claimed), true);

select is(
  current_setting('test.c217_guard')::jsonb ->> md5('c217-both')::uuid::text,
  'email',
  'THE RETRY FALLS BACK TO EMAIL BY ITSELF for the player who accepts email. Stamp the '
  'channel at scheduling instead and somebody whose browser was reinstalled is silently '
  'never reminded again'
);

select is(
  current_setting('test.c217_guard')::jsonb ? md5('c217-push')::uuid::text,
  false,
  'AND THE PLAYER WHO TURNED EMAIL OFF IS NOT CLAIMED AT ALL. The same fallback that '
  'rescues one of them would have sent the other the one thing they refused'
);

-- ---------------------------------------------------------------------------
-- THE SWEEP, WHICH HAD TO MOVE WITH THE GATE
-- ---------------------------------------------------------------------------

update public.reminder_deliveries set status = 'pending';
select set_config('test.c217_sweep',
  public.process_reminder_schedule(interval '24 hours', false)::text, true);

select ok(
  (select delivery.status from public.reminder_deliveries
     delivery where delivery.user_id = md5('c217-both')::uuid) = 'pending',
  'a player with a live device survives the withdrawal sweep — a gate that admits and a '
  'sweep that does not would cancel every reminder it schedules, five minutes at a time'
);

select is(
  (select delivery.status from public.reminder_deliveries delivery
    where delivery.user_id = md5('c217-push')::uuid),
  'skipped',
  'and a player whose last device was pruned AND whose emails are off is withdrawn, '
  'because both consents are now gone'
);

-- ---------------------------------------------------------------------------
-- SAVING A SUBSCRIPTION
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('c217-mail')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select lives_ok(
  $$select public.save_push_subscription(
      'https://push.example.test/c217-shared',
      'BJALxoN96LLa2NxsmXagWXK3fzGLZtzl2VqCd1v1yhE-IW0QVtmfC9Qmejh0RJolHh_fK4titymTJRnLqzQBBhw',
      'AAECAwQFBgcICQoLDA0ODw')$$,
  'a signed-in player may record the subscription their browser handed them'
);

select is(
  (select count(*)::integer from public.push_subscriptions),
  1,
  'AND THEY SEE ONLY THEIR OWN. Row-level security is what stops one endpoint list being '
  'everybody''s — the table holds two rows at this point'
);

select throws_ok(
  $$select public.save_push_subscription('http://push.example.test/plain',
      'BJALxoN96LLa2NxsmXagWXK3fzGLZtzl2VqCd1v1yhE-IW0QVtmfC9Qmejh0RJolHh_fK4titymTJRnLqzQBBhw',
      'AAECAwQFBgcICQoLDA0ODw')$$,
  '22023',
  'A push endpoint must be an https URL',
  'a plain-http endpoint is refused rather than stored and posted to later'
);

select throws_ok(
  $$select public.save_push_subscription('https://push.example.test/junk', 'short', 'junk')$$,
  '23514',
  null,
  'and a malformed key is refused by the schema, not accepted and encrypted to'
);

-- ---------------------------------------------------------------------------
-- AN ENDPOINT IS A URL A BROWSER CHOSE AND A SERVICE ROLE WILL POST TO
--
-- Blind, POST-only and once per reminder, so the ceiling is low — but a
-- signed-in player must not be able to aim this platform's sender at an
-- internal address, and the cheap half of that belongs in the schema where no
-- caller can forget it.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.save_push_subscription('https://169.254.169.254/latest/meta-data',
      'BJALxoN96LLa2NxsmXagWXK3fzGLZtzl2VqCd1v1yhE-IW0QVtmfC9Qmejh0RJolHh_fK4titymTJRnLqzQBBhw',
      'AAECAwQFBgcICQoLDA0ODw')$$,
  '22023',
  'A push endpoint must name a public push service',
  'an address literal is refused rather than stored and posted to by the sender'
);

select throws_ok(
  $$select public.save_push_subscription('https://metadata.internal/push',
      'BJALxoN96LLa2NxsmXagWXK3fzGLZtzl2VqCd1v1yhE-IW0QVtmfC9Qmejh0RJolHh_fK4titymTJRnLqzQBBhw',
      'AAECAwQFBgcICQoLDA0ODw')$$,
  '22023',
  'A push endpoint must name a public push service',
  'and so is a private suffix'
);

select lives_ok(
  $$select public.save_push_subscription(
      'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABc217',
      'BJALxoN96LLa2NxsmXagWXK3fzGLZtzl2VqCd1v1yhE-IW0QVtmfC9Qmejh0RJolHh_fK4titymTJRnLqzQBBhw',
      'AAECAwQFBgcICQoLDA0ODw')$$,
  'A REAL PUSH SERVICE IS STILL ACCEPTED. This is not an origin allow-list — one would '
  'silently stop working for a browser nobody anticipated — so what it must never do is '
  'refuse the addresses browsers actually hand over'
);

select throws_ok(
  $$select public.prune_push_subscription('https://push.example.test/c217-both')$$,
  '42501',
  null,
  'NO BROWSER ROLE MAY PRUNE. It deletes by endpoint regardless of owner, which is right '
  'for a dead endpoint and would otherwise be one player switching off another'
);

reset role;

-- The same browser, a different player. The endpoint MOVES rather than
-- duplicating, so the previous account cannot go on buzzing a device that is
-- now somebody else's.
select set_config('request.jwt.claims',
  json_build_object('sub', md5('c217-none')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select lives_ok(
  $$select public.save_push_subscription(
      'https://push.example.test/c217-shared',
      'BCWiVOGr0ZzQENGF-sSe47c6Sgqf9ufuLsW0x-ykdk9NVWOspcv1colEhpmBhGjKY7sM1Vnm2Q07IZs1f7hVjIQ',
      'EBESExQVFhcYGRobHB0eHw')$$,
  'a second player signing in on the same browser records the same endpoint'
);

reset role;

select is(
  (select count(*)::integer from public.push_subscriptions
    where endpoint = 'https://push.example.test/c217-shared'),
  1,
  'AND THE ENDPOINT MOVED RATHER THAN DUPLICATING. Exactly one browser profile is behind '
  'it, so the account that signed out must lose the ability to reach it'
);

select is(
  (select user_id from public.push_subscriptions
    where endpoint = 'https://push.example.test/c217-shared'),
  md5('c217-none')::uuid,
  'and it belongs to whoever is signed in now'
);

select is(
  (select p256dh from public.push_subscriptions
    where endpoint = 'https://push.example.test/c217-shared'),
  'BCWiVOGr0ZzQENGF-sSe47c6Sgqf9ufuLsW0x-ykdk9NVWOspcv1colEhpmBhGjKY7sM1Vnm2Q07IZs1f7hVjIQ',
  'RE-SUBSCRIBING ROTATES THE KEYS AND THE STORED PAIR FOLLOWS — keeping the old one would '
  'encrypt every later payload to a key the browser has already discarded'
);

-- ---------------------------------------------------------------------------
-- REVOKING, WHICH IS THE PLAYER'S OWN
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('c217-none')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

delete from public.push_subscriptions
 where endpoint = 'https://push.example.test/c217-shared';

select is(
  (select count(*)::integer from public.push_subscriptions),
  0,
  'a player can delete their own subscription with no function call at all, which is the '
  'whole of "you can make us unable to reach you"'
);

with attempted as (
  delete from public.push_subscriptions
   where endpoint = 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABc217'
  returning 1)
select is(
  (select count(*)::integer from attempted),
  0,
  'and cannot delete anybody else''s: the row is invisible, so the delete matches nothing'
);

reset role;

select is(
  (select count(*)::integer from public.push_subscriptions
    where endpoint = 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAABc217'),
  1,
  'the other player''s subscription is still there when the policy is not in the way'
);

-- ---------------------------------------------------------------------------
-- THE PRIVILEGES AND THE SHAPE
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege('authenticated', 'public.push_subscriptions', 'insert')
  and not has_table_privilege('authenticated', 'public.push_subscriptions', 'update'),
  'no browser role may write a subscription directly: the save has to reassign an endpoint '
  'across accounts, which no own-row policy can express'
);

select ok(
  not has_table_privilege('anon', 'public.push_subscriptions', 'select'),
  'and a signed-out visitor cannot read the table at all'
);

select ok(
  has_function_privilege('service_role', 'public.prune_push_subscription(text)', 'execute'),
  'the sender can prune an endpoint a push service disowned'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass),
  'push subscriptions sit behind row-level security'
);

select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conname = 'reminder_deliveries_once_per_action'
      and conrelid = 'public.reminder_deliveries'::regclass),
  'UNIQUE (user_id, action_key, reminder_kind)',
  'THE ONCE-PER-ACTION KEY DOES NOT INCLUDE THE CHANNEL. The moment it does, a player with '
  'both channels on is told the same thing twice'
);

select throws_ok(
  $$update public.reminder_deliveries set channel = 'carrier-pigeon'
     where user_id = $$ || quote_literal(md5('c217-mail')::uuid) || $$::uuid$$,
  '23514',
  null,
  'and the channel is a closed vocabulary, so an unwired third one cannot be recorded as sent'
);

select ok(
  not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'reminder_deliveries'
       and column_name in ('endpoint', 'p256dh', 'email', 'body')),
  'the delivery ledger still holds no address, endpoint or content: the channel is a word, '
  'not a destination'
);

select ok(
  pg_get_functiondef('public.claim_due_reminders(integer,boolean)'::regprocedure)
    ~ 'dry_run[[:space:]]*=[[:space:]]*delivery\.dry_run[[:space:]]+or',
  'CONTRACT 216''S TIGHTEN-ONLY DRY RUN SURVIVED THE DROP AND RECREATE. This function had to '
  'be rebuilt to add a return column, which is the one edit that could quietly undo it'
);

select finish();
rollback;
