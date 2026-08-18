import type {
  SeasonProfileMatchweek,
  SeasonPlayerProfile,
} from '../../../services/supabase/seasonPlayerProfileModel'
import type { SeasonRankHistory } from '../../../services/supabase/seasonRankHistoryModel'
import type {
  SeasonRivalry,
  SeasonRivalrySide,
} from '../../../services/supabase/seasonRivalryModel'
import type {
  PlayerAccuracy,
  PlayerProfileDetail,
  PlayerProfileModel,
  PlayerProfilePanel,
  ProfileMatchweek,
  ProfileMatchweekResult,
  ProfilePick,
  RankHistoryPanel,
  RankPoint,
  RivalryDetail,
  RivalryMatchweek,
  RivalryPanel,
  RivalrySide,
} from '../../models/playerProfile'
import type { PlayerProfileSource } from './playerProfileSource'

/**
 * `PlayerProfileSource` → `PlayerProfileModel`. PURE: no network, no storage,
 * no clock and no React — the four rules every vNext mapper is written under.
 *
 * ============================ IT DECIDES NO PERMISSION ===================
 *
 * Every state in the output is already a state in the input. This file converts
 * payloads into presentation shapes and maps `failed` onto `unavailable`; it
 * never reads a `reach`, never compares two identifiers to decide whether
 * something may be shown, and never turns one read's refusal into another's.
 * The three panels stay independent because their three server boundaries are.
 *
 * ============================ IT REVEALS NOTHING THE SERVER WITHHELD =====
 *
 * Contract 151 OMITS a matchweek that has not passed its own lock rather than
 * emptying it, so the history this file receives is already the revealed
 * history. Two rules follow and both are held here:
 *
 *   • nothing is inferred from a gap — a missing matchweek is "not yet
 *     revealed" or "they did not play it" and the payload does not say which,
 *     so no count, no percentage and no "n of m" is built from the list;
 *   • a present-but-unsettled matchweek becomes `pending`, NEVER zero points.
 *     Null-coalescing it would tell a player they scored nothing in a matchweek
 *     nobody has marked yet.
 *
 * ============================ IT COMPUTES NO RANK, RATE OR RECORD ========
 *
 * No sorting, no renumbering, no deriving a rank from points, no tallying a
 * head-to-head record off the recent window, no dividing to make a percentage.
 * `matchweeksCompared` is carried as the server stated it precisely because the
 * window it summarises is truncated.
 */

function accuracyOf(side: SeasonRivalrySide): PlayerAccuracy {
  return {
    fixturesPredicted: side.accuracy.fixturesCompared,
    exactScores: side.accuracy.exactScores,
    correctOutcomes: side.accuracy.correctOutcomes,
  }
}

function rivalrySide(side: SeasonRivalrySide): RivalrySide {
  return {
    playerRef: side.playerRef,
    displayName: side.displayName,
    points: side.points,
    matchweeksPlayed: side.matchweeksPlayed,
    standing: side.standing,
    accuracy: accuracyOf(side),
  }
}

/**
 * A MATCHWEEK'S RESULT, WHICH IS NOT A NULLABLE NUMBER.
 *
 * The service model carries `points: number | null` because that is what the
 * payload says. Here it becomes two cases, so that everything downstream has to
 * choose a sentence rather than a fallback value.
 */
function resultOf(matchweek: SeasonProfileMatchweek): ProfileMatchweekResult {
  return matchweek.points === null
    ? { kind: 'pending' }
    : { kind: 'settled', points: matchweek.points }
}

/**
 * Picks, in a stable order.
 *
 * Sorted BY FIXTURE ID rather than left in object-key order, because
 * `Object.entries` follows insertion order over a payload that never promised
 * one — and an unstable order makes a diffed list re-key on every render. The
 * order is a presentation decision about a set, not a ranking of anything.
 */
function picksOf(matchweek: SeasonProfileMatchweek): readonly ProfilePick[] {
  return Object.entries(matchweek.predictions)
    .map(([fixtureId, score]) => ({ fixtureId, home: score.home, away: score.away }))
    .sort((left, right) => left.fixtureId.localeCompare(right.fixtureId))
}

function historyOf(profile: SeasonPlayerProfile): readonly ProfileMatchweek[] {
  // The server ordered this most-recent-first and bounded it at forty. Not
  // re-sorted: a second ordering authority agrees until the day it does not.
  return profile.history.map(
    (matchweek): ProfileMatchweek => ({
      matchweekId: matchweek.matchweekId,
      ordinal: matchweek.ordinal,
      label: matchweek.label,
      result: resultOf(matchweek),
      jokerPlayed: matchweek.jokerPlayed,
      picks: picksOf(matchweek),
    }),
  )
}

function detailOf(profile: SeasonPlayerProfile): PlayerProfileDetail {
  return {
    summary: profile.season,
    accuracy: profile.accuracy,
    jokers: profile.jokers,
    history: historyOf(profile),
  }
}

function profilePanel(source: PlayerProfileSource): PlayerProfilePanel {
  const read = source.profile
  if (read.kind === 'refused') return { kind: 'refused' }
  if (read.kind === 'failed') return { kind: 'unavailable' }
  // `entered: false` is a fact about the PLAYER that contract 151 returns
  // deliberately — a private-league co-member who never joined this season's
  // game. Not a refusal, and not an empty profile.
  if (!read.profile.entered) return { kind: 'not-entered' }
  return { kind: 'profile', detail: detailOf(read.profile) }
}

function seriesOf(history: SeasonRankHistory): readonly RankPoint[] {
  // Every point already carries both a rank and the field it was out of; the
  // decoder drops a point that states only one, because a gap in a line is
  // visible and a fabricated point is not.
  return history.matchweeks.map((point) => ({
    matchweekId: point.matchweekId,
    ordinal: point.ordinal,
    label: point.label,
    rank: point.rank,
    fieldSize: point.fieldSize,
    points: point.points,
  }))
}

function rankHistoryPanel(source: PlayerProfileSource): RankHistoryPanel {
  const read = source.rankHistory
  switch (read.kind) {
    case 'unaddressable':
      return { kind: 'unaddressable' }
    case 'not-entered':
      return { kind: 'not-entered' }
    case 'refused':
      return { kind: 'refused' }
    case 'failed':
      return { kind: 'unavailable' }
    default:
      return { kind: 'history', series: seriesOf(read.history) }
  }
}

function recentOf(rivalry: SeasonRivalry): readonly RivalryMatchweek[] {
  return rivalry.recent.map(
    (matchweek): RivalryMatchweek => ({
      matchweekId: matchweek.matchweekId,
      ordinal: matchweek.ordinal,
      label: matchweek.label,
      yourPoints: matchweek.yourPoints,
      theirPoints: matchweek.theirPoints,
      outcome: matchweek.outcome,
    }),
  )
}

function rivalryDetail(rivalry: SeasonRivalry): RivalryDetail {
  return {
    // Stated by the server, never counted off `recent` — which is truncated.
    matchweeksCompared: rivalry.matchweeksCompared,
    you: rivalrySide(rivalry.you),
    them: rivalrySide(rivalry.opponent),
    // Positive means THEY are ahead. Carried unflipped.
    pointsGap: rivalry.pointsGap,
    yourWins: rivalry.record.yourWins,
    theirWins: rivalry.record.theirWins,
    draws: rivalry.record.draws,
    recent: recentOf(rivalry),
  }
}

function rivalryPanel(source: PlayerProfileSource): RivalryPanel {
  const read = source.rivalry
  switch (read.kind) {
    case 'self':
      return { kind: 'self' }
    case 'unaddressable':
      return { kind: 'unaddressable' }
    case 'not-entered':
      return { kind: 'not-entered' }
    case 'refused':
      return { kind: 'refused' }
    case 'failed':
      return { kind: 'unavailable' }
    default:
      return { kind: 'rivalry', detail: rivalryDetail(read.rivalry) }
  }
}

/**
 * WHO THE SERVER SAYS THIS IS, BY A STATED PRIORITY.
 *
 * The doorway carries no display name — Stage 9's intent has no field for one —
 * so the heading has to come from a read. Three reads carry a name and they can
 * disagree only if the server is inconsistent; picking in a FIXED ORDER rather
 * than "whichever landed" makes the heading deterministic, which matters
 * because two of the three can refuse independently and a page whose title
 * depended on load order would rename the player between renders.
 *
 * Contract 151 first because it is the narrowest boundary and therefore the
 * most authoritative answer available; then the rivalry's opponent side; then
 * the rank history. `null` where none answered, because a page that does not
 * know who it is about must say so rather than invent a label.
 */
function headingName(source: PlayerProfileSource): string | null {
  if (source.profile.kind === 'ok') return source.profile.profile.player.displayName
  if (source.rivalry.kind === 'ok') return source.rivalry.rivalry.opponent.displayName
  if (source.rankHistory.kind === 'ok') return source.rankHistory.history.displayName
  return null
}

export function buildPlayerProfileModel(source: PlayerProfileSource): PlayerProfileModel {
  const { target } = source

  return {
    generatedAt: source.generatedAt,
    context: {
      competitionName: source.context.competitionName,
      seasonLabel: source.context.seasonLabel,
      gameName: source.context.gameName,
    },
    heading: {
      // THE SERVER'S NAME, BY A FIXED PRIORITY. Never the caller's — the
      // doorway has none to give. See `headingName`.
      displayName: headingName(source),
      address: { ref: target.ref, playerId: target.playerId },
      isYou: target.isYou,
    },
    profile: profilePanel(source),
    rankHistory: rankHistoryPanel(source),
    rivalry: rivalryPanel(source),
  }
}
