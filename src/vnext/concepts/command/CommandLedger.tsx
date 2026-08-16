import { motion } from 'framer-motion'
import type { Match } from '../../models/football'
import type { HomeModel } from '../../models/home'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import { formatShare } from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import { LiveIndicator } from '../../components/football/LiveIndicator'
import { TeamKey } from './TeamKey'
import styles from './command.module.css'

export type CommandLedgerProps = {
  model: HomeModel
}

/**
 * The live ledger: football as consequence.
 *
 * This is Concept B's answer to "how dominant should live football be". Not
 * dominant — ACCOUNTED FOR. Each match in play is one line stating the current
 * scoreline, what the user called, and what that is worth AT THIS MOMENT, with
 * a total underneath. It is the same live football Concept A gives a whole
 * stage to, expressed as the four numbers a player checking their phone at
 * half-time actually wants.
 *
 * PROVISIONAL IS SAID EVERY TIME. The total is labelled "on the pitch", each
 * row's figure is labelled provisional, and neither is ever added to the banked
 * total in the status band. The backend awards points; a ledger that quietly
 * summed the two would be presentation inventing a score.
 */
export function CommandLedger({ model }: CommandLedgerProps) {
  const emphasis = useVNextMotion(vnextMotion.pointsEmphasis)
  const live = model.liveMatches
  const onThePitch = model.recentPerformance.provisionalPoints

  return (
    <div className={styles.panel}>
      <header className={styles.panelHead}>
        <h2 className={`${typography.label} ${styles.panelTitle}`}>Live ledger</h2>
        <p className={typography.micro}>
          {live.length} in play · updates while they are on
        </p>
      </header>

      <ul className={styles.ledgerList}>
        {live.map((match) => (
          <li key={match.id} className={styles.ledgerRow}>
            <span className={styles.ledgerState}>
              <LiveIndicator status={match.status} clock={match.clock} />
            </span>

            <span className={styles.ledgerFixture}>
              <span className={styles.ledgerTeams}>
                <TeamKey team={match.home.team} />
                <span className={`${styles.ledgerScore} ${typography.numeric}`}>
                  {match.score?.home ?? '–'}
                </span>
              </span>
              <span className={styles.ledgerTeams}>
                <TeamKey team={match.away.team} />
                <span className={`${styles.ledgerScore} ${typography.numeric}`}>
                  {match.score?.away ?? '–'}
                </span>
              </span>
            </span>

            <span className={styles.ledgerCall}>
              <span className={typography.label}>Your call</span>
              <span className={`${styles.ledgerCallScore} ${typography.numeric}`}>
                {match.prediction
                  ? `${match.prediction.score.home}–${match.prediction.score.away}`
                  : '—'}
                {match.prediction?.isJoker ? (
                  <span className={styles.ledgerJoker}>
                    Joker
                    <span className={typography.srOnly}>, played on this match</span>
                  </span>
                ) : null}
              </span>
            </span>

            <span
              className={`${styles.ledgerWorth} ${
                (match.prediction?.points ?? 0) > 0
                  ? styles.ledgerWorthUp
                  : styles.ledgerWorthFlat
              }`}
            >
              <span className={`${styles.ledgerWorthValue} ${typography.numeric}`}>
                {match.prediction?.points ?? 0}
              </span>
              <span className={typography.micro}>{verdict(match)}</span>
            </span>
          </li>
        ))}
      </ul>

      <footer className={styles.ledgerFoot}>
        <span className={typography.label}>On the pitch</span>
        <motion.span
          className={`${styles.ledgerTotal} ${typography.numeric}`}
          variants={emphasis}
          initial="rest"
          animate="rest"
        >
          {onThePitch} pts
        </motion.span>
        <span className={`${typography.micro} ${styles.ledgerFootNote}`}>
          Provisional. Nothing here is awarded until the backend settles the
          match.
        </span>
      </footer>
    </div>
  )
}

/** A word, so the figure is never carried by its colour alone. */
function verdict(match: Match): string {
  const prediction = match.prediction
  if (!prediction || !match.score) return 'no call'
  const exact =
    prediction.score.home === match.score.home &&
    prediction.score.away === match.score.away
  if (exact) return 'exact, provisional'
  const result = (home: number, away: number) =>
    home === away ? 'draw' : home > away ? 'home' : 'away'
  if (
    result(prediction.score.home, prediction.score.away) ===
    result(match.score.home, match.score.away)
  ) {
    return 'result, provisional'
  }
  const crowd = match.consensus?.community
  return crowd
    ? `off — ${formatShare(crowd.awayWinShare)} backed away`
    : 'off as it stands'
}
