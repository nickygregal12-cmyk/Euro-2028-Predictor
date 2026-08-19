import { VNextShell } from '../../app/VNextShell'
import { VNextPageHeader } from '../../app/VNextPageHeader'
import text from '../../foundations/typography.module.css'
import styles from './VNextLmsStates.module.css'

/**
 * THE CONNECTED SURFACE WHILE IT HAS NO ROUND TO SHOW.
 *
 * ============================ IT IS INSIDE THE SHELL ======================
 *
 * So a player who cannot see a round can still see where they are and can still
 * navigate away.
 *
 * ============================ THE SKELETON NAMES NO CLUB ==================
 *
 * Not one club name, not one digit, and nothing shaped like a button. On a
 * standings page a placeholder is read as a rank; here it would be TAPPED, and
 * a tap on this surface spends a club for the season. The bars are pairs
 * because the real list is pairs, and that is as far as the resemblance goes.
 *
 * ============================ THERE IS NO NOTICE COMPONENT HERE ===========
 *
 * The signed-out, no-competition and failed notices are `VNextLeaguesNotice`'s,
 * reused rather than reworded — the same choice Stage 10 made, for the same
 * reason: a second component differing only in its strings is a second
 * authority for one shape. Its heading is a prop, so it says the right thing.
 */
export function VNextLmsLoading() {
  return (
    <VNextShell destination="games" header={<VNextPageHeader title="Last Man Standing" />}>
      <div className={styles.page} aria-busy="true" aria-live="polite">
        <span className={text.srOnly}>Loading this round</span>
        <span className={`${styles.bar} ${styles.barStanding}`} aria-hidden="true" />
        <div className={styles.round} aria-hidden="true">
          <span className={`${styles.bar} ${styles.barHeading}`} />
          <div className={styles.pairs}>
            <span className={`${styles.bar} ${styles.barPair}`} />
            <span className={`${styles.bar} ${styles.barPair}`} />
            <span className={`${styles.bar} ${styles.barPair}`} />
            <span className={`${styles.bar} ${styles.barPair}`} />
          </div>
        </div>
      </div>
    </VNextShell>
  )
}
