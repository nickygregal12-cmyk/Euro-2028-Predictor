import { useMemo } from 'react'
import { VNextMatchCentre } from '../../matches/VNextMatchCentre'
import type { MatchCentreIntent } from '../../matches/VNextMatchCentre'
import { VNextShellProvider } from '../../app/VNextShellProvider'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import { buildMatchCentreModel } from './buildMatchCentreModel'
import {
  useVNextMatchCentreSource,
  type VNextMatchCentreSourceInput,
} from './useVNextMatchCentreSource'
import { VNextMatchesLoading, VNextMatchesNotice } from './VNextMatchesStates'

/**
 * THE CONNECTED vNEXT MATCH CENTRE, RESOLVED FROM A FIXTURE ID.
 *
 * ============================ `notFound` IS ITS OWN STATE =================
 *
 * And it is the state this screen exists to get right. The server REFUSES a
 * fixture that does not exist or belongs to the tournament shape, so a refusal
 * is a real answer — "this match cannot be opened" — and it is a different
 * sentence from "we could not read it just now", which offers a retry. §26
 * forbids implying a match does not exist when a read merely failed, and the
 * only way to keep that true is to have both states.
 *
 * IT NEVER SAYS "not in this window". That message was the defect contract 148
 * removed: the old route carried the fixture's day in the URL, loaded three
 * weeks around it and searched. Nothing here has a window to be outside of.
 */
export type VNextMatchCentreScreenProps = VNextMatchCentreSourceInput & {
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  /**
   * The player's OTHER competitions and what is waiting in them, where the host
   * loads them. `undefined` is the one-competition shape: the shell states this
   * page's competition and says nothing about any other, which is what a
   * page-scoped host should pass. The inbox costs reads per competition, so it
   * belongs to a host that mounts it once above the pages.
   */
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
  readonly onIntent?: ((intent: MatchCentreIntent) => void) | undefined
}

export function VNextMatchCentreScreen(props: VNextMatchCentreScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const state = useVNextMatchCentreSource(props)

  const model = useMemo(
    () => (state.status === 'ready' ? buildMatchCentreModel(state.source) : null),
    [state],
  )

  const shell = useMemo(
    () =>
      state.status === 'ready' && model
        ? buildShellModel({
            competition: {
              tournamentId: model.competition.id,
              name: model.competition.name,
              seasonLabel: model.competition.seasonLabel ?? '',
              colours: model.competition.colours,
            },
            playerName: null,
            outstandingGames: null,
            canNavigateAway: props.onShellIntent !== undefined,
            elsewhere,
          })
        : null,
    [state, model, props.onShellIntent, elsewhere],
  )

  const body =
    state.status === 'loading' ? (
      <VNextMatchesLoading title="Match Centre" />
    ) : state.status === 'signedOut' ? (
      <VNextMatchesNotice
        heading="Match Centre"
        title="Sign in to open this match"
        body="A fixture belongs to a competition season, and a season is reached from your account."
      />
    ) : state.status === 'notFound' ? (
      <VNextMatchesNotice
        heading="Match Centre"
        title="This match could not be opened"
        body="It may have been removed from the calendar, or it belongs to a different competition. The competition's own fixture list is the place to find it."
      />
    ) : state.status === 'failed' ? (
      <VNextMatchesNotice
        heading="Match Centre"
        title="We could not load this match"
        body="The match is there — we just could not read it just now. Trying again usually works."
        onRetry={state.retry}
      />
    ) : model ? (
      <VNextMatchCentre model={model} onIntent={props.onIntent} />
    ) : (
      <VNextMatchesLoading title="Match Centre" />
    )

  return shell === null ? (
    body
  ) : (
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextShellProvider>
  )
}
