import type { ReactNode } from 'react'
import { VNextShell } from '../../app/VNextShell'
import { VNextPageHeader } from '../../app/VNextPageHeader'
import typography from '../../foundations/typography.module.css'
import styles from './VNextHomeStates.module.css'

/**
 * THE STATES A CONNECTED HOME HAS AND A FIXTURE-BACKED ONE NEVER DID.
 *
 * All three keep the shell. The canvas, the masthead band, the navigation and
 * the `<main>` landmark are the APPLICATION's, and they are true before any read
 * lands — so a player who opens Home on a slow connection sees the product they
 * opened rather than a blank page that becomes one. Only the inside of `<main>`
 * is unknown, and only the inside of `<main>` is replaced.
 *
 * EXACTLY ONE `<h1>` IN EVERY STATE, and it is always the page header's. The
 * shell points `<main aria-labelledby>` at it through context, so the heading
 * contract holds while loading, while failed and while empty — states where an
 * accidental second heading or a missing one is easiest to ship, because nobody
 * screenshots them.
 */

/**
 * WHAT HOME LOOKS LIKE BEFORE IT KNOWS ANYTHING.
 *
 * The geometry is Home's own: a ticker strip, one tall dominant zone, then dense
 * rows. That is the shape of all three emphases, so whichever one the real state
 * turns out to deserve, the page does not jump when it arrives.
 *
 * NO NUMBERS, ANYWHERE. There is no placeholder rank, no greyed-out score and no
 * zero. A skeleton that draws a plausible figure is a skeleton that lies for
 * three hundred milliseconds, and the one thing worse than not knowing a score is
 * being shown the wrong one.
 *
 * `aria-busy` ON THE REGION, WITH A LABEL, and nothing more. A live region that
 * announced each block as it resolved would talk over the page for the whole
 * load. Assistive technology is told the region is busy and told what it is
 * waiting for, once.
 */
export function VNextHomeLoading({ header }: { header?: ReactNode }) {
  return (
    <VNextShell
      destination="home"
      header={header ?? <VNextPageHeader title="Home" />}
    >
      {/* `role="group"` because ARIA prohibits a name on the generic role, so
          `aria-label` on a bare div reaches nobody. The group is named and
          marked busy once — deliberately not a live region, which would narrate
          the whole load. */}
      <div
        className={styles.skeleton}
        role="group"
        aria-busy="true"
        aria-label="Loading your matchweek"
      >
        <div className={`${styles.block} ${styles.ticker}`} />
        <div className={`${styles.block} ${styles.stage}`} />
        <div className={styles.rows}>
          <div className={`${styles.block} ${styles.row}`} />
          <div className={`${styles.block} ${styles.row}`} />
          <div className={`${styles.block} ${styles.row}`} />
        </div>
      </div>
    </VNextShell>
  )
}

export type VNextHomeNoticeProps = {
  title: string
  body: string
  /** Omitted where retrying cannot help — signed out, or no competition. */
  onRetry?: () => void
  header?: ReactNode
}

/**
 * ONE HONEST NOTICE, USED BY EVERY NON-READY STATE THAT IS NOT LOADING.
 *
 * WHAT IT NEVER SAYS. No Supabase message, no SQL, no RPC name, no provider
 * name, no error code, no stack. The caller passes prose and this renders prose;
 * there is no path by which a caught error's `message` reaches the screen,
 * because the component cannot take one.
 *
 * IT IS NOT A LEGACY ERROR CARD DROPPED INTO HOME. It is the same raised
 * surface, hairline, radius and shadow every other Home zone uses, at the page
 * inset, so a failure looks like this product having a bad day rather than a
 * different product's dialog.
 *
 * RETRY IS OFFERED ONLY WHERE IT IS HONEST. A read that failed can be tried
 * again; being signed out cannot be fixed by trying again, and a season with no
 * competition will not acquire one on a second attempt. A button that does
 * nothing twice teaches a player to distrust every button.
 */
export function VNextHomeNotice({ title, body, onRetry, header }: VNextHomeNoticeProps) {
  return (
    <VNextShell
      destination="home"
      header={header ?? <VNextPageHeader title="Home" />}
    >
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
