import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  expectedLockScopeCount,
  lastManStandingLockPolicy,
  mainPredictorLockPolicy,
  originalPredictorLockPolicy,
  type GameLockPolicy,
} from '../../src/domain/competition/game'
import type {
  LeagueSeasonCompetitionConfig,
  TournamentCompetitionConfig,
} from '../../src/domain/competition/kinds'

/**
 * The persisted game catalogue and the lock engine must name the same scope.
 *
 * Contract 66 seeded `main_predictor` and `last_man_standing` with
 * `lock_scope = 'round'`. The engine returns null for 'round' — deliberately,
 * because no game locks by knockout round through it — and `context.ts` turns
 * that null into FAIL_CLOSED_LOCK_POLICY, under which nothing ever unlocks.
 * Nothing read `lock_scope` yet, so nothing was broken; but the first code to
 * read it would have locked every matchweek of the domestic season forever,
 * with no error explaining why.
 *
 * Contract 67 moves both games to 'matchweek'. This file exists so the two
 * authorities cannot drift apart again, in the family of `scoringValueParity`
 * and `enumUnionParity`.
 *
 * Text-based over the committed migrations, so it needs no database.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')

/** Every migration, oldest first — the order the database applies them in. */
const migrations = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))

const allSql = migrations.join('\n')

/**
 * The effective lock scope of a game, after every migration.
 *
 * The seed row supplies the original value and later `update` statements
 * override it, so the value is read in migration order rather than from the
 * insert alone — reading only the seed would have reported 'round' and passed
 * while the database said something else.
 */
function effectiveLockScope(gameKey: string): string | null {
  let scope: string | null = null

  for (const sql of migrations) {
    const seeded = new RegExp(
      `\\('${gameKey}',\\s*'[^']*',\\s*(?:true|false),\\s*'([a-z]+)'`,
      'i',
    ).exec(sql)
    if (seeded !== null) scope = seeded[1]

    // `update ... set lock_scope = 'x' where game_key in (...)`
    for (const update of sql.matchAll(
      /update\s+public\.game_definitions\s+set\s+lock_scope\s*=\s*'([a-z]+)'\s+where\s+game_key\s+in\s*\(([^)]*)\)/gi,
    )) {
      if (update[2].includes(`'${gameKey}'`)) scope = update[1]
    }
  }

  return scope
}

const SEASON: LeagueSeasonCompetitionConfig = {
  id: 'premier-league-2026-27',
  name: 'Premier League 2026/27',
  kind: 'league_season',
  competitionTimeZone: 'Europe/London',
  bounds: { startsAt: '2026-08-01T00:00:00Z', endsAt: '2027-05-31T23:59:59Z' },
  primaryStage: 'league',
  progression: 'rolling_matchweeks',
  matchweeks: { count: 38 },
}

const TOURNAMENT: TournamentCompetitionConfig = {
  id: 'euro-2028',
  name: 'Euro 2028',
  kind: 'tournament',
  competitionTimeZone: 'Europe/London',
  bounds: { startsAt: '2028-06-09T00:00:00Z', endsAt: '2028-07-09T23:59:59Z' },
  primaryStage: 'groups',
  progression: 'groups_to_knockout',
  groupStage: { groupCount: 6, matchdayCount: 3 },
  knockoutStage: { roundCount: 4 },
}

/** Each persisted game, the policy the engine builds, and where it runs. */
const GAMES: {
  gameKey: string
  policy: GameLockPolicy
  config: LeagueSeasonCompetitionConfig | TournamentCompetitionConfig
}[] = [
  { gameKey: 'original_predictor', policy: originalPredictorLockPolicy(), config: TOURNAMENT },
  { gameKey: 'main_predictor', policy: mainPredictorLockPolicy(38), config: SEASON },
  { gameKey: 'last_man_standing', policy: lastManStandingLockPolicy(38), config: SEASON },
]

describe('the parser reads the catalogue it claims to', () => {
  it('finds every seeded game, so the assertions below are not vacuous', () => {
    for (const gameKey of ['original_predictor', 'main_predictor', 'ko_predictor', 'predictor_cup']) {
      expect(effectiveLockScope(gameKey), `no seeded lock scope found for ${gameKey}`).not.toBeNull()
    }
  })

  it('applies a later update rather than stopping at the seed', () => {
    // Reading only the insert would report contract 66's 'round' and pass while
    // the database said 'matchweek'. This is the assertion that catches that.
    expect(allSql).toMatch(/update\s+public\.game_definitions\s+set\s+lock_scope/i)
    expect(effectiveLockScope('main_predictor')).toBe('matchweek')
  })
})

describe('SQL and the lock engine name the same scope', () => {
  it.each(GAMES.map((game) => [game.gameKey, game] as const))(
    '%s',
    (_key, { gameKey, policy }) => {
      expect(
        effectiveLockScope(gameKey),
        `the catalogue and src/domain/competition/game.ts disagree about ${gameKey}: ` +
          `changing one without the other is how the fail-closed trap returns`,
      ).toBe(policy.scope)
    },
  )
})

describe('no persisted scope can fail the engine closed', () => {
  it.each(GAMES.map((game) => [game.gameKey, game] as const))(
    '%s resolves a real scope count',
    (_key, { policy, config }) => {
      // This is the defect itself, not a restatement of it: a null here reaches
      // context.ts, which substitutes FAIL_CLOSED_LOCK_POLICY and never unlocks.
      expect(
        expectedLockScopeCount(config, policy),
        `${policy.scope} resolves to no scope count for a ${config.kind}, so the ` +
          `game would fail closed and never unlock`,
      ).not.toBeNull()
    },
  )

  it('still refuses a knockout round, which is what round means', () => {
    // The fix widened the database rather than collapsing the engine's two
    // scopes into synonyms. If 'round' ever starts resolving, that distinction
    // has been lost and this file is no longer guarding anything.
    expect(
      expectedLockScopeCount(SEASON, { scope: 'round', scopeCount: 38, bufferMinutes: 0 }),
    ).toBeNull()
  })
})

describe('the constraint permits every scope in use', () => {
  it('allows matchweek, so the seeded values are legal', () => {
    const constraint = /check \(lock_scope in \(([^)]*)\)\)/gi
    const permitted = [...allSql.matchAll(constraint)].at(-1)?.[1] ?? ''

    expect(permitted, 'no lock_scope check constraint found').not.toBe('')
    for (const { gameKey } of GAMES) {
      const scope = effectiveLockScope(gameKey)
      expect(permitted, `${gameKey} uses ${scope}, which the constraint forbids`).toContain(
        `'${scope}'`,
      )
    }
  })
})
