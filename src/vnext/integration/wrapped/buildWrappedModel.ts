import {
  correctOutcomeRate,
  exactScoreRate,
} from '../../../services/supabase/seasonWrappedModel'
import type { SeasonWrappedBody, SeasonWrappedModel } from '../../models/wrapped'
import type { WrappedSource } from './wrappedSource'

/**
 * `WrappedSource` → `SeasonWrappedModel`. PURE.
 *
 * ============================ IT COMPUTES NOTHING ========================
 *
 * Points, rank, field size, matchweeks, exact scores, correct outcomes, the
 * best matchweek and the joker count are copied across unchanged. The archive
 * is immutable by trigger precisely so that this mapping can be a copy, and a
 * mapper that adjusted any of them would make the same season read differently
 * on the day somebody changed this file.
 *
 * The two shares are the ONE piece of arithmetic on this path, and they are
 * imported from the service that owns the model rather than re-divided here.
 * They are null when nothing was predicted, so a season somebody entered and
 * never played prints no percentage rather than `NaN%` or a confident zero.
 *
 * ============================ AND NO PERCENTILE ==========================
 *
 * `rank` and `fieldSize` are both here and dividing them would be trivial. It
 * is not done, and that is deliberate: a percentile computed in a browser is a
 * number the archive never agreed to, and it would be the one figure on a
 * "this does not change" page that changed.
 */
function bodyOf(source: WrappedSource): SeasonWrappedBody {
  const wrapped = source.wrapped
  if (wrapped === null) return { kind: 'unavailable' }
  if (!wrapped.finalised) return { kind: 'pending' }

  return {
    kind: 'wrapped',
    result: {
      season: {
        points: wrapped.season.points,
        rank: wrapped.season.rank,
        fieldSize: wrapped.season.fieldSize,
        matchweeksPlayed: wrapped.season.matchweeksPlayed,
      },
      best: wrapped.bestMatchweek,
      accuracy: {
        fixturesPredicted: wrapped.accuracy.fixturesPredicted,
        exactScores: wrapped.accuracy.exactScores,
        correctOutcomes: wrapped.accuracy.correctOutcomes,
        exactShare: exactScoreRate(wrapped.accuracy),
        correctShare: correctOutcomeRate(wrapped.accuracy),
      },
      jokersPlayed: wrapped.jokersPlayed,
      finalisedAt: wrapped.finalisedAt,
    },
  }
}

export function buildWrappedModel(source: WrappedSource): SeasonWrappedModel {
  return {
    generatedAt: source.generatedAt,
    context: {
      competitionName: source.competitionName,
      seasonLabel: source.seasonLabel,
      playerName: source.playerName,
    },
    body: bodyOf(source),
  }
}
