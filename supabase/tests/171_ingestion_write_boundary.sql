-- What provider ingestion is allowed to write.
--
-- AMENDED 9 AUGUST 2026 BY OWNER DECISION (contract 135). The rule this file
-- was written to enforce has changed, and the file changes with it rather than
-- being quietly satisfied by a technicality.
--
-- What changed: a provider result may now become the official SEASON result
-- without a human typing it. The owner's words were that the provider is final
-- truth for awarding points, and that it must stay auditable and correctable
-- from the admin panel.
--
-- What did NOT change, and is now asserted here rather than assumed:
--
--   * the TOURNAMENT path is untouched. Nothing in the provider path may write
--     `public.matches` or `public.match_result_revisions`. Euro 2028 keeps the
--     protected confirmation gate in full (assertion 10);
--   * a provider result reaches `season_fixtures` only through contract 125's
--     `record_season_fixture_result`, which numbers the revision, records what
--     it replaced and cannot be rewritten. The applier writes no `public`
--     relation of its own (assertion 8);
--
-- AMENDED AGAIN 19 AUGUST 2026 BY OWNER DECISION (contract 209), and this is
-- the amendment this file most needed to be made loudly. A SECOND unattended
-- function may now write a `public` competition relation:
-- `apply_provider_fixture_lifecycle` sets `season_fixtures.status` to
-- `postponed`, and back to `scheduled`, on a provider's word and with no human
-- in the loop.
--
-- That is a real widening of this boundary and it is admitted rather than
-- absorbed. What makes it acceptable is not that a postponement is small, but
-- that it is REVERSIBLE AND SUBTRACTIVE: a postponed fixture cannot carry a
-- score (`season_fixtures_scores_match_status`), does not settle its matchweek
-- (contract 87), and survives Last Man Standing consuming nothing (contract
-- 85). Applying it wrongly delays a settlement; the next poll that disagrees
-- undoes it. The transitions are constrained to exactly those two by a CHECK
-- on the evidence row the applier must write first, so this function cannot
-- void, abandon, create or delete a fixture even by mistake.
--
-- Cancellation and abandonment are NOT included, deliberately: they are
-- terminal, they change what the competition consists of, and they stay with
-- `admin_decide_provider_change_proposal`.
--
-- The measured reason the line moved: requiring a human for a postponement
-- meant, in practice, that no postponement was ever shown at all. Assertion 5
-- now names five writers rather than four, so a SIXTH still has to argue for
-- itself here.
--   * that writer still reaches no score, total, lock, progression, standing or
--     player prediction. A result is the ONLY official truth the provider path
--     can now produce; everything downstream still derives from it through the
--     authorities that own it (assertion 9).
--
-- Why the extra assertions were needed at all: assertion 2 scans each ingestion
-- function's own text, and `season_fixtures` is deliberately not in the
-- forbidden list because contract 117 legitimately revises a kickoff. So the
-- applier would have passed this file unchanged while doing something this file
-- previously said was impossible — the "reaches it through a callee" limit the
-- header below already admits, arriving for real. A guard that passes because
-- the property it names moved out from under it is worse than no guard.
--
-- WHY THIS GUARD EXISTS. `MASTER-TODO.md` Stage D carries the claim that
-- automatic ingestion is "unable to write official results, locks, scores, totals,
-- ranks or standings". Contract 132 adds a separately gated competition-admin
-- publication path for a complete initial set of scheduled fixtures. Until this file, nothing enforced it. It was
-- true because each contract was written carefully -- contract 117's importer
-- touches exactly two relations, and its own suite proves it never writes
-- `competition_round_id` -- but "true because everyone has been careful so far"
-- is the property that stops being true on the contract nobody reviews closely.
--
-- The cost of losing it is not a wrong number on a screen. Provider data is
-- PROVISIONAL by architecture: protected confirmation and correction remain the
-- official scoring and progression gate. A feed that can write a result, a
-- score, a lock or a standing has not produced a bug, it has removed that gate
-- -- and it would do so silently, because a plausible imported result looks
-- exactly like a confirmed one once it is in the table.
--
-- So the boundary is pinned as a list, in the shape
-- `168_tournament_only_browser_reads.sql` established: every ingestion function
-- is named with its permitted writes, and a new one fails this file until
-- somebody has said what it may touch.
--
-- WHY IT QUERIES THE CATALOGUE RATHER THAN THE MIGRATION TREE. The sibling
-- guard's header records what grepping the tree cost: it missed later
-- redefinitions written in a different case and over-ran function bodies whose
-- dollar-quote tags differed, and it attributed one function's text to another.
-- `pg_get_functiondef` against a built database has neither problem, and a
-- function redefined by a later contract is judged as it currently stands
-- rather than as it was first written.
--
-- WHAT THIS FILE DOES NOT CLAIM. A text scan proves a function does not NAME a
-- relation. It cannot prove a function will not reach one through dynamic SQL
-- or through a callee. That is a real limit and is stated rather than papered
-- over: every function listed below is `security definer` with `search_path`
-- pinned to the empty string, so each writes under schema-qualified names that
-- this scan can see, and none builds a statement from a string. If a future
-- ingestion contract introduces `execute format(...)`, this guard will pass
-- while proving less, and that contract owes its own evidence.
--
-- HOW THIS FILE WAS VERIFIED BEFORE IT WAS PUSHED, because pgTAP does not run
-- in the authoring container and `pgTapFunctionReferences.test.ts` exists over
-- exactly that gap. A throwaway PostgreSQL 16 cluster was started locally,
-- `plan`, `is`, `ok` and `finish` were stubbed to print what each assertion
-- computed, and this file was executed end to end. That established the
-- mechanical half first: every statement parses, every regular expression is
-- valid, each `jsonb_agg(distinct ... order by ...)` is legal, and all seven
-- assertions run -- the failure that costs a CI round trip is a file that
-- aborts partway and silently stops checking the rest.
--
-- Then the reviewed functions were recreated with the shapes the real ones
-- have and all seven passed, and three mutants were killed: an importer that
-- also writes `public.season_matchweek_scores` (assertions 2 and 7), an
-- unreviewed `provider_*` function appearing (assertion 3), and a third
-- function writing a `public` relation (assertion 5). On the empty cluster,
-- before any of that, assertions 5 and 6 FAILED rather than passing vacuously,
-- which is the property assertion 6 was added for.
--
-- What none of that proves is the verdict against the real database: these are
-- stubs. CI's `local-supabase` job runs this file against the schema the
-- committed migrations actually build, and that is the run that counts.

begin;

select plan(12);

-- ---------------------------------------------------------------------------
-- The official truth ingestion may never write.
-- ---------------------------------------------------------------------------
--
-- Results, scores, totals, locks, progression, standings and player
-- predictions. Provider data reaches none of them: it revises a kickoff, and
-- everything above derives from confirmed results through the authorities that
-- own them.

create temporary table official_truth (relation text primary key, why text) on commit drop;

insert into official_truth (relation, why) values
  ('matches',                                 'tournament official results and kickoff truth'),
  ('match_result_revisions',                  'the immutable result audit trail'),
  ('season_matchweek_scores',                 'settled matchweek scores and totals'),
  ('season_predictions',                      'what a player predicted'),
  ('season_matchweek_cards',                  'the entry a player submits against'),
  ('season_matchweek_jokers',                 'the Joker allowance and its use'),
  ('season_matchweek_submission_outcomes',    'how a submission resolved'),
  ('entry_automatic_submission_outcomes',     'automatic submission results'),
  ('bonus_score_events',                      'game scoring events'),
  ('competition_lock_events',                 'when a round locked'),
  ('season_lms_entrant_state',                'Last Man Standing survival and progression'),
  ('bonus_knockout_predictions',              'knockout bracket predictions'),
  ('bonus_cup_fixtures',                      'Championship fixtures'),
  ('bonus_cup_groups',                        'Championship groups and phase'),
  ('bonus_cup_members',                       'Championship membership'),
  ('bonus_cup_penalty_numbers',               'Championship tie settlement input');

-- ---------------------------------------------------------------------------
-- The reviewed ingestion functions, and what each may write.
-- ---------------------------------------------------------------------------
--
-- THIS IS A LIST OF FUNCTIONS, NOT A LIST OF DEFECTS. Being on it means the
-- function is part of the provider path and its writes have been read.

create temporary table ingestion_functions (name text primary key, permitted_writes text) on commit drop;

insert into ingestion_functions (name, permitted_writes) values
  ('admin_approve_initial_provider_fixtures',
   'explicit competition-admin publication of a complete initial scheduled season: teams, matchweeks, provider mappings and season_fixtures only; provider scores remain proposal evidence.'),
  ('admin_reject_initial_provider_fixtures',
   'decision evidence only -- pending provider proposals become rejected and no competition relation is written.'),
  ('stage_provider_fixture_proposals',
   'pending internal proposal evidence only; no canonical competition relation is written.'),
  ('block_provider_fixture_proposal_rewrite',
   'refuses rewrite or deletion of provider proposal evidence; writes nothing.'),
  ('import_provider_fixture_revisions',
   'season_fixtures.kickoff_at and the append-only revision record. The only '
   'function here that writes a public relation at all, and contract 117 fails '
   'closed on the whole payload rather than applying it in part.'),
  ('archive_provider_response',
   'raw custody only -- the exact response text, archived before decode.'),
  ('record_provider_response_processing',
   'append-only processing evidence.'),
  ('upsert_provider_team_profile',
   'predictor_internal.provider_team_profiles only -- current provider metadata and retained-response provenance; no public competition truth.'),
  ('dispatch_due_provider_polls',
   'the append-only dispatch record, and public.provider_poll_targets to stamp '
   'when a target was last polled. Ingestion configuration, not competition '
   'truth: no result, score or lock derives from it.'),
  ('dispatch_ai_odds_polls',
   'contract 184. Owner/pg_cron-only paid-odds dispatch: writes only the '
   'private append-only ai.odds_api_dispatches evidence and calls the '
   'server-only provider-poll endpoint. It writes no public competition truth.'),
  ('post_provider_poll',               'the outbound request; no competition relation.'),
  ('due_provider_poll_targets',        'reads poll targets; writes nothing.'),
  ('resolve_provider_poll_path',
   'contract 146. Substitutes date placeholders in a stored path and returns a '
   'string. It is immutable, reads no relation at all and writes nothing.'),
  ('provider_target_is_live',
   'contract 146. Reads season_fixtures kickoff and score to decide whether a '
   'match is near enough to poll often, and writes nothing. It reads no '
   'prediction, entry or score event: how often we talk to a provider is not '
   'allowed to depend on who is playing our games.'),
  ('provider_target_awaits_deadline',
   'contract 211. Reads season_fixtures kickoff and score to decide whether a '
   'match''s PREDICTION DEADLINE is still ahead, and writes nothing. It is the '
   'sibling of provider_target_is_live and answers the other question: not "is '
   'this being played" but "is this still happening". Same boundary, same '
   'reason -- how often we talk to a provider is not allowed to depend on who '
   'is playing our games.'),
  ('provider_poll_endpoint',           'resolves an endpoint; writes nothing.'),
  ('touch_provider_poll_target',       'the poll target row''s own updated_at trigger.'),
  ('touch_provider_entity_map',        'the identity map row''s own updated_at trigger.'),
  ('reject_provider_custody_mutation', 'refuses a custody mutation; writes nothing.'),
  ('apply_provider_fixture_facts',
   'contract 135. The provisional live projection, the unknown-status and '
   'refusal queues, and the provenance row naming the provider behind a result '
   'revision -- all internal. It writes NO public relation itself: the official '
   'season result is reached only through record_season_fixture_result, which '
   'is asserted separately below.'),
  ('consume_provider_responses',
   'contract 135. The consumption record that makes the driver idempotent. It '
   'routes to contracts 117, 132 and the applier and writes nothing else.'),
  ('get_provider_review_queues',
   'contract 138. Reads the seven review queues bounded per section and writes '
   'nothing at all -- it is declared stable.'),
  ('acknowledge_provider_review_items',
   'contract 138. Marks reviewed_at on the five acknowledgeable queues and '
   'appends the acknowledgement record naming the actor. Every one of those is '
   'internal: it writes no public relation, decides nothing about the item it '
   'marks, and cannot apply a result the provider was refused.'),
  ('provider_status_kind',             'reads the status vocabulary; writes nothing.'),
  ('resolve_provider_response_season', 'resolves which season a response is about; writes nothing.'),
  ('provider_mapping_gaps',            'reports unmapped identifiers; writes nothing.'),
  ('resolve_provider_season',          'reads the identity map; writes nothing.'),
  ('resolve_provider_round',           'reads the identity map; writes nothing.'),
  ('resolve_provider_team',            'reads the identity map; writes nothing.'),
  -- Contract 168. An administrator's read of the staged calendar, registered
  -- here because THIS GUARD CAUGHT IT: a new function naming a provider
  -- relation must say what it may write, or it does not pass. It writes
  -- nothing — it reads the proposals, joins the identity map to say which club
  -- each provider id means, and names what would block an approval. The
  -- decisions stay with contract 132's two writers.
  ('admin_provider_proposal_detail',
   'reads staged proposals and the identity map; writes nothing, and returns no raw payload.'),
  -- Contract 174. Registered here because THIS GUARD CAUGHT IT AGAIN, which is
  -- the third time it has earned its keep. Four new names match `%provider%`
  -- and each says what it may write.
  ('detect_provider_calendar_changes',
   'staged change proposals only -- a discovered fixture, a postponement, '
   'abandonment or cancellation, and (only against a caller-declared complete '
   'span) a withdrawal. It writes NO public relation at all: the assertion in '
   'its own migration fails if it ever names season_fixtures, because it runs '
   'unattended every five minutes.'),
  ('admin_provider_change_proposals',
   'reads staged change proposals bounded and self-declaring about truncation; '
   'writes nothing, and returns no raw provider payload.'),
  ('admin_decide_provider_change_proposal',
   'contract 174. THE ONLY function in the provider path that may add a fixture '
   'to a published season or take one out, and it is not automatic: it requires '
   'require_competition_admin and one explicit decision per proposal. It '
   'inserts season_fixtures on an approved discovery and updates '
   'season_fixtures.status on an approved postponement, abandonment, '
   'cancellation or withdrawal. It writes NO score and cannot: it refuses any '
   'fixture already carrying one, re-checked under the row lock, so contract '
   '125''s confirmation gate is untouched.'),
  ('block_provider_change_proposal_rewrite',
   'refuses rewrite or deletion of staged change evidence, and refuses a second '
   'decision on a decided proposal; writes nothing.'),
  -- Contract 209. Registered here because THIS GUARD CAUGHT IT AGAIN, and this
  -- time it caught the thing it was written for: a NEW WRITER of a public
  -- competition relation, arriving unattended.
  ('apply_provider_fixture_lifecycle',
   'contract 209. season_fixtures.status, and the append-only lifecycle '
   'transition record. It is the SECOND unattended function permitted to write '
   'a public competition relation, and the permission is deliberately narrow: '
   'the ONLY transitions it can make are scheduled -> postponed and postponed '
   '-> scheduled, enforced by a CHECK on the evidence row it must write first. '
   'It cannot void, abandon, create or delete a fixture -- those stay with '
   'admin_decide_provider_change_proposal -- it refuses any fixture carrying a '
   'score, and it writes no result, lock, standing or prediction. A postponement '
   'removes nothing and is reversed by the next poll that disagrees, which is '
   'why it is allowed to be automatic at all.'),
  ('provider_poll_path_pattern',
   'contract 209. Turns a stored poll path into a LIKE pattern so a dispatched '
   'URL can be matched back to the target that produced it. Immutable, reads no '
   'relation and writes nothing.');

-- ---------------------------------------------------------------------------
-- 1. Every reviewed function exists.
-- ---------------------------------------------------------------------------
--
-- A name that resolves nowhere silently stops guarding anything, which is the
-- failure `tests/scripts/pgTapFunctionReferences.test.ts` exists to make cheap.

select is(
  (select coalesce(jsonb_agg(missing.name order by missing.name), '[]'::jsonb)
     from ingestion_functions missing
    where not exists (
      select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('predictor_internal', 'public')
         and p.prokind = 'f'
         and p.proname = missing.name
    )),
  '[]'::jsonb,
  'every reviewed ingestion function exists -- a renamed or dropped one leaves '
  'an entry guarding nothing');

-- ---------------------------------------------------------------------------
-- 2. None of them writes official truth.
-- ---------------------------------------------------------------------------
--
-- The assertion this whole file is for. Matched as `insert into public.X`,
-- `update public.X` and `delete from public.X`, which is how a definer function
-- with an empty search_path must name a relation to write it.

select is(
  (select coalesce(jsonb_agg(distinct offender.detail order by offender.detail), '[]'::jsonb)
     from (
       select f.name || ' -> ' || t.relation as detail
         from ingestion_functions f
         join pg_proc p on p.proname = f.name and p.prokind = 'f'
         join pg_namespace n on n.oid = p.pronamespace
                            and n.nspname in ('predictor_internal', 'public')
         cross join official_truth t
        where pg_get_functiondef(p.oid) ~* (
                '(insert\s+into|update|delete\s+from)\s+public\.' || t.relation || '\M')
     ) offender),
  '[]'::jsonb,
  'no provider ingestion function writes an official result, score, total, '
  'lock, progression, standing or player prediction -- provider data is '
  'provisional and confirmation remains the gate');

-- ---------------------------------------------------------------------------
-- 3. A new ingestion function must be reviewed before it can pass.
-- ---------------------------------------------------------------------------
--
-- The property that makes this a guard rather than a snapshot. Scoped by name,
-- because that is what an ingestion contract has in common before anyone has
-- read it.

select is(
  (select coalesce(jsonb_agg(distinct candidate.proname order by candidate.proname), '[]'::jsonb)
     from (
       select p.proname
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('predictor_internal', 'public')
          and p.prokind = 'f'
          and (p.proname like '%provider%' or p.proname like '%poll%')
          and p.proname not in (select name from ingestion_functions)
     ) candidate),
  '[]'::jsonb,
  'every provider or poll function is reviewed here -- a new one names what it '
  'may write, or it does not pass');

-- ---------------------------------------------------------------------------
-- 4. The inverse: entries that no longer describe anything are deleted.
-- ---------------------------------------------------------------------------

select is(
  (select coalesce(jsonb_agg(stale.name order by stale.name), '[]'::jsonb)
     from ingestion_functions stale
    where stale.name not like '%provider%'
      and stale.name not like '%poll%'),
  '[]'::jsonb,
  'reviewed entries that are no longer part of the provider path -- delete them '
  'rather than leaving the list to rot');

-- ---------------------------------------------------------------------------
-- 5. The reviewed public writes, named rather than merely allowed.
-- ---------------------------------------------------------------------------
--
-- Three reviewed provider-path functions write a `public` relation and no others do. Asserting
-- the set positively means a third appearing is visible here, not merely absent
-- from the forbidden list above -- and the forbidden list can only refuse
-- relations somebody thought to name.
--
-- Both were read rather than assumed, and the second one corrected this
-- assertion: `dispatch_due_provider_polls` updates `public.provider_poll_targets`,
-- which the first draft of this file did not expect. That relation is ingestion
-- CONFIGURATION -- when a target was last polled -- not competition truth, and
-- the same is true of `public.provider_entity_map`. Provider plumbing living in
-- `public` is what makes "writes nothing in public" the wrong question and
-- "writes nothing a player's result depends on" the right one.

select is(
  (select coalesce(jsonb_agg(distinct writer.proname order by writer.proname), '[]'::jsonb)
     from (
       select p.proname
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         join ingestion_functions f on f.name = p.proname
        where n.nspname in ('predictor_internal', 'public')
          and p.prokind = 'f'
          and pg_get_functiondef(p.oid) ~* '(insert\s+into|update|delete\s+from)\s+public\.'
     ) writer),
  '["admin_approve_initial_provider_fixtures", "admin_decide_provider_change_proposal", "apply_provider_fixture_lifecycle", "dispatch_due_provider_polls", "import_provider_fixture_revisions"]'::jsonb,
  'exactly five reviewed provider-path functions write a public relation: '
  'contract 132 explicit admin publication, contract 174 explicit admin '
  'decision on a staged calendar change, contract 117 kickoff import, the poll '
  'dispatcher metadata stamp, and contract 209 postponement lifecycle. What '
  'would be a defect is a writer that is not one of those -- and '
  'detect_provider_calendar_changes, the unattended half of contract 174, is '
  'deliberately absent from this list');

-- ---------------------------------------------------------------------------
-- 6. And what it writes there is the fixture, not the round.
-- ---------------------------------------------------------------------------
--
-- Contract 117's own suite proves the behaviour. This restates the structural
-- half here so the boundary reads in one place: the importer reaches
-- `season_fixtures` and nothing else in `public`.
--
-- The signature is resolved first and asserted non-null, because
-- `pg_get_functiondef(null)` is null and every `~*` against it is null too --
-- so an importer whose argument list changed would make the assertion below
-- pass while checking nothing. Assertion 1 catches a rename; only this catches
-- a signature drift.

select ok(
  to_regprocedure(
    'predictor_internal.import_provider_fixture_revisions(text,uuid,jsonb,uuid,timestamptz)'
  ) is not null,
  'the contract 117 importer resolves at the signature this file checks');

select is(
  (select coalesce(jsonb_agg(distinct t.relation order by t.relation), '[]'::jsonb)
     from official_truth t
    where pg_get_functiondef(
            to_regprocedure(
              'predictor_internal.import_provider_fixture_revisions(text,uuid,jsonb,uuid,timestamptz)'
            )::oid
          ) ~* ('(insert\s+into|update|delete\s+from)\s+public\.' || t.relation || '\M')),
  '[]'::jsonb,
  'the kickoff importer writes no official-truth relation -- it revises '
  'season_fixtures and records the move, and every derived lock, score and '
  'standing follows from authorities it never touches');

-- ---------------------------------------------------------------------------
-- 8. The applier writes no public relation of its own.
-- ---------------------------------------------------------------------------
--
-- Contract 135's whole audit argument rests on this. If the applier could
-- update `public.season_fixtures` directly it would set a score with no
-- revision, no numbering and no record of what it replaced — an official result
-- that no administrator could later explain. Routing through contract 125's
-- writer is what makes the owner's "auditable" requirement structural rather
-- than a promise.
--
-- The signature is resolved and asserted non-null first, for the reason
-- assertion 6 records: `pg_get_functiondef(null)` is null and every `~*`
-- against it is null too, so a drifted signature would pass while checking
-- nothing.

select ok(
  to_regprocedure(
    'predictor_internal.apply_provider_fixture_facts(text,uuid,jsonb,uuid,timestamptz)'
  ) is not null,
  'the contract 135 applier resolves at the signature this file checks');

select is(
  (select (
     pg_get_functiondef(
       to_regprocedure(
         'predictor_internal.apply_provider_fixture_facts(text,uuid,jsonb,uuid,timestamptz)'
       )::oid
     ) ~* '(insert\s+into|update|delete\s+from)\s+public\.')),
  false,
  'the provider result applier writes no public relation directly -- an '
  'official season result is reached only through the audited writer');

select is(
  (select (
     pg_get_functiondef(
       to_regprocedure(
         'predictor_internal.apply_provider_fixture_facts(text,uuid,jsonb,uuid,timestamptz)'
       )::oid
     ) ~* 'record_season_fixture_result')),
  true,
  'and it does reach that writer -- an applier that stopped calling it would '
  'satisfy the assertion above by doing nothing at all');

-- ---------------------------------------------------------------------------
-- 9. What the audited writer may reach, now that ingestion can call it.
-- ---------------------------------------------------------------------------
--
-- Before contract 135 this function was only ever reached by a signed-in
-- administrator, so its own writes were outside this file's scope. They are
-- inside it now: whatever `record_season_fixture_result` can touch, the
-- provider path can cause. It writes the fixture and its revision record, and
-- settles nothing — the hourly rederivation owns that, which is why a provider
-- result cannot reach a score, total, rank or standing even indirectly.

select is(
  (select coalesce(jsonb_agg(distinct t.relation order by t.relation), '[]'::jsonb)
     from official_truth t
    where pg_get_functiondef(
            to_regprocedure(
              'predictor_internal.record_season_fixture_result(uuid,text,smallint,smallint,text)'
            )::oid
          ) ~* ('(insert\s+into|update|delete\s+from)\s+public\.' || t.relation || '\M')),
  '[]'::jsonb,
  'the audited result writer reaches no score, total, lock, progression, '
  'standing or player prediction -- it writes the fixture and its revision, and '
  'settlement remains the job that derives everything else');

-- ---------------------------------------------------------------------------
-- 10. The tournament keeps its gate.
-- ---------------------------------------------------------------------------
--
-- The owner's amendment is about a league season. Euro 2028's results remain
-- confirmable only by a signed-in administrator through the tournament RPCs,
-- and no part of the provider path may so much as name those relations.

select is(
  (select coalesce(jsonb_agg(distinct offender.detail order by offender.detail), '[]'::jsonb)
     from (
       select f.name || ' -> ' || t.relation as detail
         from ingestion_functions f
         join pg_proc p on p.proname = f.name and p.prokind = 'f'
         join pg_namespace n on n.oid = p.pronamespace
                            and n.nspname in ('predictor_internal', 'public')
         cross join (values ('matches'), ('match_result_revisions')) as t(relation)
        where pg_get_functiondef(p.oid) ~* ('public\.' || t.relation || '\M')
     ) offender),
  '[]'::jsonb,
  'no provider ingestion function so much as names a tournament result '
  'relation -- the amendment moved the season boundary and left this one where '
  'it was');

select finish();
rollback;
