import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, Compass, Gamepad2, Home, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import type { FootballContext, IaModel } from '../../models/ia'
import { ownedContextCount, recentContexts } from '../../models/ia'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import { competitionColourStyle } from '../../foundations/teamColour'
import { useIaNavigation } from '../shared/navigation'
import type { IaDestination } from '../shared/navigation'
import { useFocusReturn } from '../../foundations/focusReturn'
import {
  BackControl,
  CompetitionMark,
  IaSurface,
  destinationContextLabel,
  destinationTitle,
} from '../shared/Surfaces'
import { emitFeedback } from '../../foundations/feedback'
import type { FeedbackPreference } from '../../foundations/feedback'
import styles from './conceptA.module.css'
import text from '../../foundations/typography.module.css'

/**
 * CONCEPT A — THE COMPETITION DECK.
 *
 * ================================ THE MENTAL MODEL =========================
 *
 * "I AM INSIDE A COMPETITION. EVERYTHING I SEE BELONGS TO IT UNTIL I SAY
 * OTHERWISE."
 *
 * Football context is the ROOT of the architecture rather than a setting on it.
 * The largest permanent control in the product is the competition itself, and
 * the four destinations beneath it — Home, Matches, Games, Leagues — are that
 * competition's own. There is no global Play, no global Matches and no global
 * Leagues: those exist as a scope on the switcher ("Across all"), because the
 * evidence in the production authority is that competition CHOOSERS get worse
 * with every competition added, while a competition CONTEXT does not.
 *
 * WHAT IT IS ARGUING. That a football product is a place, and that the single
 * question a player answers on arrival is which football they are here for. If
 * that is right, then stating the competition once and loudly is cheaper than
 * repeating it on every card in every list, and a player with one competition
 * pays almost nothing for a platform with twenty.
 *
 * ================================ WHAT IS PERMANENT ========================
 *
 *   mobile   a context bar (the competition, its season, its tempo, a quiet
 *            Explore control and the account) above a four-item bottom bar of
 *            that competition's destinations
 *   desktop  a rail whose HEAD is the switcher, then the same four
 *            destinations, then the player's bounded competition shortcuts,
 *            then All competitions and the account
 *
 * THE TWO SHAPES CARRY THE SAME THREE THINGS: where I am, everywhere else, and
 * me. The rail says "everywhere else" with a full row; the bar says it with one
 * small control beside the competition. WHICHEVER WAY THE SWITCHER RENDERS —
 * button at two competitions, label at one — THE CATALOGUE IS ONE PRESS AWAY AT
 * EVERY WIDTH. Switching between competitions the player already has and
 * browsing the ones they do not are two different actions, and this concept is
 * the one that says so loudest: the switcher does the first and disappears as a
 * control when there is nothing to switch between; Explore does the second and
 * never disappears, because a platform of twenty published competitions always
 * has somewhere else to go.
 *
 * The two are not the same shape and are not meant to be: a phone gets one
 * decision per thumb reach, a 1440 screen gets the competition list open
 * permanently because it has the column to spend and the switch becomes free.
 *
 * ================================ HOW IT SCALES ============================
 *
 *   1 competition    the switcher renders as a LABEL and cannot be pressed.
 *                    A control that offers one choice is furniture. Explore
 *                    still stands beside it, because the catalogue is not the
 *                    player's own competitions and never was.
 *   2–6              a sheet listing them, no search.
 *   7+               the same sheet, search first, recents beneath, then the
 *                    rest — and the desktop rail still shows only six.
 *   20 published     unchanged, because the rail is a function of what the
 *                    player plays and never of what the platform publishes.
 *
 * ================================ WHERE THE GAMES LIVE =====================
 *
 * Games is a destination, and every game is a peer inside it. That is the
 * concept's strongest claim about Last Man Standing: it is not a tab beside
 * "predictions", it is one of three formats a competition runs, and it gets the
 * same row, the same weight and its own status vocabulary.
 *
 * ================================ THE KNOWN WEAKNESS =======================
 *
 * A PLAYER WITH FOUR COMPETITIONS AND ONE URGENT DEADLINE HAS TO KNOW WHICH
 * COMPETITION IT IS IN. This architecture has no cross-competition inbox on
 * screen at any time; the urgency lives inside a competition the player must
 * already have chosen. The switcher carries urgency dots to soften it, and a
 * dot is not an answer. Concept B exists because of this.
 */

const DESTINATIONS: readonly {
  readonly id: string
  readonly label: string
  readonly icon: LucideIcon
}[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'matches', label: 'Matches', icon: CalendarDays },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'leagues', label: 'Leagues', icon: Users },
]

/** How many competition shortcuts the desktop rail shows before All. */
const RAIL_SHORTCUTS = 6

export function ConceptA({
  model,
  feedback = 'system',
}: {
  model: IaModel
  feedback?: FeedbackPreference
}) {
  const nav = useIaNavigation(model)
  const headingId = useId()
  const contentId = useId()
  const [sheetOpen, setSheetOpen] = useState(false)
  /**
   * THE SWITCHER EXISTS TWICE AND ONE REF CANNOT HOLD BOTH.
   *
   * A single `useRef` shared by the rail copy and the bar copy holds whichever
   * mounted last, so closing the sheet on a desktop focused the phone's
   * `display: none` switcher and dropped the keyboard user on `<body>`. The
   * opener is captured from the press instead — see `foundations/focusReturn.ts`.
   */
  const { captureOpener, returnFocus } = useFocusReturn()
  const rise = useVNextMotion(vnextMotion.riseIn)

  const context = nav.context
  const owned = ownedContextCount(model)
  const switchable = owned > 1

  const currentDestination = (() => {
    switch (nav.destination.kind) {
      case 'matches':
        return 'matches'
      case 'games':
      case 'game':
        return 'games'
      case 'people':
      case 'league':
      case 'player':
        return 'leagues'
      default:
        return 'home'
    }
  })()

  function goTo(id: string) {
    if (!context) {
      nav.go({ kind: 'discover' })
      return
    }
    const contextId = context.competition.id
    const destination: IaDestination =
      id === 'matches'
        ? { kind: 'matches', contextId }
        : id === 'games'
          ? { kind: 'games', contextId }
          : id === 'leagues'
            ? { kind: 'people', contextId }
            : { kind: 'home' }
    nav.go(destination)
  }

  function openSheet(opener: HTMLElement | null) {
    captureOpener(opener)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    returnFocus()
  }

  function chooseContext(contextId: string) {
    nav.switchContext(contextId)
    // A DELIBERATE CHOICE LANDED. This is the one place in Concept A that asks
    // for haptic feedback, and it is `selection` rather than `success`: the
    // player picked something, nothing completed. Ordinary navigation between
    // the four destinations emits nothing at all.
    emitFeedback('selection', { preference: feedback })
    // ONLY THE SHEET RESTORES FOCUS, because only the sheet took it. The rail's
    // own shortcut list calls this too, and moving focus off the row the player
    // just pressed — onto a switcher they did not ask for — is the same defect
    // in the other direction.
    if (sheetOpen) closeSheet()
  }

  return (
    <div
      className={styles.shell}
      data-ia-concept="a"
      style={
        context
          ? competitionColourStyle({
              primary: context.competition.colours.primary,
              accent: context.competition.colours.accent,
            })
          : undefined
      }
    >
      <a className={styles.skipLink} href={`#${contentId}`}>
        Skip to content
      </a>

      {/* THE GRID LIVES ON A CHILD, NOT ON THE SHELL, and that is load-bearing
          rather than tidy. A container query is answered by an ANCESTOR
          container, so `.shell` — which declares `ia-shell` — can never match a
          query against it. The first build put `grid-template-columns` on
          `.shell` inside `@container ia-shell (min-width: 1120px)`; the rule was
          inert at every width, the rail rendered as a full-width block above the
          content, and it LOOKED plausible. The browser suite's "does this
          concept spend a column" measurement is what caught it. */}
      <div className={styles.frame}>
        {/* THE RAIL — desktop only, and CSS decides which of the two navigations
            is real. Both are always in the DOM and exactly one is displayed, so a
            keyboard user never reaches a control they cannot see. */}
        <div className={styles.rail}>
        <nav className={styles.railNav} aria-label="Competition">
          <ContextSwitcher
            variant="rail"
            context={context}
            switchable={switchable}
            open={sheetOpen}
            onOpen={openSheet}
            onClose={closeSheet}
          />
          <ul className={styles.railList}>
            {DESTINATIONS.map((destination) => (
              <li key={destination.id}>
                <button
                  type="button"
                  className={styles.railLink}
                  aria-current={currentDestination === destination.id ? 'page' : undefined}
                  onClick={() => goTo(destination.id)}
                >
                  <destination.icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  <span>{destination.label}</span>
                </button>
              </li>
            ))}
          </ul>

          {/* THE BOUNDED SHORTCUT GROUP. Six, then All competitions — the
              rail's height is a function of what the player plays, never of
              what the platform publishes. */}
          {model.contexts.length > 1 ? (
            <>
              <p className={styles.railGroupTitle}>Your competitions</p>
              <ul className={styles.railList}>
                {model.contexts.slice(0, RAIL_SHORTCUTS).map((entry) => (
                  <li key={entry.competition.id}>
                    <button
                      type="button"
                      className={styles.railLink}
                      aria-current={
                        entry.competition.id === context?.competition.id ? 'true' : undefined
                      }
                      onClick={() => chooseContext(entry.competition.id)}
                    >
                      <CompetitionMark
                        monogram={entry.competition.monogram}
                        primary={entry.competition.colours.primary}
                        accent={entry.competition.colours.accent}
                      />
                      <span className={styles.railLinkName}>{entry.competition.name}</span>
                      {entry.games.some((game) => game.urgency === 'urgent') ? (
                        <>
                          {/* ARIA PROHIBITS A NAME ON A GENERIC SPAN, so the dot
                              is decorative and the word travels in the button's
                              own name. The comma is deliberate: name computation
                              joins text nodes with no separator, so "Premier
                              League" + " needs you" would announce as
                              "Premier Leagueneeds you" — the gotcha
                              `PredictionChip` already records. */}
                          <span className={styles.urgencyDot} aria-hidden="true" />
                          <span className={text.srOnly}>, needs you</span>
                        </>
                      ) : null}
                    </button>
                  </li>
                ))}
                {model.contexts.length > RAIL_SHORTCUTS ? (
                  <li>
                    <span className={styles.railOverflow}>
                      +{model.contexts.length - RAIL_SHORTCUTS} more
                    </span>
                  </li>
                ) : null}
              </ul>
            </>
          ) : null}

          <ul className={styles.railList}>
            <li>
              <button
                type="button"
                className={styles.railLink}
                onClick={() => nav.go({ kind: 'discover' })}
              >
                <span className={styles.railGlobe} aria-hidden="true">
                  ◎
                </span>
                <span className={styles.railLinkName}>All competitions</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={styles.railLink}
                onClick={() => nav.go({ kind: 'me' })}
              >
                <span className={styles.railGlobe} aria-hidden="true">
                  ◍
                </span>
                <span className={styles.railLinkName}>{model.player.name}</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>

      <div className={styles.column}>
        <motion.header
          className={styles.masthead}
          variants={rise}
          initial="hidden"
          animate="visible"
        >
          {/* THE CONTEXT BAR — mobile's copy of the switcher, and the loudest
              permanent thing on the phone. It carries the two small controls
              the rail carries as rows: the way out to the catalogue and the
              way in to the account. */}
          <div className={styles.contextBar}>
            <ContextSwitcher
              variant="bar"
              context={context}
              switchable={switchable}
              open={sheetOpen}
              onOpen={openSheet}
              onClose={closeSheet}
            />
            {/* THE ESCAPE HATCH, AND WHY IT IS NOT CONDITIONAL.
                Below 1120 the rail is gone, and with it the row that said "All
                competitions". A player with one competition then had a switcher
                that is correctly not a control, four destinations that all
                belong to that one competition, and NO ROUTE INTO THE CATALOGUE
                AT ALL — the product stopped feeling like a one-competition
                product and started being one.

                It is present at every scale rather than only at one, because
                the alternative is chrome that rearranges itself the first time
                a player joins a second competition, and because the thing it
                reaches — twenty published competitions the player does not have
                — exists whatever the player owns. It is deliberately the
                smallest control in the bar: discovery is secondary here, and a
                concept whose whole claim is "you are inside a competition"
                cannot make leaving it the loudest thing on screen. */}
            {/* THE NAME IS AN `aria-label` AND THE VISIBLE WORD IS INSIDE IT.
                Name computation joins text nodes with no separator, so an
                sr-only " competitions" beside a visible "Explore" announces as
                "Explorecompetitions" — the `PredictionChip` gotcha, and one
                this control cannot dodge with a comma the way the urgency dot
                does. `Explore` is a substring of `Explore competitions`, so the
                speech-input requirement that a visible label be part of the
                accessible name still holds. */}
            <button
              type="button"
              className={styles.explore}
              aria-label="Explore competitions"
              onClick={() => nav.go({ kind: 'discover' })}
            >
              <Compass size={18} strokeWidth={1.75} aria-hidden="true" />
              <span className={styles.exploreLabel}>Explore</span>
            </button>
            <button
              type="button"
              className={styles.avatar}
              onClick={() => nav.go({ kind: 'me' })}
            >
              <span aria-hidden="true">{model.player.initials}</span>
              <span className={text.srOnly}>{model.player.name}</span>
            </button>
          </div>

          <BackControl nav={nav} />
          <h1 id={headingId} className={styles.heading}>
            {destinationTitle(nav)}
          </h1>
          {destinationContextLabel(nav) && nav.destination.kind !== 'home' ? (
            <p className={styles.headingContext}>{destinationContextLabel(nav)}</p>
          ) : null}
        </motion.header>

        <main
          id={contentId}
          className={styles.main}
          aria-labelledby={headingId}
          tabIndex={-1}
        >
          <IaSurface nav={nav} />
        </main>
        </div>
      </div>

      {/* THE BOTTOM BAR — four competition-scoped destinations, and never five.
          Four is the most that clears a 44px target across a 375px bar, which
          is the finding the accepted shell already recorded. */}
      <div className={styles.bottomBar}>
        <nav className={styles.bottomNav} aria-label="Competition sections">
          <ul className={styles.bottomList}>
            {DESTINATIONS.map((destination) => (
              <li key={destination.id} className={styles.bottomItem}>
                <button
                  type="button"
                  className={styles.bottomLink}
                  aria-current={currentDestination === destination.id ? 'page' : undefined}
                  onClick={() => goTo(destination.id)}
                >
                  <destination.icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.bottomLabel}>{destination.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {sheetOpen ? (
        <CompetitionSheet
          model={model}
          activeId={context?.competition.id ?? null}
          onChoose={chooseContext}
          onExplore={() => {
            // The catalogue REPLACES the sheet rather than closing behind it,
            // so focus follows the content to `<main>` — there is no opener to
            // return to when the player has deliberately gone somewhere.
            setSheetOpen(false)
            nav.go({ kind: 'discover' })
          }}
          onClose={closeSheet}
        />
      ) : null}
    </div>
  )
}

/**
 * THE SWITCHER, AND THE ONE THING IT MUST NOT DO AT SCALE ONE.
 *
 * With a single competition it is not a button. A control offering one choice
 * teaches a player that there is a decision to make and then wastes their press
 * proving there is not — which is precisely how a platform with twenty
 * competitions makes a one-competition player feel like a tourist in someone
 * else's product.
 *
 * IT IS NOT THE DISCOVERY CONTROL AND MUST NEVER BECOME ONE. Making the label
 * pressable so that "there is somewhere to go" would be the same lie in nicer
 * clothes: a control named after the competition the player is already in, that
 * opens a list of competitions they do not have. Explore sits beside it and
 * says what it does.
 *
 * IT TAKES NO REF. There are two of these on screen at once — a rail copy and a
 * bar copy — and a ref shared between them holds whichever mounted last. The
 * press itself carries the opener, which is the only source that cannot name
 * the hidden one.
 */
function ContextSwitcher({
  variant,
  context,
  switchable,
  open,
  onOpen,
  onClose,
}: {
  variant: 'bar' | 'rail'
  context: FootballContext | null
  switchable: boolean
  open: boolean
  onOpen: (opener: HTMLElement) => void
  onClose: () => void
}) {
  if (!context) {
    return (
      <span className={`${styles.switcher} ${styles[variant]}`}>
        <span className={styles.switcherName}>No competition yet</span>
      </span>
    )
  }

  const inner = (
    <>
      <CompetitionMark
        monogram={context.competition.monogram}
        primary={context.competition.colours.primary}
        accent={context.competition.colours.accent}
        size="md"
      />
      <span className={styles.switcherText}>
        <span className={`${styles.switcherName} ${text.emphasis}`}>
          {context.competition.name}
        </span>
        <span className={styles.switcherMeta}>
          {context.competition.seasonLabel ? `${context.competition.seasonLabel} · ` : ''}
          {context.tempoLabel ?? 'No football scheduled'}
        </span>
      </span>
      {switchable ? (
        <span className={styles.switcherCaret} aria-hidden="true">
          ▾
        </span>
      ) : null}
    </>
  )

  if (!switchable) {
    return <span className={`${styles.switcher} ${styles[variant]}`}>{inner}</span>
  }

  return (
    <button
      type="button"
      className={`${styles.switcher} ${styles.switcherButton} ${styles[variant]}`}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={(event) => {
        if (open) onClose()
        else onOpen(event.currentTarget)
      }}
    >
      {inner}
    </button>
  )
}

/**
 * THE SHEET. Recently viewed, then everything the player has, then a way out to
 * the whole catalogue. Search appears only once the list is long enough to need
 * it — a search field over three rows is a search field that has to be
 * explained.
 */
function CompetitionSheet({
  model,
  activeId,
  onChoose,
  onExplore,
  onClose,
}: {
  model: IaModel
  activeId: string | null
  onChoose: (contextId: string) => void
  onExplore: () => void
  onClose: () => void
}) {
  const titleId = useId()
  const [query, setQuery] = useState('')
  const searchable = model.contexts.length > 6
  const recents = recentContexts(model, 3)
  const searchRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  /**
   * FOCUS ENTERS THE SHEET, AND THE SHEET DECIDES WHERE.
   *
   * A dialog that opens without moving focus leaves a keyboard user tabbing
   * through the page behind it to reach the thing they just opened. Where the
   * list is long enough to be searchable the search is the useful landing
   * point; otherwise the dialog itself takes focus so the first Tab lands on
   * the first competition. Both exits — Escape and Close — return focus to the
   * control that opened it, which is the half most implementations forget.
   */
  useEffect(() => {
    if (searchRef.current) searchRef.current.focus()
    else dialogRef.current?.focus()
  }, [])

  const listed = model.contexts.filter((entry) =>
    query.trim() === ''
      ? true
      : entry.competition.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <div className={styles.sheetScrim} data-ia-sheet="">
      <div
        ref={dialogRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
      >
        <div className={styles.sheetHead}>
          <h2 id={titleId} className={styles.sheetTitle}>
            Choose a competition
          </h2>
          <button type="button" className={styles.sheetClose} onClick={onClose}>
            Close
          </button>
        </div>

        {searchable ? (
          <input
            ref={searchRef}
            className={styles.sheetSearch}
            type="search"
            aria-label={`Search your ${model.contexts.length} competitions`}
            placeholder="Search your competitions"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        ) : null}

        {recents.length > 0 && query.trim() === '' ? (
          <>
            <p className={styles.sheetGroup}>Recently viewed</p>
            <ul className={styles.sheetList}>
              {recents.map((entry) => (
                <SheetRow
                  key={`recent-${entry.competition.id}`}
                  entry={entry}
                  active={entry.competition.id === activeId}
                  onChoose={onChoose}
                />
              ))}
            </ul>
          </>
        ) : null}

        <p className={styles.sheetGroup}>Your competitions</p>
        <ul className={styles.sheetList}>
          {listed.map((entry) => (
            <SheetRow
              key={entry.competition.id}
              entry={entry}
              active={entry.competition.id === activeId}
              onChoose={onChoose}
            />
          ))}
        </ul>
        {listed.length === 0 ? (
          <p className={styles.sheetEmpty}>None of yours match “{query}”.</p>
        ) : null}

        <button type="button" className={styles.sheetExplore} onClick={onExplore}>
          All {model.catalogue.length} competitions
        </button>
      </div>
    </div>
  )
}

function SheetRow({
  entry,
  active,
  onChoose,
}: {
  entry: FootballContext
  active: boolean
  onChoose: (contextId: string) => void
}) {
  const joined = entry.games.filter((game) => game.availability === 'joined')
  return (
    <li>
      <button
        type="button"
        className={styles.sheetRow}
        aria-current={active ? 'true' : undefined}
        onClick={() => onChoose(entry.competition.id)}
      >
        <CompetitionMark
          monogram={entry.competition.monogram}
          primary={entry.competition.colours.primary}
          accent={entry.competition.colours.accent}
        />
        <span className={styles.sheetRowText}>
          <span className={text.emphasis}>{entry.competition.name}</span>
          <span className={styles.sheetRowMeta}>
            {/* FOLLOW AND JOIN STAY APART, even in a one-line summary. A
                competition the player follows and plays nothing in says so,
                rather than being counted as zero games and looking broken. */}
            {joined.length > 0
              ? `${joined.length} game${joined.length === 1 ? '' : 's'}`
              : 'Following · no games joined'}
            {entry.tempoLabel ? ` · ${entry.tempoLabel}` : ''}
          </span>
        </span>
        {entry.games.some((game) => game.urgency === 'urgent') ? (
          <>
                          {/* ARIA PROHIBITS A NAME ON A GENERIC SPAN, so the dot
                              is decorative and the word travels in the button's
                              own name. The comma is deliberate: name computation
                              joins text nodes with no separator, so "Premier
                              League" + " needs you" would announce as
                              "Premier Leagueneeds you" — the gotcha
                              `PredictionChip` already records. */}
                          <span className={styles.urgencyDot} aria-hidden="true" />
                          <span className={text.srOnly}>, needs you</span>
                        </>
        ) : null}
      </button>
    </li>
  )
}
