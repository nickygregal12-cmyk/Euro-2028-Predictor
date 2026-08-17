import type { HomeModel } from '../models/home'
import { formatNumber, formatOrdinal } from '../foundations/format'
import typography from '../foundations/typography.module.css'
import { RankMovementIndicator } from '../components/game/RankMovementIndicator'
import { VNextNav, defaultNavItems } from '../components/navigation/VNextNav'
import styles from './home.module.css'

export type HomeMastheadProps = {
  model: HomeModel
  headingId: string
  /** Open predictions, for the badge on Fixtures. Zero renders nothing. */
  openPredictions: number
}

/**
 * THE MASTHEAD — the part of Home that does not change.
 *
 * Whatever the page is emphasising underneath, this band answers the same two
 * questions in the same place: WHICH COMPETITION AND MATCHWEEK AM I IN, and HOW
 * AM I DOING. That constancy is what makes the three emphases feel like one
 * surface rather than three products — same stadium, different match state.
 *
 * THE USER'S STANDING IS THREE SHORT LINES, NOT A PANEL. Football has first
 * claim on area on this page, and on a matchday the user's rank is context
 * rather than the subject. But "how am I doing" is one of the five questions
 * the first screen owes an answer to, so the season total, the rank, the
 * movement and the points still in play are all present — just small, and never
 * competing with the score.
 *
 * NAVIGATION IS RENDERED ONCE HERE AND ONCE AT THE FOOT OF THE PAGE, and CSS
 * shows exactly one of them. `display: none` removes the other from the
 * accessibility tree as well as from the page, so there is never a duplicate
 * landmark or a focus stop on a navigation nobody can see.
 */
export function HomeMasthead({
  model,
  headingId,
  openPredictions,
}: HomeMastheadProps) {
  const { competition, recentPerformance: performance } = model
  const provisional = performance.provisionalPoints

  return (
    <>
      <div className={styles.mastheadTop}>
        <div className={styles.competition}>
          <p className={typography.label}>{competition.shortName}</p>
          <h1 id={headingId} className={`${typography.title} ${styles.matchweek}`}>
            {competition.matchweekLabel}
          </h1>
          <p className={typography.micro}>
            {competition.seasonLabel} · {matchdayLine(model)}
          </p>
        </div>

        <div className={styles.standing}>
          <p className={typography.label}>Your rank</p>
          <p className={`${styles.standingValue} ${typography.numeric}`}>
            {formatOrdinal(performance.rank)}
            <RankMovementIndicator movement={performance.rankMovement} />
          </p>
          <p className={typography.micro}>
            {formatNumber(performance.totalPoints)} pts
            {provisional > 0 ? ` · ${formatNumber(provisional)} on the pitch` : ''}
          </p>
          <p className={typography.micro}>
            of {formatNumber(performance.rankOutOf)} players
          </p>
        </div>
      </div>

      <div className={styles.mastheadNav}>
        <VNextNav
          variant="band"
          activeId="home"
          items={withBadge(openPredictions)}
        />
      </div>
    </>
  )
}

/** The bottom bar, rendered by the shell at the foot of the page. */
export function HomeNavBar({ openPredictions }: { openPredictions: number }) {
  return (
    <div className={styles.navBar}>
      <VNextNav variant="bar" activeId="home" items={withBadge(openPredictions)} />
    </div>
  )
}

function withBadge(openPredictions: number) {
  if (openPredictions <= 0) return defaultNavItems
  return defaultNavItems.map((item) =>
    item.id === 'fixtures' ? { ...item, badge: openPredictions } : item,
  )
}

/**
 * "2 live · 2 to come" — what the matchweek is doing, in one line.
 *
 * Counts come from the partitions the model supplied. Home does not work out
 * which bucket a match belongs in; it reports how many are already in each.
 */
function matchdayLine(model: HomeModel): string {
  const parts: string[] = []
  if (model.liveMatches.length > 0) parts.push(`${model.liveMatches.length} live`)
  if (model.upcomingMatches.length > 0) {
    parts.push(`${model.upcomingMatches.length} to come`)
  }
  if (model.recentResults.length > 0) {
    parts.push(`${model.recentResults.length} settled`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'No fixtures scheduled'
}
