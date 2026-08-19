import { useEffect, useMemo, useState } from 'react'
import { VNextInvite, type InviteIntent } from '../../invite/VNextInvite'
import { VNextConnectedShell } from '../shell/VNextConnectedShell'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import { VNextNotice } from '../../states/VNextStates'
import { useInviteCode, type InviteJoinResult } from '../../../features/leagues/useInviteCode'
import { buildInviteModel } from './buildInviteModel'

/**
 * THE CONNECTED INVITE SURFACE.
 *
 * ============================ THE FLOW IS NOT THIS FILE'S ===============
 *
 * `useInviteCode` resolves and accepts, and dispatches on the server's own
 * `joinWith` — never on the code's shape or anything the browser inferred.
 * This screen calls it, maps its state with `buildInviteModel`, and draws.
 * There is no second copy of the join logic here, which is the whole reason
 * that hook exists.
 *
 * ============================ SIGNED OUT IS THE HOST'S PROBLEM ==========
 *
 * Production's `JoinLandingPage` stashes the code and routes through sign-up so
 * the deep link survives authentication — an accepted requirement the route
 * matrix carries forward unchanged. That is routing, and Stage 14 owns routing,
 * so this screen states the signed-out case and does not redirect from it.
 */

export type VNextInviteScreenProps = {
  readonly userId: string | null
  readonly authLoading: boolean
  readonly code: string | undefined
  readonly onShellIntent?: ((intent: ShellIntent) => void) | undefined
  /**
   * The player's OTHER competitions and what is waiting in them, where the host
   * loads them. `undefined` is the one-competition shape: the shell states this
   * page's competition and says nothing about any other, which is what a
   * page-scoped host should pass. The inbox costs reads per competition, so it
   * belongs to a host that mounts it once above the pages.
   */
  readonly shellElsewhere?: ShellSourceElsewhere | null | undefined
  readonly onJoined?: ((result: InviteJoinResult) => void) | undefined
  readonly onGoHome?: (() => void) | undefined
  readonly onOpenGame?: (() => void) | undefined
}

export function VNextInviteScreen(props: VNextInviteScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const { state, joining, resolve, accept } = useInviteCode()
  const [generatedAt] = useState(() => new Date().toISOString())
  const { userId, authLoading, code } = props

  useEffect(() => {
    if (authLoading || !userId || !code) return
    void resolve(code)
  }, [authLoading, userId, code, resolve])

  const model = useMemo(
    () => buildInviteModel(state, { generatedAt, accepting: joining }),
    [state, generatedAt, joining],
  )

  const shell = useMemo(
    () =>
      buildShellModel({
        // An invite is not inside a competition — accepting it is how a player
        // gets into one.
        competition: null,
        playerName: null,
        outstandingPredictions: null,
        canNavigateAway: props.onShellIntent !== undefined,
            elsewhere,
      }),
    [props.onShellIntent, elsewhere],
  )

  const body =
    authLoading ? (
      <VNextNotice
        destination="none"
        heading="Invitation"
        title="One moment"
        body="Checking who you are signed in as."
      />
    ) : !userId ? (
      <VNextNotice
        destination="none"
        heading="Invitation"
        title="Sign in to open this invitation"
        body="Invitations are accepted by an account, so we need to know who you are first. Your link will still work after you sign in."
      />
    ) : !code ? (
      <VNextNotice
        destination="none"
        heading="Invitation"
        title="No invitation code"
        body="This address has no code in it. Ask whoever invited you for the full link."
      />
    ) : (
      <VNextInvite
        model={model}
        onIntent={(intent: InviteIntent) => {
          switch (intent.kind) {
            case 'accept':
              void accept(code).then((result) => {
                if (result) props.onJoined?.(result)
              })
              return
            case 'retry':
              void resolve(code)
              return
            case 'open-game':
              props.onOpenGame?.()
              return
            default:
              props.onGoHome?.()
          }
        }}
      />
    )

  return (
    <VNextConnectedShell model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextConnectedShell>
  )
}
