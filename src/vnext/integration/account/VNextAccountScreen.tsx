import { useMemo } from 'react'
import {
  VNextAccount,
  type AccountActions,
  type AccountIntent,
  type AccountWriteResult,
} from '../../account/VNextAccount'
import { VNextShellProvider } from '../../app/VNextShellProvider'
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
 *
 * ============================ AND THE WRITES ARE PERFORMED HERE ==========
 *
 * Stage 7's rule: a command goes out through the application's own function.
 * The page owns the control, the wording, the checks it was given as numbers
 * and the busy and error presentation; this file calls `updateMyDisplayName`,
 * `updatePassword`, `updateEmail` and `updateReminderEmails`, and it is where
 * the DISPLAY-NAME MODERATION POLICY runs — `checkDisplayName` mirrors a
 * database trigger, and a copy in the presentation lane would be a second list
 * to keep in step and the one that went stale.
 *
 * A REFUSAL IS TRANSLATED ONCE, HERE. `friendlyAuthError` and `userFacingError`
 * are the application's own vocabulary for what went wrong; the sheet prints
 * the sentence it is handed and composes none of its own.
 *
 * AN ACTION IS ABSENT WHERE IT CANNOT RUN. Every one of these needs a signed-in
 * user id, so a signed-out caller gets no controls rather than controls that
 * would throw.
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
  /**
   * A ready `mailto:` for the deployment's administrator, or absent where none
   * is configured. Built by the host, because the subject names the product and
   * the body carries the player's own address.
   */
  readonly supportHref?: string | null
  /**
   * Called after a write that changes something the SESSION holds — a display
   * name the auth provider caches, or an email change the session now has
   * pending. The screen re-reads its own source either way; this is how the
   * application's own copy is refreshed too.
   */
  readonly onSaved?: (() => void) | undefined
}

/**
 * ONE PLACE THAT TURNS A THROWN ERROR INTO A SENTENCE THE SHEET CAN PRINT.
 *
 * Four writes with four different failure vocabularies, and the alternative is
 * four `try`/`catch` blocks that drift. The message comes from the
 * application's own translator in every case; nothing here composes one.
 */
async function run(
  write: () => Promise<unknown>,
  message: (error: unknown) => string,
  afterwards?: (() => void) | undefined,
): Promise<AccountWriteResult> {
  try {
    await write()
    afterwards?.()
    return { ok: true }
  } catch (error) {
    return { ok: false, message: message(error) }
  }
}

export function VNextAccountScreen(props: VNextAccountScreenProps) {
  const elsewhere = useShellElsewhere(props.shellElsewhere)
  const state = useVNextAccountSource({
    userId: props.userId,
    authLoading: props.authLoading,
    displayName: props.displayName ?? null,
    supportHref: props.supportHref ?? null,
  })

  const { userId, onSaved } = props
  const actions = useMemo<AccountActions | undefined>(() => {
    if (userId === null) return undefined

    return {
      setDisplayName: async (name) => {
        const [{ checkDisplayName }, { updateMyDisplayName }, { userFacingError }] =
          await Promise.all([
            import('../../../features/auth/displayNamePolicy'),
            import('../../../services/supabase/profile'),
            import('../../../shared/errors/userFacingError'),
          ])
        // THE POLICY RUNS HERE, once. The server trigger is the real gate; this
        // is the friendly first line, and it lives beside the one copy of the
        // list rather than beside a second one in the presentation lane.
        const refusal = checkDisplayName(name)
        if (refusal) return { ok: false, message: refusal }
        return run(
          () => updateMyDisplayName(userId, name),
          (error) => userFacingError(error, 'We could not change your display name.'),
          onSaved,
        )
      },
      setPassword: async (password) => {
        const [{ updatePassword }, { friendlyAuthError }] = await Promise.all([
          import('../../../services/supabase/auth'),
          import('../../../features/auth/authErrors'),
        ])
        return run(
          () => updatePassword(password),
          // `'update'`, which is the vocabulary this authority uses for a
          // change to an existing credential rather than a sign-in attempt.
          (error) => friendlyAuthError(error, 'update'),
        )
      },
      setEmail: async (email) => {
        const [{ updateEmail }, { friendlyAuthError }] = await Promise.all([
          import('../../../services/supabase/auth'),
          import('../../../features/auth/authErrors'),
        ])
        return run(
          () => updateEmail(email),
          (error) => friendlyAuthError(error, 'update'),
          onSaved,
        )
      },
      setReminderEmails: async (on) => {
        const [{ updateReminderEmails }, { userFacingError }] = await Promise.all([
          import('../../../services/supabase/profile'),
          import('../../../shared/errors/userFacingError'),
        ])
        return run(
          () => updateReminderEmails(userId, on),
          (error) => userFacingError(error, 'We could not save that preference.'),
        )
      },
    }
  }, [userId, onSaved])

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
        actions={actions}
      />
    )

  return (
    <VNextShellProvider model={shell} onIntent={props.onShellIntent}>
      {body}
    </VNextShellProvider>
  )
}
