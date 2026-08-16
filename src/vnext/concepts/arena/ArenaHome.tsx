import { useId } from 'react'
import { motion } from 'framer-motion'
import type { HomeModel } from '../../models/home'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import { formatCountdown, formatNumber, formatOrdinal } from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import { RankMovementIndicator } from '../../components/game/RankMovementIndicator'
import { ArenaFeature } from './ArenaFeature'
import { ArenaGrounds } from './ArenaGrounds'
import { ArenaNav } from './ArenaNav'
import { ArenaTerrace } from './ArenaTerrace'
import { ArenaTicker } from './ArenaTicker'
import styles from './arena.module.css'

export type ArenaHomeProps = {
  model: HomeModel
}

/**
 * CONCEPT A — MATCHDAY ARENA.
 *
 * ONE IDEA: THE FOOTBALL IS THE EVENT, AND THE PAGE IS THE BROADCAST.
 *
 * The information architecture, not the styling, is what makes this concept
 * what it is. There is a masthead, a score bar and then a STAGE: one match
 * gets a whole zone to itself and everything else is a supporting row. That
 * is the shape of a football broadcast — one camera on the important game,
 * a strip of everything else along the top — and it is deliberately the
 * opposite of a dashboard of equal cards.
 *
 * WHAT EARNS THE FIRST SCREEN. The competition, the live scores, the one
 * thing the user still has to do, and then the featured match. The user's own
 * standing is present in the masthead as a single line rather than a panel,
 * because on a Saturday afternoon it is context, not the subject.
 *
 * WHERE RIVALRY LIVES. In "the terrace": a strip beneath the football on
 * mobile and tablet, a column beside it only once the desktop is wide enough
 * that taking one does not narrow the stage. Social never outranks football
 * here — but it is never absent either.
 *
 * TEAM COLOUR IS LOUD ON PURPOSE. This is the concept that answers the
 * workshop's open colour question with "the whole fixture". The stage is
 * painted in both clubs' colours; every ground row carries a colour spine.
 * The scrim over the field, and the fixture's own `onPrimary`, are what keep
 * the text legible on top of it.
 */
export function ArenaHome({ model }: ArenaHomeProps) {
  const headingId = useId()
  const rise = useVNextMotion(vnextMotion.riseIn)
  const stagger = useVNextMotion(vnextMotion.stagger)
  const now = model.generatedAt
  const featured =
    model.liveMatches.find((match) => match.isFeatured) ?? model.liveMatches[0]
  const supporting = [
    ...model.liveMatches.filter((match) => match.id !== featured?.id),
    ...model.upcomingMatches,
    ...model.recentResults,
  ]
  const countdown = model.primaryAction.deadline
    ? formatCountdown(model.primaryAction.deadline, now)
    : null

  return (
    <div className={styles.shell}>
      <motion.header
        className={styles.masthead}
        data-vnext-zone="masthead"
        variants={rise}
        initial="hidden"
        animate="visible"
      >
        <div className={styles.mastheadTop}>
          <div className={styles.competition}>
            <p className={typography.label}>{model.competition.shortName}</p>
            <h1 id={headingId} className={`${typography.title} ${styles.matchweek}`}>
              {model.competition.matchweekLabel}
            </h1>
            <p className={typography.micro}>
              {model.liveMatches.length} live · {model.upcomingMatches.length} to
              come · {model.competition.seasonLabel}
            </p>
          </div>

          {/* The user's standing, as three short lines rather than a panel.
              Football has first claim on area here — but "how am I doing" is
              one of the four questions the first screen owes an answer to, so
              the season total, the rank and the points still in play are all
              present, just small. */}
          <div className={styles.standing}>
            <p className={typography.label}>Your matchday</p>
            <p className={`${styles.standingValue} ${typography.numeric}`}>
              {formatOrdinal(model.recentPerformance.rank)}
              <RankMovementIndicator movement={model.recentPerformance.rankMovement} />
            </p>
            <p className={typography.micro}>
              {formatNumber(model.recentPerformance.totalPoints)} pts ·{' '}
              {model.recentPerformance.provisionalPoints} on the pitch
            </p>
            <p className={typography.micro}>
              of {formatNumber(model.recentPerformance.rankOutOf)} players
            </p>
          </div>
        </div>

        <ArenaNav variant="masthead" openPredictions={openCount(model)} />
      </motion.header>

      <ArenaTicker matches={allMatches(model)} now={now} />

      {/* The one outstanding action, as a strip rather than a card: a broadcast
          lower third. It sits above the stage because a deadline outranks a
          match already in play — you can still change the deadline's outcome. */}
      <motion.section
        className={styles.callToAction}
        aria-label="Your outstanding predictions"
        data-vnext-zone="action"
        variants={rise}
        initial="hidden"
        animate="visible"
      >
        <span className={styles.ctaFlag}>{model.primaryAction.title}</span>
        <span className={`${typography.caption} ${styles.ctaDetail}`}>
          {model.primaryAction.description}
        </span>
        {countdown ? (
          <span className={`${styles.ctaClock} ${typography.numeric}`}>
            {countdown} left
          </span>
        ) : null}
        <button type="button" className={styles.ctaButton}>
          Predict now
        </button>
      </motion.section>

      <motion.div
        className={styles.body}
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {featured ? (
          <motion.section
            className={styles.stage}
            aria-label="Featured match"
            data-vnext-zone="stage"
            variants={rise}
          >
            <ArenaFeature match={featured} now={now} />
          </motion.section>
        ) : null}

        <motion.section
          className={styles.grounds}
          aria-label="Around the grounds"
          data-vnext-zone="grounds"
          variants={rise}
        >
          <ArenaGrounds matches={supporting} now={now} />
        </motion.section>

        <motion.section
          className={styles.terrace}
          aria-label="Your leagues and rivals"
          data-vnext-zone="social"
          variants={rise}
        >
          <ArenaTerrace model={model} />
        </motion.section>
      </motion.div>

      <ArenaNav variant="bar" openPredictions={openCount(model)} />
    </div>
  )
}

function allMatches(model: HomeModel) {
  return [...model.liveMatches, ...model.upcomingMatches, ...model.recentResults]
}

function openCount(model: HomeModel): number {
  const progress = model.primaryAction.progress
  return progress ? progress.total - progress.completed : 0
}
