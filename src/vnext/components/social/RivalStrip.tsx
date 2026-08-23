import { useId } from 'react'
import type { Rival } from '../../models/home'
import { formatSignedPoints } from '../../foundations/format'
import surfaces from '../../foundations/surfaces.module.css'
import typography from '../../foundations/typography.module.css'
import { RankMovementIndicator } from '../game/RankMovementIndicator'
import styles from './RivalStrip.module.css'

export type RivalStripProps = {
  rivals: readonly Rival[]
  title?: string
}

const RELATION_LABEL: Record<Rival['relation'], string> = {
  // "Watching" rather than "Watched": it says what the READER is doing, which
  // is the truth of it — the relation is one-directional and the person named
  // is not told about it.
  watched: 'Watching',
  leagueLeader: 'Leader',
  closestAbove: 'Just ahead',
  closestBelow: 'Just behind',
  friend: 'Friend',
}

/**
 * The people the user is actually playing against.
 *
 * This exists as its own component because rivalry is a first-class part of the
 * game rather than a footnote on a leaderboard. Each entry says who, by how
 * much, and which way they are moving — the three facts that make a small
 * points gap feel like something to close.
 *
 * The signed difference is written with a real minus sign and a word ("ahead",
 * "behind"), so the sign is never the only thing carrying the direction.
 */
export function RivalStrip({ rivals, title = 'Your rivals' }: RivalStripProps) {
  const headingId = useId()
  if (rivals.length === 0) return null

  return (
    <section
      className={`${surfaces.surface} ${styles.strip}`}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className={typography.label}>
        {title}
      </h2>
      <ul className={styles.list}>
        {rivals.map((rival) => (
          <li key={`${rival.player.id}-${rival.sharedLeagueName}`} className={styles.item}>
            <span className={styles.avatar} aria-hidden="true">
              {rival.player.initials}
            </span>
            <span className={styles.detail}>
              <span className={styles.nameRow}>
                <span className={`${typography.body} ${typography.clamp2}`}>
                  {rival.player.name}
                </span>
                <span className={styles.relation}>
                  {RELATION_LABEL[rival.relation]}
                </span>
              </span>
              <span className={`${typography.micro} ${typography.clamp2}`}>
                {rival.headline ?? rival.sharedLeagueName}
              </span>
            </span>
            <span className={styles.numbers}>
              <span
                className={`${styles.difference} ${
                  rival.pointsDifference > 0 ? styles.behind : styles.ahead
                } ${typography.numeric}`}
              >
                {formatSignedPoints(rival.pointsDifference)}
                <span className={typography.srOnly}>
                  {describeDifference(rival.pointsDifference)}
                </span>
              </span>
              <RankMovementIndicator
                movement={rival.movement}
                subject={rival.player.name}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * A level rival is a real state and needs its own sentence, not "0 behind".
 *
 * Each string opens with punctuation rather than a space, because the visible
 * number and this hidden text are announced with no separator between them.
 */
function describeDifference(difference: number): string {
  if (difference > 0) return ', points ahead of you'
  if (difference < 0) return ', points behind you'
  return ', level with you'
}
