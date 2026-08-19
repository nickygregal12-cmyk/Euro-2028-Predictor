import { motion } from 'framer-motion'
import type { InviteDetails, InvitePageModel, InvitePanel } from '../models/invite'
import { offersAccept } from '../models/invite'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import text from '../foundations/typography.module.css'
import styles from './invite.module.css'

/**
 * vNEXT INVITE — what a code turned out to be.
 *
 * ============================ IT IS ONE THING ON ONE PAGE ================
 *
 * A player arrives here from a link somebody sent them, usually on a phone,
 * usually without context. So the page answers one question — what is this, and
 * what happens if I say yes — and offers at most one action. No navigation into
 * the container before accepting it, no preview of who is in it: the invite
 * read carries none of that, and a page that showed it would be a page reading
 * a container the player has not joined.
 *
 * ============================ A REFUSAL IS A SENTENCE, NOT A DEAD BUTTON =
 *
 * Where the server would refuse — closed, already in, the owner, or a league
 * whose game has not been joined — there is NO accept control at all, and the
 * page says which of those it is. A disabled button teaches a player to press
 * it again.
 *
 * ============================ IT NEVER EXPLAINS A BAD CODE ===============
 *
 * The not-found state says one sentence and offers no diagnosis. The server
 * made unknown, malformed and rotated codes indistinguishable on purpose.
 */

export type InviteIntent =
  | { readonly kind: 'accept' }
  | { readonly kind: 'retry' }
  | { readonly kind: 'go-home' }
  /** Join the underlying game first, which is what the server requires. */
  | { readonly kind: 'open-game' }

export type VNextInviteProps = {
  readonly model: InvitePageModel
  readonly onIntent?: ((intent: InviteIntent) => void) | undefined
}

export function VNextInvite({ model, onIntent }: VNextInviteProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)

  return (
    <VNextShell
      // NOT ONE OF THE FOUR. An invite is a thing that happened to the player,
      // not a place in the product, so nothing lights up.
      destination="none"
      header={<VNextPageHeader title="Invitation" context="You were invited" />}
    >
      <div className={styles.page}>
        <motion.div variants={rise} initial="hidden" animate="visible" className={styles.body}>
          <Panel panel={model.panel} accepting={model.accepting} onIntent={onIntent} />
        </motion.div>
      </div>
    </VNextShell>
  )
}

function Panel({
  panel,
  accepting,
  onIntent,
}: {
  readonly panel: InvitePanel
  readonly accepting: boolean
  readonly onIntent?: ((intent: InviteIntent) => void) | undefined
}) {
  if (panel.kind === 'looking') {
    return (
      <div className={styles.card} data-vnext-zone="looking" aria-busy="true" aria-live="polite">
        <p className={text.body}>Looking up your invitation…</p>
      </div>
    )
  }

  if (panel.kind === 'not-found') {
    return (
      <div className={styles.card} data-vnext-zone="not-found">
        <p className={text.title}>That invitation is not valid</p>
        {/* ONE SENTENCE, NO DIAGNOSIS. See the component header. */}
        <p className={`${text.body} ${styles.body}`}>
          It may have been used up, replaced, or typed slightly differently. Ask
          whoever sent it for a fresh link.
        </p>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => onIntent?.({ kind: 'go-home' })}
        >
          Go to Home
        </button>
      </div>
    )
  }

  if (panel.kind === 'failed') {
    return (
      <div className={styles.card} data-vnext-zone="failed">
        <p className={text.title}>We could not check that invitation</p>
        {/* THE WRITE CONTRACT'S OWN SENTENCE, carried rather than re-worded. */}
        <p className={`${text.body} ${styles.body}`}>{panel.message}</p>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => onIntent?.({ kind: 'retry' })}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <Invitation
      details={panel.details}
      // THE RULE COMES FROM THE MODEL, not from re-reading the action here.
      // `offersAccept` is the one place that decides whether an accept may be
      // offered; branching on `action.kind` again below would be a second copy
      // of it, and the two would disagree the first time a case was added.
      canAccept={offersAccept(panel)}
      accepting={accepting}
      onIntent={onIntent}
    />
  )
}

/** What the invitation IS, in the words the read supplied. */
function Subtitle({ details }: { readonly details: InviteDetails }) {
  const parts = [details.game, details.season].filter((part): part is string => part !== null)
  if (parts.length === 0) return null
  return (
    <p className={`${text.micro} ${styles.meta}`} data-vnext-zone="subtitle">
      {parts.join(' · ')}
    </p>
  )
}

function Invitation({
  details,
  canAccept,
  accepting,
  onIntent,
}: {
  readonly details: InviteDetails
  readonly canAccept: boolean
  readonly accepting: boolean
  readonly onIntent?: ((intent: InviteIntent) => void) | undefined
}) {
  const action = details.action

  return (
    <div
      className={styles.card}
      data-vnext-zone="invite"
      data-container={details.container}
      data-action={action.kind}
    >
      <p className={`${text.micro} ${styles.kind}`}>
        {details.container === 'league' ? 'A private league' : 'A private competition'}
      </p>
      <p className={text.title}>{details.name}</p>
      <Subtitle details={details} />

      {canAccept ? (
        <>
          <p className={`${text.body} ${styles.body}`}>
            Accepting adds you to it. You can leave again from the{' '}
            {details.container === 'league' ? 'league' : 'competition'} itself.
          </p>
          <button
            type="button"
            className={styles.accept}
            disabled={accepting}
            onClick={() => onIntent?.({ kind: 'accept' })}
          >
            {accepting ? 'Joining…' : 'Accept invitation'}
          </button>
        </>
      ) : action.kind === 'already-in' ? (
        <p className={`${text.body} ${styles.body}`} data-vnext-zone="refusal">
          You are already in this one, so there is nothing to accept.
        </p>
      ) : action.kind === 'owner' ? (
        <p className={`${text.body} ${styles.body}`} data-vnext-zone="refusal">
          This one is yours — you set it up.
        </p>
      ) : action.kind === 'closed' ? (
        <p className={`${text.body} ${styles.body}`} data-vnext-zone="refusal">
          This one is no longer taking entries. It has either finished or been
          started by whoever runs it.
        </p>
      ) : action.kind === 'needs-game-first' ? (
        <>
          {/* THE SERVER'S OWN REQUIREMENT, stated as a next step rather than as
              a refusal. `requiresGameEntry` exists so a surface can do exactly
              this instead of offering a button the database refuses. */}
          <p className={`${text.body} ${styles.body}`} data-vnext-zone="refusal">
            {action.gameName === null
              ? 'You need to be playing this league’s game before you can join it.'
              : `You need to be playing ${action.gameName} before you can join this league.`}
          </p>
          <button
            type="button"
            className={styles.accept}
            onClick={() => onIntent?.({ kind: 'open-game' })}
          >
            {action.gameName === null ? 'Go to the game' : `Go to ${action.gameName}`}
          </button>
        </>
      ) : null}
    </div>
  )
}
