import type { PrivateLeague, PrivateLeagueStanding } from '../models/home'
import { formatNumber, formatOrdinal } from '../foundations/format'
import typography from '../foundations/typography.module.css'
import { RankMovementIndicator } from '../components/game/RankMovementIndicator'
import styles from './home.module.css'

export type LeagueRaceVariant = 'strip' | 'race'

export type LeagueRaceProps = {
  league: PrivateLeague
  /**
   * `strip` is the three-line mobile module; `race` is the windowed table.
   * Same facts, same order, same wording — only how much room they are given.
   */
  variant?: LeagueRaceVariant
}

/**
 * YOUR LEAGUE RACE — the competitive treatment borrowed from Game Command
 * Centre, cut down to the size Matchday Arena can afford to give it.
 *
 * HOME ANSWERS "WHAT'S THE BATTLE?", NOT "SHOW ME EVERY ROW". A fifty-person
 * league rendered on Home is a standings page that has wandered onto the front
 * door: it costs the football most of a screen and tells the user nothing they
 * could act on. So this shows three rows at most — the player above, the user,
 * the player below — which is the whole of the battle the user is actually in.
 * The full table is a destination, and Leagues is where it lives.
 *
 * WHAT IT MAY CLAIM. Only what the model supplied: ranks, points, movement,
 * `gapToLeader` and `leaderName`. The gap between two rows is the difference
 * between two point totals the model stated — the same arithmetic the model
 * does for `Rival.pointsDifference` — and nothing here works out what it would
 * TAKE to overtake anybody, because that depends on scoring rules Home does not
 * own.
 *
 * MOVEMENT IS NEVER ONLY A COLOUR. Every arrow is a shape plus a number plus a
 * screen-reader sentence, which is `RankMovementIndicator`'s whole job.
 */
export function LeagueRace({ league, variant = 'race' }: LeagueRaceProps) {
  const window = raceWindow(league)
  const user = window.find((standing) => standing.isUser) ?? null
  // ADJACENT, NOT MERELY ABOVE. The window is sorted ascending, so `find`
  // returns the HIGHEST-placed row rather than the nearest one. That is the same
  // answer whenever the user sits in the middle of the window — and the wrong
  // one whenever `raceWindow` clamps to the end of a longer table, where the
  // window is [n-2, n-1, YOU] and the first match is two places up. Home would
  // then name the wrong player and quote a gap the user is not actually facing.
  // `findLast` takes the nearest row above; `find` is already nearest below,
  // because the first ascending row past the user IS the adjacent one.
  const above = user
    ? (window.findLast((standing) => standing.rank < user.rank) ?? null)
    : null
  const below = user
    ? (window.find((standing) => standing.rank > user.rank) ?? null)
    : null

  if (variant === 'strip') {
    return (
      <div className={styles.raceStrip}>
        <p className={styles.raceStripHead}>
          <span className={`${typography.label} ${styles.raceStripName}`}>
            {league.name}
          </span>
          <span className={styles.raceStripRank}>
            <span className={`${typography.numeric} ${styles.raceStripRankValue}`}>
              {formatOrdinal(league.userRank)}
            </span>
            <RankMovementIndicator movement={league.userMovement} />
          </span>
        </p>
        {/* Two sentences at most, and the one about the player who can catch
            the user is as important as the one about the player they are
            chasing — B's "who can catch you" is the half a ladder never says. */}
        <p className={`${typography.caption} ${styles.raceStripLine}`}>
          {chaseLine(league, user, above)}
        </p>
        {below && user ? (
          <p className={`${typography.caption} ${styles.raceStripLine}`}>
            {gapWord(user.points - below.points)} behind you:{' '}
            <span className={styles.raceStripWho}>{below.player.name}</span>
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.race}>
      <p className={`${typography.label} ${styles.raceName}`}>{league.name}</p>
      <ol className={styles.raceList}>
        {window.map((standing) => (
          <li
            key={standing.player.id}
            className={`${styles.raceRow} ${standing.isUser ? styles.raceRowUser : ''}`}
            aria-current={standing.isUser ? 'true' : undefined}
          >
            <span className={`${styles.raceRank} ${typography.numeric}`}>
              {standing.rank}
            </span>
            <span className={`${styles.racePlayer} ${typography.clamp2}`}>
              {standing.isUser ? 'You' : standing.player.name}
            </span>
            <RankMovementIndicator
              movement={standing.movement}
              subject={standing.isUser ? 'You' : standing.player.name}
            />
            <span className={`${styles.racePoints} ${typography.numeric}`}>
              {formatNumber(standing.points)}
            </span>
          </li>
        ))}
      </ol>
      <p className={`${typography.caption} ${styles.raceGap}`}>
        {chaseLine(league, user, above)}
      </p>
      {below && user ? (
        <p className={`${typography.caption} ${styles.raceGap}`}>
          {below.player.name} is {gapWord(user.points - below.points)} behind you
        </p>
      ) : null}
      <p className={`${typography.micro} ${styles.raceSize}`}>
        {formatNumber(league.participantCount)} players
      </p>
    </div>
  )
}

/**
 * The three rows either side of the user.
 *
 * `standings` is already a window rather than a whole league, but it is not
 * guaranteed to be three rows — the fixture ships four — and Home is the
 * surface that decides how much of it to spend. A user at the top gets the two
 * players chasing them rather than a blank row where "above" would be.
 */
function raceWindow(league: PrivateLeague): readonly PrivateLeagueStanding[] {
  const ordered = [...league.standings].sort((a, b) => a.rank - b.rank)
  const index = ordered.findIndex((standing) => standing.isUser)
  if (index === -1) return ordered.slice(0, 3)

  const start = Math.max(0, Math.min(index - 1, ordered.length - 3))
  return ordered.slice(start, start + 3)
}

/**
 * The single sentence about the player the user is chasing.
 *
 * Prefers the row immediately above, because that is the place actually
 * available; falls back to the leader, whom the model names outright. When the
 * user leads, the honest sentence is that they do.
 */
function chaseLine(
  league: PrivateLeague,
  user: PrivateLeagueStanding | null,
  above: PrivateLeagueStanding | null,
): string {
  if (above && user) {
    return `${gapWord(above.points - user.points)} to catch ${above.player.name}`
  }
  if (league.gapToLeader > 0) {
    return `${gapWord(league.gapToLeader)} to catch ${league.leaderName}`
  }
  return 'You lead it'
}

/** "1 pt", "2 pts", "level" — a gap is never rendered as a bare number. */
function gapWord(points: number): string {
  const magnitude = Math.abs(points)
  if (magnitude === 0) return 'level'
  return `${formatNumber(magnitude)} ${magnitude === 1 ? 'pt' : 'pts'}`
}
