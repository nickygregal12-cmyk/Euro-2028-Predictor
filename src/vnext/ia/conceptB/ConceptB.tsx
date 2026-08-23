import { useId, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, Inbox, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { IaModel } from '../../models/ia'
import { attentionFor } from '../../models/ia'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import { useIaNavigation } from '../shared/navigation'
import type { IaDestination, IaNavigation } from '../shared/navigation'
import {
  BackControl,
  CompetitionMark,
  IaSurface,
  destinationTitle,
} from '../shared/Surfaces'
import { emitFeedback } from '../../foundations/feedback'
import type { FeedbackPreference } from '../../foundations/feedback'
import styles from './conceptB.module.css'
import text from '../../foundations/typography.module.css'

/**
 * CONCEPT B — THE ATTENTION INBOX.
 *
 * ================================ THE MENTAL MODEL =========================
 *
 * "THE PRODUCT TELLS ME WHAT TO DO. COMPETITIONS ARE LABELS ON THE WORK."
 *
 * The front door is not a place, it is a QUEUE: everything that needs the
 * player, across every competition and every game, ordered by how much it
 * needs them. Football context is demoted from a root to a FILTER — a chip
 * row that scopes whichever of the three anchors is current — and games are
 * never navigation at all. A game is the SHAPE of a card in the queue.
 *
 * WHAT IT IS ARGUING. That the question a returning player actually has is
 * "what do I need to do", not "which competition am I in", and that a product
 * which makes them pick a competition before answering it has made them do the
 * routing. It is the same argument the production authority already made when
 * it turned `/play` from a competition chooser into a cross-competition action
 * inbox — taken to its conclusion and applied to the whole architecture.
 *
 * ================================ WHAT IS PERMANENT ========================
 *
 *   mobile   three anchors — Needs you, Football, People — over a horizontally
 *            scrollable competition filter, "All" first
 *   desktop  the filter becomes a permanent left column of competitions with
 *            their own urgency, and the queue takes two columns beside it
 *
 * ================================ HOW IT SCALES ============================
 *
 * BEST OF THE THREE, AND BY CONSTRUCTION. A filter costs one chip; twenty
 * competitions cost twenty chips in a scroller that starts on "All", and the
 * player who never touches it is unaffected. Nothing in the permanent chrome
 * grows with the catalogue, because the catalogue is not in the chrome.
 *
 * ================================ WHERE THE GAMES LIVE =====================
 *
 * NOWHERE, AND EVERYWHERE. There is no Games destination and no game switcher.
 * A game appears when it has something to say, wearing its own vocabulary: the
 * Match Predictor as a fraction, Last Man Standing as one club and a
 * consequence, the Championship as a fixture against a named opponent. This is
 * the concept where Last Man Standing is structurally impossible to bury,
 * because there is no tab for it to be the fourth of.
 *
 * ================================ THE KNOWN WEAKNESSES =====================
 *
 * 1. "WHERE AM I" IS THE WEAKEST OF THE THREE. Football context is a filter,
 *    so the answer to "which competition am I in" is "all of them" more often
 *    than not — which is honest, and is not what a football product usually
 *    feels like.
 * 2. BROWSING IS SECOND-CLASS. A player who wants to read a league table on a
 *    quiet Tuesday has to leave the queue to do it, and the queue is what the
 *    architecture is for.
 * 3. A QUIET DAY IS AN EMPTY FRONT DOOR. The `quiet` scenario is where this
 *    concept has the most to prove, and the honest answer is that it degrades
 *    into "here is what just happened" rather than "here is what to do".
 */

const ANCHORS: readonly {
  readonly id: 'attention' | 'football' | 'people'
  readonly label: string
  readonly icon: LucideIcon
}[] = [
  { id: 'attention', label: 'Needs you', icon: Inbox },
  { id: 'football', label: 'Football', icon: CalendarDays },
  { id: 'people', label: 'People', icon: Users },
]

export function ConceptB({
  model,
  feedback = 'system',
}: {
  model: IaModel
  feedback?: FeedbackPreference
}) {
  const nav = useIaNavigation(model)
  const headingId = useId()
  const contentId = useId()
  const rise = useVNextMotion(vnextMotion.riseIn)

  /**
   * THE FILTER IS THE CONCEPT'S OWN STATE AND NOT THE NAVIGATION'S.
   *
   * `null` means "all competitions", which is the default and the thing the
   * whole architecture is for. The shared navigation still tracks a context —
   * it has to, because Football and a player profile are always ABOUT a
   * competition — but here that context follows the filter rather than leading
   * it, which is exactly the inversion under review.
   */
  const [filter, setFilter] = useState<string | null>(null)

  /**
   * CONCEPT B HAS NO HOME, AND THAT IS THE ARCHITECTURE RATHER THAN AN OMISSION.
   *
   * The shared navigation opens every concept on `home`, because two of the
   * three have one. This one does not: its front door is the queue, so `home`
   * is normalised to `attention` here and nowhere else. The browser suite found
   * the omission — switching the competition filter was landing the player on a
   * competition's front door and out of the queue, which is precisely the
   * behaviour this concept exists to argue against.
   */
  const destination: IaDestination =
    nav.destination.kind === 'home' ? { kind: 'attention' } : nav.destination

  const anchor: 'attention' | 'football' | 'people' = (() => {
    switch (destination.kind) {
      case 'matches':
        return 'football'
      case 'people':
      case 'league':
      case 'player':
        return 'people'
      default:
        return 'attention'
    }
  })()

  const filtered = attentionFor(model, filter)

  function goAnchor(id: 'attention' | 'football' | 'people') {
    if (id === 'attention') {
      nav.go({ kind: 'attention' })
      return
    }
    if (id === 'people') {
      nav.go({ kind: 'people', contextId: filter })
      return
    }
    // FOOTBALL ALWAYS NEEDS A COMPETITION, and "all" is not one. With the
    // filter off it falls to the player's most relevant competition rather
    // than refusing — a football destination that answers "which one?" is the
    // chooser this concept exists to remove.
    const contextId = filter ?? model.contexts[0]?.competition.id
    if (contextId) nav.go({ kind: 'matches', contextId })
    else nav.go({ kind: 'discover' })
  }

  function chooseFilter(next: string | null) {
    setFilter(next)
    if (next !== null) {
      nav.switchContext(next)
      emitFeedback('selection', { preference: feedback })
    } else {
      nav.go({ kind: 'attention' })
    }
  }

  return (
    <div className={styles.shell} data-ia-concept="b">
      <a className={styles.skipLink} href={`#${contentId}`}>
        Skip to content
      </a>

      <motion.header
        className={styles.masthead}
        variants={rise}
        initial="hidden"
        animate="visible"
      >
        <div className={styles.topRow}>
          <h1 id={headingId} className={styles.heading}>
            {destination.kind === 'attention'
              ? 'Needs you'
              : destinationTitle({ ...nav, destination })}
          </h1>
          <button
            type="button"
            className={styles.avatar}
            onClick={() => nav.go({ kind: 'me' })}
          >
            <span aria-hidden="true">{model.player.initials}</span>
            <span className={text.srOnly}>{model.player.name}</span>
          </button>
        </div>

        {destination.kind === 'attention' ? (
          <p className={styles.subheading}>
            {filtered.length === 0
              ? 'Nothing is waiting.'
              : `${filtered.length} thing${filtered.length === 1 ? '' : 's'} across ${
                  filter === null ? `${model.contexts.length} competitions` : 'this competition'
                }.`}
          </p>
        ) : null}

        {/* WHAT THIS COMPETITION RUNS, WHEN THE FILTER NARROWS TO ONE.
            Concept B has no game navigation at all, so without this it has
            nowhere to say that Euro 2028 runs no Last Man Standing — a player
            filtering to it would see a short queue and be left to infer whether
            the game is missing, unjoined or simply quiet. The two other
            concepts answer it on a games surface; this is where an
            activity-first architecture has to answer it. */}
        {filter !== null ? <FilterScopeNote model={model} filter={filter} /> : null}

        <BackControl nav={nav} />

        {/* THE FILTER — a scroller on a phone, a column on a desktop. It is the
            only place competitions appear in the permanent chrome, and it is
            the only thing here that grows with the catalogue. */}
        <div className={styles.filterScroller}>
          <FilterChips model={model} filter={filter} onChoose={chooseFilter} nav={nav} />
        </div>
      </motion.header>

      <div className={styles.columns}>
        {/* THE DESKTOP COLUMN. It carries the same three anchors and the same
            competition filter as the phone's bottom bar and scroller, and CSS
            displays exactly one pair — so the anchors never appear twice in
            the accessibility tree, and neither navigation is a focus stop
            nobody can see. */}
        <div className={styles.filterColumn}>
          <nav className={styles.columnNav} aria-label="Primary">
            <ul className={styles.columnAnchors}>
              {ANCHORS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.columnAnchor}
                    aria-current={anchor === item.id ? 'page' : undefined}
                    onClick={() => goAnchor(item.id)}
                  >
                    <item.icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <p className={styles.filterColumnTitle}>Filter</p>
          <FilterChips
            model={model}
            filter={filter}
            onChoose={chooseFilter}
            nav={nav}
            variant="column"
          />
        </div>

        <main
          id={contentId}
          className={styles.main}
          aria-labelledby={headingId}
          tabIndex={-1}
        >
          <IaSurface nav={filterAwareNav({ ...nav, destination }, filter)} />
        </main>
      </div>

      <div className={styles.bottomBar}>
        <nav className={styles.bottomNav} aria-label="Primary">
          <ul className={styles.bottomList}>
            {ANCHORS.map((item) => (
              <li key={item.id} className={styles.bottomItem}>
                <button
                  type="button"
                  className={styles.bottomLink}
                  aria-current={anchor === item.id ? 'page' : undefined}
                  onClick={() => goAnchor(item.id)}
                >
                  <item.icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.bottomLabel}>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}

/**
 * The queue and the people list are filtered; everything else is not.
 *
 * WHY THE NAVIGATION IS WRAPPED RATHER THAN TOLD. The shared navigation is the
 * same object in all three concepts, and giving it a `filter` would give
 * Concepts A and C a field they have no idea what to do with — a shared type
 * quietly acquiring one concept's model is how a lab stops comparing anything.
 * So the filter is applied at the boundary, where it belongs to Concept B
 * alone.
 */
function filterAwareNav(nav: IaNavigation, filter: string | null): IaNavigation {
  if (nav.destination.kind === 'attention' && filter !== null) {
    return {
      ...nav,
      model: { ...nav.model, attention: attentionFor(nav.model, filter) },
    }
  }
  if (nav.destination.kind === 'people') {
    const destination: IaDestination = { kind: 'people', contextId: filter }
    return { ...nav, destination }
  }
  return nav
}

function FilterChips({
  model,
  filter,
  onChoose,
  nav,
  variant = 'scroller',
}: {
  model: IaModel
  filter: string | null
  onChoose: (contextId: string | null) => void
  nav: IaNavigation
  variant?: 'scroller' | 'column'
}) {
  return (
    <ul className={`${styles.filterList} ${styles[variant]}`}>
      <li>
        <button
          type="button"
          className={styles.chip}
          aria-pressed={filter === null}
          onClick={() => onChoose(null)}
        >
          <span className={styles.chipName}>All</span>
          {model.attention.length > 0 ? (
            <span className={styles.chipCount}>{model.attention.length}</span>
          ) : null}
        </button>
      </li>
      {model.contexts.map((context) => {
        const count = attentionFor(model, context.competition.id).filter(
          (item) => item.urgency !== 'done',
        ).length
        return (
          <li key={context.competition.id}>
            <button
              type="button"
              className={styles.chip}
              aria-pressed={filter === context.competition.id}
              data-urgent={context.games.some((game) => game.urgency === 'urgent')}
              onClick={() => onChoose(context.competition.id)}
            >
              <CompetitionMark
                monogram={context.competition.monogram}
                primary={context.competition.colours.primary}
                accent={context.competition.colours.accent}
              />
              <span className={styles.chipName}>{context.competition.shortName}</span>
              {count > 0 ? <span className={styles.chipCount}>{count}</span> : null}
            </button>
          </li>
        )
      })}
      <li>
        <button
          type="button"
          className={`${styles.chip} ${styles.chipExplore}`}
          onClick={() => nav.go({ kind: 'discover' })}
        >
          <span className={styles.chipName}>Find a competition</span>
        </button>
      </li>
    </ul>
  )
}

/**
 * The one sentence an activity-first architecture owes a filtered competition.
 *
 * It names what the competition RUNS and what it does not, and it distinguishes
 * the two from a game the player simply has not joined — three different facts
 * that a queue, which only shows work, cannot otherwise separate.
 */
function FilterScopeNote({ model, filter }: { model: IaModel; filter: string }) {
  const context = model.contexts.find((entry) => entry.competition.id === filter)
  if (!context) return null
  const runs = context.games.filter((game) => game.availability !== 'not-offered')
  const missing = context.games.filter((game) => game.availability === 'not-offered')

  return (
    <p className={styles.scopeNote}>
      {context.competition.name} runs {runs.map((game) => game.name).join(', ') || 'no games'}.
      {missing.length > 0
        ? ` It does not run ${missing.map((game) => game.name).join(' or ')}.`
        : ''}
    </p>
  )
}
