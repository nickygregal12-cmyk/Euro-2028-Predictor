import type { InviteAction, InviteDetails, InvitePageModel, InvitePanel } from '../../models/invite'
import type { InviteState } from '../../../features/leagues/useInviteCode'

/**
 * `InviteState` → `InvitePageModel`. PURE.
 *
 * The source here is the SHARED HOOK'S OWN STATE rather than a read of this
 * lane's, because the flow is `useInviteCode`'s and duplicating it is the
 * defect that hook exists to prevent. This maps its five states onto a
 * presentation and decides one thing the hook does not: what a player may be
 * offered.
 *
 * WHAT IT MUST NOT DO:
 *
 *   1. TELL AN UNKNOWN CODE FROM A MALFORMED OR ROTATED ONE. The server made
 *      them indistinguishable; `notfound` carries nothing and this carries
 *      nothing onward.
 *   2. RECOMPUTE `closed`. It is resolved server-side against the server's own
 *      clock, and there is no instant here to redo it from.
 *   3. OFFER A JOIN THE SERVER WOULD REFUSE. See `actionOf`.
 */

/**
 * WHAT CAN BE DONE, in the order the server's own refusals impose.
 *
 * Already-in first: a player who is in does not care that registration later
 * closed. Then the refusals — a closed competition, and a league whose
 * underlying game has not been joined, which the decoder carries
 * `requiresGameEntry` for precisely so a surface can send the player to the
 * game rather than offer a button the database will refuse.
 */
function actionOf(invite: Extract<InviteState, { status: 'ready' }>['invite']): InviteAction {
  if (invite.kind === 'competition' && invite.isOwner) return { kind: 'owner' }
  if (invite.alreadyIn) return { kind: 'already-in' }

  if (invite.kind === 'competition') {
    // SERVER-RESOLVED. Finished, or registration closed — including by an
    // organiser launching. Not recomputed here.
    if (invite.closed) return { kind: 'closed' }
    return { kind: 'accept' }
  }

  if (invite.requiresGameEntry) {
    return { kind: 'needs-game-first', gameName: invite.game }
  }
  return { kind: 'accept' }
}

function detailsOf(invite: Extract<InviteState, { status: 'ready' }>['invite']): InviteDetails {
  return {
    container: invite.kind,
    name: invite.name,
    season: invite.season,
    game: invite.game,
    action: actionOf(invite),
  }
}

function panelOf(state: InviteState): InvitePanel {
  switch (state.status) {
    case 'ready':
      return { kind: 'invite', details: detailsOf(state.invite) }
    case 'notfound':
      // NOTHING TRAVELS WITH IT. Not the code, not a reason.
      return { kind: 'not-found' }
    case 'error':
      return { kind: 'failed', message: state.message }
    default:
      // `idle` and `looking` are one state to a reader: the page has not
      // answered yet. Distinguishing them on screen would be showing a person
      // the difference between "about to ask" and "asking".
      return { kind: 'looking' }
  }
}

export function buildInviteModel(
  state: InviteState,
  options: { readonly generatedAt: string; readonly accepting: boolean },
): InvitePageModel {
  return {
    generatedAt: options.generatedAt,
    panel: panelOf(state),
    accepting: options.accepting,
  }
}
