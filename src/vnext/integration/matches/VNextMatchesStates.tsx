import { VNextShell } from '../../app/VNextShell'
import { VNextPageHeader } from '../../app/VNextPageHeader'
import text from '../../foundations/typography.module.css'
import styles from './VNextMatchesStates.module.css'

/**
 * THE STATES A CONNECTED MATCHES SURFACE IS IN WHEN IT IS NOT SHOWING FOOTBALL.
 *
 * ============================ THEY ARE INSIDE THE SHELL ===================
 *
 * Every one renders `VNextShell`, so a player who cannot see fixtures can still
 * see where they are and can still navigate. A loading screen that dropped the
 * chrome would be a page that arrives twice: once as a bare panel, once as an
 * application.
 *
 * ============================ LOADING PRESERVES THE LAYOUT ================
 *
 * §26: a few full-width bars in the shape the day groups will take, not a
 * skeleton grid of twenty rows. A skeleton that is denser than the content is a
 * page that flashes as it settles. AND NO FAKE SCORE VALUES — there is no "0–0"
 * and no "15:00" anywhere in a skeleton, because a placeholder that looks like
 * football is a placeholder somebody will read as football.
 *
 * ============================ AN ERROR NEVER DENIES THE MATCH =============
 *
 * "We could not load these matches" and never "this match does not exist". The
 * two are different sentences and only the server can say the second one — see
 * `VNextMatchCentreScreen`, where a genuine refusal gets its own state.
 */
export function VNextMatchesLoading({ title = 'Matches' }: { readonly title?: string }) {
  return (
    <VNextShell destination="matches" header={<VNextPageHeader title={title} />}>
      <div className={styles.page} aria-busy="true" aria-live="polite">
        <span className={text.srOnly}>Loading matches</span>
        <div className={styles.barRow} aria-hidden="true">
          <span className={`${styles.bar} ${styles.barControl}`} />
          <span className={`${styles.bar} ${styles.barControl}`} />
          <span className={`${styles.bar} ${styles.barControl}`} />
        </div>
        <span className={`${styles.bar} ${styles.barHeading}`} aria-hidden="true" />
        <span className={`${styles.bar} ${styles.barRowItem}`} aria-hidden="true" />
        <span className={`${styles.bar} ${styles.barRowItem}`} aria-hidden="true" />
        <span className={`${styles.bar} ${styles.barRowItem}`} aria-hidden="true" />
      </div>
    </VNextShell>
  )
}

export type VNextMatchesNoticeProps = {
  readonly title: string
  readonly body: string
  readonly heading?: string
  readonly onRetry?: (() => void) | undefined
}

export function VNextMatchesNotice({
  title,
  body,
  heading = 'Matches',
  onRetry,
}: VNextMatchesNoticeProps) {
  return (
    <VNextShell destination="matches" header={<VNextPageHeader title={heading} />}>
      <div className={styles.page}>
        <div className={styles.notice} role="status">
          <p className={text.title}>{title}</p>
          <p className={`${text.body} ${styles.noticeBody}`}>{body}</p>
          {onRetry ? (
            <button type="button" className={styles.retry} onClick={onRetry}>
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </VNextShell>
  )
}
