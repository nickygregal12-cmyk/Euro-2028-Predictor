import { useId } from 'react'
import type { ActivityItem, HomeModel } from '../models/home'
import { formatNumber, formatOrdinal } from '../foundations/format'
import typography from '../foundations/typography.module.css'
import { RankMovementIndicator } from '../components/game/RankMovementIndicator'
import { StatTile } from '../components/game/StatTile'
import { LeagueRace } from './LeagueRace'
import styles from './home.module.css'

export type CompetitionFocusProps = {
  model: HomeModel
}

/**
 * MY COMPETITION AS THE EVENT — the quiet-day dominant zone, and the one place
 * Game Command Centre's information is allowed to lead.
 *
 * THE LINE THIS WALKS. Concept B's answer to a Tuesday was a metric board:
 * tiles, trends, ledgers, a wire. It knew more about the user than either other
 * concept and it looked like an analytics product, which is precisely what the
 * brief says Home must not become. So what is borrowed is B's INFORMATION —
 * rank movement, gap to leader, who you can catch, who can catch you, how the
 * recent predictions actually went — and what is left behind is B's furniture.
 *
 * Four figures, the league races, and what has happened. No sparkline, no
 * trend chart, no ledger. The football-first visual language does not change
 * just because there is no football on: the same surfaces, the same radii, the
 * same type, and Around the Grounds still sits underneath carrying the fixtures
 * that are coming.
 *
 * EVERY CLAIM COMES FROM THE MODEL. Ranks, movement, gaps and accuracy are
 * supplied; nothing here computes what a result would be worth or what it would
 * take to overtake anyone, because that is scoring, and scoring is not Home's.
 */
export function CompetitionFocus({ model }: CompetitionFocusProps) {
  const headingId = useId()
  const { recentPerformance: performance, privateLeagues, activity } = model
  const { accuracy } = performance

  return (
    <section className={styles.competitionFocus} aria-labelledby={headingId}>
      <h2 id={headingId} className={`${typography.label} ${styles.zoneTitle}`}>
        Your season
      </h2>

      <div className={styles.competitionFigures}>
        <StatTile
          label="Total points"
          value={formatNumber(performance.totalPoints)}
          meta={`${formatNumber(accuracy.predicted)} predictions made`}
          tone="accent"
        />
        {/* AN UNRANKED SEASON IS A STATE, NOT A GAP IN THE GRID. A player with
            no banked standing yet has no rank, and the tile says so in words
            rather than printing an ordinal nothing supplied. Movement and the
            field size disappear with it: both describe a rank there isn't. */}
        <StatTile
          label="Overall rank"
          value={performance.rank === null ? 'Unranked' : formatOrdinal(performance.rank)}
          meta={
            performance.rank === null
              ? 'Ranked once a matchweek settles'
              : performance.rankOutOf === null
                ? undefined
                : `of ${formatNumber(performance.rankOutOf)} players`
          }
          trailing={
            performance.rankMovement === null ? undefined : (
              <RankMovementIndicator movement={performance.rankMovement} />
            )
          }
        />
        <StatTile
          label="Exact scores"
          value={formatNumber(accuracy.exact)}
          meta={`${formatNumber(accuracy.resultOnly)} right result · ${formatNumber(
            accuracy.missed,
          )} missed`}
        />
        <StatTile
          label="This matchweek"
          value={formatNumber(performance.matchweekPoints)}
          /* "Nothing in play" is a CLAIM, so it is only made where the figure
             is known. Null means nobody told us what is on the pitch, and the
             qualifier is omitted rather than asserting a quiet afternoon. */
          meta={
            performance.provisionalPoints === null
              ? undefined
              : performance.provisionalPoints > 0
                ? `${formatNumber(performance.provisionalPoints)} more on the pitch`
                : 'Nothing in play'
          }
        />
      </div>

      {privateLeagues.length > 0 ? (
        <div className={styles.competitionRaces}>
          {privateLeagues.map((league) => (
            <LeagueRace key={league.id} league={league} variant="race" />
          ))}
        </div>
      ) : (
        /* NOT AN EMPTY BOX. A user with no private league is not a broken state
           and must not be drawn as one — the surface says what a league would
           give them and points at the action the model already supplies. */
        <div className={styles.competitionEmpty}>
          <p className={`${typography.body} ${styles.competitionEmptyLead}`}>
            You are not in a private league yet.
          </p>
          <p className={typography.caption}>
            A private league is where the game gets its edge: the same fixtures,
            scored against people you know.
          </p>
        </div>
      )}

      {activity.length > 0 ? (
        <div className={styles.competitionActivity}>
          <p className={typography.label}>What has happened</p>
          <ul className={styles.activityList}>
            {activity.slice(0, 4).map((item) => (
              <li key={item.id} className={styles.activityItem}>
                {/* The emphasis is a word before it is a colour: the marker
                    carries a symbol and a hidden noun, so a positive and a
                    negative item are distinguishable in greyscale and by
                    anyone who never sees the border at all. */}
                <span
                  className={`${styles.activityMark} ${styles[item.emphasis]}`}
                  aria-hidden="true"
                >
                  {MARK[item.emphasis]}
                </span>
                <span className={styles.activityText}>
                  <span className={typography.body}>
                    <span className={typography.srOnly}>{TONE[item.emphasis]}: </span>
                    {item.headline}
                  </span>
                  {item.detail ? (
                    <span className={typography.micro}>{item.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

const MARK: Record<ActivityItem['emphasis'], string> = {
  positive: '▲',
  negative: '▼',
  neutral: '•',
}

const TONE: Record<ActivityItem['emphasis'], string> = {
  positive: 'Good news',
  negative: 'Bad news',
  neutral: 'Note',
}
