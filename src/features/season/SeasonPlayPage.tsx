import { Link } from 'react-router'
import { EmptyState } from '../../design-system'
import type { PlayInbox } from './playInboxModel'
import styles from './SeasonPlayPage.module.css'

/**
 * Play: the games in this competition that are yours.
 *
 * IT IS A LIST OF DESTINATIONS, NOT A DASHBOARD. Each game's own page owns
 * what is due in it — the deadline, the pick, the card, the table — and
 * gathering those here would put a second copy of "what is due" beside the
 * reads that already answer it. What this adds is the short list: of everything
 * this competition offers, these are the ones you are in.
 *
 * A JOINED GAME WITH NO SURFACE IS STILL LISTED. Hiding it would misreport what
 * the player has joined, which is the failure the static Hub used to have in
 * the other direction. It simply carries no link.
 */

export type SeasonPlayPageProps = {
  inbox: PlayInbox
  /** Where Overview lives, for the empty state to point at. */
  overviewHref: string
}

export function SeasonPlayPage({ inbox, overviewHref }: SeasonPlayPageProps) {
  if (inbox.empty) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.heading}>Play</h2>
        <EmptyState
          title="You have not joined a game here yet"
          description="Games you join in this competition appear here, ready to play."
        />
        <Link className={styles.entry} to={overviewHref}>
          <span className={styles.name}>See the games in this competition</span>
          <span className={styles.note}>Overview</span>
        </Link>
      </section>
    )
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>Play</h2>
      <p className={styles.caption}>
        {inbox.entries.length === 1
          ? 'The game you have joined in this competition.'
          : `The ${inbox.entries.length} games you have joined in this competition.`}
      </p>

      <ul className={styles.list}>
        {inbox.entries.map((entry) => (
          <li key={entry.gameKey}>
            {entry.href ? (
              <Link className={styles.entry} to={entry.href}>
                <span className={styles.name}>{entry.name}</span>
                <span className={styles.note}>Open</span>
              </Link>
            ) : (
              <div className={styles.entryInert}>
                <span className={styles.name}>{entry.name}</span>
                <span className={styles.note}>Joined</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
