import { VNextShell } from '../../app/VNextShell'
import { VNextPageHeader } from '../../app/VNextPageHeader'
import text from '../../foundations/typography.module.css'
import styles from './VNextChampionshipStates.module.css'

/**
 * THE CONNECTED SURFACE WHILE IT HAS NO BRACKET TO SHOW.
 *
 * ============================ IT IS INSIDE THE SHELL ======================
 *
 * So a player who cannot see their Championship can still see where they are
 * and can still navigate away.
 *
 * ============================ THE SKELETON NAMES NOBODY ==================
 *
 * Not one player name, not one round label, and nothing shaped like a seat a
 * reader might scan for themselves. A placeholder on a bracket is read as a
 * DRAW — somebody looking for their own tie would find a shape where it will
 * be — so the bars are deliberately uniform and carry no pairing at all.
 *
 * ============================ THERE IS NO NOTICE COMPONENT HERE ===========
 *
 * The signed-out, no-competition and failed notices are `VNextLeaguesNotice`'s,
 * reused rather than reworded — the same choice Stages 10 and 11 made, for the
 * same reason: a second component differing only in its strings is a second
 * authority for one shape.
 */
export function VNextChampionshipLoading() {
  return (
    <VNextShell
      destination="games"
      header={<VNextPageHeader title="Predictor Championship" />}
    >
      <div className={styles.page} aria-busy="true" aria-live="polite">
        <span className={text.srOnly}>Loading this Championship</span>
        <span className={`${styles.bar} ${styles.barStanding}`} aria-hidden="true" />
        <div className={styles.rounds} aria-hidden="true">
          {[0, 1, 2].map((round) => (
            <div key={round} className={styles.round}>
              <span className={`${styles.bar} ${styles.barHeading}`} />
              <span className={`${styles.bar} ${styles.barSeat}`} />
              <span className={`${styles.bar} ${styles.barSeat}`} />
            </div>
          ))}
        </div>
      </div>
    </VNextShell>
  )
}
