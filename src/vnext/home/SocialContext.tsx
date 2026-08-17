import { useId } from 'react'
import type { HomeModel } from '../models/home'
import { formatNumber } from '../foundations/format'
import typography from '../foundations/typography.module.css'
import { LeagueRace } from './LeagueRace'
import { pickHeadlineLeague } from './selectHomeEmphasis'
import styles from './home.module.css'

export type SocialContextProps = {
  model: HomeModel
}

/**
 * THE COMPACT COMPETITIVE MODULE — Matchday Arena's weakest area, fixed with
 * Game Command Centre's information.
 *
 * The brief settled this one outright: Arena needed a stronger social presence
 * on mobile, and it needed it without pushing the football down the page. So
 * this sits BELOW the featured match and above Around the Grounds, and on a
 * phone it is three lines:
 *
 *     WORK LEAGUE · 2ND ▲2
 *     2 pts to catch Jamie Ferguson-Whyte
 *     3 pts behind you: Martin Okafor
 *
 * WHY TWO SHAPES RATHER THAN ONE RESPONSIVE ONE. A phone can afford the battle;
 * a desktop column can afford the table that shows it. Both are rendered and a
 * container query displays exactly one — `display: none` takes the other out of
 * the accessibility tree as well as off the page, so nothing is announced
 * twice. It is the same idiom the navigation uses, for the same reason.
 *
 * ONE LEAGUE ON A PHONE, ALL OF THEM ON A DESKTOP. Home answers "what's the
 * battle?", and on 375px of width the battle is the league where the user is
 * closest to a place they could take. The desktop composition has room for
 * every league the user is in, so it shows them.
 *
 * THE CONSEQUENCE LINE IS QUOTED, NOT CALCULATED. "6 pts on the pitch" and "up
 * 214 places" are figures the model supplied. Home never works out what a
 * scoreline would be worth or where a result would leave the user, because that
 * is scoring and settlement, and neither belongs to presentation.
 */
export function SocialContext({ model }: SocialContextProps) {
  const headingId = useId()
  const headline = pickHeadlineLeague(model)
  const consequence = consequenceLine(model)

  if (!headline) {
    return (
      <section className={styles.social} aria-labelledby={headingId}>
        <h2 id={headingId} className={`${typography.label} ${styles.zoneTitle}`}>
          Your league race
        </h2>
        <p className={`${typography.body} ${styles.socialEmpty}`}>
          You are not in a private league yet.
        </p>
        <p className={typography.caption}>
          {consequence ?? 'Join one to play these fixtures against people you know.'}
        </p>
      </section>
    )
  }

  return (
    <section className={styles.social} aria-labelledby={headingId}>
      <h2 id={headingId} className={`${typography.label} ${styles.zoneTitle}`}>
        Your league race
      </h2>

      {consequence ? (
        <p className={`${typography.caption} ${styles.socialConsequence}`}>
          {consequence}
        </p>
      ) : null}

      <div className={styles.socialCompact}>
        <LeagueRace league={headline} variant="strip" />
      </div>

      <div className={styles.socialFull}>
        {model.privateLeagues.map((league) => (
          <LeagueRace key={league.id} league={league} variant="race" />
        ))}
      </div>
    </section>
  )
}

/**
 * What today has done to the user's standing, in the model's own numbers.
 *
 * Provisional points are always labelled provisional — the backend awards
 * points, and a line that read "6 pts today" while two matches were still being
 * played would have told the user something that is not yet true.
 */
function consequenceLine(model: HomeModel): string | null {
  const { provisionalPoints, pointsToday, rankMovement } = model.recentPerformance
  const parts: string[] = []

  if (provisionalPoints > 0) {
    parts.push(`${formatNumber(provisionalPoints)} pts on the pitch`)
  }
  if (pointsToday > 0) {
    parts.push(`${formatNumber(pointsToday)} banked today`)
  }
  if (rankMovement.direction === 'up' && rankMovement.places > 0) {
    parts.push(`up ${formatNumber(rankMovement.places)} places overall`)
  }
  if (rankMovement.direction === 'down' && rankMovement.places > 0) {
    parts.push(`down ${formatNumber(rankMovement.places)} places overall`)
  }

  return parts.length > 0 ? capitalise(parts.join(' · ')) : null
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
