import { useId } from 'react'
import { motion } from 'framer-motion'
import type { HomeModel } from '../../models/home'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import { formatNumber, formatOrdinal } from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import { RankMovementIndicator } from '../../components/game/RankMovementIndicator'
import { VNextNav, defaultNavItems } from '../../components/navigation/VNextNav'
import type { VNextNavItem } from '../../components/navigation/VNextNav'
import { CommandDecisions } from './CommandDecisions'
import { CommandLedger } from './CommandLedger'
import { CommandStandings } from './CommandStandings'
import { CommandTrend } from './CommandTrend'
import { CommandWire } from './CommandWire'
import styles from './command.module.css'

export type CommandHomeProps = {
  model: HomeModel
}

/**
 * CONCEPT B — GAME COMMAND CENTRE.
 *
 * ONE IDEA: MY COMPETITION IS THE EVENT.
 *
 * Every zone on this page answers one of four questions, in this order: how am
 * I doing, what changed, what must I decide, and what are the people I am
 * playing against doing about it. Football is everywhere on the page — but it
 * arrives as CONSEQUENCE. The live matches appear as a ledger of points moving,
 * not as a stage; the upcoming matches appear as a queue of decisions with
 * deadlines, not as fixtures to browse.
 *
 * THIS IS THE DENSEST OF THE THREE, DELIBERATELY. The bet it is making is that
 * a prediction player on a Saturday afternoon wants numbers, and that density
 * is only a problem when hierarchy is absent. So the page has exactly one
 * display-size number (the points figure in the status band), one urgent
 * colour (the open-decision queue), and everything else is ranked below both.
 *
 * TEAM COLOUR IS RESTRAINED ON PURPOSE. This is the opposite end of the
 * workshop's open colour question from Concept A: clubs are identified by a
 * 3px colour key beside a three-letter code and nothing else, so that the
 * only large colours on the page are GAME-STATE colours and they keep their
 * meaning.
 *
 * NAVIGATION. A persistent icon rail on the desktop — the one treatment of the
 * three that says "this is an application you come back to" — and a bottom bar
 * plus a standing action strip on mobile, because the open decision must be
 * one thumb away at all times. Nothing routes.
 */
export function CommandHome({ model }: CommandHomeProps) {
  const headingId = useId()
  const rise = useVNextMotion(vnextMotion.riseIn)
  const stagger = useVNextMotion(vnextMotion.stagger)
  const pointsEmphasis = useVNextMotion(vnextMotion.pointsEmphasis)
  const now = model.generatedAt
  const open = openCount(model)
  const performance = model.recentPerformance

  return (
    <div className={styles.shell}>
      <div className={styles.rail} data-vnext-region="nav-rail">
        <VNextNav variant="rail" activeId="home" items={navItems(open)} />
      </div>

      <div className={styles.work}>
        <motion.header
          className={styles.head}
          data-vnext-zone="header"
          variants={rise}
          initial="hidden"
          animate="visible"
        >
          <div className={styles.headWho}>
            <p className={typography.label}>
              {model.competition.shortName} · {model.competition.seasonLabel}
            </p>
            <h1 id={headingId} className={`${typography.title} ${styles.headTitle}`}>
              {model.competition.matchweekLabel}
            </h1>
            <p className={typography.micro}>Playing as {model.user.name}</p>
          </div>

          {/* The competition switcher: navigation exploration, not routing.
              Which competition you are in is a question this concept expects
              to be asked constantly, so it sits in the header rather than
              behind a destination. */}
          <div className={styles.switcher}>
            <span className={typography.label}>Competition</span>
            <button type="button" className={styles.switcherButton}>
              {model.competition.name}
              <span className={styles.switcherChevron} aria-hidden="true">
                ▾
              </span>
            </button>
          </div>
        </motion.header>

        {/* The status band: the answer to "how am I doing", once, at the top,
            at a size nothing else on the page competes with. */}
        <motion.section
          className={styles.band}
          aria-label="Your standing"
          data-vnext-zone="standing"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.div className={`${styles.bandPrimary}`} variants={rise}>
            <span className={typography.label}>Total points</span>
            <motion.span
              className={`${styles.bandPrimaryValue} ${typography.numeric}`}
              variants={pointsEmphasis}
              initial="rest"
              animate="rest"
            >
              {formatNumber(performance.totalPoints)}
            </motion.span>
            <span className={typography.micro}>
              {performance.matchweekPoints} this matchweek ·{' '}
              {performance.pointsToday} banked today
            </span>
          </motion.div>

          <motion.div className={styles.bandStat} variants={rise}>
            <span className={typography.label}>Overall rank</span>
            <span className={`${styles.bandValue} ${typography.numeric}`}>
              {formatOrdinal(performance.rank)}
              <RankMovementIndicator movement={performance.rankMovement} />
            </span>
            <span className={typography.micro}>
              of {formatNumber(performance.rankOutOf)}
            </span>
          </motion.div>

          <motion.div
            className={`${styles.bandStat} ${styles.bandLive}`}
            variants={rise}
          >
            <span className={typography.label}>On the pitch</span>
            <span className={`${styles.bandValue} ${typography.numeric}`}>
              {performance.provisionalPoints}
            </span>
            <span className={typography.micro}>Provisional, not awarded</span>
          </motion.div>

          <motion.div
            className={`${styles.bandStat} ${styles.bandWarn}`}
            variants={rise}
          >
            <span className={typography.label}>Open decisions</span>
            <span className={`${styles.bandValue} ${typography.numeric}`}>{open}</span>
            <span className={typography.micro}>
              {model.primaryAction.progress
                ? `${model.primaryAction.progress.completed} of ${model.primaryAction.progress.total} in`
                : 'Nothing outstanding'}
            </span>
          </motion.div>

          <motion.div className={styles.bandStat} variants={rise}>
            <span className={typography.label}>Exact scores</span>
            <span className={`${styles.bandValue} ${typography.numeric}`}>
              {performance.accuracy.exact}
            </span>
            <span className={typography.micro}>
              of {performance.accuracy.predicted} predicted
            </span>
          </motion.div>
        </motion.section>

        <motion.div
          className={styles.grid}
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.section
            className={styles.decisions}
            aria-label="Decisions still open"
            data-vnext-zone="decisions"
            variants={rise}
          >
            <CommandDecisions model={model} now={now} />
          </motion.section>

          <motion.section
            className={styles.ledger}
            aria-label="Live points ledger"
            data-vnext-zone="football"
            variants={rise}
          >
            <CommandLedger model={model} />
          </motion.section>

          <motion.section
            className={styles.standings}
            aria-label="Leagues and rivals"
            data-vnext-zone="social"
            variants={rise}
          >
            <CommandStandings model={model} />
          </motion.section>

          <motion.section
            className={styles.trend}
            aria-label="Your season so far"
            data-vnext-zone="trend"
            variants={rise}
          >
            <CommandTrend model={model} />
          </motion.section>

          <motion.section
            className={styles.wire}
            aria-label="Activity"
            data-vnext-zone="wire"
            variants={rise}
          >
            <CommandWire model={model} />
          </motion.section>
        </motion.div>
      </div>

      {/* Mobile only. The action strip sits ABOVE the bar rather than inside
          it: a destination and a task are different things, and putting the
          task in the navigation makes it hard to reach either. */}
      <div className={styles.mobileFoot}>
        <div className={styles.actionStrip}>
          <span className={styles.actionStripText}>
            <span className={`${styles.actionStripCount} ${typography.numeric}`}>
              {open}
            </span>
            <span className={typography.caption}>still to decide</span>
          </span>
          <button type="button" className={styles.actionStripButton}>
            Predict now
          </button>
        </div>
        <VNextNav variant="bar" activeId="home" items={navItems(open)} />
      </div>
    </div>
  )
}

function navItems(open: number): readonly VNextNavItem[] {
  return defaultNavItems.map((item) =>
    item.id === 'fixtures' ? { ...item, badge: open } : item,
  )
}

function openCount(model: HomeModel): number {
  const progress = model.primaryAction.progress
  return progress ? progress.total - progress.completed : 0
}
