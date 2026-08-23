import { useId } from 'react'
import { motion } from 'framer-motion'
import type { HomeActionGame, SecondaryAction } from '../models/home'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import styles from './WeekElsewhere.module.css'
import text from '../foundations/typography.module.css'

/**
 * THE REST OF THIS PLAYER'S WEEK, AS AT MOST TWO COMPACT LINES.
 *
 * WHAT IT IS FOR. `DFA-010` asks Home for "one primary urgent/next action, at
 * most two compact secondary actions". The banner above is the first; this is
 * the rest. Before it existed the vNext Home could say nothing whatever about
 * Last Man Standing or the Predictor Championship — the two games the player
 * had joined alongside the one it talked about.
 *
 * A REPORT IS NOT A TASK, AND THE DIFFERENCE IS VISIBLE.
 * `outstanding` decides whether a row gets a control at all. "Last Man
 * Standing: you are out" and "Championship: Matchday 3 against Rowan" are worth
 * saying and are not jobs, so they are TEXT. A row that still wants something
 * gets a button. Dressing a settled game as a task is the exact failure
 * `DFA-006` names, and it is prevented here by shape rather than by wording.
 *
 * IT COMPOSES NO SENTENCE. Every `title` is `competitionWeekModel`'s own, so
 * this surface and the competition's own game cards say the same thing about
 * the same game. Nothing here reads a clock, ranks a game, or decides that one
 * of them matters more: the order arrived sorted.
 *
 * IT RENDERS NOTHING WHEN THERE IS NOTHING. A one-game player has an empty list
 * and gets no heading, no rule and no empty state — a quiet day stays quiet.
 */
export function WeekElsewhere({
  actions,
  onOpen,
}: {
  readonly actions: readonly SecondaryAction[]
  readonly onOpen?: ((game: HomeActionGame) => void) | undefined
}) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  // A `<section>` is only a landmark once it has a name, and an unnamed one is
  // invisible to the region navigation a screen-reader user actually uses.
  const headingId = useId()

  if (actions.length === 0) return null

  return (
    <motion.section
      className={styles.zone}
      data-vnext-zone="week-elsewhere"
      aria-labelledby={headingId}
      variants={rise}
    >
      <h2 className={`${text.label} ${styles.heading}`} id={headingId}>
        Also this week
      </h2>
      <ul className={styles.list}>
        {actions.map((action) => (
          <li key={action.game} className={styles.row} data-outstanding={action.outstanding}>
            <span className={`${text.body} ${styles.title}`}>{action.title}</span>
            {action.outstanding ? (
              <button
                type="button"
                className={`${text.label} ${styles.action}`}
                onClick={() => onOpen?.(action.game)}
              >
                {CALL[action.game]}
                {/* The visible label is the verb; the game travels in the
                    accessible name so two rows never read as one repeated
                    control to a screen reader. */}
                <span className={text.srOnly}>{` — ${NAME[action.game]}`}</span>
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </motion.section>
  )
}

/**
 * The verb per game, matching `weekActionCallToAction` exactly.
 *
 * `championship` is present and unreachable: a Championship action is never
 * `outstanding`, so no row of it is ever drawn with a control. It is named here
 * rather than omitted so the record stays total and a future kind cannot be
 * added without deciding what it would say.
 */
const CALL: Record<HomeActionGame, string> = {
  'match-predictor': 'Predict this matchweek',
  'last-man-standing': 'Pick your club',
  championship: 'Open Championship',
}

const NAME: Record<HomeActionGame, string> = {
  'match-predictor': 'Match Predictor',
  'last-man-standing': 'Last Man Standing',
  championship: 'Predictor Championship',
}
