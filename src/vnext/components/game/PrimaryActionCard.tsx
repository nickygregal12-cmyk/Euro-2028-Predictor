import { VNextClockIcon } from '../../foundations/VNextIcon'
import { useId } from 'react'
import { motion } from 'framer-motion'
import type { PrimaryAction } from '../../models/home'
import { formatCountdown, formatTime } from '../../foundations/format'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import surfaces from '../../foundations/surfaces.module.css'
import typography from '../../foundations/typography.module.css'
import styles from './PrimaryActionCard.module.css'

export type PrimaryActionCardProps = {
  action: PrimaryAction
  /** The instant to measure the deadline against. */
  now: string
  onAct?: (action: PrimaryAction) => void
}

/**
 * The one thing the user is here to do.
 *
 * There is exactly one of these on a surface. The moment a second appears the
 * screen has no primary action, which is the failure mode this component exists
 * to prevent — so it takes a single `PrimaryAction` rather than a list.
 *
 * Urgency comes from the model, not from arithmetic on the clock. A deadline
 * that is 38 minutes away is `urgent` because the fixture says so; presentation
 * inventing its own thresholds would be presentation inventing a game rule.
 *
 * The progress bar is a real `<progress>`: it is announced, it degrades, and it
 * needs no ARIA of its own.
 */
export function PrimaryActionCard({
  action,
  now,
  onAct,
}: PrimaryActionCardProps) {
  const headingId = useId()
  const progressId = useId()
  const rise = useVNextMotion(vnextMotion.riseIn)
  const countdown = action.deadline ? formatCountdown(action.deadline, now) : null

  return (
    <motion.section
      className={`${surfaces.raised} ${styles.card} ${styles[action.urgency]}`}
      aria-labelledby={headingId}
      variants={rise}
      initial="hidden"
      animate="visible"
    >
      <div className={styles.body}>
        <span className={typography.label}>Your move</span>
        <h2 id={headingId} className={`${typography.headline} ${styles.title}`}>
          {action.title}
        </h2>
        <p className={`${typography.body} ${typography.secondary}`}>
          {action.description}
        </p>

        {action.progress ? (
          <div className={styles.progressBlock}>
            <label
              className={typography.micro}
              htmlFor={progressId}
              id={`${progressId}-label`}
            >
              {action.progress.completed} of {action.progress.total} predictions in
            </label>
            <progress
              id={progressId}
              className={styles.progress}
              value={action.progress.completed}
              max={action.progress.total}
            />
          </div>
        ) : null}
      </div>

      <div className={styles.actions}>
        {countdown ? (
          <span className={`${styles.deadline} ${typography.numeric}`}>
            <VNextClockIcon /> {countdown} left
            {action.deadline ? (
              <span className={typography.srOnly}>
                , deadline {formatTime(action.deadline)}
              </span>
            ) : null}
          </span>
        ) : null}
        {onAct ? (
          <button
            type="button"
            className={styles.cta}
            onClick={() => onAct(action)}
          >
            {ctaLabel(action)}
          </button>
        ) : null}
      </div>
    </motion.section>
  )
}

function ctaLabel(action: PrimaryAction): string {
  switch (action.type) {
    case 'predict':
      return 'Make your predictions'
    case 'pickClub':
      // The verb `weekActionCallToAction` already fixes for Last Man Standing,
      // so the workshop card and the shipped banner promise the same thing.
      return 'Pick your club'
    case 'review':
      return 'See how you did'
    case 'watchLive':
      // Not "Follow the live matches". Nothing in the model or the product
      // implements follow, watch, subscribe or notify, and Home settled Match
      // Centre as the single real live destination. This card is a workshop
      // component rather than part of Home, but it is reviewed in the same
      // Storybook, so it should not keep vocabulary the Gold Standard rejected.
      return 'Open Match centre'
    case 'joinLeague':
      return 'Find a league'
  }
}
