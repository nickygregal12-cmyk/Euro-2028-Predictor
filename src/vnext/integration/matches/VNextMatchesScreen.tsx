import { useMemo } from 'react'
import { useCompetitionTable } from '../../../features/season/useCompetitionTable'
import { VNextMatches } from '../../matches/VNextMatches'
import type { MatchesIntent, MatchesView } from '../../matches/VNextMatches'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import { buildMatchesLeagueTable } from './buildMatchesLeagueTable'
import { buildMatchesModel } from './buildMatchesModel'
import {
  useVNextMatchesSource,
  type VNextMatchesSourceInput,
} from './useVNextMatchesSource'
import { VNextMatchesLoading, VNextMatchesNotice } from './VNextMatchesStates'

/**
 * THE CONNECTED vNEXT MATCHES SURFACE.
 *
 * It acquires the fixture list plus ONE optional, independently-failable piece
 * of context: contract 160's existing competition table. The table read lives
 * here rather than inside presentation because the route owns reads; no second
 * standings authority or browser-calculated table is introduced.
 *
 * `VNextMatches({ model })` STAYS USABLE WITHOUT ANY OF THIS. Storybook and
 * deterministic render tests still hand the page a fixture model directly and
 * get an unavailable table by default.
 */
export type VNextMatchesScreenProps = VNextMatchesSourceInput & {
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
  readonly onIntent?: ((intent: MatchesIntent) => void) | undefined
  readonly initialView?: MatchesView | undefined
}

export function VNextMatchesScreen(props: VNextMatchesScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const state = useVNextMatchesSource(props)

  const model = useMemo(
    () => (state.status === 'ready' ? buildMatchesModel(state.source) : null),
    [state],
  )

  /**
   * ONE EXTRA REQUEST, ONLY WHEN A REAL COMPETITION HAS RESOLVED.
   *
   * Lazy-importing the service preserves the vNext visual/testing boundary and
   * the memo keeps the read function stable, so `useCompetitionTable` does not
   * refetch on every render. Non-league formats are refused by the existing RPC;
   * the shared hook turns that independent refusal/failure into table state
   * without costing the fixtures themselves.
   */
  const tableRead = useMemo(() => {
    if (state.status !== 'ready') return undefined
    const tournamentId = state.source.competition.tournamentId
    return () =>
      import('../../../services/supabase/competitionTable').then(({ fetchCompetitionTable }) =>
        fetchCompetitionTable(tournamentId),
      )
  }, [state])
  const tableAnswer = useCompetitionTable(tableRead)
  const leagueTable = useMemo(
    () => buildMatchesLeagueTable(tableAnswer),
    [tableAnswer],
  )

  const shell = useMemo(
    () =>
      state.status === 'ready' && model
        ? buildShellModel({
            competition: {
              tournamentId: state.source.competition.tournamentId,
              name: state.source.competition.name,
              seasonLabel: state.source.competition.seasonLabel,
              colours: model.competition.colours,
            },
            playerName: null,
            outstandingPredictions: null,
            canNavigateAway: props.onShellIntent !== undefined,
            elsewhere,
          })
        : null,
    [state, model, props.onShellIntent, elsewhere],
  )

  const body =
    state.status === 'loading' ? (
      <VNextMatchesLoading />
    ) : state.status === 'signedOut' ? (
      <VNextMatchesNotice
        title="Sign in to see the football"
        body="Fixtures belong to a competition season, and a season is reached from your account."
      />
    ) : state.status === 'noCompetition' ? (
      <VNextMatchesNotice
        title="No competition to show"
        body="Pick a competition and season, and this is where its matches will be."
      />
    ) : state.status === 'failed' ? (
      <VNextMatchesNotice
        title="We could not load these matches"
        body="The fixtures are there — we just could not read them just now. Trying again usually works."
        onRetry={state.retry}
      />
    ) : model ? (
      <VNextMatches
        model={model}
        leagueTable={leagueTable}
        initialView={props.initialView}
        onIntent={props.onIntent}
      />
    ) : (
      <VNextMatchesLoading />
    )

  return shell === null ? (
    body
  ) : (
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextShellProvider>
  )
}