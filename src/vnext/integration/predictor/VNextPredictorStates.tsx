import { VNextShell } from '../../app/VNextShell'
import { VNextPageHeader } from '../../app/VNextPageHeader'
import typography from '../../foundations/typography.module.css'
import styles from './VNextPredictorStates.module.css'

/**
 * THE STATES A CONNECTED MATCH PREDICTOR HAS AND A FIXTURE-BACKED ONE NEVER DID.
 *
 * BOTH KEEP THE SHELL, for the reason the Home states record: the canvas, the
 * masthead, the navigation and the `<main>` landmark are the APPLICATION's and
 * they are true before any read lands. A player who opens the predictor on a slow
 * connection sees the product they opened rather than a blank page that becomes
 * one. Only the inside of `<main>` is unknown, and only that is replaced.
 *
 * EXACTLY ONE `<h1>` IN EVERY STATE, and it is always the page header's. These are
 * the states where a missing or duplicated heading is easiest to ship, because
 * nobody screenshots them.
 *
 * THE SKELETON DRAWS THE PREDICTOR'S OWN GEOMETRY — a brief, then a column of
 * rows — so the page does not jump when the card arrives. And it draws NO NUMBERS:
 * no placeholder deadline, no greyed progress, no zero. A skeleton that shows a
 * plausible figure lies for three hundred milliseconds, and on this page the
 * plausible figure would be a deadline.
 */

export function VNextPredictorLoading() {
  return (
    <VNextShell destination="fixtures" header={<VNextPageHeader title="Match Predictor" />}>
      {/* `role="group"` because ARIA prohibits a name on the generic role, so an
          `aria-label` on a bare div reaches nobody. Named and marked busy once —
          deliberately not a live region, which would narrate the whole load. */}
      <div
        className={styles.skeleton}
        role="group"
        aria-busy="true"
        aria-label="Loading this matchweek"
      >
        <div className={`${styles.block} ${styles.brief}`} />
        <div className={styles.rows}>
          <div className={`${styles.block} ${styles.row}`} />
          <div className={`${styles.block} ${styles.row}`} />
          <div className={`${styles.block} ${styles.row}`} />
          <div className={`${styles.block} ${styles.row}`} />
        </div>
      </div>
    </VNextShell>
  )
}

export type VNextPredictorNoticeProps = {
  title: string
  body: string
  /** Omitted where retrying cannot help — signed out, no competition, season over. */
  onRetry?: (() => void) | undefined
}

/**
 * ONE HONEST NOTICE FOR EVERY NON-READY STATE THAT IS NOT LOADING.
 *
 * WHAT IT NEVER SAYS on its own account: the component takes prose and renders
 * prose. Where a caller does pass a gateway's message through — the failed state
 * does, because an honest "unavailable" has to say WHICH thing was unavailable —
 * that is the application's own player-facing copy from `seasonPlayContextModel`,
 * which exists precisely because "a PostgREST message is not addressed to a
 * player".
 *
 * RETRY IS OFFERED ONLY WHERE IT IS HONEST. A read that failed can be tried
 * again; being signed out cannot be fixed by trying again, and a season that has
 * played its last matchweek will not acquire another one on a second attempt. A
 * button that does nothing twice teaches a player to distrust every button.
 */
export function VNextPredictorNotice({ title, body, onRetry }: VNextPredictorNoticeProps) {
  return (
    <VNextShell destination="fixtures" header={<VNextPageHeader title="Match Predictor" />}>
      <div className={styles.notice} role="group">
        <h2 className={`${typography.title} ${styles.noticeTitle}`}>{title}</h2>
        <p className={`${typography.body} ${styles.noticeBody}`}>{body}</p>
        {onRetry ? (
          <button type="button" className={styles.retry} onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    </VNextShell>
  )
}
