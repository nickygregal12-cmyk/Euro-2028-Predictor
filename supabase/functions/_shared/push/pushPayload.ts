// What a push notification SAYS, decided in one place away from the crypto.
//
// ============================ THE LOCK SCREEN RULE =========================
//
// A push notification is rendered by the operating system, usually on a locked
// phone, in front of whoever happens to be looking at it. That is a different
// audience from an email, and it is the constraint this module exists to keep:
//
//   * NO PREDICTION, ever — not a scoreline, not a pick, not a Joker, not a
//     Last Man Standing selection. A competitor reading a rival's lock screen
//     must learn nothing they could act on, and contract 151's whole
//     pre-lock-privacy boundary would be undone by one helpful notification;
//   * NO PLAYER NAME, no display name, no email address and no league name. The
//     device already knows whose phone it is;
//   * NO RANK, POINTS OR RESULT. Those are settled facts with their own reveal
//     rules, and a notification is not one of the surfaces that owns them.
//
// What is left is exactly what a reminder is for: a matchweek number, that it
// is closing, and how many entries are still missing. All three are the
// player's own outstanding work, none of them is a competitive disclosure, and
// the count is already what the action item says on screen.
//
// ============================ AND NO TIME OF DAY ===========================
//
// `closesAt` is an instant, and this code does not know the player's timezone —
// the ledger does not store one and the event does not carry one. A time
// rendered in the wrong zone is worse than no time: it is a specific, credible,
// wrong deadline. So the wording is relative and the service worker is not
// asked to format anything.
//
// ============================ AND NO DEEP LINK =============================
//
// The event carries `competitionId`, a uuid. The route it would need is
// `/competitions/:competitionSlug/:seasonSlug/...`, and this module has no way
// to turn one into the other. Sending the hub is honest and lands the player on
// the surface that lists their outstanding actions; a guessed URL would open a
// 404 from a notification, which is worse than one extra tap.

import type { NotificationEvent } from '../notifications/notificationEvents.ts'

/** Exactly what the service worker's `push` handler reads, and nothing more. */
export interface PushNotificationPayload {
  readonly title: string
  readonly body: string
  /** Where a tap goes. Always same-origin and always a path. */
  readonly url: string
  /**
   * Collapses repeats. A second reminder for the same matchweek REPLACES the
   * first on the lock screen rather than stacking beside it.
   */
  readonly tag: string
}

export type PushPayloadResult =
  | { readonly ok: true; readonly payload: PushNotificationPayload }
  /** This event kind has no push wording, so nothing is invented for it. */
  | { readonly ok: false; readonly reason: `unsupported-push-kind:${string}` }

/** The action centre lists outstanding work; the event cannot name a route. */
const HUB = '/'

/**
 * Turn one deliverable reminder into the words a lock screen shows.
 *
 * The two kinds handled here are the two the ledger actually schedules. Every
 * other kind in the taxonomy is refused by name rather than given a plausible
 * default, on the same terms as `reminderEvents.ts`: a notification that says
 * the wrong thing gets believed, and one that never went out gets retried.
 */
export function buildPushPayload(event: NotificationEvent): PushPayloadResult {
  switch (event.kind) {
    case 'prediction.window_closing': {
      const outstanding = event.outstandingFixtures
      return {
        ok: true,
        payload: {
          title: `Matchweek ${event.matchweek} closes soon`,
          // The count when it is known, and a plain nudge when it is not.
          // `null` is a real state — the ledger does not always count — and
          // "0 predictions" would be both wrong and demoralising.
          body:
            outstanding !== null && outstanding > 0
              ? `${outstanding} ${plural(outstanding, 'prediction')} still to make before it locks.`
              : 'Get your predictions in before it locks.',
          url: HUB,
          tag: `matchweek-${event.matchweek}`,
        },
      }
    }
    case 'prediction.entries_outstanding':
      return {
        ok: true,
        payload: {
          title: `Last call for matchweek ${event.matchweek}`,
          body: `${event.outstandingFixtures} ${plural(
            event.outstandingFixtures,
            'prediction',
          )} still to make.`,
          url: HUB,
          // THE SAME TAG as the earlier nudge, deliberately. The last call
          // REPLACES the reminder it follows up rather than sitting beneath it,
          // because two live notices about one matchweek read as two deadlines.
          tag: `matchweek-${event.matchweek}`,
        },
      }
    default:
      return { ok: false, reason: `unsupported-push-kind:${event.kind}` }
  }
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`
}
