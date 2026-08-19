import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * The two schema-wide security invariants, asserted over the committed migrations.
 *
 *   1. Every table in the API-exposed `public` schema has row-level security
 *      enabled.
 *   2. Every `security definer` function pins `search_path`.
 */

const repositoryRoot = process.cwd()
const migrationsDirectory = resolve(repositoryRoot, 'supabase/migrations')

function migrationFiles(): string[] {
  return readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

function sourceOf(migration: string): string {
  return readFileSync(resolve(migrationsDirectory, migration), 'utf8')
}

function statementsOf(migration: string): string {
  return sourceOf(migration)
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

type CreatedTable = { schema: string; name: string }

function createdTables(): CreatedTable[] {
  const tables: CreatedTable[] = []
  for (const migration of migrationFiles()) {
    const pattern = /create table\s+(?:if not exists\s+)?(?:([a-z_0-9]+)\.)?([a-z_0-9]+)/gi
    for (const match of statementsOf(migration).matchAll(pattern)) {
      tables.push({ schema: match[1] ?? 'public', name: at(match, 2) })
    }
  }
  return tables
}

function rowLevelSecurityEnabled(): Set<string> {
  const enabled = new Set<string>()
  for (const migration of migrationFiles()) {
    const pattern = /alter table\s+(?:public\.)?([a-z_0-9]+)\s+enable row level security/gi
    for (const match of statementsOf(migration).matchAll(pattern)) {
      enabled.add(at(match, 1))
    }
  }
  return enabled
}

const publicTables = new Set(
  createdTables()
    .filter((table) => table.schema === 'public')
    .map((table) => table.name),
)
const rlsTables = rowLevelSecurityEnabled()

describe('row-level security', () => {
  it('parses a plausible number of tables at all', () => {
    expect(publicTables.size).toBeGreaterThanOrEqual(41)
  })

  it('enables RLS on every public table', () => {
    const unprotected = [...publicTables].filter((table) => !rlsTables.has(table)).sort()
    expect(unprotected).toEqual([])
  })

  it('keeps the internal schema out of the public surface', () => {
    const internal = createdTables().filter((table) => table.schema !== 'public')
    expect(internal).toEqual([
      { schema: 'predictor_internal', name: 'operating_limits' },
      { schema: 'predictor_internal', name: 'provider_raw_responses' },
      { schema: 'predictor_internal', name: 'provider_response_processing' },
      // Contract 114. The record of what the poll job sent. Internal rather
      // than public for the same reason as the two custody tables above it:
      // nothing outside the job has cause to read it, and its neighbours in
      // `public` all exist because something reaches them through a definer
      // function that needs a public foreign key.
      { schema: 'predictor_internal', name: 'provider_poll_dispatches' },
      // Contract 116. Every kickoff a provider moved, with the instant it
      // moved from. Internal because it is an administrator's review queue
      // rather than anything a player reads, and because the fixture already
      // carries the current kickoff — this exists to hold what the current
      // value replaced, which no browser surface has a use for.
      { schema: 'predictor_internal', name: 'season_fixture_revisions' },
      // Contract 123. Every round play window refresh that was refused because
      // its proposed span overlapped another round's. Internal for the same
      // reason as the revision queue above it: it records what was NOT written
      // and why, which is an administrator's review surface and has no meaning
      // to a player — the round already carries the window in force.
      { schema: 'predictor_internal', name: 'round_window_refresh_conflicts' },
      // Contract 125. Every official season result confirmed, corrected or
      // cleared, with the result it replaced. Internal for the same reason as
      // the queues above it: the fixture carries the result in force, and this
      // carries what that value replaced, which no player surface reads.
      { schema: 'predictor_internal', name: 'season_fixture_result_revisions' },
      // Contract 132. Fresh provider fixture discovery remains private evidence
      // until a competition administrator explicitly approves or rejects the
      // complete initial calendar. No player-facing API needs direct access.
      { schema: 'predictor_internal', name: 'provider_fixture_proposals' },
      // Contract 135. What a provider status token means. Internal because it
      // is the vocabulary a fail-closed rule is decided by, not a fact about
      // any competition — and because a browser able to write it could make an
      // arbitrary token mean 'final'.
      { schema: 'predictor_internal', name: 'provider_status_kinds' },
      // Contract 135. Status tokens with no mapping, so a vocabulary that fails
      // closed is visible rather than silent. An operator's queue.
      { schema: 'predictor_internal', name: 'provider_status_observations' },
      // Contract 135. The provisional provider view of a fixture: latest
      // status, score and observation time. Internal because it decides
      // nothing — the bounded card read exposes it, labelled as provisional,
      // and no lock, score or standing may take it as an input.
      { schema: 'predictor_internal', name: 'season_fixture_live_state' },
      // Contract 135. Which result revisions the provider wrote. Internal for
      // the same reason as the revision record it keys onto: it explains a
      // number a player can see, to whoever has to answer for it.
      { schema: 'predictor_internal', name: 'season_fixture_result_sources' },
      // Contract 135. Every provider result this platform declined to apply,
      // with the reason. The administrator-owned case is why it exists: a
      // provider that silently stops writing a fixture is indistinguishable
      // from one that agrees with it.
      { schema: 'predictor_internal', name: 'provider_result_refusals' },
      // Contract 135. Which decoded responses the driver has handled, which is
      // what makes it idempotent. Ingestion bookkeeping, read by nobody else.
      { schema: 'predictor_internal', name: 'provider_response_consumption' },
      // Contract 136. Owner-controlled club codes and colours, matched onto
      // teams by normalised name. Internal because it is reference data behind
      // a bounded read rather than a competition relation, and because it is
      // not provider data and must not be mistaken for it.
      { schema: 'predictor_internal', name: 'club_identity_reference' },
      // Contract 138. Who acknowledged which review item, and why. One
      // relation for every queue kind, so contracts 117 and 123 gain an actor
      // without either of their tables being altered. Internal because it is
      // an operations record rather than anything a player reads.
      { schema: 'predictor_internal', name: 'provider_review_acknowledgements' },
      // Contract 143. The Euro publication state itself, and its append-only
      // transition history. Internal because ADR 0026 makes publication an
      // owner operational act rather than anything a player reads: what a
      // browser may see is the bounded `euro_publication_state()` read — the
      // state and the instant it last changed, nothing more — while the actor
      // who moved it, their reason and the whole history stay here with no
      // browser grant at all. The mutation reaches these tables only through
      // the definer RPC, which gates on super_admin internally.
      { schema: 'predictor_internal', name: 'euro_publication_state' },
      { schema: 'predictor_internal', name: 'euro_publication_transitions' },
      // Contract 144. Current provider team profile facts remain internal and
      // subordinate to the existing provider identity map. No browser surface
      // receives table access, and image references are provenance only.
      { schema: 'predictor_internal', name: 'provider_team_profiles' },
      // Contract 174. Staged calendar changes: append-only evidence, RLS on,
      // no grant to any browser role, reached only through the two
      // administrator functions.
      { schema: 'predictor_internal', name: 'provider_calendar_change_proposals' },
      // Contract 178. The shadow scoring verifier's own evidence: what it
      // checked, and every banked total it disagreed with. Internal because it
      // is an integrity operations record rather than anything a player reads,
      // and because a browser able to write it could manufacture a mismatch —
      // or erase one. The administrator's view is the bounded
      // `admin_shadow_scoring_report`, which names entries and never people.
      { schema: 'predictor_internal', name: 'shadow_scoring_runs' },
      { schema: 'predictor_internal', name: 'shadow_scoring_mismatches' },
      // Contract 184. A separately revoked analytical schema: private model,
      // odds and paper-betting evidence only. Browser access is through the
      // bounded admin RPCs above it, never direct table privileges.
      { schema: 'ai', name: 'team_aliases' },
      { schema: 'ai', name: 'raw_matches' },
      { schema: 'ai', name: 'models' },
      { schema: 'ai', name: 'predictions' },
      { schema: 'ai', name: 'prediction_results' },
      { schema: 'ai', name: 'job_runs' },
      { schema: 'ai', name: 'publication_gate' },
      { schema: 'ai', name: 'observations' },
      { schema: 'ai', name: 'market_snapshots' },
      { schema: 'ai', name: 'feature_experiments' },
      { schema: 'ai', name: 'bookmakers' },
      { schema: 'ai', name: 'bets' },
      { schema: 'ai', name: 'bet_results' },
      { schema: 'ai', name: 'fixture_odds' },
      { schema: 'ai', name: 'fixtures' },
      { schema: 'ai', name: 'model_artifacts' },
      { schema: 'ai', name: 'evidence_gate' },
      { schema: 'ai', name: 'markets' },
      { schema: 'ai', name: 'market_prices' },
      { schema: 'ai', name: 'api_usage' },
      { schema: 'ai', name: 'api_budget' },
      { schema: 'ai', name: 'odds_api_events' },
      { schema: 'ai', name: 'odds_api_snapshots' },
      { schema: 'ai', name: 'odds_api_coverage' },
      { schema: 'ai', name: 'historical_market_prices' },
      { schema: 'ai', name: 'odds_api_raw_responses' },
      { schema: 'ai', name: 'odds_api_dispatches' },
      // Contract 188. The lab's decision log, including the decision NOT to
      // bet. Internal for the same reason every other `ai` table is: no
      // browser role reads this schema, and the one admin surface over it is
      // a bounded SECURITY DEFINER RPC on the competition-admin gate.
      { schema: 'ai', name: 'recommendations' },
      // Contract 188. Every identity correction, append-only, and every
      // forecast quarantined because it was built on a broken one. Internal
      // for the same reason: they are the lab's own audit of itself, and the
      // Bet Builder reads them only through `ai.valid_predictions` inside a
      // definer RPC.
      { schema: 'ai', name: 'provider_identity_repairs' },
      { schema: 'ai', name: 'prediction_invalidations' },
      // Contract 206. Append-only evidence of every fixture status the
      // platform moved on a provider's word.
      { schema: 'predictor_internal', name: 'season_fixture_lifecycle_transitions' },
    ])
    for (const table of internal) {
      expect(publicTables.has(table.name)).toBe(false)
    }
  })
})

type FunctionDefinition = { migration: string; header: string }

/** Last definition wins, exactly as append-only migrations apply. */
function latestFunctionDefinitions(): Map<string, FunctionDefinition> {
  const latest = new Map<string, FunctionDefinition>()
  for (const migration of migrationFiles()) {
    const source = statementsOf(migration)
    const pattern = /create (?:or replace )?function\s+(?:([a-z_0-9]+)\.)?([a-z_0-9]+)\s*\(/gi
    for (const match of source.matchAll(pattern)) {
      const rest = source.slice(match.index)
      const bodyStart = rest.search(/\bas\s*\$/i)
      if (bodyStart < 0) continue
      const qualifiedName = `${match[1] ?? 'public'}.${match[2]}`
      latest.set(qualifiedName, { migration, header: rest.slice(0, bodyStart) })
    }
  }
  return latest
}

const definitions = latestFunctionDefinitions()
const definerFunctions = [...definitions].filter(([, definition]) =>
  /security definer/i.test(definition.header),
)

describe('security definer functions', () => {
  it('parses a plausible number of definer functions at all', () => {
    expect(definitions.size).toBeGreaterThanOrEqual(143)
    expect(definerFunctions.length).toBeGreaterThanOrEqual(127)
  })

  it('pins search_path on every one of them', () => {
    const unpinned = definerFunctions
      .filter(([, definition]) => !/set\s+search_path/i.test(definition.header))
      .map(([name, definition]) => `${definition.migration} :: ${name}`)
      .sort()

    expect(unpinned).toEqual([])
  })

  it('resolves redefinitions to the latest one', () => {
    const redefined = 'public.enforce_entry_lock_generic'
    const occurrences = migrationFiles().filter((migration) =>
      new RegExp(
        `create (?:or replace )?function\\s+(?:public\\.)?${redefined.replace(/^public\./, '')}\\b`,
        'i',
      ).test(sourceOf(migration)),
    )

    expect(occurrences).toEqual([
      '20260719170000_lock_and_leaderboard.sql',
      '20260723174500_harden_entry_lock_functions.sql',
      '20260727174658_automatic_entry_submission.sql',
      '20260730235602_stage_c1_competition_season_foundation.sql',
      '20260803070000_c1b_game_catalogue_memberships.sql',
    ])

    expect(sourceOf(at(occurrences, 0))).not.toMatch(
      /enforce_entry_lock_generic[\s\S]{0,200}set search_path/i,
    )
    expect(definitions.get(redefined)?.migration).toBe(occurrences.at(-1))
    expect(definitions.get(redefined)?.header).toMatch(/set search_path/i)

    // This function deliberately remains SECURITY INVOKER. The trusted refresh
    // predicate therefore observes the real caller rather than the owner.
    expect(definitions.get(redefined)?.header).not.toMatch(/security definer/i)
  })

  it('stops the header at the function body', () => {
    expect(definitions.get('public._stage_ord')?.header).not.toMatch(/security definer/i)
  })
})
