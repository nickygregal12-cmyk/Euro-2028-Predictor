import { useCallback, useMemo, useRef, useState } from 'react'
import { VNextAccount, type AccountIntent } from '../../account/VNextAccount'
import { VNextConnectedShell } from '../shell/VNextConnectedShell'
import type { ShellIntent } from '../../models/shell'
import { buildShellModel } from '../shell/buildShellModel'
import type { ShellSourceElsewhere } from '../shell/shellSource'
import { useShellElsewhere } from '../shell/VNextShellElsewhereHost'
import { VNextLoadingRows, VNextNotice } from '../../states/VNextStates'
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
  const settings = useAccountSettingsWrites({
    userId: props.userId,
    retry: state.status === 'ready' ? state.retry : null,
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
      // TWO PANELS, BECAUSE ACCOUNT IS TWO INDEPENDENT READS. Follows and
      // season history resolve separately and are drawn separately, so the
      // placeholder is the pair rather than one undifferentiated list.
      <VNextLoadingRows
        destination="none"
        heading="You"
        label="Loading your account"
        shape="panels"
      />
    ) : (
      <VNextAccount
        model={model}
        onRetry={state.status === 'ready' ? state.retry : undefined}
        refreshing={state.status === 'ready' ? state.refreshing : false}
        theme={props.theme ?? 'system'}
        settingsBusy={settings.busy}
        settingsNotice={settings.notice}
        onIntent={(intent: AccountIntent) => {
          // THE TWO SETTINGS WRITES ARE THIS SCREEN'S. Everything else — sign
          // out, the theme, opening a season — belongs to the host, because
          // each of those changes something outside this page.
          if (intent.kind === 'change-email' || intent.kind === 'set-reminder-emails') {
            settings.perform(intent)
            return
          }
          props.onIntent?.(intent)
        }}
      />
    )

  return (
    <VNextConnectedShell model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextConnectedShell>
  )
}

/* ==========================================================================
   THE TWO SETTINGS WRITES
   ==========================================================================

   THEY REUSE THE EXISTING AUTHORITIES AND ADD NOTHING. `updateEmail` is the
   auth module's own call and `updateReminderEmails` is the profile module's;
   neither validates here, because neither rule is this lane's. There is no
   second settings authority — the same two functions the legacy `/account`
   page calls.

   AN EMAIL CHANGE IS NOT A STATE CHANGE AND IS NOT RE-READ. Supabase sends a
   confirmation to the NEW address and applies nothing until it is clicked, so
   the honest answer is a sentence rather than a redraw: the page keeps showing
   the current address, and the session's `pendingEmail` is what will report the
   replacement once there is one.

   A PREFERENCE CHANGE IS RE-READ, because it IS a state change and the surface
   must show the server's answer rather than the press. A failed toggle leaves
   the control where the server actually has it.

   ONE WRITE AT A TIME, guarded on a ref: a state read inside the callback would
   be the value from the render that created it.
   ========================================================================== */

type SettingsWrite = Extract<
  AccountIntent,
  { kind: 'change-email' } | { kind: 'set-reminder-emails' }
>

function useAccountSettingsWrites(options: {
  readonly userId: string | null
  readonly retry: (() => void) | null
}) {
  const [busy, setBusy] = useState<'email' | 'reminders' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const inFlight = useRef(false)
  const { userId, retry } = options

  const perform = useCallback(
    (intent: SettingsWrite) => {
      if (inFlight.current || userId === null) return
      inFlight.current = true
      setNotice(null)
      setBusy(intent.kind === 'change-email' ? 'email' : 'reminders')

      void (async () => {
        try {
          if (intent.kind === 'change-email') {
            const { updateEmail } = await import('../../../services/supabase/auth')
            await updateEmail(intent.email)
            // NOT "CHANGED". Nothing has changed yet, and saying otherwise is
            // the one sentence this write must not produce.
            setNotice(
              `We have sent a confirmation to ${intent.email}. Your address changes when you click the link in it.`,
            )
          } else {
            const { updateReminderEmails } = await import('../../../services/supabase/profile')
            await updateReminderEmails(userId, intent.enabled)
            // THE SERVER'S ANSWER, RE-READ. The checkbox is drawn from the
            // profile read, so this is what moves it.
            retry?.()
          }
        } catch (error) {
          const { userFacingError } = await import('../../../shared/errors/userFacingError')
          setNotice(userFacingError(error))
        } finally {
          inFlight.current = false
          setBusy(null)
        }
      })()
    },
    [retry, userId],
  )

  return { busy, notice, perform }
}
