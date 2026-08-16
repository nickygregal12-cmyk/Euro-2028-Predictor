import { useId } from 'react'
import { motion } from 'framer-motion'
import type { HomeModel } from '../../models/home'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import typography from '../../foundations/typography.module.css'
import { CinematicHero } from './CinematicHero'
import { CinematicLeagueCard } from './CinematicLeagueCard'
import { CinematicMatchPoster } from './CinematicMatchPoster'
import { CinematicNav } from './CinematicNav'
import { CinematicRail } from './CinematicRail'
import { CinematicRivalPoster } from './CinematicRivalPoster'
import styles from './cinematic.module.css'

export type CinematicHomeProps = {
  model: HomeModel
}

/**
 * CONCEPT C — CINEMATIC FOOTBALL.
 *
 * ONE IDEA: MAKE THE NEXT THING IRRESISTIBLE, THEN LET THE USER BROWSE.
 *
 * The page is a hero and a stack of rails. That is the shape borrowed from
 * discovery interfaces, and the borrowing stops at the shape: what is being
 * discovered is football and rivalry, the hero is a decision rather than a
 * trailer, and every card carries the state and the numbers a prediction game
 * needs. A rail here is not a shelf of things to consume — it is a set of
 * things to act on, and each one says what acting would cost or gain.
 *
 * WHAT EARNS THE FIRST SCREEN: exactly one thing. The hero is the match whose
 * deadline is closest and which the user has NOT called — the single most
 * consequential decision available — rendered at a size nothing else competes
 * with. Everything else is below it, in a deliberate order.
 *
 * WHY THE HERO IS SIZED THE WAY IT IS. `--vnext-frame-block` is `none` unless
 * the host declares a real height, so the `calc()` is invalid and the hero
 * simply fits its content. Inside a workshop device shell — or any future
 * fixed-height embed — it takes a share of the FRAME. It is never `vh`: that
 * measures the browser showing the workshop, which is a different box.
 *
 * TEAM COLOUR IS ATMOSPHERE HERE. The richest of the three answers: club
 * colours become the light in the room. Legibility is bought back with a
 * layered scrim rather than by muting the colour, so the drama survives and
 * the text still reads.
 */
export function CinematicHome({ model }: CinematicHomeProps) {
  const headingId = useId()
  const rise = useVNextMotion(vnextMotion.riseIn)
  const now = model.generatedAt
  const hero = heroMatch(model)
  const rest = model.upcomingMatches.filter((match) => match.id !== hero?.id)

  return (
    <div className={styles.shell}>
      <CinematicNav model={model} openPredictions={openCount(model)} />

      <h1 id={headingId} className={typography.srOnly}>
        {model.competition.name} — {model.competition.matchweekLabel}
      </h1>

      {hero ? <CinematicHero match={hero} model={model} now={now} /> : null}

      <motion.div
        className={styles.rails}
        data-vnext-zone="rails"
        variants={rise}
        initial="hidden"
        animate="visible"
      >
        <CinematicRail
          title="Live now"
          meta={`${model.liveMatches.length} matches · your points are moving`}
        >
          {model.liveMatches.map((match) => (
            <CinematicMatchPoster key={match.id} match={match} now={now} size="wide" />
          ))}
        </CinematicRail>

        <CinematicRail
          title="The rivalries"
          meta="Where you sit against the people you play with"
        >
          {model.rivals.map((rival) => (
            <CinematicRivalPoster
              key={`${rival.player.id}-${rival.sharedLeagueName}`}
              rival={rival}
            />
          ))}
          {model.privateLeagues.map((league) => (
            <CinematicLeagueCard key={league.id} league={league} />
          ))}
        </CinematicRail>

        {rest.length > 0 ? (
          <CinematicRail title="Still to call" meta="Locks at kick-off">
            {rest.map((match) => (
              <CinematicMatchPoster key={match.id} match={match} now={now} />
            ))}
          </CinematicRail>
        ) : null}

        {model.recentResults.length > 0 ? (
          <CinematicRail
            title="How it finished"
            meta="Settled, and how the rest of the crowd did"
          >
            {model.recentResults.map((match) => (
              <CinematicMatchPoster key={match.id} match={match} now={now} />
            ))}
          </CinematicRail>
        ) : null}
      </motion.div>

      <CinematicNav model={model} openPredictions={openCount(model)} variant="bar" />
    </div>
  )
}

/**
 * The most consequential decision available: the soonest deadline the user has
 * not answered. Falling back to the featured live match, then to anything, so
 * a matchday with nothing outstanding still has a hero rather than a hole.
 */
function heroMatch(model: HomeModel) {
  const unanswered = model.upcomingMatches
    .filter((match) => match.prediction === null && match.lockAt !== null)
    .sort((left, right) => Date.parse(left.lockAt ?? '') - Date.parse(right.lockAt ?? ''))
  return (
    unanswered[0] ??
    model.liveMatches.find((match) => match.isFeatured) ??
    model.upcomingMatches[0] ??
    model.liveMatches[0]
  )
}

function openCount(model: HomeModel): number {
  const progress = model.primaryAction.progress
  return progress ? progress.total - progress.completed : 0
}
