// Assembles a ShareCardModel from the live providers (tournament data +
// predictions + auth), so every share entry point (Review, Home, league) builds
// the card the same way. Context-specific bits come in via opts: a league name
// (recruitment variant), brag numbers (unlocks the brag variant), the golden
// boot name, an override URL. Cheap to compute — no memo needed; the ShareSheet
// captures the model when it opens so the canvas doesn't redraw on every render.

import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { usePredictions } from '../../app/providers/PredictionsProvider'
import { useAuth } from '../auth/AuthProvider'
import { buildBracketPipeline } from '../bracket/bracketPipeline'
import { sumGroupGoals } from '../../domain/tournament/groupGoals'
import { isEntryLocked } from '../../domain/tournament/entryLock'
import { survivorsFromRounds } from './buildShareModel'
import { availableShareVariants, type ShareCardModel, type ShareVariant } from './shareModel'

export type ShareModelOpts = {
  leagueName?: string | null
  brag?: { points: number; rank: number | null; total: number } | null
  championEliminated?: boolean
  goldenBootName?: string | null
  url?: string
}

export function useShareModel(opts: ShareModelOpts = {}): {
  model: ShareCardModel | null
  variants: ShareVariant[]
} {
  const data = useTournamentData()
  const preds = usePredictions()
  const auth = useAuth()

  if (data.status !== 'ready' || !preds.ready) return { model: null, variants: [] }
  const td = data.data
  const bracket = buildBracketPipeline(td, preds.getPrediction, preds.tieResolutions, preds.bracketProgression)
  const groupMatches = td.matches.filter((m) => m.round === 'group')
  const goals = sumGroupGoals(groupMatches.map((m) => preds.getPrediction(m.id)))
  const locked = isEntryLocked(td.tournament.lockAt)

  const teamsById = new Map(td.teams.map((t) => [t.id, t]))
  const teamOf = (id: string) => {
    const t = teamsById.get(id)
    return t ? { name: t.name, countryCode: '' } : null
  }
  const finalTie = bracket.rounds.find((r) => r.key === 'FINAL')?.ties[0]
  const finalists: ShareCardModel['finalists'] =
    finalTie && finalTie.home.kind === 'team' && finalTie.away.kind === 'team'
      ? [
          { name: finalTie.home.name, countryCode: finalTie.home.countryCode },
          { name: finalTie.away.name, countryCode: finalTie.away.countryCode },
        ]
      : null

  const model: ShareCardModel = {
    header: { playerName: auth.displayName ?? 'You', locked, leagueName: opts.leagueName ?? null },
    champion: bracket.champion
      ? { name: bracket.champion.name, countryCode: bracket.champion.countryCode, eliminated: opts.championEliminated }
      : null,
    finalists,
    venue: null,
    dateLabel: null,
    stats: { goalsPredicted: goals.total, jokersArmed: preds.jokerCount },
    awards: { goldenBootName: opts.goldenBootName ?? null, groupGoals: goals.total },
    survivors: survivorsFromRounds(bracket.rounds, teamOf),
    brag: opts.brag ?? null,
    url: opts.url ?? (typeof window !== 'undefined' ? window.location.origin : ''),
  }
  const variants = availableShareVariants({
    championPicked: bracket.champion !== null,
    entryComplete: preds.submittedAt !== null,
    // Brag numbers are only supplied once the tournament is under way.
    tournamentStarted: !!opts.brag,
  })
  return { model, variants }
}
