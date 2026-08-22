import type { PrimaryAction } from '../models/home'
import { formatCountdown } from '../foundations/format'
import typography from '../foundations/typography.module.css'
import styles from './home.module.css'

export type ActionBannerProps = {
  action: PrimaryAction
  now: string
  /** Presentation emits intent; the connected screen decides navigation. */
  onActivate?: (() => void) | undefined
}

/**
 * The verb on the button, per action type. Never invented from the title.
 *
 * `watchLive` names the ACTION TYPE, not a capability. There is no watch,
 * follow, subscribe or notify concept in the model or in the product, so the
 * button says where the user can actually go: Match Centre, which is the same
 * single live destination the featured match and the in-play rows settled on.
 * A label is a promise, and "Watch live" promises a feature nothing implements.
 */
const CALL: Record<PrimaryAction['type'], string> = {
  predict: 'Predict now',
  review: 'Review picks',
  watchLive: 'Match centre',
  joinLeague: 'Find a league',
}

/**
 * THE ONE OUTSTANDING THING, AS A LOWER THIRD.
 *
 * A strip rather than a card, and it sits ABOVE the football even when a match
 * is in play, because a deadline outranks a match already kicked off: you can
 * still change the outcome of one of them. That ordering is the whole reason
 * this is a separate zone instead of another row in Around the Grounds.
 *
 * URGENCY IS THE MODEL'S, NOT THE CLOCK'S. `urgency` is a field the model
 * states and this reads it; nothing here compares a deadline against now to
 * decide how alarmed to look. The countdown is formatted from two supplied
 * instants and disappears entirely once it has run out, because a deadline that
 * has passed is a different state and "0 min" is not it.
 *
 * COLOUR IS NEVER THE MESSAGE. The urgency changes the border and the veil, and
 * the same fact is always written: the title says what is outstanding, the
 * description says which fixture, the clock says how long.
 */
export function ActionBanner({ action, now, onActivate }: ActionBannerProps) {
  const countdown = action.deadline ? formatCountdown(action.deadline, now) : null
  const progress = action.progress

  return (
    <section
      className={`${styles.banner} ${styles[`banner${cap(action.urgency)}`]}`}
      aria-label="Your outstanding action"
      data-vnext-zone="action"
    >
      <span className={styles.bannerTitle}>{action.title}</span>

      <span className={`${typography.caption} ${styles.bannerDetail}`}>
        {action.description}
      </span>

      {progress ? (
        <span className={`${typography.micro} ${styles.bannerProgress}`}>
          {progress.completed} of {progress.total} done
        </span>
      ) : null}

      {countdown ? (
        <span className={`${styles.bannerClock} ${typography.numeric}`}>
          {countdown} left
        </span>
      ) : null}

      <button
        type="button"
        className={styles.bannerButton}
        onClick={onActivate}
        data-vnext-control="home-primary-action"
      >
        {CALL[action.type]}
      </button>
    </section>
  )
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
