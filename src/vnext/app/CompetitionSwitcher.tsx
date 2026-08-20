import { useState } from 'react'
import type { RefObject } from 'react'
import type { ShellContext, VNextShellModel } from '../models/shell'
import {
  SHELL_GAME_NAMES,
  contextNeedsAttention,
  shellActiveContext,
  shellSwitchable,
} from '../models/shell'
import { useVNextFeedback } from '../foundations/feedbackContext'
import { CompetitionMark } from './CompetitionMark'
import text from '../foundations/typography.module.css'
import styles from './CompetitionSwitcher.module.css'

/**
 * THE LOUDEST PERMANENT THING IN THE PRODUCT, AND THE ONE-COMPETITION CONTRACT.
 *
 * The Competition Deck's claim is that football context is the ROOT of the
 * architecture, so the competition is the largest permanent control on screen
 * and the four destinations beneath it are small. This is that control.
 *
 * ============================ AT ONE COMPETITION ===========================
 *
 * IT IS NOT A BUTTON. A control offering a single choice teaches a player there
 * is a decision to make and then spends their press proving there is not —
 * which is exactly how a platform with twenty competitions makes a
 * one-competition player feel like a tourist in somebody else's product. Below
 * two contexts this renders a `<span>`: not a disabled button, not a button
 * that opens a list of one, and not a button that quietly becomes the discovery
 * control.
 *
 * IT IS NEVER THE DISCOVERY CONTROL. Making the label pressable so that "there
 * is somewhere to go" would be the same lie in better clothes: a control named
 * after the competition the player is already in, opening a list of
 * competitions they do not have. Explore sits beside it and says what it does.
 *
 * ============================ IT TAKES NO REF ==============================
 *
 * There are two of these on screen at once — a rail copy and a bar copy, with
 * CSS showing exactly one — and a ref shared between them holds whichever
 * mounted last. The press itself carries the opener; see
 * `foundations/focusReturn.ts` for the defect that rule exists to close.
 */
export function CompetitionSwitcher({
  model,
  variant,
  open,
  onOpen,
  onClose,
}: {
  readonly model: VNextShellModel
  readonly variant: 'bar' | 'rail'
  readonly open: boolean
  readonly onOpen: (opener: HTMLElement) => void
  readonly onClose: () => void
}) {
  const context = shellActiveContext(model)

  if (!context) {
    /**
     * NO ACTIVE CONTEXT IS A REAL STATE, not a loading state and not a failure,
     * and it has TWO causes the shell cannot tell apart — which is why the copy
     * no longer picks one.
     *
     * It said "No competition yet". That is a claim about the PLAYER, and the
     * shell has no read that supports it: `buildShellModel` is handed one
     * competition or null, and null means "this page is not inside a
     * competition". Stage 13's platform-scoped pages — Account, Discovery, the
     * invite landing — are all legitimately outside one, so the old copy told a
     * player with three follows that they had none, in the chrome above a page
     * listing all three.
     *
     * "No competition selected" is true of the new account that has followed
     * nothing AND of the page that is simply not in one, and the Explore
     * control beside it is the right offer in both.
     */
    return (
      <span className={`${styles.switcher} ${styles[variant]}`} data-vnext-switcher="empty">
        <span className={styles.text}>
          <span className={`${styles.name} ${text.emphasis}`}>No competition selected</span>
          <span className={styles.meta}>Explore what is published and pick one</span>
        </span>
      </span>
    )
  }

  const inner = <SwitcherFace context={context} />

  if (!shellSwitchable(model)) {
    return (
      <span className={`${styles.switcher} ${styles[variant]}`} data-vnext-switcher="label">
        {inner}
      </span>
    )
  }

  return (
    <button
      type="button"
      className={`${styles.switcher} ${styles.button} ${styles[variant]}`}
      data-vnext-switcher="control"
      aria-expanded={open}
      aria-haspopup="dialog"
      // The visible competition name is inside the accessible name, so speech
      // input still works; the comma is what stops name computation joining the
      // text nodes into "Premier LeagueChange competition".
      aria-label={`${context.competition.name}, change competition`}
      onClick={(event) => {
        if (open) onClose()
        else onOpen(event.currentTarget)
      }}
    >
      {inner}
      <span className={styles.caret} aria-hidden="true">
        ▾
      </span>
    </button>
  )
}

function SwitcherFace({ context }: { readonly context: ShellContext }) {
  const { competition, tempoLabel } = context
  return (
    <>
      <CompetitionMark competition={competition} size="md" />
      <span className={styles.text}>
        {/* A COMPETITION NAME IS NEVER TRUNCATED. Nothing here clamps a line or
            hides overflow, so "Union of European Football Associations
            Champions League" wraps and the control grows. */}
        <span className={`${styles.name} ${text.emphasis}`}>{competition.name}</span>
        <span className={styles.meta}>
          {competition.seasonLabel ? `${competition.seasonLabel}` : null}
          {competition.seasonLabel && tempoLabel ? ' · ' : null}
          {tempoLabel}
        </span>
      </span>
    </>
  )
}

/**
 * THE SHEET — switching between competitions the player already has.
 *
 * IT IS NOT DISCOVERY AND IT SAYS SO. The last row is a way OUT to the
 * catalogue rather than the catalogue itself: the two jobs are different, and
 * this is the surface where a product most easily confuses them.
 *
 * SEARCH APPEARS ONLY ONCE THE LIST NEEDS IT. A search field over three rows is
 * a search field that has to be explained.
 *
 * THERE IS NO "RECENTLY VIEWED" GROUP, and its absence is deliberate. Stage
 * 7.5's audit found no per-competition recency authority anywhere in the
 * platform — `lastVisit.ts` is one local marker for when this device last
 * showed the Hub. The lab drew the group from a fixture field; the product
 * contract has no such field, so this cannot draw a history that does not
 * exist. See `docs/product/vnext-shell-ia.md`.
 */
export function CompetitionSheetBody({
  model,
  searchRef,
  onChoose,
  onExplore,
}: {
  readonly model: VNextShellModel
  readonly searchRef: RefObject<HTMLInputElement | null>
  readonly onChoose: (contextId: string) => void
  readonly onExplore: () => void
}) {
  const [query, setQuery] = useState('')
  const searchable = model.contexts.length > 6
  const needle = query.trim().toLowerCase()
  const listed =
    needle === ''
      ? model.contexts
      : model.contexts.filter(
          (entry) =>
            entry.competition.name.toLowerCase().includes(needle) ||
            entry.competition.shortName.toLowerCase().includes(needle),
        )

  return (
    <>
      {searchable ? (
        <input
          ref={searchRef}
          className={styles.search}
          type="search"
          aria-label={`Search your ${model.contexts.length} competitions`}
          placeholder="Search your competitions"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      ) : null}

      <p className={styles.group}>Your competitions</p>
      <ul className={styles.list}>
        {listed.map((entry) => (
          <li key={entry.competition.id}>
            <SheetRow
              model={model}
              context={entry}
              active={entry.competition.id === model.activeContextId}
              onChoose={onChoose}
            />
          </li>
        ))}
      </ul>
      {listed.length === 0 ? (
        <p className={styles.empty}>None of yours match “{query.trim()}”.</p>
      ) : null}

      {model.discovery.reachable ? (
        <button type="button" className={styles.explore} onClick={onExplore}>
          {model.discovery.catalogueSize === null
            ? 'Explore all competitions'
            : `All ${model.discovery.catalogueSize} competitions`}
        </button>
      ) : null}
    </>
  )
}

function SheetRow({
  model,
  context,
  active,
  onChoose,
}: {
  readonly model: VNextShellModel
  readonly context: ShellContext
  readonly active: boolean
  readonly onChoose: (contextId: string) => void
}) {
  const needsAttention = contextNeedsAttention(model, context.competition.id)
  const feedback = useVNextFeedback()
  return (
    <button
      type="button"
      className={styles.row}
      aria-current={active ? 'true' : undefined}
      onClick={() => {
        // A DELIBERATE CHANGE OF SUBJECT, WHICH IS NOT NAVIGATION. Moving
        // between Home, Matches, Games and Leagues is the movement this product
        // expects constantly and none of it is felt; choosing which football
        // you are looking at is a decision, and `selection` is the lightest
        // mark there is.
        feedback('selection')
        onChoose(context.competition.id)
      }}
    >
      <CompetitionMark competition={context.competition} />
      <span className={styles.rowText}>
        <span className={text.emphasis}>{context.competition.name}</span>
        <span className={styles.rowMeta}>{summarise(context)}</span>
      </span>
      {needsAttention ? (
        <>
          {/* ARIA prohibits a name on a generic span, so the dot is decorative
              and the word travels in the button's own name. The comma is
              deliberate: name computation joins text nodes with no separator,
              so "Premier League" + " needs you" announces as
              "Premier Leagueneeds you". */}
          <span className={styles.dot} aria-hidden="true" />
          <span className={text.srOnly}>, needs you</span>
        </>
      ) : null}
    </button>
  )
}

/**
 * FOLLOW AND JOIN STAY APART, even in a one-line summary.
 *
 * A competition the player follows and plays nothing in says so, rather than
 * being counted as zero games and looking broken. That distinction is the
 * platform's own — `features/hub/playerCompetitions.ts` models it and contract
 * 157 answers it — and a shell that flattened it would reintroduce the defect
 * Follow was built to fix.
 */
function summarise(context: ShellContext): string {
  const parts: string[] = []
  const [only] = context.games
  if (context.games.length === 0) {
    parts.push(
      context.relationship === 'following' ? 'Following · no games joined' : 'No games joined',
    )
  } else if (only && context.games.length === 1) {
    parts.push(SHELL_GAME_NAMES[only.key])
  } else {
    parts.push(`${context.games.length} games`)
  }
  if (context.tempoLabel) parts.push(context.tempoLabel)
  return parts.join(' · ')
}
