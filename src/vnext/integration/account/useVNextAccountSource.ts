import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AccountSource } from './accountSource'

/**
 * ACQUIRE WHAT vNEXT ACCOUNT NEEDS.
 *
 * This hook fetches and CLASSIFIES. `buildAccountModel` is the only thing that
 * turns an answer into something a page can draw, which is what makes every
 * mapping case testable with no Supabase, no auth and no network.
 *
 * ============================ IT IS NOT COMPETITION-SCOPED ==============
 *
 * Every other vNext source hook takes a competition slug and a season slug and
 * loads a play context first. This one takes NEITHER, and that is the point:
 * the route matrix keeps platform identity deliberately outside the tournament
 * boundary, and all three reads here answer about the caller alone. Contract
 * 161 states the same rule from the other side — it takes no player argument,
 * so it is not a directory.
 *
 * The request identity is therefore the USER, and nothing else. A player
 * switching competitions must not re-read their account.
 *
 * ============================ THREE READS, THREE OUTCOMES ===============
 *
 *   contract 157  preferences  the follows themselves
 *   contract 161  history      the seasons actually played
 *   contract 147  catalogue    a NAME for a follow, and nothing else
 *
 * Issued concurrently with A CATCH PER PROMISE rather than one around the set.
 * A `Promise.all` over unguarded promises discards answers that already
 * arrived, which is the defect Stage 11's reviews found and Stage 12 fixed
 * again.
 *
 * ============================ THE CATALOGUE IS NOT A PANEL ==============
 *
 * 157 and 161 each own a panel and each failure is visible as one. 147 owns no
 * panel: it decorates the follows with a name. When it fails the follows still
 * render, as `unnamed` — a state the model has for reasons that have nothing to
 * do with failure. A decoration failing must never empty a panel another read
 * filled.
 *
 * ============================ A RE-READ DOES NOT TEAR THE PAGE DOWN =====
 *
 * `refreshing` is a re-read in flight OVER a page that is still shown. Stage 11
 * shipped the opposite and blanked the surface on its own primary interaction.
 */

export type VNextAccountSourceInput = {
  readonly userId: string | null
  readonly authLoading: boolean
  /** The player's own display name, where the host knows one. */
  readonly displayName?: string | null
  /**
   * A ready `mailto:` for the deployment's administrator, or `null`/absent
   * where none is configured.
   *
   * THE HOST BUILDS IT. The subject names the product and the body carries the
   * player's own address, both of which are the application's facts — the site
   * brand and the session. A presentation module composing one would be
   * inventing an address and a product name.
   */
  readonly supportHref?: string | null
}

export type VNextAccountSourceState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'failed'; retry: () => void }
  | {
      status: 'ready'
      source: AccountSource
      retry: () => void
      /** A re-read is in flight over a page that is still shown. */
      refreshing: boolean
    }

type RequestIdentity = string

/**
 * THE USER, AND THE NAME SHOWN BESIDE THEM. No competition, no season — see the
 * header. The display name is in the identity because it is rendered; a host
 * that resolves it late must produce a page that then says it.
 */
function requestIdentity(userId: string, displayName: string | null): RequestIdentity {
  return JSON.stringify([userId, displayName])
}

type InternalState =
  | { status: 'idle' }
  | { status: 'failed'; identity: RequestIdentity }
  | { status: 'loaded'; identity: RequestIdentity; payload: AccountSource }

const IDLE: InternalState = { status: 'idle' }

export function useVNextAccountSource(
  input: VNextAccountSourceInput,
): VNextAccountSourceState {
  const [state, setState] = useState<InternalState>(IDLE)
  const [refreshing, setRefreshing] = useState(false)
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((value) => value + 1), [])

  /**
   * THE IDENTITY OF THE PAYLOAD CURRENTLY IN STATE, READABLE FROM THE EFFECT.
   * A ref rather than the state, for the reason the Championship hook records:
   * reading `state` here would mean depending on something this effect writes.
   */
  const loadedIdentity = useRef<RequestIdentity | null>(null)

  const { userId, authLoading } = input
  const displayName = input.displayName ?? null
  const supportHref = input.supportHref ?? null

  useEffect(() => {
    if (authLoading || !userId) {
      setState((current) => (current.status === 'idle' ? current : IDLE))
      return
    }

    const identity = requestIdentity(userId, displayName)
    let active = true

    // KEEP THE PAGE UP WHILE THE SAME PAGE RELOADS.
    const kept = loadedIdentity.current === identity
    if (!kept) loadedIdentity.current = null
    setState((current) => {
      if (current.status === 'idle') return current
      if (current.status === 'loaded' && current.identity === identity) return current
      return IDLE
    })
    setRefreshing(kept)

    void (async () => {
      const [preferencesModule, historyModule, catalogueModule, profileModule, authModule, policy, pushModule] =
        await Promise.all([
          import('../../../services/supabase/playerPreferences'),
          import('../../../services/supabase/seasonHistory'),
          import('../../../services/supabase/weeklyCatalogue'),
          import('../../../services/supabase/profile'),
          import('../../../services/supabase/auth'),
          import('../../../features/auth/authValidation'),
          import('../../../services/pushNotifications'),
        ])
      if (!active) return

      // A CATCH PER PROMISE. None of the four is another's precondition, and a
      // catch around the set would throw away answers that already landed.
      //
      // The account row and the session's email state are the ONE pair that is
      // caught together, because the settings panel cannot draw itself from
      // half of them: an email row with no address and a switch in an unknown
      // position are not two independently useful halves.
      const [preferences, history, catalogue, settings, pushNotifications] = await Promise.all([
        preferencesModule.fetchPlayerPreferences().catch(() => null),
        historyModule.fetchMySeasonHistory().catch(() => null),
        catalogueModule.fetchPublishedWeeklySeasons().catch(() => null),
        Promise.all([
          profileModule.fetchMyAccount(userId),
          authModule.getSessionEmailState(),
        ])
          .then(([account, emails]) =>
            account === null ? null : { account, emails },
          )
          .catch(() => null),
        pushModule.getPushNotificationState().catch(() => null),
      ])
      if (!active) return

      loadedIdentity.current = identity
      setRefreshing(false)
      setState({
        status: 'loaded',
        identity,
        payload: {
          // The one legitimate clock read on this path, stamped once and passed
          // down as data so the mapper stays pure.
          generatedAt: new Date().toISOString(),
          displayName,
          preferences:
            preferences === null ? { kind: 'failed' } : { kind: 'ok', preferences },
          history: history === null ? { kind: 'failed' } : { kind: 'ok', history },
          catalogue: catalogue === null ? { kind: 'failed' } : { kind: 'ok', seasons: catalogue },
          settings:
            settings === null
              ? { kind: 'failed' }
              : {
                  kind: 'ok',
                  email: settings.emails.email,
                  pendingEmail: settings.emails.pendingEmail,
                  reminderEmails: settings.account.reminderEmails,
                  // THE NUMBERS ONLY. The moderation list stays in one place —
                  // it is mirrored by a database trigger, and a second copy
                  // would be the one that went stale.
                  displayNameMaxLength: policy.DISPLAY_NAME_MAX,
                  passwordMinLength: policy.PASSWORD_MIN,
                },
          pushNotifications: pushNotifications ?? { kind: 'unavailable' },
          supportHref,
        },
      })
    })()

    return () => {
      active = false
    }
  }, [authLoading, userId, displayName, supportHref, nonce])

  return useMemo<VNextAccountSourceState>(() => {
    if (authLoading) return { status: 'loading' }
    if (!userId) return { status: 'signedOut' }

    const identity = requestIdentity(userId, displayName)
    if (state.status === 'loaded' && state.identity === identity) {
      return { status: 'ready', source: state.payload, retry, refreshing }
    }
    if (state.status === 'failed' && state.identity === identity) {
      return { status: 'failed', retry }
    }
    return { status: 'loading' }
  }, [authLoading, userId, displayName, state, retry, refreshing])
}
