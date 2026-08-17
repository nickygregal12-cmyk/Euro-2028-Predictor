-- Internal analytics views for Metabase.
--
-- NOT A MIGRATION, and deliberately not numbered. This provisions a reporting
-- surface for an operations tool; it adds nothing the application reads, no
-- table the product depends on, and no behaviour any test asserts. Consuming a
-- repository contract number for it would put an ops concern into the sequence
-- that governs application schema, and every future migration would inherit
-- the confusion.
--
-- Apply it by hand, to a NON-PRODUCTION database first. See
-- docs/ops/metabase-analytics.md for the rules of engagement.
--
-- ---------------------------------------------------------------------------
-- WHY VIEWS RATHER THAN TABLE ACCESS
-- ---------------------------------------------------------------------------
-- Metabase authenticates as one database role for everybody who opens it. It
-- has no notion of the signed-in player, so `auth.uid()` is null for every
-- query it issues, and Row Level Security written in terms of the current
-- player therefore cannot express "this analyst may see this row". Pointing
-- Metabase at the base tables would mean granting a role that reads every
-- player's predictions, and RLS would not be circumvented so much as rendered
-- irrelevant.
--
-- So Metabase never sees a base table. It sees these views, each of which is
-- an AGGREGATE. There is no row here that describes one identifiable player's
-- choices, and the grants at the bottom make that the only thing the role can
-- reach.
--
-- ---------------------------------------------------------------------------
-- WHAT IS DELIBERATELY ABSENT
-- ---------------------------------------------------------------------------
--   * no auth.users, no email address, no display name, no user id;
--   * no invite code — `leagues.invite_code` is a credential, not a datum;
--   * no individual prediction, selection or score;
--   * no per-player row of any kind.
--
-- Counts are the unit. Where a count would be small enough to identify
-- somebody, the view says so rather than being quietly precise.

create schema if not exists analytics;

-- ===========================================================================
-- PLATFORM
-- ===========================================================================

-- Sign-ups per day. `profiles` carries a display name; it is never selected.
create or replace view analytics.platform_signups_daily as
select
    date_trunc('day', created_at) as day,
    count(*)                      as signups
from public.profiles
group by 1
order by 1;

-- Prediction activity per day, as a proxy for engagement.
--
-- It is a PROXY and is named like one. There is no session or page-view
-- record in this database, so a true DAU cannot be derived here and is not
-- claimed: this counts distinct entries that wrote a prediction, which is a
-- different and narrower thing.
create or replace view analytics.platform_prediction_activity_daily as
select
    date_trunc('day', created_at)  as day,
    count(*)                       as predictions_written,
    count(distinct entry_id)       as active_entries
from public.season_predictions
group by 1
order by 1;

-- Entries per tournament, and how many have been finally submitted.
create or replace view analytics.platform_entries_by_tournament as
select
    tournament_id,
    count(*)                                     as entries,
    count(submitted_at)                          as submitted,
    count(*) - count(submitted_at)               as unsubmitted
from public.entries
group by 1;

-- Prediction completion: how much of the fixture list each tournament's
-- entrants have actually filled in.
create or replace view analytics.platform_prediction_completion as
select
    p.tournament_id,
    count(distinct p.entry_id)   as entries_with_predictions,
    count(*)                     as predictions,
    count(distinct p.season_fixture_id) as fixtures_predicted
from public.season_predictions p
group by 1;

-- Private leagues, and how large they are. Names and invite codes are not
-- selected: a league name is user-supplied text and an invite code is a
-- credential.
create or replace view analytics.platform_leagues_by_tournament as
select
    l.tournament_id,
    count(distinct l.id)                             as leagues,
    count(m.user_id)                                 as memberships,
    round(avg(member_counts.members), 2)             as mean_members_per_league
from public.leagues l
left join public.league_members m on m.league_id = l.id
left join (
    select league_id, count(*) as members
    from public.league_members
    group by 1
) member_counts on member_counts.league_id = l.id
group by 1;

-- Last Man Standing participation, as counts of entrant state.
create or replace view analytics.platform_lms_participation as
select
    competition_id,
    count(*)                                        as entrants,
    count(*) filter (where lives_remaining > 0)     as still_alive,
    count(*) filter (where lives_remaining = 0)     as eliminated
from public.season_lms_entrant_state
group by 1;

-- ===========================================================================
-- PROVIDERS
-- ===========================================================================

-- Poll freshness and coverage. This is the view that answers "is anything
-- actually feeding us", which has been a real question more than once.
create or replace view analytics.provider_poll_health as
select
    provider,
    count(*)                                    as targets,
    count(*) filter (where enabled)             as enabled_targets,
    count(*) filter (where not enabled)         as disabled_targets,
    max(last_dispatched_at)                     as last_dispatch,
    -- NULL when nothing has ever dispatched. Not 0: "never polled" and
    -- "polled 0 minutes ago" are opposite findings.
    case
        when max(last_dispatched_at) is null then null
        else extract(epoch from (now() - max(last_dispatched_at))) / 60.0
    end                                         as minutes_since_last_dispatch
from public.provider_poll_targets
group by 1;

-- ===========================================================================
-- AI LAB
-- ===========================================================================

-- Champion and challengers per league, with the metrics the lab records.
--
-- `market_log_loss` is the bookmaker closing line over the same matches. A
-- model beating its own baseline and losing to the market is the expected
-- result, and showing both stops the first number being read as success.
create or replace view analytics.ai_model_register as
select
    league,
    family,
    version,
    status,
    trained_at,
    training_matches,
    val_log_loss,
    val_brier,
    val_accuracy,
    baseline_log_loss,
    market_log_loss
from ai.models;

-- How many models are current versus waiting, per league.
create or replace view analytics.ai_model_status_by_league as
select
    league,
    count(*) filter (where status = 'current')    as current_models,
    count(*) filter (where status = 'challenger') as challengers,
    count(*) filter (where status = 'retired')    as retired,
    count(*) filter (where status = 'failed')     as failed
from ai.models
group by 1;

-- Forecast volume over time.
create or replace view analytics.ai_forecast_volume_daily as
select
    date_trunc('day', created_at) as day,
    count(*)                      as predictions
from ai.predictions
group by 1
order by 1;

-- Provider spend. The lab's paid odds budget is small and the question
-- "have we spent anything" must be answerable without opening the console.
--
-- `reported_cost` is what the provider actually charged and is null when it
-- did not say; `estimated_cost` is the lab's own pre-flight figure. Both are
-- shown because a divergence between them is the interesting case.
create or replace view analytics.ai_provider_usage_daily as
select
    date_trunc('day', called_at)  as day,
    provider,
    count(*)                      as requests,
    sum(estimated_cost)           as estimated_credits,
    sum(reported_cost)            as reported_credits,
    min(reported_remaining)       as lowest_reported_remaining
from ai.api_usage
group by 1, 2
order by 1, 2;

-- ===========================================================================
-- BETTING AND VALUE EVIDENCE
-- ===========================================================================

-- Recommendation decisions and which gate is firing.
--
-- The reason-code breakdown is the most useful thing the lab produces on a
-- quiet week: passing on price, on data and on disagreement have completely
-- different fixes.
--
-- `reason_codes` is an array — one PASS commonly carries several — so it is
-- unnested. A recommendation therefore contributes one row per reason, and
-- the counts below are counts of REASONS rather than of recommendations.
-- Summing them would double-count, which is why the decision totals live in
-- their own view rather than in a column here.
create or replace view analytics.ai_recommendation_reasons as
select
    r.league,
    r.decision,
    reason.code,
    count(*) as occurrences
from ai.recommendations r
cross join lateral unnest(
    case when cardinality(r.reason_codes) = 0
         then array[null]::text[]
         else r.reason_codes
    end
) as reason(code)
group by 1, 2, 3;

-- Decision totals, counted once per recommendation.
create or replace view analytics.ai_recommendation_decisions as
select
    league,
    decision,
    count(*)                     as recommendations,
    min(decided_at)              as first_decided_at,
    max(decided_at)              as last_decided_at
from ai.recommendations
group by 1, 2;

-- Settled paper-betting evidence.
--
-- Every figure here is over SETTLED bets, with the unsettled count reported
-- beside it. An open position folded in at zero profit makes a record look
-- flat, which is a different claim from "we do not know yet".
--
-- ROI is NULL rather than 0 when nothing has settled. A strategy that has
-- resolved no bet has not broken even.
create or replace view analytics.ai_betting_evidence as
select
    b.league,
    b.is_paper,
    count(*)                                         as advised,
    count(r.pnl_units)                               as settled,
    count(*) - count(r.pnl_units)                    as unsettled,
    sum(r.pnl_units)                                 as net_units,
    sum(case when r.pnl_units is not null then b.stake_units end)
                                                     as staked_units,
    case
        when sum(case when r.pnl_units is not null then b.stake_units end) > 0
        then sum(r.pnl_units)
             / sum(case when r.pnl_units is not null then b.stake_units end)
        else null
    end                                              as roi,
    -- Closing-line value is the scoreboard, and it only exists where a
    -- closing benchmark was captured. The rows without one are counted, not
    -- averaged in as zero.
    count(r.clv)                                     as with_closing_benchmark,
    count(*) - count(r.clv)                          as without_closing_benchmark,
    avg(r.clv)                                       as mean_clv
from ai.bets b
left join ai.bet_results r on r.bet_id = b.id
group by 1, 2;

-- ===========================================================================
-- GRANTS
-- ===========================================================================
--
-- The role is created without a password here on purpose. Set one out of band
-- so it never enters a file that could be committed:
--
--   alter role metabase_readonly with password '<generated>';
--
-- Nothing below grants anything on `public`, `ai` or `predictor_internal`
-- beyond the schema-usage needed to resolve the views' own dependencies. The
-- role cannot select from a base table, so it cannot read one player's
-- predictions even by accident.

do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'metabase_readonly') then
        create role metabase_readonly with login noinherit;
    end if;
end
$$;

-- No CREATE. The role may not add objects to any schema.
grant usage on schema analytics to metabase_readonly;
grant select on all tables in schema analytics to metabase_readonly;

-- New views become readable without another grant round; nothing else does.
alter default privileges in schema analytics
    grant select on tables to metabase_readonly;

-- Belt and braces: refuse the role every base table explicitly, so a later
-- blanket grant on `public` cannot silently widen it.
revoke all on all tables in schema public from metabase_readonly;
revoke all on schema public from metabase_readonly;

-- The views are owned by their creator and run with that owner's rights, so
-- the reader role needs no privilege on the underlying schemas at all.
