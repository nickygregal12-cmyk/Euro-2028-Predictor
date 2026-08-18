import { VNextShell } from '../../app/VNextShell'
import { VNextPageHeader } from '../../app/VNextPageHeader'
import text from '../../foundations/typography.module.css'
import styles from './VNextPlayerProfileStates.module.css'

/**
 * THE CONNECTED PROFILE WHILE IT HAS NO PROFILE TO SHOW.
 *
 * ============================ IT IS INSIDE THE SHELL ======================
 *
 * So a reader who cannot see a profile can still see where they are and can
 * still navigate. A loading screen that dropped the chrome is a page that
 * arrives twice.
 *
 * ============================ THE SKELETON HAS NO NUMBERS AND NO LINE =====
 *
 * Not one digit, not one name, and above all no plotted curve. A placeholder
 * chart is a season this player did not have, and a placeholder position is the
 * one figure here a reader will believe at a glance. Bars only.
 *
 * ============================ THERE IS NO NOTICE COMPONENT HERE ===========
 *
 * The signed-out, no-competition and failed notices are `VNextLeaguesNotice`'s,
 * reused rather than reworded. A profile lives in the LEAGUES destination —
 * that is the doorway it is opened from and the tab it highlights — so the two
 * surfaces are in the same place and want the same notice. A second component
 * differing only in its strings would be a second authority for one shape.
 */
export function VNextPlayerProfileLoading({ title = 'Player' }: { readonly title?: string }) {
  return (
    <VNextShell destination="leagues" header={<VNextPageHeader title={title} />}>
      <div className={styles.page} aria-busy="true" aria-live="polite">
        <span className={text.srOnly}>Loading this player&apos;s season</span>
        <div className={styles.panel} aria-hidden="true">
          <span className={`${styles.bar} ${styles.barHeading}`} />
          <span className={`${styles.bar} ${styles.barStats}`} />
          <span className={`${styles.bar} ${styles.barRowItem}`} />
          <span className={`${styles.bar} ${styles.barRowItem}`} />
        </div>
        <div className={styles.panel} aria-hidden="true">
          <span className={`${styles.bar} ${styles.barHeading}`} />
          <span className={`${styles.bar} ${styles.barChart}`} />
        </div>
        <div className={styles.panel} aria-hidden="true">
          <span className={`${styles.bar} ${styles.barHeading}`} />
          <span className={`${styles.bar} ${styles.barStats}`} />
          <span className={`${styles.bar} ${styles.barRowItem}`} />
        </div>
      </div>
    </VNextShell>
  )
}
