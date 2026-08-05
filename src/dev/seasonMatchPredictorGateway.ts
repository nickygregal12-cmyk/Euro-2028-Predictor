import { resolveLockState } from '../domain/competition/lockState'
import { seasonJokerAllowance } from '../domain/season/scoring'
import { mainPredictorLockPolicy } from '../domain/competition/game'
import type { CardStatus } from '../domain/season/cardSubmission'
import type { ScorelinePrediction } from '../domain/season/scoring'
import type {
  MatchPredictorCommand,
  MatchPredictorFixture,
  MatchPredictorGateway,
  MatchPredictorPage,
} from '../features/season/matchPredictorModel'
import { VersionConflictError } from '../services/supabase/writeConflict'
import {
  MATCHWEEK_COUNT,
  SEASON_CONFIG,
  fixturesForMatchweek,
  matchweekScopeId,
} from './seasonPreviewFixture'

/**
 * A fixture-backed gateway for the season Match Predictor.
 *
 * WHY THIS EXISTS RATHER THAN A SUPABASE IMPLEMENTATION. There is no browser
 * path to season data: `season_fixtures`, `season_predictions` and
 * `season_matchweek_jokers` each have RLS enabled with every grant revoked from
 * `authenticated`, and `get_season_leaderboard` is the only season function a
 * browser role may call. The fixtures migration states the intent — reads
 * "arrive through a bounded RPC when the season surfaces land". So the real
 * gateway is blocked on backend work with its own migration, parity and rollout
 * gates, and this one lets the surface be built, reviewed and tested now.
 *
 * The rules it applies are real: the lock comes from `resolveLockState` through
 * the Main Predictor's own game-owned policy, and the Joker allowance comes from
 * `seasonJokerAllowance`. Only the storage is synthetic. That is the same
 * division the DEV season preview already draws — "the rules on this page are
 * real and the data is not".
 *
 * It also has to be able to misbehave on purpose. A page that only ever sees a
 * healthy backend cannot demonstrate its unavailable, failed-save or conflict
 * states, and those are the states the release gate asks for. Hence `scenario`.
 */

export type GatewayScenario =
  | 'healthy'
  | 'slow'
  | 'load_failure'
  | 'save_failure'
  | 'version_conflict'
  | 'no_fixtures'

export type GatewayOptions = {
  scenario?: GatewayScenario
  /** Injected clock. Never read ambiently, so a test can sit before or after a lock. */
  now: Date
  /** Seed predictions, keyed by fixture id. */
  predictions?: Readonly<Record<string, ScorelinePrediction>>
  cardStatus?: CardStatus
  jokerPlayed?: boolean
  jokersUsedThisHalf?: number
}

const SLOW_MS = 1200

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function shortName(name: string): string {
  return name.length <= 12 ? name : `${name.slice(0, 11)}…`
}

export function createSeasonMatchPredictorGateway(options: GatewayOptions): MatchPredictorGateway {
  const scenario = options.scenario ?? 'healthy'
  const predictions = new Map<string, ScorelinePrediction | null>(
    Object.entries(options.predictions ?? {}),
  )
  let cardStatus: CardStatus = options.cardStatus ?? 'no_submission'
  let jokerPlayed = options.jokerPlayed ?? false
  let jokersUsedThisHalf = options.jokersUsedThisHalf ?? 0

  return {
    async load(matchweek: number): Promise<MatchPredictorPage> {
      if (scenario === 'slow') await delay(SLOW_MS)
      if (scenario === 'load_failure') {
        throw new Error('The season fixture list could not be reached.')
      }

      const seasonFixtures = scenario === 'no_fixtures' ? [] : fixturesForMatchweek(matchweek)
      const policy = mainPredictorLockPolicy(MATCHWEEK_COUNT)

      // The lock is resolved by the domain from real kickoffs, not asserted here.
      const lock = resolveLockState(
        {
          id: matchweekScopeId(matchweek),
          type: policy.scope,
          bufferMinutes: policy.bufferMinutes,
          previouslyLocked: false,
          fixtureData:
            seasonFixtures.length === 0
              ? null
              : {
                  // `validUntil` is what makes the lock fail closed on stale
                  // data, so it is taken from the season bounds rather than
                  // invented: an observation that expires before the fixture it
                  // describes would lock every matchweek as stale.
                  observedAt: SEASON_CONFIG.bounds.startsAt,
                  validUntil: SEASON_CONFIG.bounds.endsAt,
                  fixtures: seasonFixtures.map((fixture) => ({
                    id: fixture.id,
                    kickoffAt: fixture.kickoffAt,
                  })),
                },
        },
        options.now,
      )

      const allowance = seasonJokerAllowance(MATCHWEEK_COUNT)
      const remainingThisHalf =
        allowance === null ? 0 : Math.max(0, allowance.perHalf - jokersUsedThisHalf)

      const fixtures: MatchPredictorFixture[] = seasonFixtures.map((fixture) => ({
        fixtureId: fixture.id,
        kickoffAt: fixture.kickoffAt,
        home: {
          name: fixture.home.name,
          shortName: shortName(fixture.home.name),
          tokens: fixture.home.tokens,
        },
        away: {
          name: fixture.away.name,
          shortName: shortName(fixture.away.name),
          tokens: fixture.away.tokens,
        },
        prediction: predictions.get(fixture.id) ?? null,
        result: null,
        points: null,
      }))

      return {
        competition: {
          name: SEASON_CONFIG.name,
          seasonLabel: 'Main Predictor',
          timeZone: SEASON_CONFIG.competitionTimeZone,
        },
        matchweek: { number: matchweek, of: MATCHWEEK_COUNT },
        fixtures,
        cardStatus,
        lock,
        joker: {
          playedHere: jokerPlayed,
          remainingThisHalf,
          playable: remainingThisHalf > 0,
        },
        settledPoints: null,
      }
    },

    async apply(_matchweek: number, command: MatchPredictorCommand): Promise<void> {
      if (scenario === 'slow') await delay(SLOW_MS)
      if (scenario === 'version_conflict') {
        // The real gateway raises this from PostgREST's PT409; the shape is what
        // `isVersionConflict` classifies, so the page's conflict path is the
        // same one production will take.
        throw new VersionConflictError()
      }
      if (scenario === 'save_failure') {
        throw new Error('The prediction could not be saved.')
      }

      switch (command.kind) {
        case 'setPrediction':
          predictions.set(command.fixtureId, command.prediction)
          if (cardStatus === 'no_submission') cardStatus = 'provisional'
          break
        case 'setJoker':
          jokerPlayed = command.played
          jokersUsedThisHalf = Math.max(0, jokersUsedThisHalf + (command.played ? 1 : -1))
          break
        case 'confirmCard':
          cardStatus = 'confirmed'
          break
      }
    },
  }
}
