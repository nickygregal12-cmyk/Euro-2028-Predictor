import type { Match } from '../models/football'
import { formatKickoffLabel } from '../foundations/format'
import surfaces from '../foundations/surfaces.module.css'
import typography from '../foundations/typography.module.css'
import styles from './home.module.css'

export type FixtureTickerProps = {
  matches: readonly Match[]
  now: string
}

/**
 * THE SCORE BAR — every fixture in the matchweek, one row tall, at every width.
 *
 * This is the strongest navigational idea Stage 3 produced and it is kept
 * whole. It is what lets Home give one match an entire stage without hiding the
 * other four: "what else is happening" is answered on the first screen, in a
 * strip, in the order a broadcast would put them — what is on now, what is
 * coming, what has finished.
 *
 * IT IS A LIST, NOT A MARQUEE. Continuous horizontal travel is motion with no
 * job, it cannot be read at a glance, and it is the first thing a
 * reduced-motion user would have to fight. The scrolling is the user's, the
 * scroller takes focus so a keyboard can drive it, and every item snaps.
 *
 * CLUB NAMES GROW WITH THE ROOM. The three-letter code is what fits on a phone
 * and it is the model's own field for exactly that job — but shrinking names to
 * fit MORE fixtures onto a wide screen is how a ticker becomes a puzzle, so at
 * 760px and up each item switches to the short club name and the strip simply
 * carries fewer items per screen. Both spellings are always in the DOM and CSS
 * chooses; the accessible sentence always uses the full name regardless.
 */
export function FixtureTicker({ matches, now }: FixtureTickerProps) {

  if (matches.length === 0) return null

  return (
    <section
      className={styles.ticker}
      aria-label="Matchweek scores"
      data-vnext-zone="scores"
    >
      {/* The fade is `surfaces.scrollEdges` rather than a rule of this page's
       * own, because "this scroller has more to the right" is the same sentence
       * on every strip in the product and it should not be written twice. */}
      <div className={`${styles.tickerScroller} ${surfaces.scrollEdges}`} tabIndex={0}>
        <ul className={styles.tickerList}>
          {matches.map((match) => {
            const inPlay = match.status === 'live' || match.status === 'halfTime'
            return (
              <li
                key={match.id}
                className={`${styles.tickerItem} ${inPlay ? styles.tickerLive : ''} ${
                  match.status === 'postponed' ? styles.tickerOff : ''
                }`}
              >
                <span className={`${styles.tickerState} ${typography.numeric}`}>
                  {stateLabel(match, now)}
                </span>

                <span className={styles.tickerTeams}>
                  {[match.home, match.away].map((side, index) => (
                    <span
                      key={side.team.id}
                      className={`${styles.tickerTeam} ${typography.numeric}`}
                      aria-hidden="true"
                    >
                      <span className={styles.tickerCode}>{side.team.abbreviation}</span>
                      <span className={styles.tickerShort}>
                        {side.team.shortName}
                      </span>
                      <span className={styles.tickerGoals}>
                        {match.score
                          ? index === 0
                            ? match.score.home
                            : match.score.away
                          : '–'}
                      </span>
                    </span>
                  ))}
                </span>

                <span className={typography.srOnly}>{describe(match, now)}</span>

                <span
                  className={`${styles.tickerCall} ${
                    match.prediction ? '' : styles.tickerCallOpen
                  } ${typography.numeric}`}
                  aria-hidden="true"
                >
                  {match.prediction
                    ? `${match.prediction.score.home}–${match.prediction.score.away}`
                    : '– –'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/** The state chip. Every status the model declares has a label here. */
function stateLabel(match: Match, now: string): string {
  switch (match.status) {
    case 'live':
      return match.clock?.label ?? 'Live'
    case 'halfTime':
      return 'HT'
    case 'fullTime':
      return 'FT'
    case 'postponed':
      return 'P–P'
    default:
      // Tomorrow's fixture must not read as another kick-off today, so the day
      // comes from the model instant rather than from the clock.
      return formatKickoffLabel(match.kickoff, now).replace('Today ', '')
  }
}

/** One sentence per item, because a grid of codes is not readable aloud. */
function describe(match: Match, now: string): string {
  const teams = `${match.home.team.name} versus ${match.away.team.name}`
  const state =
    match.status === 'postponed'
      ? 'postponed'
      : match.score
        ? `${match.score.home}–${match.score.away}, ${stateLabel(match, now)}`
        : `kicks off ${formatKickoffLabel(match.kickoff, now)}`
  const call = match.prediction
    ? `your call ${match.prediction.score.home}–${match.prediction.score.away}`
    : 'not predicted'
  return `${teams}, ${state}, ${call}`
}
