import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/** Effective account-deletion behaviour encoded by every auth.users FK. */
const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

type AuthUserReference = {
  migration: string
  table: string
  column: string
  action: 'cascade' | 'restrict' | 'set null' | 'undeclared'
}

function collectAuthUserReferences(): AuthUserReference[] {
  const found: AuthUserReference[] = []

  for (const migration of readdirSync(migrationsDirectory).sort()) {
    if (!migration.endsWith('.sql')) continue
    const lines = readFileSync(resolve(migrationsDirectory, migration), 'utf8')
      .split('\n')
      .map((line) => line.replace(/--.*$/, ''))

    lines.forEach((line, index) => {
      if (!/references\s+auth\.users/i.test(line)) return

      let table = 'unknown'
      for (let cursor = index; cursor >= 0; cursor -= 1) {
        const match =
          // Any schema, not only `public`. Contract 125 creates
          // `predictor_internal.season_fixture_result_revisions`, and a
          // `public.`-only prefix made the parser read the SCHEMA as the table
          // name and pin the column as `predictor_internal.actor_id`.
          at(lines, cursor).match(/create table (?:if not exists )?(?:[a-z_]+\.)?([a-z_]+)/i) ??
          at(lines, cursor).match(/alter table (?:[a-z_]+\.)?([a-z_]+)/i)
        if (match) {
          table = at(match, 1)
          break
        }
      }

      const column =
        (line.match(/^\s*(?:add column\s+)?([a-z_]+)\s+uuid/i) ??
          line.match(/foreign key \(([a-z_]+)\)/i))?.[1] ?? 'unknown'
      const declared = line.match(/on delete (cascade|restrict|set null)/i)?.[1]?.toLowerCase()

      found.push({
        migration,
        table,
        column,
        action: (declared as AuthUserReference['action']) ?? 'undeclared',
      })
    })
  }

  return found
}

const references = collectAuthUserReferences()
const effectiveActions = new Map<string, AuthUserReference['action']>()
for (const reference of references) {
  effectiveActions.set(`${reference.table}.${reference.column}`, reference.action)
}

function sitesOf(action: AuthUserReference['action']): string[] {
  return [...effectiveActions]
    .filter(([, effective]) => effective === action)
    .map(([site]) => site)
    .sort()
}

describe('account deletion — declared foreign-key semantics', () => {
  it('pins every reference to auth.users', () => {
    expect(
      references.map(
        (reference) => `${reference.migration} ${reference.table}.${reference.column} → ${reference.action}`,
      ),
    ).toEqual([
      '20260719120000_init_v0_1.sql profiles.id → cascade',
      '20260719120000_init_v0_1.sql entries.user_id → cascade',
      '20260719180000_add_leagues.sql leagues.owner_id → cascade',
      '20260719180000_add_leagues.sql league_members.user_id → cascade',
      '20260720120000_league_fk_semantics.sql league_members.user_id → cascade',
      '20260720120000_league_fk_semantics.sql leagues.owner_id → restrict',
      '20260720180000_add_rank_history.sql rank_history.user_id → cascade',
      '20260720210000_rate_limits.sql rate_limit_events.user_id → cascade',
      '20260723183000_knockout_result_lifecycle.sql match_result_revisions.actor_id → set null',
      '20260727163339_actual_third_place_resolution.sql actual_third_place_resolutions.updated_by → set null',
      '20260727163339_actual_third_place_resolution.sql actual_third_place_resolution_revisions.actor_id → set null',
      '20260728150000_bonus_games_platform.sql bonus_competition_entrants.user_id → cascade',
      '20260728150000_bonus_games_platform.sql bonus_competition_audit.actor_id → set null',
      '20260728190000_shared_knockout_prediction_store.sql bonus_knockout_predictions.user_id → cascade',
      '20260729050000_predictor_cup_knockouts.sql bonus_cup_fixtures.winner_user_id → undeclared',
      '20260730180000_cup_winner_deletion_semantics.sql bonus_cup_fixtures.winner_user_id → restrict',
      '20260803070000_c1b_game_catalogue_memberships.sql game_memberships.user_id → cascade',
      '20260803070000_c1b_game_catalogue_memberships.sql game_membership_events.actor_id → set null',
      // Contract 125. Who confirmed, corrected or cleared a season result. Set
      // null on erasure for the same reason as every other actor column: the
      // audit trail is evidence and survives the account that made it.
      '20260806160000_season_fixture_result_entry.sql season_fixture_result_revisions.actor_id → set null',
      // Contract 138. Who acknowledged a provider review item. Set null on
      // deletion for the same reason as every other audit actor here: the
      // record that a human looked stays true after that human leaves.
      '20260809080000_provider_review_queues.sql provider_review_acknowledgements.actor_id → set null',
      // Contract 143. Publication state/history are operational evidence. The
      // event survives account erasure while attribution becomes explicitly
      // unknown, matching the repository's other administrator audit trails.
      '20260809130000_euro_publication_state.sql euro_publication_state.changed_by → set null',
      '20260809130000_euro_publication_state.sql euro_publication_transitions.actor_id → set null',
      '20260810180000_private_container_identity.sql bonus_competitions.owner_id → restrict',
      '20260810220000_season_wrapped_archive.sql season_wrapped.user_id → cascade',
      '20260810230000_player_preferences.sql competition_follows.user_id → cascade',
      '20260810230000_player_preferences.sql pinned_rivals.user_id → cascade',
      '20260810230000_player_preferences.sql pinned_rivals.rival_user_id → cascade',
      // Contract 160. Both are administrator audit attribution on a competition
      // decision — who deducted the points, who awarded the fixture — so they
      // take `set null` like every other audit actor here. The DECISION survives
      // the account: a nine-point deduction that vanished when the official who
      // recorded it closed their account would silently restate the table.
      '20260811110000_domestic_league_table.sql season_table_adjustments.decided_by → set null',
      '20260811110000_domestic_league_table.sql season_fixture_awards.decided_by → set null',
      // Contracts 162 and 163. All three CASCADE, unlike contract 160's two,
      // and the difference is the right one: those are audit attribution on a
      // competition decision that must outlive the account, while these are the
      // player's own inbox and their own queued mail. A closed account keeps
      // neither.
      '20260811130000_action_centre.sql player_action_items.user_id → cascade',
      '20260811130000_action_centre.sql player_action_state.user_id → cascade',
      '20260811140000_reminder_delivery.sql reminder_deliveries.user_id → cascade',
      // Contract 174, on contract 138's terms: the decision and the calendar
      // change it caused outlive the account that took it.
      '20260811234000_provider_calendar_change_proposals.sql provider_calendar_change_proposals.decided_by → set null',
      // Contract 217. A push subscription is a way to reach a person, so it
      // cascades — the strongest possible reading of "delete my account" is
      // that nothing is left anywhere that could make their phone buzz.
      '20260824090000_web_push_channel.sql push_subscriptions.user_id → cascade',
    ])
  })

  it('resolves the league references to the later migration', () => {
    const semantics = readFileSync(
      resolve(migrationsDirectory, '20260720120000_league_fk_semantics.sql'),
      'utf8',
    )

    for (const constraint of ['league_members_user_id_fkey', 'leagues_owner_id_fkey']) {
      expect(semantics).toContain(`drop constraint if exists ${constraint}`)
      expect(semantics).toContain(`add constraint ${constraint}`)
    }
  })

  it('leaves no reference with an undeclared action', () => {
    expect(sitesOf('undeclared')).toEqual([])
  })
})

describe('account deletion — consequences', () => {
  it('names the references that block deletion outright', () => {
    expect(sitesOf('restrict').sort()).toEqual([
      'bonus_competitions.owner_id',
      'bonus_cup_fixtures.winner_user_id',
      'leagues.owner_id',
    ])
  })

  it('keeps the documented rationale attached to the restricting reference', () => {
    const semantics = readFileSync(
      resolve(migrationsDirectory, '20260720120000_league_fk_semantics.sql'),
      'utf8',
    )
    expect(semantics).toMatch(/leagues are never orphaned/i)
    expect(semantics).toMatch(/account-deletion flow MUST hand owned/i)
  })

  it('names the references that cascade with identity deletion', () => {
    expect(sitesOf('cascade')).toEqual([
      'bonus_competition_entrants.user_id',
      'bonus_knockout_predictions.user_id',
      'competition_follows.user_id',
      'entries.user_id',
      'game_memberships.user_id',
      'league_members.user_id',
      'pinned_rivals.rival_user_id',
      'pinned_rivals.user_id',
      'player_action_items.user_id',
      'player_action_state.user_id',
      'profiles.id',
      'push_subscriptions.user_id',
      'rank_history.user_id',
      'rate_limit_events.user_id',
      'reminder_deliveries.user_id',
      'season_wrapped.user_id',
    ])
  })

  it('keeps audit trails attributable-or-null rather than deleted', () => {
    expect(sitesOf('set null')).toEqual([
      'actual_third_place_resolution_revisions.actor_id',
      'actual_third_place_resolutions.updated_by',
      'bonus_competition_audit.actor_id',
      'euro_publication_state.changed_by',
      'euro_publication_transitions.actor_id',
      'game_membership_events.actor_id',
      'match_result_revisions.actor_id',
      'provider_calendar_change_proposals.decided_by',
      'provider_review_acknowledgements.actor_id',
      'season_fixture_awards.decided_by',
      'season_fixture_result_revisions.actor_id',
      'season_table_adjustments.decided_by',
    ])
  })

  it('carries the entry cascade into every dependent competition table', () => {
    const dependants = new Set<string>()
    for (const migration of readdirSync(migrationsDirectory).sort()) {
      if (!migration.endsWith('.sql')) continue
      const source = readFileSync(resolve(migrationsDirectory, migration), 'utf8')
      const lines = source.split('\n')
      lines.forEach((line, index) => {
        if (!/references\s+(?:public\.)?entries\s*\(/i.test(line)) return
        if (!/on delete cascade/i.test(line)) return
        for (let cursor = index; cursor >= 0; cursor -= 1) {
          const match = at(lines, cursor).match(/create table (?:if not exists )?(?:public\.)?([a-z_]+)/i)
          if (match) {
            dependants.add(at(match, 1))
            break
          }
        }
      })
    }
    expect(dependants.size).toBeGreaterThanOrEqual(7)
  })

  it('leaves profiles with no dependants of its own', () => {
    const referencesProfiles = readdirSync(migrationsDirectory)
      .filter((migration) => migration.endsWith('.sql'))
      .filter((migration) =>
        /references\s+(?:public\.)?profiles\s*\(/i.test(
          readFileSync(resolve(migrationsDirectory, migration), 'utf8'),
        ),
      )
    expect(referencesProfiles).toEqual([])
  })
})
