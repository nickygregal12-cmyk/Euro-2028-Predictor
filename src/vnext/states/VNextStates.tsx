import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import type { ShellDestinationId, ShellIntent } from '../models/shell'
import text from '../foundations/typography.module.css'
import styles from './VNextStates.module.css'

/**
 * THE STATES ANY vNEXT SURFACE IS IN WHEN IT IS NOT SHOWING ITS CONTENT.
 *
 * ============================ WHY IT IS HERE AND NOT IN A FEATURE ========
 *
 * This was `VNextLeaguesStates`. Six connected screens used it and five of them
 * reached across into `../leagues/` to do so — Championship, Player Profile,
 * Last Man Standing, Account and Games. A component five features import is not
 * one feature's component, and leaving it there had a cost that was not
 * cosmetic: it hard-coded
 *
 *     <VNextShell destination="leagues" ...>
 *
 * with no prop to change it. So when the Championship failed to load, the
 * navigation told the player they were in Leagues. Same for Account, Games,
 * Last Man Standing and Player Profile. A page that cannot show its content is
 * exactly when a player looks at the navigation to work out where they are, and
 * it was the one moment the navigation lied.
 *
 * `destination` is now required. There is no default, on purpose: a default
 * would silently reintroduce the same defect for the next surface.
 *
 * AND IT IS PRESENTATION, NOT INTEGRATION. It first landed under
 * `integration/states/`, which was wrong twice over. Nothing here reads: every
 * one takes props and renders, so it belongs on the presentation side by the
 * same test every other vNext component is held to. And putting it under
 * `integration/` made it unreachable from a story — the architecture rule says
 * only `src/vnext/integration` may reach integration adapters, and stories
 * count as presentation — which would have left the one module every surface
 * falls back to as the one module with no visual coverage.
 *
 * ============================ THEY ARE INSIDE THE SHELL ==================
 *
 * Every one renders `VNextShell`, so a player who cannot see the content can
 * still see where they are and can still navigate. The matrix asks for exactly
 * this of the not-found row — "every concept still needs a deterministic parent
 * from a not-found".
 *
 * ============================ AN ERROR NEVER DENIES THE CONTENT ==========
 *
 * "We could not load this" and never "there is nothing here". The read did not
 * answer; that is a fact about the request and not about what exists. Only the
 * server can say the second one, and when it does the page draws its own
 * ordinary empty state instead.
 */

export type VNextNoticeProps = {
  readonly title: string
  readonly body: string
  /** The page's own name. Shown in the header so the notice is still that page. */
  readonly heading: string
  /**
   * Which destination the player is in. REQUIRED — see the header. `'none'` for
   * a page outside the four, which is not the same as "unspecified".
   */
  readonly destination: ShellDestinationId | 'none'
  readonly onRetry?: (() => void) | undefined
  /** What the retry control says. "Try again" fits a failure, not every state. */
  readonly retryLabel?: string
  /**
   * THE SHELL'S OUTWARD EDGE, FOR A CALLER THAT HAS NO PROVIDER TO PUT IT IN.
   *
   * `VNextShell` normally takes its intent handler from `VNextShellProvider`,
   * which every connected screen mounts around its own body — so no notice has
   * ever needed to pass one. A caller ABOVE the screens has no such provider to
   * borrow: `VNextSurfaceBoundary` renders this after a destination threw, and
   * the throw took that destination's provider with it.
   *
   * Without this the boundary would draw the four destinations as controls that
   * are focusable, named and inert, which is worse than drawing none — a player
   * pressing Matches on a failed page and getting nothing learns the whole
   * product is broken rather than one page of it.
   *
   * Optional, and absent means exactly what it meant before: the provider
   * answers, or nothing does.
   */
  readonly onIntent?: ((intent: ShellIntent) => void) | undefined
  /**
   * A SUPPORT REFERENCE, ON ITS OWN LINE RATHER THAN IN THE SENTENCE.
   *
   * It belongs to a failure a person may have to report, and it is a TOKEN —
   * the one string on the page that has to survive being read out or copied
   * exactly. Written into `body` it wrapped between the timestamp and the
   * suffix; given its own line it cannot, and one tap selects all of it.
   *
   * Absent on every state that is not a failure, which is most of them: a
   * not-found and an access refusal have nothing to correlate.
   */
  readonly reference?: string | undefined
}

export function VNextNotice({
  title,
  body,
  heading,
  destination,
  onRetry,
  retryLabel = 'Try again',
  onIntent,
  reference,
}: VNextNoticeProps) {
  return (
    <VNextShell
      destination={destination}
      header={<VNextPageHeader title={heading} />}
      onIntent={onIntent}
    >
      <div className={styles.page}>
        <div className={styles.notice} role="status">
          <p className={text.title}>{title}</p>
          <p className={`${text.body} ${styles.noticeBody}`}>{body}</p>
          {onRetry ? (
            <button type="button" className={styles.retry} onClick={onRetry}>
              {retryLabel}
            </button>
          ) : null}
          {/* BELOW THE ACTION, not above it. The reference matters to whoever
              reports the failure; getting out of it matters to everyone. */}
          {reference ? (
            <p className={styles.reference}>
              If you report this, quote{' '}
              <code className={styles.referenceCode}>{reference}</code>
            </p>
          ) : null}
        </div>
      </div>
    </VNextShell>
  )
}

/**
 * NOT FOUND — the matrix's `*` row.
 *
 * ITS JOB IS THE PARENT, NOT THE APOLOGY. The matrix asks for "a deterministic
 * parent from a not-found", so this renders inside the shell with the full
 * navigation and no destination lit: the player is nowhere in particular, which
 * is the truth, and every way out is one press away.
 *
 * IT DOES NOT GUESS WHAT THE PLAYER MEANT. No "did you mean", no redirect after
 * three seconds. An address that does not resolve is not evidence of an
 * intention this page can read.
 */
export function VNextNotFound({ onHome }: { readonly onHome?: (() => void) | undefined }) {
  return (
    <VNextNotice
      heading="Not found"
      destination="none"
      title="That page is not here"
      body="The address does not match anything in the app. It may have been renamed, or the link may be incomplete."
      onRetry={onHome}
      retryLabel="Go to Home"
    />
  )
}

/**
 * ACCESS REFUSED — the player is signed in and this is not theirs.
 *
 * IT IS NOT A NOT-FOUND AND NOT A SIGN-IN PROMPT. Those are three different
 * facts and telling a signed-in player "sign in" or "not found" for a thing
 * that exists and is simply not theirs teaches them the app is broken.
 *
 * IT NAMES NOTHING ABOUT WHAT IT IS REFUSING. Not the competition, not the
 * league, not who is in it. A refusal that describes what it is protecting is
 * a disclosure — the same reason contract 133 answers an unknown id and a
 * non-member's id identically, "so a private UUID is not an existence oracle".
 */
export function VNextAccessRefused({
  heading = 'Not available',
  destination = 'none',
  onBack,
}: {
  readonly heading?: string
  readonly destination?: ShellDestinationId | 'none'
  readonly onBack?: (() => void) | undefined
}) {
  return (
    <VNextNotice
      heading={heading}
      destination={destination}
      title="This is not open to you"
      body="You are signed in, and this one is not yours to see. If you think it should be, whoever runs it can add you."
      onRetry={onBack}
      retryLabel="Go back"
    />
  )
}

/**
 * A SKELETON WITH NO NUMBERS AND NO NAMES.
 *
 * Not one digit anywhere. A skeleton showing "1", "2", "3" down the left or a
 * plausible total on the right is a placeholder somebody will read as a rank —
 * and a rank is the thing a player is most likely to believe at a glance and
 * act on. Bars only, and none of them wide enough to look like a person.
 *
 * ============================ AND THE GEOMETRY IS THE SURFACE'S ==========
 *
 * Home's own loading state settled the pattern this follows: keep the shell,
 * and make the shape inside `<main>` resemble the page that is coming, so
 * nothing reflows when it arrives. One generic skeleton on nine different
 * surfaces would satisfy the letter of that and none of its point — a catalogue
 * of joinable games and a standings table settle into different shapes, and a
 * placeholder that settles into the wrong one is a jump with extra steps.
 *
 * So `shape` names the surface's geometry rather than a style:
 *
 *   * `table` — two controls, a heading and rows inside one bordered block.
 *     Leagues and any other standings surface.
 *   * `catalogue` — free-standing rows, each a title, a meta line and a
 *     trailing control. Discovery's competition list.
 *   * `cards` — a group heading and taller cards with a trailing action.
 *     The Games hub, whose rows carry Join.
 *   * `panels` — stacked bordered panels, each with a heading and a few lines.
 *     Account, which is two independent reads drawn as two panels.
 *
 * A surface with a shape of its own that none of these fit keeps its own
 * states file, which is why Home, the Match Predictor, Matches, the player
 * profile, Last Man Standing and the Championship still have theirs.
 */
export type VNextLoadingShape = 'table' | 'catalogue' | 'cards' | 'panels'

export function VNextLoadingRows({
  heading,
  destination,
  label = 'Loading',
  rows = 5,
  shape = 'table',
}: {
  readonly heading: string
  readonly destination: ShellDestinationId | 'none'
  readonly label?: string
  readonly rows?: number
  readonly shape?: VNextLoadingShape
}) {
  return (
    <VNextShell destination={destination} header={<VNextPageHeader title={heading} />}>
      <div className={styles.page} aria-busy="true" aria-live="polite">
        <span className={text.srOnly}>{label}</span>
        {shape === 'table' ? (
          <>
            <div className={styles.barRow} aria-hidden="true">
              <span className={`${styles.bar} ${styles.barControl}`} />
              <span className={`${styles.bar} ${styles.barControl}`} />
            </div>
            <span className={`${styles.bar} ${styles.barHeading}`} aria-hidden="true" />
            <div className={styles.table} aria-hidden="true">
              {Array.from({ length: rows }, (_, index) => (
                <span key={index} className={`${styles.bar} ${styles.barRowItem}`} />
              ))}
            </div>
          </>
        ) : shape === 'panels' ? (
          <div className={styles.panels} aria-hidden="true">
            {Array.from({ length: 2 }, (_, panel) => (
              <div key={panel} className={styles.panel}>
                <span className={`${styles.bar} ${styles.barHeading}`} />
                {Array.from({ length: 3 }, (_, line) => (
                  <span key={line} className={`${styles.bar} ${styles.barLine}`} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <>
            <span className={`${styles.bar} ${styles.barHeading}`} aria-hidden="true" />
            <div className={styles.stack} aria-hidden="true">
              {Array.from({ length: rows }, (_, index) => (
                <div
                  key={index}
                  className={shape === 'cards' ? styles.cardItem : styles.catalogueItem}
                >
                  <span className={styles.itemMain}>
                    <span className={`${styles.bar} ${styles.barTitle}`} />
                    <span className={`${styles.bar} ${styles.barMeta}`} />
                  </span>
                  <span className={`${styles.bar} ${styles.barControl}`} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </VNextShell>
  )
}
