import type { CompetitionContext } from '../../domain/competition/context'
import type { FixtureGroup } from '../../domain/tournament/matchesTab'
import type { Match, TournamentData } from '../../services/supabase/tournamentData'
import { resolveTournamentCompetitionContext } from './tournamentCompetitionContext'

const ENTRY_LOCK_SCOPE_ID = 'matches-entry'

export type MatchesCompetitionContextInput = {
  data: TournamentData
  groups: FixtureGroup<Match>[]
  submitted: boolean
  nowServer: Date
  timeZone: string
}

export type MatchesCompetitionContextResult = {
  context: CompetitionContext
  currentGroupIndex: number
}

function parseInstant(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isoInstant(value: Date): string | null {
  const time = value.getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function currentFrontIndex(
  groups: FixtureGroup<Match>[],
  context: CompetitionContext,
  nowServer: Date,
): number {
  if (groups.length === 0) return 0
  const nowMs = nowServer.getTime()
  const resolvedById = new Map(context.matches.map((match) => [match.id, match]))
  const index = groups.findIndex((group) =>
    group.matches.some((match) => {
      const kickoffAt = parseInstant(resolvedById.get(match.id)?.kickoffAt)
      return kickoffAt !== null && kickoffAt >= nowMs
    }),
  )
  return index === -1 ? groups.length - 1 : index
}

/**
 * Maps the shared tournament competition context back to the unchanged Matches
 * current-front index contract. Match-card temporal presentation remains owned
 * by the later Match Centre migration.
 */
export function resolveMatchesCompetitionContext(
  input: MatchesCompetitionContextInput,
): MatchesCompetitionContextResult {
  const observedAt = isoInstant(input.nowServer)
  const context = resolveTournamentCompetitionContext({
    data: input.data,
    lockScopeId: ENTRY_LOCK_SCOPE_ID,
    submitted: input.submitted,
    nowServer: input.nowServer,
    timeZone: input.timeZone,
    fixtureFreshness:
      observedAt === null ? null : { observedAt, validUntil: observedAt },
  })

  return {
    context,
    currentGroupIndex: currentFrontIndex(input.groups, context, input.nowServer),
  }
}
