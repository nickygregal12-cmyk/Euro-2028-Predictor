import { useId, useState } from 'react'
import { ChevronDownIcon } from '../../design-system/icons'
import type { GameRules } from './gameRules'
import styles from './gameRules.module.css'

/**
 * "How it works", where the player is deciding whether to play.
 *
 * A DISCLOSURE RATHER THAN A LINK, because there is no honest page to link to.
 * The one rules document in the repository describes the Euro Original
 * Predictor — a different game, a different scale and its own bonuses — and
 * sending a domestic player there would be worse than saying nothing. The rules
 * a season game actually runs on live in `domain/season/`, so the explanation
 * is rendered from those constants where the question is asked instead of
 * filed somewhere else.
 *
 * COLLAPSED BY DEFAULT, and it never becomes the card. A player who already
 * knows the game should not have to scroll past three paragraphs to reach the
 * control that plays it.
 *
 * IT INVENTS NOTHING. Every line comes from `gameRules`, which imports its
 * numbers from the modules that decide them. A game with no rules content — a
 * game type this build does not describe — renders nothing at all rather than
 * an empty panel or a generic paragraph that might be wrong.
 */

export type GameRulesDisclosureProps = {
  rules: GameRules | null
  /** Open on mount. For the gallery and for a rules-first surface. */
  defaultOpen?: boolean
}

export function GameRulesDisclosure({ rules, defaultOpen = false }: GameRulesDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  if (rules === null) return null

  return (
    <div className={styles.disclosure}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDownIcon size={16} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
        How {rules.name} works
      </button>
      {open ? (
        <div className={styles.panel} id={panelId}>
          <p className={styles.summary}>{rules.summary}</p>
          {rules.sections.map((section) => (
            <section className={styles.section} key={section.heading}>
              <h4 className={styles.sectionTitle}>{section.heading}</h4>
              <ul className={styles.lines}>
                {section.lines.map((line) => (
                  <li className={styles.line} key={line}>
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}
