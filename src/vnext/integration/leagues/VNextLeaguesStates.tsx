import { VNextShell } from '../../app/VNextShell'
import { VNextPageHeader } from '../../app/VNextPageHeader'
import text from '../../foundations/typography.module.css'
import styles from './VNextLeaguesStates.module.css'

/**
 * THE STATES A CONNECTED LEAGUES SURFACE IS IN WHEN IT IS NOT SHOWING A TABLE.
 *
 * ============================ THEY ARE INSIDE THE SHELL ===================
 *
 * Every one renders `VNextShell`, so a player who cannot see a table can still
 * see where they are and can still navigate. A loading screen that dropped the
 * chrome would be a page that arrives twice.
 *
 * ============================ THE SKELETON HAS NO NUMBERS =================
 *
 * Not one digit anywhere. A standings skeleton showing "1", "2", "3" down the
 * left or a plausible points total on the right is a placeholder somebody will
 * read as a rank — and a rank is the single thing on this page a player is most
 * likely to believe at a glance and act on. Bars only.
 *
 * IT ALSO SHOWS NO NAMES. A skeleton row wide enough to look like a person is
 * a skeleton somebody screenshots.
 *
 * ============================ AN ERROR NEVER DENIES THE PLAYERS ===========
 *
 * "We could not load these standings" and never "you are not in any league" or
 * "there is nobody here". The read did not answer; that is a fact about the
 * request and not a fact about who is playing. Only the server can say the
 * second one, and when it does the page draws an ordinary empty table instead.
 */
export function VNextLeaguesLoading({ title = 'Leagues' }: { readonly title?: string }) {
  return (
    <VNextShell destination="leagues" header={<VNextPageHeader title={title} />}>
      <div className={styles.page} aria-busy="true" aria-live="polite">
        <span className={text.srOnly}>Loading standings</span>
        <div className={styles.barRow} aria-hidden="true">
          <span className={`${styles.bar} ${styles.barControl}`} />
          <span className={`${styles.bar} ${styles.barControl}`} />
        </div>
        <span className={`${styles.bar} ${styles.barHeading}`} aria-hidden="true" />
        <div className={styles.table} aria-hidden="true">
          <span className={`${styles.bar} ${styles.barRowItem}`} />
          <span className={`${styles.bar} ${styles.barRowItem}`} />
          <span className={`${styles.bar} ${styles.barRowItem}`} />
          <span className={`${styles.bar} ${styles.barRowItem}`} />
          <span className={`${styles.bar} ${styles.barRowItem}`} />
        </div>
      </div>
    </VNextShell>
  )
}

export type VNextLeaguesNoticeProps = {
  readonly title: string
  readonly body: string
  readonly heading?: string
  readonly onRetry?: (() => void) | undefined
}

export function VNextLeaguesNotice({
  title,
  body,
  heading = 'Leagues',
  onRetry,
}: VNextLeaguesNoticeProps) {
  return (
    <VNextShell destination="leagues" header={<VNextPageHeader title={heading} />}>
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
