import { useMemo } from 'react'
import { VNextAccount, type AccountIntent } from '../../account/VNextAccount'
import { VNextConnectedShell } from '../shell/VNextConnectedShell'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import { VNextNotice } from '../../states/VNextStates'
import { buildAccountModel } from './buildAccountModel'
import { useVNextAccountSource } from './useVNextAccountSource'

/**
 * THE CONNECTED ACCOUNT SURFACE.
 *
 * ============================ THE SEAM, AND ALL OF IT ====================
 *
 * `useVNextAccountSource` acquires and classifies; `buildAccountModel` maps,
 * purely; `VNextAccount` draws. This file only chooses which of those to show,
 * which is why it holds no follow logic and no history logic at all.
 *
 * ============================ IT HAS NO COMPETITION ======================
 *
 * Every other connected screen in this lane builds its shell from a play
 * context. This one has none to build from — Account is platform-scoped by the
 * route matrix's own decision — so the shell is built with a null competition
 * and the page renders with `destination="none"`. Nothing in the navigation
 * lights up, which is correct: the player is not inside a competition.
 *
 * ============================ A FAILED READ IS NOT AN EMPTY ACCOUNT ======
 *
 * There is no whole-page `failed` state driven by the reads, because no single
 * read owns the page: preferences failing and history failing are two different
 * panels saying so. The only way this screen shows nothing is being signed out,
 * which is a fact about the caller rather than about their account.
 */

export type VNextAccountScreenProps = {
  readonly userId: string | null
  readonly authLoading: boolean
  /** The player's own display name, where the host knows one. */
  readonly displayName?: string | null
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  /**
   * The player's OTHER competitions and what is waiting in them, where the host
   * loads them. `undefined` is the one-competition shape: the shell states this
   * page's competition and says nothing about any other, which is what a
   * page-scoped host should pass. The inbox costs reads per competition, so it
   * belongs to a host that mounts it once above the pages.
   */
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
  /** The player's appearance choice, held by the host that persists it. */
  readonly theme?: 'system' | 'dark' | 'light'
  readonly onIntent?: ((intent: AccountIntent) => void) | undefined
}

export function VNextAccountScreen(props: VNextAccountScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const state = useVNextAccountSource({
    userId: props.userId,
    authLoading: props.authLoading,
    displayName: props.displayName ?? null,
  })

  const model = useMemo(
    () => (state.status === 'ready' ? buildAccountModel(state.source) : null),
    [state],
  )

  const shell = useMemo(
    () =>
      buildShellModel({
        // NO COMPETITION, AND THAT IS THE ANSWER rather than a placeholder.
        // The switcher therefore draws its EMPTY state — "No competition
        // selected", which is a fact about this page rather than about what
        // the player follows. It used to read "No competition yet", which told
        // a player with three follows that they had none, in the chrome above
        // the page that lists all three.
        competition: null,
        playerName: props.displayName ?? null,
        // An account page counts no outstanding predictions of its own. `null`
        // is "this page cannot say", never zero.
        outstandingPredictions: null,
        canNavigateAway: props.onShellIntent !== undefined,
            elsewhere,
      }),
    [props.displayName, props.onShellIntent, elsewhere],
  )

  const body =
    state.status === 'signedOut' ? (
      <VNextNotice
        destination="none"
        heading="You"
        title="Sign in to see your account"
        body="Your competitions, your seasons and your settings live with your account."
      />
    ) : model === null ? (
      <VNextNotice
        destination="none" heading="You" title="Loading your account" body="One moment." />
    ) : (
      <VNextAccount
        model={model}
        onRetry={state.status === 'ready' ? state.retry : undefined}
        refreshing={state.status === 'ready' ? state.refreshing : false}
        theme={props.theme ?? 'system'}
        onIntent={props.onIntent}
      />
    )

  return (
    <VNextConnectedShell model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextConnectedShell>
  )
}
