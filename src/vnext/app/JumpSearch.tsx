import { useId, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Search } from 'lucide-react'
import type { ShellCompetition, ShellIntent, VNextShellModel } from '../models/shell'
import { shellJumpEmpty, shellJumpGroups } from '../models/shell'
import { CompetitionMark } from './CompetitionMark'
import text from '../foundations/typography.module.css'
import styles from './JumpSearch.module.css'

/**
 * JUMP — CONCEPT C'S BEST IDEA, AND ONLY THAT.
 *
 * ============================ WHAT WAS RETAINED ============================
 *
 * That a player with ten or twenty competitions is better served by typing a
 * name than by hunting a list, and that the results must stay in DISTINCT
 * GROUPS. Competitions, games and private leagues are three dimensions; one
 * undifferentiated result list is the collapse the whole architecture exists to
 * prevent, and it is the easiest thing in the world to write by accident.
 *
 * ============================ WHAT WAS NOT =================================
 *
 * Concept C's architecture, entirely. There is no command surface, no
 * segment-menu spine, no global search, no player directory, no backend search
 * and no speculative commands. There is no command-palette dependency either —
 * §27 of the brief is explicit, and a dialog, a list, a filter and a keydown
 * handler are things this stack already does.
 *
 * ============================ IT IS OPTIONAL ===============================
 *
 * A NORMAL PLAYER NEVER SEES IT. `shellJumpAvailable` offers it only where the
 * rail has stopped being complete — more competitions than it can show
 * shortcuts for. Below that, everything the player has is already one press
 * away and a search field over a list you can see is a search field that has to
 * be explained.
 *
 * IT IS DESKTOP CHROME. On a phone the same job is done by the competition
 * sheet's own search, which appears at the same scale, so the accelerator costs
 * the 375px bar nothing. Nothing in the product requires it at any width.
 *
 * THE KEYBOARD SHORTCUT IS AN ACCELERATOR AND NEVER THE ROUTE. The visible
 * control is a real, named, focusable button with the shortcut printed on it;
 * `⌘K` is a second way in for people who already know, not knowledge the
 * product assumes. See `VNextShell` for the guard that keeps it out of text
 * fields.
 *
 * IT DOES NOT LEAK THE CATALOGUE. Jump searches the player's own world.
 * Twenty published competitions the player has not taken up are discovery's
 * business, and Jump offers Explore as its last row rather than quietly
 * becoming it — which is how a navigation accelerator turns into the twenty-
 * logo wall arriving through a search field.
 */
export function JumpControl({
  open,
  onOpen,
  onClose,
}: {
  readonly open: boolean
  readonly onOpen: (opener: HTMLElement) => void
  readonly onClose: () => void
}) {
  return (
    <button
      type="button"
      className={styles.control}
      data-vnext-jump="control"
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={(event) => {
        if (open) onClose()
        else onOpen(event.currentTarget)
      }}
    >
      <Search size={16} strokeWidth={1.75} aria-hidden="true" />
      <span className={styles.controlLabel}>Jump to…</span>
      {/* Decorative: the shortcut is printed for people who want it and is not
          part of the control's name, because "Jump to, Ctrl K" is a worse thing
          to hear than "Jump to". */}
      <kbd className={styles.hint} aria-hidden="true">
        Ctrl K
      </kbd>
    </button>
  )
}

export function JumpBody({
  model,
  searchRef,
  onIntent,
}: {
  readonly model: VNextShellModel
  readonly searchRef: RefObject<HTMLInputElement | null>
  readonly onIntent: (intent: ShellIntent) => void
}) {
  const [query, setQuery] = useState('')
  const groups = shellJumpGroups(model, query)
  const empty = shellJumpEmpty(groups)

  return (
    <>
      <input
        ref={searchRef}
        className={styles.search}
        type="search"
        aria-label="Search your competitions, games and leagues"
        placeholder="Competition, game or league"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {/* THREE GROUPS, THREE HEADINGS, THREE LISTS — never one list with a kind
          badge on each row. Each list is labelled by its own heading, so the
          hierarchy is in the accessibility tree and not only in the type. */}
      <JumpGroup title="Competitions" empty={groups.competitions.length === 0}>
        {groups.competitions.map((entry) => (
          <JumpRow
            key={entry.id}
            competition={entry.competition}
            label={entry.label}
            detail={entry.detail}
            onSelect={() => onIntent({ kind: 'context', contextId: entry.contextId })}
          />
        ))}
      </JumpGroup>

      <JumpGroup title="Games" empty={groups.games.length === 0}>
        {groups.games.map((entry) => (
          <JumpRow
            key={entry.id}
            competition={entry.competition}
            label={entry.label}
            detail={entry.detail}
            onSelect={() =>
              onIntent({ kind: 'game', contextId: entry.contextId, game: entry.game })
            }
          />
        ))}
      </JumpGroup>

      <JumpGroup title="Leagues" empty={groups.leagues.length === 0}>
        {groups.leagues.map((entry) => (
          <JumpRow
            key={entry.id}
            competition={entry.competition}
            label={entry.label}
            detail={entry.detail}
            onSelect={() =>
              onIntent({
                kind: 'league',
                contextId: entry.contextId,
                leagueId: entry.leagueId,
              })
            }
          />
        ))}
      </JumpGroup>

      {empty ? (
        <p className={styles.empty}>Nothing of yours matches “{query.trim()}”.</p>
      ) : null}

      {model.discovery.reachable ? (
        <button
          type="button"
          className={styles.explore}
          onClick={() => onIntent({ kind: 'discover' })}
        >
          Explore competitions you have not joined
        </button>
      ) : null}
    </>
  )
}

/**
 * A group that is empty says so rather than disappearing.
 *
 * A group vanishing under a filter makes the remaining rows change meaning
 * silently: two rows under one heading and two rows under another are a
 * different answer from four rows under whichever heading survived. Saying
 * "None" keeps the three dimensions on screen while the player types.
 */
function JumpGroup({
  title,
  empty,
  children,
}: {
  readonly title: string
  readonly empty: boolean
  readonly children: ReactNode
}) {
  const titleId = useId()
  return (
    <div className={styles.group}>
      {/* A HEADING WOULD BE A LANDMARK PROBLEM, NOT AN IMPROVEMENT. The overlay
          is a dialog with its own `<h2>`; three more headings inside it, or
          three `<section aria-label>` regions, would put four landmarks and
          four headings in a control that is one control. The list is labelled
          by its own title instead, which is what a screen reader needs. */}
      <p id={titleId} className={styles.groupTitle}>
        {title}
      </p>
      {empty ? (
        <p className={styles.groupEmpty}>None</p>
      ) : (
        <ul className={styles.list} aria-labelledby={titleId}>
          {children}
        </ul>
      )}
    </div>
  )
}

function JumpRow({
  competition,
  label,
  detail,
  onSelect,
}: {
  readonly competition: ShellCompetition
  readonly label: string
  readonly detail: string | null
  readonly onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        // Written out rather than left to name computation, which joins the two
        // text nodes with no separator.
        aria-label={detail === null ? label : `${label}, ${detail}`}
        onClick={onSelect}
      >
        <CompetitionMark competition={competition} />
        <span className={styles.rowText}>
          <span className={text.emphasis}>{label}</span>
          {detail === null ? null : <span className={styles.rowDetail}>{detail}</span>}
        </span>
      </button>
    </li>
  )
}
