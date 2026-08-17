import type { HomeModel } from '../models/home'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { formatNumber, formatOrdinal } from '../foundations/format'
import typography from '../foundations/typography.module.css'
import { RankMovementIndicator } from '../components/game/RankMovementIndicator'
import styles from './home.module.css'

export type HomeMastheadProps = {
  model: HomeModel
}

/**
 * WHAT HOME PUTS IN THE SHELL'S PAGE HEADER.
 *
 * The masthead used to be a Home component that also owned the sticky band, the
 * navigation and the page bounds. Those are the application's, and they now live
 * in `app/VNextShell`. What is left is the part that was only ever Home's: which
 * competition and matchweek this is — which every page states, so it goes
 * through `VNextPageHeader` — and how the user is doing, which no other page
 * states, so it goes through the header's `trailing` slot as a node Home builds.
 *
 * THE USER'S STANDING IS THREE SHORT LINES, NOT A PANEL. Football has first
 * claim on area on this page, and on a matchday the user's rank is context
 * rather than the subject. But "how am I doing" is one of the five questions the
 * first screen owes an answer to, so the season total, the rank, the movement
 * and the points still in play are all present — just small, and never competing
 * with the score.
 *
 * The shell does not know any of that, and must not learn it. A `rank` prop on
 * `VNextPageHeader` would be this composition with a generic name, and the next
 * page would inherit a points display it has no points for.
 */
export function HomeMasthead({ model }: HomeMastheadProps) {
  const { competition } = model

  return (
    <VNextPageHeader
      competition={competition.shortName}
      title={competition.matchweekLabel}
      context={`${competition.seasonLabel} · ${matchdayLine(model)}`}
      trailing={<HomeStanding model={model} />}
    />
  )
}

function HomeStanding({ model }: { model: HomeModel }) {
  const performance = model.recentPerformance
  const provisional = performance.provisionalPoints

  return (
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
