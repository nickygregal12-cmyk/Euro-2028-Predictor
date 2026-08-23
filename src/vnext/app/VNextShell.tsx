import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Compass } from 'lucide-react'
import { VNextNav, defaultNavItems } from '../components/navigation/VNextNav'
import type { VNextNavItem } from '../components/navigation/VNextNav'
import { competitionColourStyle } from '../foundations/teamColour'
import { useFocusReturn } from '../foundations/focusReturn'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { useStickyScrollPadding } from '../foundations/useStickyScrollPadding'
import type {
  ShellDestinationId,
  ShellIntent,
  VNextShellModel,
} from '../models/shell'
import {
  SHELL_DESTINATIONS,
  SHELL_DESTINATION_IDS,
  attentionElsewhere,
  shellActiveContext,
  shellJumpAvailable,
  shellShortcuts,
  shellSwitchable,
  contextNeedsAttention,
} from '../models/shell'
import { NON_AFFILIATION_SHORT } from '../models/about'
import { VNextPageHeadingContext } from './VNextPageHeader'
import { CompetitionMark } from './CompetitionMark'
import { CompetitionSheetBody, CompetitionSwitcher } from './CompetitionSwitcher'
import { AttentionElsewhereControl, AttentionListBody } from './AttentionElsewhere'
import { JumpBody, JumpControl } from './JumpSearch'
import { ShellOverlay } from './ShellOverlay'
import { useVNextShellContext } from './VNextShellProvider'
import text from '../foundations/typography.module.css'
import styles from './VNextShell.module.css'
import { ActionCentreControl } from './ActionCentreControl'
import { ActionCentreBody } from './ActionCentreBody'
import { useShellActions, type VNextShellActions } from './VNextActionsProvider'

export type VNextShellProps = {
  /** The page. The shell has no opinion about what is in here. */
  children: ReactNode
  /**
   * Which competition-scoped destination this page is, or `'none'`.
   *
   * `'none'` IS FOR A PAGE THAT IS LEGITIMATELY OUTSIDE THE FOUR, not for one
   * that has not been assigned yet. Account is the first: the matrix keeps the
   * player's platform identity deliberately outside the tournament boundary, so
   * it is reached from the avatar rather than from the navigation, and no
   * destination should light up while the player is there. The navigation
   * compares `item.id === activeId` and simply matches nothing, which is the
   * behaviour wanted — stated here so the next page outside the four does not
   * reach for one of them at random.
   */
  destination: ShellDestinationId | 'none'
  /** Use `VNextPageHeader`. See the heading contract below. */
  header?: ReactNode
  /**
   * The world the shell is chrome FOR. Normally supplied by
   * `VNextShellProvider` from above the page; this prop is for a story or a
   * test that renders the shell directly and wins over the provider.
   */
  shell?: VNextShellModel
  onIntent?: ((intent: ShellIntent) => void) | undefined
  /**
   * The competition palette behind the page when there is no shell model to
   * take it from — a page rendered on its own in Storybook.
   *
   * WHERE BOTH EXIST, THE ACTIVE FOOTBALL CONTEXT WINS. Competition identity is
   * the shell's under the selected architecture, and two sources for one colour
   * is how a page and its chrome end up painting different competitions.
   */
  competitionColours?: { readonly primary: string; readonly accent: string } | null
  /**
   * THE DURABLE ACTION FEED, or `undefined` where no host supplies one.
   *
   * `undefined` DRAWS NO CONTROL AT ALL, which is the shape a story, a render
   * test or a page-scoped `/dev` harness gets — the same rule `shellElsewhere`
   * follows. It is not a degraded state: a shell with no action host is a shell
   * that was never given one, and an inbox control opening an empty panel would
   * be worse than no control.
   *
   * A HOST THAT SUPPLIES IT OWNS THE READ. The shell renders the control and
   * the panel and issues nothing itself, because chrome mounted per page would
   * re-read the feed on every navigation.
   */
  actions?: VNextShellActions | undefined
}

/**
 * THE vNext APPLICATION SHELL — THE COMPETITION DECK.
 *
 * ======================== THE SELECTED INFORMATION ARCHITECTURE ============
 *
 * Stage 7.5 built three information-architecture concepts in a lab and chose
 * none. Stage 7.6 is where the human selection lands:
 *
 *   SELECTED     Concept A, THE COMPETITION DECK — competition-context-first.
 *   REJECTED     Concept B, Attention Inbox · Concept C, Spine and Command.
 *   RETAINED     from B, cross-competition attention as a SECONDARY layer;
 *                from C, Jump as an OPTIONAL power-user accelerator.
 *
 * The hierarchy is load-bearing and is why this file is arranged the way it is.
 * A is the PRODUCT MENTAL MODEL; B is an attention LAYER over it; C is a
 * SHORTCUT past it. `docs/product/vnext-shell-ia.md` records the rationale.
 *
 * THE MENTAL MODEL, IN ONE SENTENCE:
 *
 *   "I AM INSIDE A FOOTBALL COMPETITION. EVERYTHING BENEATH THIS CHROME BELONGS
 *    TO IT UNTIL I DELIBERATELY CHANGE IT."
 *
 * ======================== THE PLATFORM IS LARGE; THE PRODUCT IS SMALL ======
 *
 * The single hardest requirement in the brief, and the one every decision below
 * is measured against: a player who only plays the Premier League must get a
 * Premier League prediction game, not a twenty-competition dashboard with the
 * Premier League currently selected.
 *
 * How that is kept true rather than promised:
 *
 *   - `contexts` is the PLAYER's list and never the platform's, so twenty
 *     published competitions cost a one-competition player nothing;
 *   - at one context the switcher is a LABEL and not a control (see
 *     `CompetitionSwitcher`);
 *   - the rail's shortcut group is absent at one context and BOUNDED at six
 *     (`SHELL_SHORTCUT_LIMIT`) at twenty, so permanent chrome never grows into
 *     a logo wall;
 *   - the attention layer renders NOTHING when nothing is waiting elsewhere;
 *   - Jump appears only where the rail has stopped being complete;
 *   - and `e2e/vnext-shell.spec.ts` MEASURES the permanent chrome at one, four,
 *     ten and twenty competitions rather than asserting that it is bounded.
 *
 * ======================== WHAT THE SHELL OWNS =============================
 *
 * The active football context, competition switching, the discovery entry,
 * primary destination navigation, the cross-competition attention indicator,
 * the optional Jump accelerator, the player/account entry, the canvas and its
 * competition atmosphere, the page bounds, the sticky masthead, the single
 * `<main>` landmark, the skip link, mobile safe-area clearance, and the width
 * at which the bar becomes a rail.
 *
 * HOME AND THE PREDICTOR OWN NONE OF THAT. They own what is inside `<main>`,
 * and their one `<h1>`. Stage 5's rule survives intact: nothing under `app/`
 * may import from `home/` or `fixtures/`, and `tests/vnext/shell.test.tsx`
 * holds the direction.
 *
 * ======================== IT IS ROUTE-AGNOSTIC ============================
 *
 * Every control emits a `ShellIntent` and the host decides what it means. This
 * stage repoints NO production route — §25 of the brief — and the shell is
 * deliberately incapable of doing so: it holds no URL, imports no router and
 * names no page component. `docs/product/vnext-route-migration-matrix.md`
 * records the TARGET address space separately from the visible architecture.
 *
 * ======================== THE HEADING CONTRACT ============================
 *
 *   - the SHELL renders the single `<main>`, and nothing else may;
 *   - the PAGE renders the single `<h1>`, through `VNextPageHeader` in `header`;
 *   - the shell points `<main aria-labelledby>` at the id it handed the header
 *     down through context, so neither side invents one.
 *
 * ======================== MOTION ==========================================
 *
 * The masthead entrance, the navigation indicator, and the overlays' entrance.
 * Nothing else, and nothing decorative. A COMPETITION SWITCH IS NOT ANIMATED
 * AND IS NEVER DELAYED BY ONE: `chooseContext` emits its intent and closes the
 * sheet in the same tick, because chrome that waits for a transition before
 * navigating is chrome that has made the player wait for it.
 */
export function VNextShell({
  children,
  destination,
  header,
  shell,
  onIntent,
  competitionColours,
  actions: suppliedActions,
}: VNextShellProps) {
  const headingId = useId()
  const contentId = useId()
  const rise = useVNextMotion(vnextMotion.riseIn)
  const provided = useVNextShellContext()

  const model = shell ?? provided?.model ?? null
  const emit = onIntent ?? provided?.onIntent

  const context = model ? shellActiveContext(model) : null
  const colours = context?.competition.colours ?? competitionColours ?? null

  /**
   * WHICH OVERLAY IS OPEN, AS ONE VALUE AND NOT THREE BOOLEANS.
   *
   * Three `useState(false)` allow two overlays open at once, which is a scrim
   * over a scrim and a focus return to a control that is behind both. One value
   * makes that state unrepresentable.
   */
  const [overlay, setOverlay] = useState<
    'none' | 'competitions' | 'attention' | 'jump' | 'actions'
  >('none')

  /**
   * THE ACTION FEED, FROM THE PROP OR FROM THE HOST ABOVE THE PAGES.
   *
   * Resolved the same way `shell` is, and for the same reason: twenty connected
   * screens render this component and none of them should have to carry a feed
   * they never read. `undefined` draws no Action Centre at all.
   */
  const actions = useShellActions(suppliedActions)
  /**
   * THE OPENER IS CAPTURED FROM THE PRESS, NOT HELD IN A REF.
   *
   * Every one of these controls exists TWICE — a bar copy and a rail copy, with
   * CSS displaying exactly one — and a shared ref holds whichever mounted last.
   * Closing a sheet on a desktop then focused the phone's `display: none`
   * control and dropped the keyboard user on `<body>`. See
   * `foundations/focusReturn.ts`.
   */
  const { captureOpener, returnFocus } = useFocusReturn()
  const sheetSearchRef = useRef<HTMLInputElement>(null)
  const jumpSearchRef = useRef<HTMLInputElement>(null)

  const open = useCallback(
    (
      which: 'competitions' | 'attention' | 'jump' | 'actions',
      opener: HTMLElement | null,
    ) => {
      captureOpener(opener)
      setOverlay(which)
      // SEEN IS RECORDED ON READING, NOT ON LOADING. Marking when the feed
      // arrives would record that a player had seen a BADGE, which is not the
      // same thing and is what makes the state worth persisting at all.
      if (which === 'actions') actions?.onOpen?.()
    },
    [captureOpener, actions],
  )

  const close = useCallback(() => {
    setOverlay('none')
    returnFocus()
  }, [returnFocus])

  /**
   * A DELIBERATE DESTINATION WAS REACHED, so there is no opener to go back to.
   * Returning focus to a control the player has just navigated away from is the
   * same defect as not returning it — focus follows the content instead.
   */
  const leave = useCallback(
    (intent: ShellIntent) => {
      setOverlay('none')
      emit?.(intent)
    },
    [emit],
  )

  /**
   * THE JUMP SHORTCUT, AND THE THREE THINGS THAT MUST BE TRUE OF IT.
   *
   * It only exists where Jump itself does; it never fires while the player is
   * typing (a `Ctrl+K` inside the predictor's score boxes or inside this very
   * search field would be the accelerator eating the product); and it is never
   * the only route — the rail's own control is a real named button with the
   * shortcut printed on it.
   *
   * It listens on the SHELL's own subtree rather than on `document`, so two
   * device frames in one Storybook board do not both answer one keystroke.
   */
  const jumpAvailable = model !== null && shellJumpAvailable(model)
  const shellRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!jumpAvailable) return
    const node = shellRef.current
    if (!node) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'k' && event.key !== 'K') return
      if (!event.metaKey && !event.ctrlKey) return
      const target = event.target
      if (target instanceof HTMLElement) {
        const tag = target.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return
        }
      }
      event.preventDefault()
      captureOpener(null)
      setOverlay('jump')
    }
    node.addEventListener('keydown', onKeyDown)
    return () => node.removeEventListener('keydown', onKeyDown)
  }, [jumpAvailable, captureOpener])

  const mastheadRef = useRef<HTMLElement | null>(null)
  const navBarRef = useRef<HTMLDivElement | null>(null)

  const navItems = useMemo(() => toNavItems(model), [model])
  const attentionCount = model ? attentionElsewhere(model).length : 0
  const shortcuts = model ? shellShortcuts(model) : null
  const showShortcuts = model !== null && shellSwitchable(model)

  function goToDestination(id: string) {
    // `VNextNav` is generic over its items and hands back a plain string, so
    // the id is narrowed against the four the architecture actually has rather
    // than asserted. A host is never handed a destination that is not one.
    const destination = SHELL_DESTINATION_IDS.find((entry) => entry === id) ?? 'home'
    emit?.({
      kind: 'destination',
      destination,
      contextId: model?.activeContextId ?? null,
    })
  }

  const exploreControl = model?.discovery.reachable ?? false
  const player = model?.player ?? null

  /**
   * `UX-007`. The two sticky bars are the two ends of the scrollport, and the
   * browser aligns a focused control to exactly those edges unless the scroller
   * is told otherwise. Measured rather than assumed — see the hook.
   */
  useStickyScrollPadding(mastheadRef, navBarRef)

  return (
    <div
      ref={shellRef}
      className={styles.shell}
      data-vnext-shell=""
      style={colours ? competitionColourStyle(colours) : undefined}
    >
      {/* THE SKIP LINK IS THE FIRST THING IN THE SHELL, AND STAGE 7.6 MOVED IT.
          It used to live inside the masthead, which was correct while the
          masthead was the first thing on the page. The competition rail comes
          before the content column now, so a keyboard user at 1440 would have
          reached the skip link AFTER the switcher, Jump, four destinations, six
          competition shortcuts, Explore and the account — by which point it has
          nothing left to skip. `tests/vnext/shell.test.tsx` measures the focus
          order, which is how this was caught rather than reasoned about. */}
      <a className={styles.skipLink} href={`#${contentId}`}>
        Skip to content
      </a>

      {/* THE GRID IS ON A CHILD AND THAT IS LOAD-BEARING RATHER THAN TIDY.
          A container query is answered by an ANCESTOR container, so `.shell` —
          which declares `vnext-shell` — can never match a query against it.
          Stage 7.5 shipped exactly that mistake into a concept: the rule was
          inert at every width, the rail rendered as a full-width block above
          the content, and it looked entirely plausible. */}
      <div className={styles.frame}>
        {/* ---------------- the desktop rail ---------------- *
            Both navigations are always in the DOM and CSS displays exactly one.
            `display: none` takes the other out of the accessibility tree as
            well as off the page, so there is never a duplicate landmark or a
            focus stop nobody can see. */}
        {/* `data-vnext-shell-zone` AND NOT `data-vnext-zone`, deliberately.
            `data-vnext-zone` is the vocabulary a PAGE marks its own zones with
            — Home's stage, grounds and social; the predictor's brief and work —
            and several suites gate on "the first zone is visible" to know a
            page has laid out. The rail is `display: none` below 1120, so
            joining that vocabulary put a permanently hidden element first in
            document order and hung every phone-width measurement in
            `e2e/vnext-home.spec.ts`. The shell's own structural markers get
            their own attribute. */}
        <div className={styles.rail} data-vnext-shell-zone="rail">
          <div className={styles.railInner}>
            {model ? (
              <CompetitionSwitcher
                model={model}
                variant="rail"
                open={overlay === 'competitions'}
                onOpen={(opener) => open('competitions', opener)}
                onClose={close}
              />
            ) : null}

            {jumpAvailable ? (
              <JumpControl
                open={overlay === 'jump'}
                onOpen={(opener) => open('jump', opener)}
                onClose={close}
              />
            ) : null}

            <VNextNav
              variant="rail"
              activeId={destination}
              items={navItems}
              onSelect={goToDestination}
            />

            {model ? (
              <AttentionElsewhereControl
                model={model}
                variant="rail"
                open={overlay === 'attention'}
                onOpen={(opener) => open('attention', opener)}
                onClose={close}
              />
            ) : null}

            {/* THE ACTION CENTRE — a PLACE rather than an alarm, so unlike the
                attention control above it stays when there is nothing unread.
                It sits below the destinations because it is a utility, and
                below the attention layer because that one is about the next
                hour and this one is about everything. */}
            {actions ? (
              <ActionCentreControl
                unseen={actions.model?.unseen ?? null}
                variant="rail"
                open={overlay === 'actions'}
                onOpen={(opener) => open('actions', opener)}
                onClose={close}
              />
            ) : null}

            {/* THE BOUNDED SHORTCUT GROUP. Six, then a count — the rail's
                height is a function of what the player plays and never of what
                the platform publishes. Absent entirely at one competition,
                because a "Your competitions" group listing the competition you
                are already in is furniture. */}
            {showShortcuts && shortcuts ? (
              <nav className={styles.shortcuts} aria-label="Your competitions">
                <p className={styles.groupTitle}>Your competitions</p>
                <ul className={styles.shortcutList}>
                  {shortcuts.shown.map((entry) => {
                    const active = entry.competition.id === model?.activeContextId
                    const needs =
                      model !== null && contextNeedsAttention(model, entry.competition.id)
                    return (
                      <li key={entry.competition.id}>
                        <button
                          type="button"
                          className={styles.shortcut}
                          aria-current={active ? 'true' : undefined}
                          onClick={() =>
                            emit?.({ kind: 'context', contextId: entry.competition.id })
                          }
                        >
                          <CompetitionMark competition={entry.competition} />
                          <span className={styles.shortcutName}>
                            {entry.competition.name}
                          </span>
                          {needs ? (
                            <>
                              {/* ARIA prohibits a name on a generic span, so the
                                  dot is decorative and the word travels in the
                                  button's own name. The comma stops name
                                  computation joining the nodes into
                                  "Premier Leagueneeds you". */}
                              <span className={styles.dot} aria-hidden="true" />
                              <span className={text.srOnly}>, needs you</span>
                            </>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                  {shortcuts.overflow > 0 ? (
                    <li>
                      <p className={styles.overflow}>+{shortcuts.overflow} more</p>
                    </li>
                  ) : null}
                </ul>
              </nav>
            ) : null}

            <div className={styles.railFoot}>
              {exploreControl ? (
                <button
                  type="button"
                  className={styles.railAction}
                  onClick={() => emit?.({ kind: 'discover' })}
                >
                  <Compass size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span className={styles.railActionLabel}>Explore competitions</span>
                </button>
              ) : null}
              {player ? (
                <button
                  type="button"
                  className={styles.railAction}
                  onClick={() => emit?.({ kind: 'account' })}
                >
                  <span className={styles.initials} aria-hidden="true">
                    {player.initials}
                  </span>
                  <span className={styles.railActionLabel}>{player.name}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* ---------------- the content column ---------------- */}
        <div className={styles.column}>
          <motion.header
            ref={mastheadRef}
            className={styles.masthead}
            data-vnext-zone="masthead"
            variants={rise}
            initial="hidden"
            animate="visible"
          >
            {/* THE CONTEXT BAR — the phone's copy of the rail's head, and the
                loudest permanent thing on a 375px screen. It is hidden at 1120
                and above, where the rail says the same things in a column. */}
            {model ? (
              <div className={styles.contextBar}>
                <CompetitionSwitcher
                  model={model}
                  variant="bar"
                  open={overlay === 'competitions'}
                  onOpen={(opener) => open('competitions', opener)}
                  onClose={close}
                />
                {/* THE ESCAPE HATCH, AND WHY IT IS NOT CONDITIONAL ON SCALE.
                    Below 1120 the rail is gone and with it the row that said
                    "Explore competitions". A player with one competition would
                    then have a switcher that is correctly not a control, four
                    destinations that all belong to that one competition, and NO
                    ROUTE INTO THE CATALOGUE AT ALL — the product would stop
                    feeling like a one-competition product and start being one.
                    It is the smallest control in the bar, because a concept
                    whose whole claim is "you are inside a competition" cannot
                    make leaving it the loudest thing on screen.

                    THE VISIBLE WORD IS INSIDE THE ACCESSIBLE NAME. Name
                    computation joins text nodes with no separator, so an
                    sr-only " competitions" beside a visible "Explore" announces
                    as "Explorecompetitions"; and `Explore` is a substring of
                    `Explore competitions`, so the speech-input requirement that
                    a visible label be part of the name still holds. */}
                {exploreControl ? (
                  <button
                    type="button"
                    className={styles.explore}
                    aria-label="Explore competitions"
                    onClick={() => emit?.({ kind: 'discover' })}
                  >
                    <Compass size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span className={styles.exploreLabel}>Explore</span>
                  </button>
                ) : null}
                {/* ON THE PHONE IT IS ICON-ONLY AND SITS BEFORE THE AVATAR.
                    The rail is gone below 1120, so without this the Action
                    Centre would be a desktop-only place — which is the wrong
                    way round for a feed whose whole value is that a matchweek
                    deadline reaches the player wherever they are. */}
                {actions ? (
                  <ActionCentreControl
                    unseen={actions.model?.unseen ?? null}
                    variant="bar"
                    open={overlay === 'actions'}
                    onOpen={(opener) => open('actions', opener)}
                    onClose={close}
                  />
                ) : null}
                {player ? (
                  <button
                    type="button"
                    className={styles.avatar}
                    onClick={() => emit?.({ kind: 'account' })}
                  >
                    <span aria-hidden="true">{player.initials}</span>
                    <span className={text.srOnly}>{player.name}</span>
                  </button>
                ) : null}
              </div>
            ) : null}

            {/* THE ATTENTION LAYER IS BELOW THE COMPETITION AND ABOVE NOTHING
                ELSE. It renders nothing at all when nothing is waiting
                elsewhere, so the quiet day costs no height. */}
            {model && attentionCount > 0 ? (
              <div className={styles.attentionBand}>
                <AttentionElsewhereControl
                  model={model}
                  variant="masthead"
                  open={overlay === 'attention'}
                  onOpen={(opener) => open('attention', opener)}
                  onClose={close}
                />
              </div>
            ) : null}

            <VNextPageHeadingContext.Provider value={headingId}>
              {header}
            </VNextPageHeadingContext.Provider>
          </motion.header>

          <main
            id={contentId}
            className={styles.main}
            aria-labelledby={header ? headingId : undefined}
            tabIndex={-1}
          >
            {children}
          </main>

          {/* ---------------- the platform footer ----------------
              ADR 0017 asks for "an unambiguous non-affiliation statement in the
              footer and terms", and this product had neither. One line, at the
              foot of every vNext page, and the full position one press away.

              IT IS THE SHELL'S AND NOT A PAGE'S, because a legal position that
              nine pages carry and the tenth forgets is not published. It sits
              INSIDE the page column rather than under the whole frame, so it
              scrolls away with the content instead of competing with the mobile
              bottom bar for the bottom of a 667px phone.

              NOT A DESTINATION. It is a link, drawn in the quietest permanent
              place, and it lights nothing up: About belongs to the platform and
              the four destinations belong to the competition. */}
          <footer className={styles.platformFooter} data-vnext-shell-zone="footer">
            <p className={styles.platformFooterLine}>
              {NON_AFFILIATION_SHORT}
            </p>
            <button
              type="button"
              className={styles.platformFooterLink}
              onClick={() => emit?.({ kind: 'about' })}
            >
              About &amp; Disclaimer
            </button>
          </footer>
        </div>
      </div>

      {/* ---------------- the mobile bottom bar ---------------- */}
      <div ref={navBarRef} className={styles.navBar} data-vnext-shell-zone="navbar">
        <VNextNav
          variant="bar"
          activeId={destination}
          items={navItems}
          onSelect={goToDestination}
        />
      </div>

      {model && overlay === 'competitions' ? (
        <ShellOverlay
          title="Choose a competition"
          initialFocusRef={sheetSearchRef}
          onClose={close}
        >
          <CompetitionSheetBody
            model={model}
            searchRef={sheetSearchRef}
            onChoose={(contextId) => {
              // ONE PRESS, NO ANIMATION IN THE WAY. The intent goes out and the
              // sheet closes in the same tick; focus returns to the opener
              // because the player is still where they were, in a competition
              // that has changed underneath them.
              setOverlay('none')
              emit?.({ kind: 'context', contextId })
              returnFocus()
            }}
            onExplore={() => leave({ kind: 'discover' })}
          />
        </ShellOverlay>
      ) : null}

      {model && overlay === 'attention' ? (
        <ShellOverlay title="Needs you elsewhere" onClose={close}>
          <AttentionListBody
            model={model}
            onOpenItem={(item) =>
              // "Go and do this" is ONE intention. The row changes the football
              // context and opens the game, rather than charging the player for
              // the shell's own architecture.
              leave({ kind: 'game', contextId: item.contextId, game: item.game })
            }
          />
        </ShellOverlay>
      ) : null}

      {/* IT DOES NOT REQUIRE `model`, unlike the three overlays around it.
          Those are all ABOUT the competition deck — a switcher, a
          cross-competition attention list, a jump across contexts — and none of
          them means anything without one. The action feed is the player's, not
          a competition's, and a player whose shell model has not landed still
          has a matchweek locking. */}
      {actions && overlay === 'actions' ? (
        <ShellOverlay title="Updates" onClose={close}>
          <ActionCentreBody
            model={actions.model}
            status={actions.status}
            onOpenItem={actions.onOpenItem}
            onDismiss={actions.onDismiss}
            onRetry={actions.onRetry}
          />
        </ShellOverlay>
      ) : null}

      {model && overlay === 'jump' ? (
        <ShellOverlay title="Jump to" initialFocusRef={jumpSearchRef} onClose={close}>
          <JumpBody model={model} searchRef={jumpSearchRef} onIntent={leave} />
        </ShellOverlay>
      ) : null}
    </div>
  )
}

/**
 * THE FOUR DESTINATIONS, WITH WHATEVER COUNTS THE APPLICATION SUPPLIED.
 *
 * The badge is the MODEL's and never the page's. Stage 5 let Home pass a
 * `navItems` array with an open-prediction count on it, which made the page an
 * author of the application's navigation — the exact thing §6 of this brief
 * moves into the shell. The count still reaches the same place; it arrives from
 * the host that knows it instead.
 */
function toNavItems(model: VNextShellModel | null): readonly VNextNavItem[] {
  const destinations = model?.destinations ?? SHELL_DESTINATIONS
  return defaultNavItems.map((item) => {
    const supplied = destinations.find((entry) => entry.id === item.id)
    if (!supplied) return item
    const badge = supplied.badge
    return badge && badge > 0
      ? { ...item, label: supplied.label, badge }
      : { ...item, label: supplied.label }
  })
}

