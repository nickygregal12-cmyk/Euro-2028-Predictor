/**
 * THE vNext APPLICATION SHELL MODEL — STAGE 7.6.
 *
 * Stage 7.5 built three information-architecture concepts in a lab and chose
 * none of them. Stage 7.6 is where the human selection — **CONCEPT A, THE
 * COMPETITION DECK** — stops being a lab exhibit and becomes the contract the
 * accepted `app/VNextShell` is built against.
 *
 * ============================ THE MENTAL MODEL ============================
 *
 * "I AM INSIDE A FOOTBALL COMPETITION. EVERYTHING BENEATH THE SHELL BELONGS TO
 * THAT COMPETITION UNTIL I DELIBERATELY CHANGE IT."
 *
 * Football context is the ROOT of the architecture and not a setting on it. The
 * destinations beneath it — Home, Matches, Games, Leagues — are that
 * competition's own.
 *
 * ============================ THREE DIMENSIONS, KEPT APART ================
 *
 * This file inherits Stage 7.5's central claim and enforces it the same way
 * `features/hub/playerCompetitions.ts` enforces Follow/Join/Favourite: with
 * separate types, no field derived from another.
 *
 *   A. FOOTBALL CONTEXT — which competition's football am I looking at?
 *   B. GAME            — what am I doing with that football?
 *   C. PEOPLE          — who am I doing it against?
 *
 * A competition is not a game. A game is not a private league. There is no
 * `ShellGameRef` carrying colours or a season, because a game drawn with a
 * competition's furniture is a game masquerading as football context — which is
 * exactly how Last Man Standing became "another little tab".
 *
 * ============================ WHAT IT IS NOT ==============================
 *
 * IT IS A PRESENTATION CONTRACT AND NOT A RULE AUTHORITY. Nothing here defines
 * a lock, a score, a settlement, a reveal, an eligibility or a membership.
 * Every status line is a STRING the application supplies, never a number this
 * lane computes: `detail` is copy, not an instant to compare against a clock.
 * The shell may know that the Match Predictor has two predictions left; it may
 * not work that out.
 *
 * IT REACHES NO SERVICE AND NO DATABASE. `tests/vnext/vnextProductionBoundary.
 * test.ts` holds the direction — `components → models`, `integration →
 * services`, never `components → services` — and `app/` may not reach `home/`
 * or `fixtures/` either. The shell is handed one of these and renders it.
 *
 * IT HOLDS NO RECENCY, DELIBERATELY. Stage 7.5's audit found that
 * "recently viewed competitions" is stored nowhere: `lastVisit.ts` is a single
 * local marker for when this device last showed the Hub, not per-competition
 * recency. Concept A's lab drew a "Recently viewed" group from a fixture field.
 * There is no such field here, so a shell that wanted to draw fictional recent
 * history would have to invent the type first. See `docs/product/vnext-shell-
 * ia.md` §"Recently viewed".
 */

/* ==========================================================================
   A. FOOTBALL CONTEXT
   ========================================================================== */

/** How presentation paints a competition. Colours only; never identity. */
export type ShellCompetitionColours = {
  readonly primary: string
  readonly accent: string
}

export type ShellCompetition = {
  readonly id: string
  /** Full name. Long names are expected and must never be truncated. */
  readonly name: string
  /** For dense rows and chips. Never a different competition. */
  readonly shortName: string
  /** Two letters, for a collapsed rail row or an avatar-sized mark. */
  readonly monogram: string
  /**
   * The season, as words. Season is part of the football context and not a
   * fourth dimension: a player is in "Premier League · 2026/27", and a cup with
   * no season simply carries `null`.
   */
  readonly seasonLabel: string | null
  readonly colours: ShellCompetitionColours
}

/**
 * WHY THIS COMPETITION IS THE PLAYER'S AT ALL.
 *
 * The platform's own two answers, kept apart exactly as `playerCompetitions.ts`
 * keeps them: `playing` means at least one game joined here (server-owned
 * membership); `following` means the player asked for the football and joined
 * nothing, which is a real state and not an empty one.
 *
 * `browsing` from the lab's `ContextRelationship` is deliberately absent. A
 * competition the player merely reached through discovery is not one of theirs
 * and has no business in the shell's context list — it belongs to discovery,
 * which the shell reaches and does not contain.
 */
export type ShellRelationship = 'playing' | 'following'

/* ==========================================================================
   B. GAME
   ========================================================================== */

/** The three games. `championship` is the Predictor Championship. */
export type ShellGameKey = 'match-predictor' | 'last-man-standing' | 'championship'

export const SHELL_GAME_NAMES: Readonly<Record<ShellGameKey, string>> = {
  'match-predictor': 'Match Predictor',
  'last-man-standing': 'Last Man Standing',
  championship: 'Predictor Championship',
}

/**
 * THERE IS NO SHORT-NAME MAP HERE, and its absence is deliberate.
 *
 * Stage 7.5's lab carried one — "Predictor", "LMS", "Championship" — for dense
 * concept rows. Nothing in the selected architecture is dense enough to need
 * it: the shell names a game in an attention row, in a Jump row and in the
 * Games destination, and all three have the width for the real name. An
 * abbreviation with no caller is a second vocabulary waiting for somebody to
 * use it in the one place the full name would have fitted.
 */

/**
 * WHAT A GAME IS DOING FOR THIS PLAYER, IN THIS COMPETITION.
 *
 * ONE VARIANT PER GAME, AND THEY ARE NOT INTERCHANGEABLE — Stage 7.5's finding,
 * carried into the product contract unchanged. The Match Predictor's state is a
 * progress fraction against a deadline; Last Man Standing's is a survival state
 * and a club; the Championship's is a position in a field. A single
 * `{ headline, detail }` shape would let the shell draw all three identically,
 * which is precisely how LMS got treated as one more tab.
 *
 * EVERY FIELD IS THE APPLICATION'S ANSWER. `remaining` is a count somebody else
 * made; `deadlineLabel` is copy. Presentation never infers survival, never
 * counts a card and never compares a label to a clock.
 */
export type ShellGameSummary =
  | {
      readonly kind: 'match-predictor'
      readonly made: number
      readonly of: number
      readonly deadlineLabel: string | null
    }
  | {
      readonly kind: 'last-man-standing'
      readonly life: 'alive' | 'eliminated' | 'not-entered'
      /** The club picked for the open round, when there is one. */
      readonly selection: string | null
      readonly deadlineLabel: string | null
    }
  | {
      readonly kind: 'championship'
      readonly position: number
      readonly of: number
      readonly nextOpponent: string | null
    }

/**
 * A game this competition RUNS and this player can reach.
 *
 * A GAME THE COMPETITION DOES NOT RUN IS NOT IN THIS LIST. It is not disabled,
 * not greyed and not present — the brief's "unsupported game" requirement, and
 * the reason there is no `availability: 'not-offered'` here to represent it. A
 * control that exists and refuses teaches a player the product is broken.
 */
export type ShellGame = {
  readonly key: ShellGameKey
  /** The game's name as the application states it. */
  readonly name: string
  /** Absent where the player has no state in this game yet. */
  readonly summary: ShellGameSummary | null
}

/* ==========================================================================
   C. PEOPLE
   ========================================================================== */

/**
 * A private league, as somewhere the shell can send the player.
 *
 * IT NAMES ITS GAME AS WELL AS ITS COMPETITION, always. A private container
 * always belongs to exactly one game in exactly one competition, and a league
 * row that says only "Sunday Club" is a row that could be any of three games.
 *
 * NOTHING ABOUT PEOPLE THEMSELVES IS HERE. Stage 7.5's audit found that the
 * global season leaderboard returns display names with no user id, that season
 * profiles are semi-private, and that following a player does not exist. Those
 * are the later social stage's decisions, and §14 of this stage's brief forbids
 * touching any of them. The shell needs a stable PLACE for people and not a
 * model of them.
 */
export type ShellLeague = {
  readonly id: string
  readonly name: string
  readonly game: ShellGameKey
}

/* ==========================================================================
   THE CONTEXT ITSELF
   ========================================================================== */

export type ShellContext = {
  readonly competition: ShellCompetition
  readonly relationship: ShellRelationship
  /**
   * Whether football is happening here right now, in words the application
   * supplied. "3 live now", "Locks in 41 min", "Saturday". Copy, never an
   * instant, and `null` where the application has nothing to say.
   */
  readonly tempoLabel: string | null
  /** Every game this competition runs and this player can reach. */
  readonly games: readonly ShellGame[]
  /** Private leagues in this competition that are addressable today. */
  readonly leagues: readonly ShellLeague[]
}

/* ==========================================================================
   DESTINATIONS
   ========================================================================== */

/**
 * THE FOUR COMPETITION-SCOPED DESTINATIONS.
 *
 * They are ids, not routes and not components. The shell must be able to host
 * Matches, Leagues, Last Man Standing and the Championship at later stages
 * without learning what any of them render, so nothing here imports a page and
 * nothing here is a URL. `docs/product/vnext-route-migration-matrix.md` is the
 * accounting device for the address space; this is the mental model.
 *
 * `games` AND NOT `play` — see `docs/product/vnext-shell-ia.md` §"Games versus
 * Play". The short version: this product already uses both words and they
 * already mean different things. "Game" is what a joinable format is called
 * everywhere from `get_competition_games` to onboarding's "Choose your games";
 * "Play" is the cross-competition action inbox at `/play`, whose job the
 * Competition Deck moves into Home.
 */
export type ShellDestinationId = 'home' | 'matches' | 'games' | 'leagues'

export const SHELL_DESTINATION_IDS: readonly ShellDestinationId[] = [
  'home',
  'matches',
  'games',
  'leagues',
]

export type ShellDestination = {
  readonly id: ShellDestinationId
  /** The visible word. A prop so a localised set can replace all four. */
  readonly label: string
  /** A small count — open predictions, unread invites. Zero renders nothing. */
  readonly badge?: number
}

/** The default English set, in the order the navigation shows them. */
export const SHELL_DESTINATIONS: readonly ShellDestination[] = [
  { id: 'home', label: 'Home' },
  { id: 'matches', label: 'Matches' },
  { id: 'games', label: 'Games' },
  { id: 'leagues', label: 'Leagues' },
]

/* ==========================================================================
   ATTENTION — the secondary layer retained from Concept B
   ========================================================================== */

/**
 * ONE THING WAITING FOR THE PLAYER, WHEREVER IT IS.
 *
 * WHAT WAS RETAINED FROM CONCEPT B — the Attention Inbox — AND WHAT WAS NOT.
 *
 * Retained: the observation that Concept A's real weakness is cross-competition
 * urgency. A player inside the Premier League should not have to remember that
 * the Champions League locks in eighteen minutes.
 *
 * NOT retained: Concept B's information architecture. The queue is not the
 * front door, competitions are not filters over work, and "Needs you" is not a
 * permanent destination. This is a SECONDARY LAYER over a competition-rooted
 * product, and the shell renders nothing at all when nothing is waiting.
 *
 * IT NAMES ITS CONTEXT AND ITS GAME SEPARATELY. That is what stops an attention
 * list from flattening into one in which "Premier League" and "Last Man
 * Standing" look like the same kind of thing — the exact failure the three
 * dimensions exist to prevent.
 *
 * IT DOES NOT INVENT URGENCY FROM A CLOCK. `urgency` is a decision the
 * application made and `detail` is copy it wrote. Nothing in the shell reads
 * `Date.now()`, so a story rendered at midnight and a story rendered at noon
 * say the same thing.
 */
export type ShellAttentionUrgency = 'live' | 'urgent' | 'soon'

export type ShellAttentionItem = {
  readonly id: string
  /** Which football context. Always resolved against `contexts`. */
  readonly contextId: string
  /** Which game. Never merged with the competition into one label. */
  readonly game: ShellGameKey
  /** What the player has to do, in a few words. */
  readonly headline: string
  /** Why now. "Locks in 41 minutes", "3 matches live". Copy. */
  readonly detail: string
  readonly urgency: ShellAttentionUrgency
}

/* ==========================================================================
   DISCOVERY AND THE PLAYER
   ========================================================================== */

/**
 * The way OUT of the player's own competitions and into the catalogue.
 *
 * DISCOVERY IS A DIFFERENT JOB FROM SWITCHING, and the shell is the surface
 * that says so loudest. Switching moves between competitions the player already
 * has; discovery browses the ones they do not. The switcher does the first and
 * stops being a control when there is nothing to switch between; Explore does
 * the second and never disappears, because a platform with twenty published
 * competitions always has somewhere else to go.
 *
 * `catalogueSize` is the application's count where it has one and `null` where
 * it does not — an Explore control that promised "All 20 competitions" from a
 * read that never landed would be a number the shell made up.
 */
export type ShellDiscovery = {
  /** Whether the catalogue can be reached from here at all. */
  readonly reachable: boolean
  readonly catalogueSize: number | null
}

/** The current player, as presentation. Never a permission and never an id. */
export type ShellPlayer = {
  readonly name: string
  readonly initials: string
}

/* ==========================================================================
   THE MODEL
   ========================================================================== */

export type VNextShellModel = {
  readonly player: ShellPlayer
  /**
   * Every competition this player plays or follows, most relevant first.
   *
   * IT IS THE PLAYER'S LIST AND NEVER THE PLATFORM'S. A platform holding twenty
   * published competitions where the player is relevant to one renders as a
   * one-competition product, because this array has one entry in it. That is
   * the whole of the scalability argument, and it is a data shape rather than a
   * promise.
   */
  readonly contexts: readonly ShellContext[]
  /**
   * Which context the product is in. `null` is a REAL state — a new account
   * that has followed nothing — and the shell must answer it without inventing
   * a competition to be inside.
   */
  readonly activeContextId: string | null
  readonly destinations: readonly ShellDestination[]
  readonly attention: readonly ShellAttentionItem[]
  readonly discovery: ShellDiscovery
}

/* ==========================================================================
   WHERE THE SHELL CAN SEND THE PLAYER
   ========================================================================== */

/**
 * ONE INTENT TYPE, AND NOT SIX CALLBACKS.
 *
 * The shell is ROUTE-AGNOSTIC on purpose: it says what the player asked for and
 * the host decides what that means. In Storybook that is `useState`; in the dev
 * harness it is a state hook beside the connected page; after the production
 * cutover stage it will be the router. None of those are this stage's business,
 * and a shell holding six `onX` props would have to be re-plumbed for each of
 * them.
 */
export type ShellIntent =
  | {
      readonly kind: 'destination'
      readonly destination: ShellDestinationId
      readonly contextId: string | null
    }
  | { readonly kind: 'context'; readonly contextId: string }
  | {
      readonly kind: 'game'
      readonly contextId: string
      readonly game: ShellGameKey
    }
  | {
      readonly kind: 'league'
      readonly contextId: string
      readonly leagueId: string
    }
  | { readonly kind: 'discover' }
  | { readonly kind: 'account' }
  /**
   * The platform's own supporting page — About & Disclaimer.
   *
   * A SEPARATE INTENT AND NOT A FIFTH DESTINATION. The four destinations belong
   * to the ACTIVE COMPETITION and this belongs to the platform, so it must not
   * appear in the bar, must not light up, and must not compete for one of the
   * four slots that only just clear a 44px target on a 375px bar. It is emitted
   * from the shell's own footer line, which is the least prominent permanent
   * place a legal position can be reached from and still be reachable
   * everywhere — which is exactly what ADR 0017 asks for.
   */
  | { readonly kind: 'about' }

/* ==========================================================================
   BOUNDS
   ========================================================================== */

/**
 * How many competition shortcuts the desktop rail shows before it stops.
 *
 * SIX, BECAUSE THE PRODUCTION AUTHORITY ALREADY SAID SIX.
 * `features/hub/playerCompetitions.ts` exports `COMPETITION_SHORTCUT_LIMIT = 6`
 * against the same navigation authority, and a second number here would be the
 * same decision taken twice with two answers. The constant is restated rather
 * than imported because `app/` may not reach `features/` — the presentation
 * boundary is not negotiable for a integer — and the duplication is recorded
 * here so it can be found.
 *
 * THE POINT IS THAT THE LIST IS BOUNDED AT ALL. Permanent chrome must be a
 * function of what the player plays, never of what the platform publishes,
 * which is what stops twenty competitions becoming a twenty-logo wall.
 */
export const SHELL_SHORTCUT_LIMIT = 6

/* ==========================================================================
   SELECTORS — reading the model, never re-deriving it
   ========================================================================== */

export function shellContextById(
  model: VNextShellModel,
  id: string | null,
): ShellContext | null {
  if (id === null) return null
  return model.contexts.find((entry) => entry.competition.id === id) ?? null
}

export function shellActiveContext(model: VNextShellModel): ShellContext | null {
  return shellContextById(model, model.activeContextId)
}

/**
 * WHETHER SWITCHING IS A MEANINGFUL ACT.
 *
 * THE ONE-COMPETITION CONTRACT LIVES HERE. A control that offers a single
 * choice teaches a player there is a decision to make and then spends their
 * press proving there is not — which is exactly how a platform with twenty
 * competitions makes a one-competition player feel like a tourist. Below two
 * contexts the competition is a LABEL, and the shell renders a `<span>` rather
 * than a disabled button.
 *
 * IT IS NOT THE DISCOVERY TEST. Discovery stays reachable at one competition
 * and at twenty; see `ShellDiscovery`.
 */
export function shellSwitchable(model: VNextShellModel): boolean {
  return model.contexts.length > 1
}

/** The bounded shortcut list, and how many it did not show. */
export function shellShortcuts(model: VNextShellModel): {
  readonly shown: readonly ShellContext[]
  readonly overflow: number
} {
  const shown = model.contexts.slice(0, SHELL_SHORTCUT_LIMIT)
  return { shown, overflow: Math.max(0, model.contexts.length - shown.length) }
}

const URGENCY_ORDER: Readonly<Record<ShellAttentionUrgency, number>> = {
  live: 0,
  urgent: 1,
  soon: 2,
}

/**
 * The work waiting in a competition the player is NOT currently in.
 *
 * ATTENTION INSIDE THE CURRENT COMPETITION IS NOT THE SHELL'S. Home already
 * answers "what matters here?" — that is the whole division of labour between
 * the shell and the page, and an attention control that repeated the current
 * competition's own deadline would be Home's job leaking upwards into chrome.
 *
 * Sorted by urgency and then by the model's own order, so the list is
 * deterministic and never depends on a clock.
 */
export function attentionElsewhere(
  model: VNextShellModel,
): readonly ShellAttentionItem[] {
  const known = new Set(model.contexts.map((entry) => entry.competition.id))
  return model.attention
    .filter(
      (item) => item.contextId !== model.activeContextId && known.has(item.contextId),
    )
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        URGENCY_ORDER[a.item.urgency] - URGENCY_ORDER[b.item.urgency] ||
        a.index - b.index,
    )
    .map((entry) => entry.item)
}

/** Whether any of this competition's own games is asking for the player. */
export function contextNeedsAttention(
  model: VNextShellModel,
  contextId: string,
): boolean {
  return model.attention.some(
    (item) => item.contextId === contextId && item.urgency !== 'soon',
  )
}

/**
 * WHETHER THE OPTIONAL JUMP ACCELERATOR IS OFFERED AT ALL.
 *
 * WHAT WAS RETAINED FROM CONCEPT C — Spine and Command — AND WHAT WAS NOT.
 *
 * Retained: that a player with many competitions benefits from typing a name
 * instead of hunting a list, and that the results must stay in DISTINCT GROUPS
 * so competitions, games and leagues never flatten into one list.
 *
 * NOT retained: Concept C's architecture. There is no command surface, no
 * segment-menu spine, no global search, no player directory and no keyboard
 * requirement. A player who never presses it can use the whole product.
 *
 * THE THRESHOLD IS THE POINT AT WHICH THE RAIL STOPS BEING COMPLETE. Below it,
 * every competition the player has is already one press away in the rail and a
 * search field over a list you can see is a search field that has to be
 * explained. Above it the rail overflows, and Jump is the thing that makes the
 * overflow reachable by name rather than by scrolling.
 */
export function shellJumpAvailable(model: VNextShellModel): boolean {
  return model.contexts.length > SHELL_SHORTCUT_LIMIT
}

/* ==========================================================================
   JUMP GROUPS
   ========================================================================== */

export type ShellJumpCompetition = {
  readonly kind: 'competition'
  readonly id: string
  readonly contextId: string
  readonly label: string
  readonly detail: string | null
  readonly competition: ShellCompetition
}

export type ShellJumpGame = {
  readonly kind: 'game'
  readonly id: string
  readonly contextId: string
  readonly game: ShellGameKey
  readonly label: string
  readonly detail: string | null
  readonly competition: ShellCompetition
}

export type ShellJumpLeague = {
  readonly kind: 'league'
  readonly id: string
  readonly contextId: string
  readonly leagueId: string
  readonly label: string
  readonly detail: string | null
  readonly competition: ShellCompetition
}

export type ShellJumpGroups = {
  readonly competitions: readonly ShellJumpCompetition[]
  readonly games: readonly ShellJumpGame[]
  readonly leagues: readonly ShellJumpLeague[]
}

function matches(query: string, ...fields: readonly (string | null)[]): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return fields.some((field) => (field ?? '').toLowerCase().includes(needle))
}

/**
 * THE THREE GROUPS, AND WHY THEY ARE THREE RETURN VALUES RATHER THAN ONE.
 *
 * A single `ShellJumpResult[]` with a `kind` on each entry would let a caller
 * render one undifferentiated list, which §10 of the brief forbids and which is
 * the failure the three dimensions exist to prevent. Three arrays make the flat
 * list the harder thing to write.
 *
 * IT SEARCHES THE PLAYER'S OWN WORLD AND NOT THE CATALOGUE. Twenty published
 * competitions do not appear here because the player has not taken them up;
 * that is discovery's job, and Jump offers Explore as its last row instead of
 * quietly becoming it. A catalogue leaking into a navigation accelerator is the
 * twenty-logo wall arriving through a search field.
 *
 * A GAME A COMPETITION DOES NOT RUN CANNOT APPEAR, because `ShellContext.games`
 * cannot contain it. An unsupported destination is absent rather than offered
 * and refused.
 */
export function shellJumpGroups(
  model: VNextShellModel,
  query: string,
): ShellJumpGroups {
  const competitions: ShellJumpCompetition[] = []
  const games: ShellJumpGame[] = []
  const leagues: ShellJumpLeague[] = []

  for (const context of model.contexts) {
    const competition = context.competition
    if (matches(query, competition.name, competition.shortName)) {
      competitions.push({
        kind: 'competition',
        id: `competition:${competition.id}`,
        contextId: competition.id,
        label: competition.name,
        detail: competition.seasonLabel,
        competition,
      })
    }

    for (const game of context.games) {
      if (!matches(query, game.name, competition.name, competition.shortName)) continue
      games.push({
        kind: 'game',
        id: `game:${competition.id}:${game.key}`,
        contextId: competition.id,
        game: game.key,
        label: game.name,
        detail: competition.name,
        competition,
      })
    }

    for (const league of context.leagues) {
      if (!matches(query, league.name, competition.name, SHELL_GAME_NAMES[league.game]))
        continue
      leagues.push({
        kind: 'league',
        id: `league:${league.id}`,
        contextId: competition.id,
        leagueId: league.id,
        label: league.name,
        // A private league is one game inside one competition, and its row says
        // both. "Sunday Club" alone could be any of three games.
        detail: `${competition.name} · ${SHELL_GAME_NAMES[league.game]}`,
        competition,
      })
    }
  }

  return { competitions, games, leagues }
}

/** Whether a set of groups has anything in it at all. */
export function shellJumpEmpty(groups: ShellJumpGroups): boolean {
  return (
    groups.competitions.length === 0 &&
    groups.games.length === 0 &&
    groups.leagues.length === 0
  )
}
