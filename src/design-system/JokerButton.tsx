import styles from './JokerButton.module.css'
import { CardsIcon } from './icons'

// 'available' = the gold CTA to play a joker; 'on' = the quieter tint status
// (still actionable — tap to remove — until the match kicks off). The
// 'committed' state fuses into the MatchCard points pill, so it isn't a button.
export type JokerButtonState = 'available' | 'on'

export type JokerButtonProps = {
  state: JokerButtonState
  onToggle?: () => void
  disabled?: boolean
}

/**
 * The play/remove-joker control. Gold is used for nothing else in the app.
 * Solid gold fill + --gold-contrast text as the CTA; tint pill with gold
 * border+text as the active status (per the design-system gold rule).
 */
export function JokerButton({ state, onToggle, disabled }: JokerButtonProps) {
  const isOn = state === 'on'
  return (
    <button
      type="button"
      className={`${styles.btn} ${isOn ? styles.on : styles.available}`}
      aria-pressed={isOn}
      disabled={disabled}
      onClick={(e) => {
        // Inside a (future) clickable card — never trigger card navigation.
        e.stopPropagation()
        onToggle?.()
      }}
    >
      <CardsIcon size={14} />
      <span>{isOn ? 'Joker on' : 'Play joker'}</span>
    </button>
  )
}
