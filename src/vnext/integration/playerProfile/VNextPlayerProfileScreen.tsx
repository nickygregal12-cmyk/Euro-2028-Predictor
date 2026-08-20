import { useMemo } from 'react'
import { VNextPlayerProfile } from '../../player/VNextPlayerProfile'
import { VNextConnectedShell } from '../shell/VNextConnectedShell'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import { VNextNotice } from '../../states/VNextStates'
import { buildPlayerProfileModel } from './buildPlayerProfileModel'
import {
  useVNextPlayerProfileSource,
  type VNextPlayerProfileSourceInput,
} from './useVNextPlayerProfileSource'
import { VNextPlayerProfileLoading } from './VNextPlayerProfileStates'

/**
 * THE CONNECTED vNEXT PLAYER PROFILE.
 *
 * Its whole job is the three lines in the middle: resolve the state, build the
 * model, render `VNextPlayerProfile`. It holds no layout, no panel and no copy
 * about a season — everything visible in the ready state belongs to the page,
 * and this file could not change how a profile looks without importing
 * something it does not import.
 *
 * `VNextPlayerProfile({ model })` STAYS USABLE WITHOUT ANY OF THIS, which is
 * the point of the split and is enforced by `tests/vnext/
 * vnextProductionBoundary.test.ts`. Storybook and every render test hand the
 * page a model directly.
 *
 * ============================ THE ADDRESS LIVES ABOVE THIS FILE ==========
 *
 * `playerId` and `playerRef` are INPUTS. Who is being looked at is a routing
 * decision and belongs to the host; this screen only reads about whoever it was
 * given. Both identifiers travel because they address different reads — the
 * account id opens contract 151, the season entry reference opens contract 192
 * — and neither is ever substituted for the other.
 *
 * A DISPLAY NAME IS NOT AN ADDRESS, AND THIS SCREEN NEVER RECEIVES ONE. There
 * is no name prop: the doorway emits none and the page is named by whichever
 * read answered. That is the strongest form of the social identity rule — not
 * "we do not route by the name" but "there is no name here to route by".
 *
 * ============================ WHY THE STATES ARE A SWITCH ================
 *
 * Loading, signed out, no competition, no player and failed are five different
 * sentences and four of them are not errors. Collapsing them would put
 * "something went wrong" in front of a reader who is merely signed out.
 *
 * NONE OF THEM SAYS ANYTHING ABOUT THE PLAYER. A failed read is a fact about
 * the request. "You may not see this player" is a fact about permission and
 * only the server can state it — when it does, the ready state draws the page
 * with that panel refused and the others intact.
 */
export type VNextPlayerProfileScreenProps = VNextPlayerProfileSourceInput & {
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  /**
   * The player's OTHER competitions and what is waiting in them, where the host
   * loads them. `undefined` is the one-competition shape: the shell states this
   * page's competition and says nothing about any other, which is what a
   * page-scoped host should pass. The inbox costs reads per competition, so it
   * belongs to a host that mounts it once above the pages.
   */
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
}

export function VNextPlayerProfileScreen(props: VNextPlayerProfileScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const state = useVNextPlayerProfileSource(props)

  const tournamentId = state.status === 'ready' ? state.source.context.tournamentId : null
  const { playerId } = props

  /**
   * THE ONE WRITE THIS SURFACE HAS, performed by the host — Stage 7's rule.
   *
   * `set_pinned_rival` is the AUTHORITY on who may be pinned: it requires a
   * shared private league and raises otherwise. Nothing here re-evaluates that;
   * the model decides whether a control appears from the profile read, and a
   * refusal that still reaches this point surfaces rather than being hidden
   * behind an optimistic edit — the same rule the Hub's Rival Watch records.
   */
  const actions = useMemo(
    () =>
      tournamentId === null || !playerId
        ? undefined
        : {
            setPinned: async (pinned: boolean) => {
              try {
                const { setPinnedRival } = await import(
                  '../../../services/supabase/playerPreferences'
                )
                await setPinnedRival(tournamentId, playerId, pinned)
                return { ok: true as const }
              } catch (error) {
                const { userFacingError } = await import(
                  '../../../shared/errors/userFacingError'
                )
                return {
                  ok: false as const,
                  message: userFacingError(error, 'We could not save that just now.'),
                }
              }
            },
          },
    [tournamentId, playerId],
  )

  // The mapping is pure, so it is memoised on the source rather than re-run on
  // every render — rebuilding would restamp nothing (the instant lives in the
  // source) but would give React a new identity for every row each render.
  const model = useMemo(
    () => (state.status === 'ready' ? buildPlayerProfileModel(state.source) : null),
    [state],
  )

  const shell = useMemo(
    () =>
      state.status === 'ready'
        ? buildShellModel({
            competition: {
              tournamentId: state.source.context.tournamentId,
              name: state.source.context.competitionName,
              seasonLabel: state.source.context.seasonLabel,
              // A profile has no competition palette of its own to state. The
              // shell paints the competition from whatever the host gives it,
              // and inventing one here would be a second source for a colour.
              colours: null,
            },
            // THE READER'S NAME, NOT THE SUBJECT'S. The shell's account control
            // names whoever is signed in; putting the player being looked at
            // there would tell a reader they are someone else.
            playerName: null,
            // A profile carries no prediction of the reader's, so it cannot
            // count what is outstanding. `null` is "this page cannot say".
            outstandingPredictions: null,
            canNavigateAway: props.onShellIntent !== undefined,
            elsewhere,
          })
        : null,
    [state, props.onShellIntent, elsewhere],
  )

  const body =
    state.status === 'loading' ? (
      <VNextPlayerProfileLoading />
    ) : state.status === 'signedOut' ? (
      <VNextNotice
        destination="leagues"
        heading="Player"
        title="Sign in to see this player"
        body="A player's season belongs to a competition you are both in, and a competition is reached from your account."
      />
    ) : state.status === 'noCompetition' ? (
      <VNextNotice
        destination="leagues"
        heading="Player"
        title="No competition to show"
        body="Pick a competition and season, and this is where a player's season will be."
      />
    ) : state.status === 'noPlayer' ? (
      <VNextNotice
        destination="leagues"
        heading="Player"
        title="No player to show"
        // IT DOES NOT INVITE A SEARCH. Stage 10 owns no directory, and offering
        // one here would be a door onto a corridor that has not been built.
        body="Open a player from a league table and their season will be here."
      />
    ) : state.status === 'failed' ? (
      <VNextNotice
        destination="leagues"
        heading="Player"
        title="We could not load this player"
        // IT DOES NOT DENY THE PLAYER. Their season exists; the read did not
        // answer. Saying "you may not see this player" here would be the page
        // turning its own failure into a statement about permission.
        body="Their season is there — we just could not read it just now. Trying again usually works."
        onRetry={state.retry}
      />
    ) : model ? (
      <VNextPlayerProfile
        model={model}
        actions={actions}
        // A partial page is a READY page, so the retry travels with it. Only a
        // failed play context takes the whole surface down.
        onRetry={state.status === 'ready' ? state.retry : undefined}
        // AND SO DOES THE IN-FLIGHT FLAG. The page is not unmounted while a
        // retry runs, so without this a reader gets no signal at all that the
        // press did anything.
        refreshing={state.status === 'ready' ? state.refreshing : false}
      />
    ) : (
      <VNextPlayerProfileLoading />
    )

  return shell === null ? (
    body
  ) : (
    <VNextConnectedShell model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextConnectedShell>
  )
}
