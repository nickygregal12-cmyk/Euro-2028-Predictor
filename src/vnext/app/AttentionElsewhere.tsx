import { Bell } from 'lucide-react'
import type { ShellAttentionItem, VNextShellModel } from '../models/shell'
import {
  SHELL_GAME_NAMES,
  attentionElsewhere,
  shellContextById,
} from '../models/shell'
import { CompetitionMark } from './CompetitionMark'
import text from '../foundations/typography.module.css'
import styles from './AttentionElsewhere.module.css'

/**
 * THE SECONDARY ATTENTION LAYER — CONCEPT B'S BEST IDEA, AND ONLY THAT.
 *
 * ============================ THE PROBLEM IT SOLVES ========================
 *
 * The Competition Deck's own recorded weakness: a player inside the Premier
 * League has no way of knowing that the Champions League locks in eighteen
 * minutes. Concept A's answer was an urgency DOT on the switcher, and a dot
 * cannot say what. This can.
 *
 * ============================ WHAT WAS RETAINED ============================
 *
 * That cross-competition urgency is real, that it must cross the competition
 * boundary, and that an item must NAME ITS COMPETITION AND ITS GAME SEPARATELY
 * — which is what stops a queue flattening into a list where "Premier League"
 * and "Last Man Standing" look like the same kind of thing.
 *
 * ============================ WHAT WAS NOT =================================
 *
 * Concept B's information architecture, entirely. This is NOT the front door.
 * "Needs you" is not a destination, competitions are not filters over work, and
 * the current competition remains the product root at every width. Switching
 * competition does not land the player in a queue.
 *
 * ============================ AND IT IS QUIET ==============================
 *
 * WITH NOTHING WAITING ELSEWHERE IT RENDERS NOTHING AT ALL — not a zero, not a
 * greyed bell, not an empty state. Permanent chrome that says "0" is permanent
 * chrome that has to be read every time to learn it has nothing to say.
 *
 * IT DOES NOT MANUFACTURE URGENCY. `urgency` is the application's decision and
 * `detail` is copy it wrote. Nothing here reads a clock, so this control says
 * the same thing at midnight and at noon, and a story is deterministic.
 *
 * IT SCALES BY NOT GROWING. The control is a count whatever the count is; the
 * list is inside an overlay that scrolls. Twenty competitions cost the
 * permanent chrome nothing.
 */
export function AttentionElsewhereControl({
  model,
  variant,
  open,
  onOpen,
  onClose,
}: {
  readonly model: VNextShellModel
  readonly variant: 'masthead' | 'rail'
  readonly open: boolean
  readonly onOpen: (opener: HTMLElement) => void
  readonly onClose: () => void
}) {
  const items = attentionElsewhere(model)
  if (items.length === 0) return null

  const live = items.some((item) => item.urgency === 'live')
  const label =
    items.length === 1
      ? '1 thing needs you elsewhere'
      : `${items.length} things need you elsewhere`

  return (
    <button
      type="button"
      className={`${styles.control} ${styles[variant]}`}
      data-vnext-attention="control"
      data-tone={live ? 'live' : 'urgent'}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={(event) => {
        if (open) onClose()
        else onOpen(event.currentTarget)
      }}
    >
      <Bell size={16} strokeWidth={1.75} aria-hidden="true" />
      <span className={styles.controlLabel}>{label}</span>
    </button>
  )
}

/**
 * THE LIST. One row per waiting thing, each naming its competition and its game
 * on separate lines and each pressing through to that game in that competition.
 *
 * A ROW IS ONE PRESS AND ONE PRESS ONLY. It changes the football context AND
 * opens the game, because "go and do this" is one intention and making the
 * player switch competition first and then find the game would be the shell
 * charging them for its own architecture.
 */
export function AttentionListBody({
  model,
  onOpenItem,
}: {
  readonly model: VNextShellModel
  readonly onOpenItem: (item: ShellAttentionItem) => void
}) {
  const items = attentionElsewhere(model)

  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const context = shellContextById(model, item.contextId)
        if (!context) return null
        const gameName = SHELL_GAME_NAMES[item.game]
        return (
          <li key={item.id}>
            <button
              type="button"
              className={styles.row}
              data-urgency={item.urgency}
              // The three facts are separate text nodes on screen and would be
              // joined with no separator in the accessible name — the
              // `PredictionChip` gotcha. The name is written out instead, with
              // the competition and the game still named apart.
              aria-label={`${context.competition.name}, ${gameName}: ${item.headline}. ${item.detail}`}
              onClick={() => onOpenItem(item)}
            >
              <CompetitionMark competition={context.competition} />
              <span className={styles.rowText}>
                {/* COMPETITION AND GAME ON SEPARATE LINES, always. The football
                    context is one dimension and the game is another, and a row
                    that ran them together as "Champions League Predictor" would
                    be exactly the collapse the model exists to prevent. */}
                <span className={styles.rowContext}>{context.competition.name}</span>
                <span className={`${styles.rowGame} ${text.emphasis}`}>
                  {gameName} · {item.headline}
                </span>
                <span className={styles.rowDetail}>{item.detail}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
