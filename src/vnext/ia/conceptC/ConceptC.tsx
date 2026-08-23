import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Home, Search, User } from 'lucide-react'
import type { FootballContext, GameKey, IaModel } from '../../models/ia'
import { GAME_NAMES, offeredGames } from '../../models/ia'
import { useVNextMotion, vnextMotion } from '../../foundations/motion'
import { useIaNavigation } from '../shared/navigation'
import type { IaDestination, IaNavigation } from '../shared/navigation'
import { useFocusReturn } from '../../foundations/focusReturn'
import {
  BackControl,
  CompetitionMark,
  GameStatusLine,
  IaSurface,
  destinationTitle,
} from '../shared/Surfaces'
import { emitFeedback } from '../../foundations/feedback'
import type { FeedbackPreference } from '../../foundations/feedback'
import styles from './conceptC.module.css'
import text from '../../foundations/typography.module.css'

/**
 * CONCEPT C — THE SPINE AND THE COMMAND SURFACE.
 *
 * ================================ THE MENTAL MODEL =========================
 *
 * "THERE IS ONE HOME AND ONE WAY TO JUMP ANYWHERE. HIERARCHY IS A SPINE, NOT A
 * SET OF TABS."
 *
 * This concept refuses the premise that the important places must all be
 * permanently on screen. It keeps two anchors — Home and You — and replaces
 * every other piece of permanent navigation with two things:
 *
 *   THE SPINE   a breadcrumb-shaped statement of where the player is, in which
 *               EVERY SEGMENT IS A MENU. "Premier League ▸ Match Predictor"
 *               tells you the football context and the game in the same four
 *               words, and either word changes it. It is the only navigation
 *               that scales with the product's DEPTH rather than its breadth.
 *
 *   THE COMMAND a single search-and-jump surface over competitions, games,
 *   SURFACE     private leagues and standings. It is discovery, it is the
 *               competition switcher, and it is the game switcher, and it is
 *               one control rather than three.
 *
 * WHAT IT IS ARGUING. That navigation furniture is the cost a product pays for
 * not being searchable, and that a platform heading for twenty competitions
 * times three games times any number of private leagues is past the point where
 * a fixed set of destinations can name what the player wants. It is the
 * architecture that gets STRUCTURALLY cheaper as the platform grows, which is
 * the opposite of the other two.
 *
 * ================================ WHAT IS PERMANENT ========================
 *
 *   mobile   two anchors and a central Jump control, plus the spine
 *   desktop  a command centre column — a search field over the player's whole
 *            play, grouped by competition, with every joined game and its
 *            status visible at once. No bottom bar, and the spine stays.
 *
 * The desktop is deliberately not the phone stretched: at 1440 this concept
 * shows more of the player's actual position — every competition, every joined
 * game and every status line — than either of the other two, because it spends
 * the width on state rather than on destinations.
 *
 * ================================ THE KNOWN WEAKNESSES =====================
 *
 * 1. IT ASKS THE PLAYER TO KNOW WHAT THEY WANT. A command surface rewards
 *    someone who can name the thing. A player who cannot has one Home and a
 *    spine, and that is a real risk with a mainstream football audience.
 * 2. DISCOVERABILITY OF THE GAMES. There is no place where the three games sit
 *    side by side as peers unless the player opens the spine's game segment,
 *    which they have to know is a menu. The spine's caret is doing a lot of
 *    work.
 * 3. IT IS THE LEAST CONVENTIONAL. Every phone football product the audience
 *    already uses has a bottom bar of destinations. This has two.
 */

export function ConceptC({
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
  const [commandOpen, setCommandOpen] = useState(false)
  /**
   * THE COMMAND SURFACE HAS TWO OPENERS AND ONLY ONE OF THEM IS EVER ON SCREEN.
   *
   * Below 1120 it is the bottom bar's Jump control; at and above it the bottom
   * bar is gone entirely and the command centre's own search button is the
   * opener. A hard-coded ref to the Jump button therefore returned focus to a
   * `display: none` element on every desktop width, and the keyboard user
   * landed on `<body>`. The opener travels with the press — see
   * `foundations/focusReturn.ts`.
   */
  const { captureOpener, returnFocus } = useFocusReturn()

  function openCommand(opener: HTMLElement | null) {
    captureOpener(opener)
    setCommandOpen(true)
  }

  function closeCommand() {
    setCommandOpen(false)
    returnFocus()
  }

  /**
   * `jump` and `chooseContext` ARE CALLED FROM THREE PLACES, AND ONLY ONE OF
   * THEM IS AN OVERLAY. The command surface, the desktop command centre and the
   * spine's own menus all share these two functions; restoring focus
   * unconditionally meant the spine's menu handed focus to its segment button
   * and this function immediately took it away again. Focus is only returned
   * where it was actually taken.
   */
  function jump(destination: IaDestination) {
    nav.go(destination)
    if (commandOpen) closeCommand()
  }

  function chooseContext(contextId: string) {
    nav.switchContext(contextId)
    emitFeedback('selection', { preference: feedback })
    if (commandOpen) closeCommand()
  }

  return (
    <div className={styles.shell} data-ia-concept="c">
      <a className={styles.skipLink} href={`#${contentId}`}>
        Skip to content
      </a>

      {/* THE GRID LIVES ON A CHILD, NOT ON THE SHELL. A container query is
          answered by an ANCESTOR container, so `.shell` cannot match a query
          against the container it declares itself — see the same note in
          Concept A, which had the same defect and was caught by the same
          measurement. */}
      <div className={styles.frame}>
      {/* THE COMMAND CENTRE — desktop only. It is the command surface made
          permanent, which is what a wide screen is for.

          A `<nav>` AND NOT AN `<aside>`, and the browser suite is what found
          it: at 1120 the bottom bar goes and this becomes the ONLY navigation
          on the page, so an `aside` left the desktop with no navigation
          landmark at all. A screen-reader user would have had a list of
          landmarks with nowhere to go in it. */}
      <nav className={styles.centre} aria-label="Your play">
        {/* THE DESKTOP OPENER. It is a different element from the phone's Jump
            control, not a copy of it, and closing the command surface must come
            back HERE — which is exactly what a single shared ref could not
            express. */}
        <button
          type="button"
          className={styles.centreSearch}
          aria-haspopup="dialog"
          aria-expanded={commandOpen}
          onClick={(event) => openCommand(event.currentTarget)}
        >
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>Jump to anything</span>
        </button>
        <CommandCentreList nav={nav} onChooseContext={chooseContext} onJump={jump} />
      </nav>

      <div className={styles.column}>
        <motion.header
          className={styles.masthead}
          variants={rise}
          initial="hidden"
          animate="visible"
        >
          <Spine nav={nav} onChooseContext={chooseContext} onJump={jump} />
          <BackControl nav={nav} />
          <h1 id={headingId} className={styles.heading}>
            {destinationTitle(nav)}
          </h1>
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

      <div className={styles.bottomBar}>
        <nav className={styles.bottomNav} aria-label="Primary">
          <ul className={styles.bottomList}>
            <li className={styles.bottomItem}>
              <button
                type="button"
                className={styles.bottomLink}
                aria-current={nav.destination.kind === 'home' ? 'page' : undefined}
                onClick={() => nav.go({ kind: 'home' })}
              >
                <Home size={20} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.bottomLabel}>Home</span>
              </button>
            </li>
            <li className={styles.bottomItem}>
              {/* THE JUMP CONTROL. Centre, largest, and the only way into
                  everything that is not Home or You. If this concept fails, it
                  fails here. */}
              <button
                type="button"
                className={`${styles.bottomLink} ${styles.jump}`}
                aria-haspopup="dialog"
                aria-expanded={commandOpen}
                onClick={(event) => openCommand(event.currentTarget)}
              >
                <Search size={22} strokeWidth={2} aria-hidden="true" />
                <span className={styles.bottomLabel}>Jump</span>
              </button>
            </li>
            <li className={styles.bottomItem}>
              <button
                type="button"
                className={styles.bottomLink}
                aria-current={nav.destination.kind === 'me' ? 'page' : undefined}
                onClick={() => nav.go({ kind: 'me' })}
              >
                <User size={20} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.bottomLabel}>You</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {commandOpen ? (
        <CommandSurface
          model={model}
          nav={nav}
          onChooseContext={chooseContext}
          onJump={jump}
          onClose={closeCommand}
        />
      ) : null}
    </div>
  )
}

/* ==========================================================================
   the spine
   ========================================================================== */

/**
 * WHERE THE PLAYER IS, IN WORDS, WITH EVERY WORD A CONTROL.
 *
 * The first segment is always the football context. The second appears only
 * when the player is inside a game, and it is the game switcher — which is the
 * only place in this concept where the three games are enumerated. Season is
 * part of the first segment rather than a third: a season is a property of the
 * competition, and a third segment would imply it is a level.
 */
function Spine({
  nav,
  onChooseContext,
  onJump,
}: {
  nav: IaNavigation
  onChooseContext: (contextId: string) => void
  onJump: (destination: IaDestination) => void
}) {
  const context = nav.context
  const gameKey = nav.destination.kind === 'game' ? nav.destination.game : null

  if (!context) {
    return (
      <p className={styles.spine}>
        <span className={styles.spineEmpty}>No competition chosen yet</span>
      </p>
    )
  }

  return (
    <div className={styles.spine}>
      <SpineMenu
        label={context.competition.name}
        meta={context.competition.seasonLabel}
        buttonLabel={`Competition: ${context.competition.name}. Change`}
      >
        {(close) => (
          <ul className={styles.menuList}>
            {nav.model.contexts.map((entry) => (
              <li key={entry.competition.id}>
                <button
                  type="button"
                  className={styles.menuItem}
                  aria-current={
                    entry.competition.id === context.competition.id ? 'true' : undefined
                  }
                  onClick={() => {
                    onChooseContext(entry.competition.id)
                    close()
                  }}
                >
                  <CompetitionMark
                    monogram={entry.competition.monogram}
                    primary={entry.competition.colours.primary}
                    accent={entry.competition.colours.accent}
                  />
                  <span className={styles.menuItemText}>{entry.competition.name}</span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className={`${styles.menuItem} ${styles.menuItemQuiet}`}
                onClick={() => {
                  onJump({ kind: 'discover' })
                  close()
                }}
              >
                <span className={styles.menuItemText}>
                  All {nav.model.catalogue.length} competitions…
                </span>
              </button>
            </li>
          </ul>
        )}
      </SpineMenu>

      {gameKey ? (
        <>
          <span className={styles.spineDivider} aria-hidden="true">
            ▸
          </span>
          <SpineMenu
            label={GAME_NAMES[gameKey]}
            meta={null}
            buttonLabel={`Game: ${GAME_NAMES[gameKey]}. Change`}
          >
            {(close) => (
              <GameMenu
                context={context}
                onChoose={(key) => {
                  onJump({ kind: 'game', contextId: context.competition.id, game: key })
                  close()
                }}
              />
            )}
          </SpineMenu>
        </>
      ) : null}
    </div>
  )
}

function GameMenu({
  context,
  onChoose,
}: {
  context: FootballContext
  onChoose: (game: GameKey) => void
}) {
  const offered = offeredGames(context)
  const missing = context.games.filter((game) => game.availability === 'not-offered')

  return (
    <>
      <ul className={styles.menuList}>
        {offered.map((game) => (
          <li key={game.key}>
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => onChoose(game.key)}
            >
              <span className={styles.menuItemText}>
                <span className={text.emphasis}>{game.name}</span>
                <span className={styles.menuItemMeta}>
                  <GameStatusLine game={game} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* A GAME THE COMPETITION DOES NOT RUN IS SAID ONCE, IN WORDS, AND IS NOT
          A DISABLED ROW. A greyed row invites a press and then refuses it. */}
      {missing.length > 0 ? (
        <p className={styles.menuNote}>
          {context.competition.shortName} does not run{' '}
          {missing.map((game) => game.name).join(' or ')}.
        </p>
      ) : null}
    </>
  )
}

/**
 * One spine segment: a labelled button and the list it opens.
 *
 * Escape closes it and focus returns to the segment, because a menu that
 * strands focus in a closed popover is the defect that makes keyboard users
 * abandon a product rather than report it.
 */
function SpineMenu({
  label,
  meta,
  buttonLabel,
  children,
}: {
  label: string
  meta: string | null
  buttonLabel: string
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <span className={styles.segment}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.segmentButton}
        aria-expanded={open}
        aria-label={buttonLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.segmentLabel}>{label}</span>
        {meta ? <span className={styles.segmentMeta}>{meta}</span> : null}
        <span className={styles.segmentCaret} aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          className={styles.menu}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close()
          }}
        >
          {children(close)}
        </div>
      ) : null}
    </span>
  )
}

/* ==========================================================================
   the command surface
   ========================================================================== */

type CommandResult = {
  readonly id: string
  readonly group: string
  readonly label: string
  readonly meta: string
  readonly run: () => void
}

function CommandSurface({
  model,
  nav,
  onChooseContext,
  onJump,
  onClose,
}: {
  model: IaModel
  nav: IaNavigation
  onChooseContext: (contextId: string) => void
  onJump: (destination: IaDestination) => void
  onClose: () => void
}) {
  const titleId = useId()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  /**
   * ONE INDEX OVER THREE DIFFERENT KINDS OF THING, AND THE GROUPS KEEP THEM
   * APART. Competitions, games and people are searched together because that is
   * what makes the surface worth having; they are never MERGED, because a flat
   * list in which "Premier League", "Last Man Standing" and "The Sunday Club"
   * look like siblings is the exact confusion Stage 7.5 exists to prevent.
   */
  const results = useMemo<readonly CommandResult[]>(() => {
    const out: CommandResult[] = []

    for (const context of model.contexts) {
      out.push({
        id: `ctx-${context.competition.id}`,
        group: 'Competitions',
        label: context.competition.name,
        meta: context.competition.seasonLabel ?? 'No season',
        run: () => onChooseContext(context.competition.id),
      })
      for (const game of offeredGames(context)) {
        out.push({
          id: `game-${context.competition.id}-${game.key}`,
          group: 'Games',
          label: `${game.name} · ${context.competition.shortName}`,
          meta:
            game.availability === 'joined'
              ? 'Joined'
              : game.availability === 'joinable'
                ? 'Open to join'
                : 'Registration closed',
          run: () =>
            onJump({ kind: 'game', contextId: context.competition.id, game: game.key }),
        })
      }
    }

    for (const scope of model.people) {
      out.push({
        id: `people-${scope.id}`,
        group: scope.kind === 'private-league' ? 'Your leagues' : 'Standings',
        label: scope.title,
        meta:
          scope.kind === 'private-league'
            ? `${scope.memberCount} members`
            : `${scope.fieldSize.toLocaleString('en-GB')} entrants`,
        run: () =>
          onJump(
            scope.kind === 'private-league'
              ? { kind: 'league', scopeId: scope.id }
              : { kind: 'people', contextId: scope.contextId },
          ),
      })
    }

    out.push({
      id: 'discover',
      group: 'Discover',
      label: `Browse all ${model.catalogue.length} competitions`,
      meta: 'The whole published catalogue',
      run: () => onJump({ kind: 'discover' }),
    })

    const needle = query.trim().toLowerCase()
    if (!needle) return out
    return out.filter(
      (entry) =>
        entry.label.toLowerCase().includes(needle) ||
        entry.group.toLowerCase().includes(needle),
    )
  }, [model, onChooseContext, onJump, query])

  const groups = useMemo(() => {
    const order = ['Competitions', 'Games', 'Your leagues', 'Standings', 'Discover']
    return order
      .map((group) => ({ group, entries: results.filter((entry) => entry.group === group) }))
      .filter((entry) => entry.entries.length > 0)
  }, [results])

  return (
    <div className={styles.commandScrim}>
      <div
        className={styles.command}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
      >
        <div className={styles.commandHead}>
          <h2 id={titleId} className={styles.commandTitle}>
            Jump to anything
          </h2>
          <button type="button" className={styles.commandClose} onClick={onClose}>
            Close
          </button>
        </div>
        <input
          ref={inputRef}
          className={styles.commandInput}
          type="search"
          aria-label="Search competitions, games, leagues and standings"
          placeholder="Premier League, Last Man Standing, The Sunday Club…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className={styles.commandHint}>
          {nav.model.contexts.length} of your competitions · {model.catalogue.length} published
        </p>
        {groups.length === 0 ? (
          <p className={styles.commandEmpty}>Nothing matches “{query}”.</p>
        ) : (
          groups.map((group) => (
            <section key={group.group} className={styles.commandGroup}>
              <h3 className={styles.commandGroupTitle}>{group.group}</h3>
              <ul className={styles.commandList}>
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" className={styles.commandItem} onClick={entry.run}>
                      <span className={styles.commandItemLabel}>{entry.label}</span>
                      <span className={styles.commandItemMeta}>{entry.meta}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  )
}

/**
 * THE DESKTOP COMMAND CENTRE, which is the concept's real answer to "does it
 * use the width or merely stretch a phone".
 *
 * It shows the player's whole position at once — every competition, every game
 * they have joined in it, and each game's own status in its own vocabulary. No
 * other concept puts that on screen permanently, and no phone can.
 */
function CommandCentreList({
  nav,
  onChooseContext,
  onJump,
}: {
  nav: IaNavigation
  onChooseContext: (contextId: string) => void
  onJump: (destination: IaDestination) => void
}) {
  const { model } = nav

  if (model.contexts.length === 0) {
    return (
      <p className={styles.centreEmpty}>
        Nothing followed and nothing joined. The command surface is the way in.
      </p>
    )
  }

  return (
    <div className={styles.centreGroups}>
      {model.contexts.map((context) => {
        const joined = context.games.filter((game) => game.availability === 'joined')
        return (
          <section key={context.competition.id} className={styles.centreGroup}>
            <button
              type="button"
              className={styles.centreCompetition}
              aria-current={
                context.competition.id === nav.context?.competition.id ? 'true' : undefined
              }
              onClick={() => onChooseContext(context.competition.id)}
            >
              <CompetitionMark
                monogram={context.competition.monogram}
                primary={context.competition.colours.primary}
                accent={context.competition.colours.accent}
              />
              <span className={styles.centreCompetitionName}>{context.competition.name}</span>
            </button>
            {joined.length === 0 ? (
              <p className={styles.centreFollowing}>Following · no games joined</p>
            ) : (
              <ul className={styles.centreGames}>
                {joined.map((game) => (
                  <li key={game.key}>
                    <button
                      type="button"
                      className={styles.centreGame}
                      data-urgency={game.urgency}
                      onClick={() =>
                        onJump({
                          kind: 'game',
                          contextId: context.competition.id,
                          game: game.key,
                        })
                      }
                    >
                      <span className={styles.centreGameName}>{game.name}</span>
                      <span className={styles.centreGameStatus}>
                        <GameStatusLine game={game} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
      <button
        type="button"
        className={styles.centreExplore}
        onClick={() => onJump({ kind: 'discover' })}
      >
        All {model.catalogue.length} competitions
      </button>
    </div>
  )
}
