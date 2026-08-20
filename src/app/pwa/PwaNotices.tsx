import { Button } from '../../design-system'
import { useSite } from '../site/SiteProvider'
import { usePwaNotices } from './usePwaNotices'
import styles from './PwaNotices.module.css'

/**
 * At most one small notice, at the bottom, that the player can always ignore.
 *
 * ONE AT A TIME, IN ORDER OF WHAT IT COSTS THE PLAYER NOT TO KNOW. Being
 * offline first, because it explains failures already on screen. Then an
 * available update, because a stale bundle can be showing last week's
 * fixtures. The install suggestion last and least: it can always wait until
 * next time, and it is the only one of the three the player can dismiss.
 *
 * NOTHING HERE IS A MODAL. Neither notice blocks the page, takes focus, or
 * traps it. An install suggestion that interrupts somebody entering a scoreline
 * before a deadline would be the worst possible moment to appear, and a new
 * version that demanded attention would be worse still.
 *
 * IT IS LAZY, AND THE ENTRY CHUNK CARES. Loaded after first paint by
 * `PwaNoticesHost`, so neither this component, its stylesheet nor the
 * registration logic sits in the bundle every visitor downloads before anything
 * renders.
 */
export function PwaNotices() {
  const { productName } = useSite().brand
  const { offline, updateReady, invitation, applyUpdate, install, dismissInstall } =
    usePwaNotices()

  // FIRST, AND NOT DISMISSIBLE, BECAUSE IT IS STATUS RATHER THAN A SUGGESTION.
  // Offline, a navigation is answered from the cached shell — so the frame
  // renders and the reads behind it fail, which without this reads as "the
  // application is broken" rather than "this device has no connection". It says
  // what cannot happen rather than what has happened: no prediction, pick or
  // join is reported here, because whether one saved is the server's answer and
  // this notice has never spoken to the server.
  if (offline) {
    return (
      <div className={styles.host}>
        <div className={styles.notice} role="status" aria-live="polite">
          <p className={styles.title}>You&rsquo;re offline</p>
          <p className={styles.body}>
            You can still look around what has already loaded. Predictions,
            Jokers, picks and joins need a connection, and will not be saved
            until you have one.
          </p>
        </div>
      </div>
    )
  }

  if (updateReady) {
    return (
      <div className={styles.host}>
        <div className={styles.notice} role="status" aria-live="polite">
          <p className={styles.title}>
            A new version of {productName} is available
          </p>
          <p className={styles.body}>
            Refreshing loads it. Anything you have already saved stays saved.
          </p>
          <div className={styles.actions}>
            <Button variant="primary" onClick={applyUpdate}>
              Refresh
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (invitation.kind === 'prompt') {
    return (
      <div className={styles.host}>
        <div className={styles.notice}>
          <p className={styles.title}>
            Add {productName} to your home screen
          </p>
          <p className={styles.body}>
            It opens straight into the app, without the browser around it.
          </p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={dismissInstall}>
              Not now
            </Button>
            <Button variant="primary" onClick={install}>
              Add
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (invitation.kind === 'ios-guidance') {
    return (
      <div className={styles.host}>
        <div className={styles.notice}>
          <p className={styles.title}>
            Add {productName} to your home screen
          </p>
          {/* Safari exposes no install API, so this describes ITS OWN steps
              rather than offering a button that cannot do anything. The glyph
              is drawn because "the Share button" is a shape before it is a
              word, and the word for it differs between iOS versions. */}
          <ol className={styles.steps}>
            <li>
              Tap Share
              <ShareGlyph /> in Safari&rsquo;s toolbar.
            </li>
            <li>Choose &ldquo;Add to Home Screen&rdquo;.</li>
          </ol>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={dismissInstall}>
              Got it
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function ShareGlyph() {
  return (
    <svg
      className={styles.glyph}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Share"
    >
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}
