import { motion } from 'framer-motion'
import type {
  CatalogueGameKey,
  GameEntry,
  GamesPageModel,
  GamesPanel,
} from '../models/games'
import { offersEntry, partitionByPlaying } from '../models/games'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { VNextGameRules, type RulesGame } from '../rules/VNextGameRules'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import text from '../foundations/typography.module.css'
import styles from './games.module.css'

/**
 * vNEXT GAMES — the competition's games, as PEERS.
 *
 * ============================ NO GAME IS THE DEFAULT =====================
 *
 * Match Predictor, Last Man Standing and the Predictor Championship are drawn
 * the same way, in the catalogue's own order. That is the point of the surface:
 * Last Man Standing was under-scoped for a whole programme because nothing put
 * it beside its peers, and a hub that made one game bigger would be doing the
 * same thing again with better spacing.
 *
 * The only grouping is whether the PLAYER is in a game, which is a fact about
 * them and not a ranking of the games.
 *
 * ============================ IT OFFERS ONE WAY IN, NOT TWO ==============
 *
 * "Join" appears only where the answer is determinate — an open registration
 * for a player who never joined. There is NO "Rejoin" control anywhere, because
 * whether a rejoin would succeed depends on whether the competition is running
 * and no browser can learn that. A player who left is told the rule and sent to
 * the game, where the join flow and its authority live.
 *
 * ============================ IT NAMES NOTHING THE CATALOGUE DID NOT =====
 *
 * A game with no `display_name` renders without one. Turning `predictor_cup`
 * into "Predictor Cup" would be this lane naming a game the catalogue already
 * names — and getting it wrong the first time the catalogue disagrees.
 */

export type GamesIntent =
  | {
      readonly kind: 'open-game'
      /** `game_competition_id`. What a read or a write is addressed by. */
      readonly gameId: string
      /**
       * The catalogue's own key, carried BECAUSE A HOST HAS TO ROUTE.
       *
       * The id is a membership row and says nothing about which page a game
       * has; the key is what the router knows. Without it a host would have to
       * map an opaque id back to a game, and the only way to do that is to keep
       * a second copy of the catalogue — which is how a route ends up pointing
       * at the wrong game after the catalogue changes.
       */
      readonly gameKey: CatalogueGameKey
    }
  | { readonly kind: 'join-game'; readonly gameId: string }
  /**
   * START SOMETHING FOR YOUR OWN FRIENDS.
   *
   * NOT PER GAME, and that is the point. A create control on the Match
   * Predictor row would say that private play is a Match Predictor feature; it
   * is a thing all three games have, and the corridor asks WHICH one first.
   */
  | { readonly kind: 'create-private-play' }

export type VNextGamesProps = {
  readonly model: GamesPageModel
  readonly onRetry?: (() => void) | undefined
  readonly refreshing?: boolean
  readonly onIntent?: ((intent: GamesIntent) => void) | undefined
  /** A join is in flight. Named per game so one row's work does not disable the rest. */
  readonly joiningGameId?: string | null
  /**
   * A join that did not land, and the game it was for.
   *
   * NAMED, FOR THE SAME REASON `joiningGameId` IS. A write that fails silently
   * is the worst of the three outcomes: the control returns to "Join" and the
   * row is telling the truth about the server while telling a player nothing
   * about their own press. One row failing must not blank the catalogue.
   */
  readonly joinFailure?:
    | { readonly gameId: string; readonly message: string }
    | null
    | undefined
}

export function VNextGames({
  model,
  onRetry,
  refreshing = false,
  onIntent,
  joiningGameId = null,
  joinFailure = null,
}: VNextGamesProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const { context } = model

  return (
    <VNextShell
      destination="games"
      header={
        <VNextPageHeader
          title="Games"
          competition={`${context.competitionName} · ${context.seasonLabel}`}
          /* WHAT A "GAME" IS, IN THE SLOT THAT ALREADY EXISTS.
             `Matches` and `Games` are two of the four destinations and they
             mean different things — football fixtures, and the prediction games
             played over them. Matches already tells a reader which it is: its
             own subtitle is the round's own label, "Matchweek 12". This one
             said "This season", which is true of every destination and
             therefore distinguishes nothing.
             THE FIX IS THE COPY AND NOT THE IA. A third word in the navigation,
             a "Predictions & Games & Matches", another level or a More menu
             would all be answering a comprehension question with structure. */
          context="Ways to play this competition"
        />
      }
    >
      <div className={styles.page}>
        <motion.div variants={rise} initial="hidden" animate="visible" className={styles.body}>
          <Games
            panel={model.games}
            onRetry={onRetry}
            refreshing={refreshing}
            onIntent={onIntent}
            joiningGameId={joiningGameId}
            joinFailure={joinFailure}
          />

          {/* PRIVATE PLAY, WHERE THE GAMES ARE. It sits below the three rather
              than on one of them, because a group of friends is something all
              three games can be played as and the corridor asks which. It is
              drawn wherever the host can route it — a host that cannot simply
              passes no `onIntent`, and no control appears. */}
          {onIntent === undefined ? null : (
            <div className={styles.privatePlay} data-vnext-zone="private-play">
              <p className={`${text.body} ${styles.privateLead}`}>
                Want a table of just your friends? You can run any of these three as your own
                private competition.
              </p>
              <button
                type="button"
                className={styles.privateAction}
                onClick={() => onIntent({ kind: 'create-private-play' })}
              >
                Create private play
              </button>
            </div>
          )}

          {/* THE RULES, BESIDE THE GAMES THEY GOVERN. The route matrix absorbs
              `/more/scoring` for exactly this: rules are reached from a game,
              not from a directory. It opens on the game the player is already
              in, so the common question needs no press. */}
          {model.games.kind === 'games' ? (
            <VNextGameRules game={rulesGameFor(model.games.entries)} />
          ) : null}
        </motion.div>
      </div>
    </VNextShell>
  )
}

function Games({
  panel,
  onRetry,
  refreshing,
  onIntent,
  joiningGameId,
  joinFailure,
}: {
  readonly panel: GamesPanel
  readonly onRetry?: (() => void) | undefined
  readonly refreshing: boolean
  readonly onIntent?: ((intent: GamesIntent) => void) | undefined
  readonly joiningGameId: string | null
  readonly joinFailure: { readonly gameId: string; readonly message: string } | null
}) {
  if (panel.kind === 'unavailable') {
    return (
      <div className={styles.empty} data-vnext-zone="unavailable">
        <p className={text.body}>We could not load this season’s games just now.</p>
        {onRetry === undefined ? null : (
          <button type="button" className={styles.retry} onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    )
  }

  if (panel.kind === 'empty') {
    return (
      <p className={`${text.body} ${styles.empty}`} data-vnext-zone="no-games">
        This competition is not running any games this season.
      </p>
    )
  }

  const { playing, rest } = partitionByPlaying(panel.entries)

  return (
    <div data-refreshing={refreshing || undefined}>
      {playing.length === 0 ? null : (
        <section className={styles.group} data-vnext-zone="playing">
          <h2 className={`${text.micro} ${styles.groupHeading}`}>You are playing</h2>
          <ul className={styles.list}>
            {playing.map((entry) => (
              <GameRow
                key={entry.id}
                entry={entry}
                onIntent={onIntent}
                joining={joiningGameId === entry.id}
                failure={
                  joinFailure && joinFailure.gameId === entry.id ? joinFailure.message : null
                }
              />
            ))}
          </ul>
        </section>
      )}

      {rest.length === 0 ? null : (
        <section className={styles.group} data-vnext-zone="rest">
          <h2 className={`${text.micro} ${styles.groupHeading}`}>
            {playing.length === 0 ? 'This season’s games' : 'Also running'}
          </h2>
          <ul className={styles.list}>
            {rest.map((entry) => (
              <GameRow
                key={entry.id}
                entry={entry}
                onIntent={onIntent}
                joining={joiningGameId === entry.id}
                failure={
                  joinFailure && joinFailure.gameId === entry.id ? joinFailure.message : null
                }
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * WHICH GAME'S RULES TO OPEN ON.
 *
 * The first game the player is actually IN, because that is the one they are
 * most likely to be asking about. Where they are in none, the catalogue's own
 * first game — never a hard-coded favourite, which would be this file deciding
 * which game matters on a page built to stop exactly that.
 */
function rulesGameFor(entries: readonly GameEntry[]): RulesGame | undefined {
  const playing = entries.find((entry) => entry.standing.kind === 'playing')
  const chosen = playing ?? entries[0]
  switch (chosen?.gameKey) {
    case 'last_man_standing':
      return 'last-man-standing'
    case 'predictor_cup':
      return 'championship'
    case 'main_predictor':
      return 'match-predictor'
    default:
      // A game this block has no rules for — the page opens on its default
      // rather than claiming the catalogue's game is one of the three.
      return undefined
  }
}

/** What the page says about where a player stands. One sentence, never a colour alone. */
function standingLine(entry: GameEntry): string {
  const standing = entry.standing
  switch (standing.kind) {
    case 'playing':
      return 'You are in this one.'
    case 'disqualified':
      // ABSOLUTE, and said as such. The server refuses a rejoin above the
      // game's own flag, so there is nothing conditional to offer here.
      return 'Your entry was disqualified. You cannot rejoin this one.'
    case 'left':
      return standing.rejoin === 'allowed'
        ? 'You left this one. You can join it again from the game.'
        : // THE RULE, NOT A VERDICT. Whether it has started is not readable
          // from here, so the page states the condition and does not resolve it.
          'You left this one. It only takes you back if it has not started yet.'
    default:
      switch (standing.registration) {
        case 'open':
          return 'Open to join.'
        case 'not-open':
          return 'Registration has not opened yet.'
        case 'closed':
          return 'Registration has closed for this season.'
        default:
          return 'This one has finished for the season.'
      }
  }
}

function GameRow({
  entry,
  onIntent,
  joining,
  failure,
}: {
  readonly entry: GameEntry
  readonly onIntent?: ((intent: GamesIntent) => void) | undefined
  readonly joining: boolean
  readonly failure: string | null
}) {
  const canJoin = offersEntry(entry)

  return (
    <li
      className={styles.row}
      data-vnext-game={entry.id}
      data-standing={entry.standing.kind}
      data-active={entry.active}
    >
      <div className={styles.rowMain}>
        {entry.displayName === null ? (
          // NOT A NAME BUILT FROM THE KEY. See the component header.
          <p className={`${text.body} ${styles.rowTitle}`}>A game this competition runs</p>
        ) : (
          <p className={`${text.body} ${styles.rowTitle}`}>{entry.displayName}</p>
        )}

        <p className={`${text.micro} ${styles.rowMeta}`} data-vnext-zone="standing">
          {standingLine(entry)}
        </p>

        {/* THE GAME'S OWN SENTENCE, where its read supplied one. It is the same
            string Home prints for the same game, from the same computation, so
            a card and the front door can never disagree about a deadline. It
            sits BESIDE the standing line rather than replacing it: "you are in
            this one" and "pick a club for Round 12" answer different
            questions. */}
        {entry.weekAction === null ? null : (
          <p
            className={`${text.micro} ${styles.rowWeek}`}
            data-vnext-zone="week"
            data-outstanding={entry.weekAction.outstanding}
          >
            {entry.weekAction.title}
          </p>
        )}

        {entry.active ? null : (
          // A GAME SWITCHED OFF IS NOT A GAME MISSING, and the catalogue says
          // which it is.
          <p className={`${text.micro} ${styles.inactive}`} data-vnext-zone="inactive">
            Not running at the moment.
          </p>
        )}
      </div>

      <div className={styles.rowActions}>
        {/* ACTION-LED WHERE THE GAME IS ASKING, AND A DESTINATION WHERE IT IS
            NOT — `DFA-006`'s rule, in its own words: the primary control is
            "'Pick your club' rather than 'Open game'" where there is something
            to do, and stays a destination where there is not, "so a complete
            game is not dressed as a task".

            THE VERB IS NOT CHOSEN HERE. `call` is `weekActionCallToAction`'s
            answer, which is null for anything not outstanding and always null
            for the Championship — so this surface cannot invent a task that the
            week model says does not exist. */}
        <button
          type="button"
          className={styles.rowAction}
          data-asking={entry.weekAction?.outstanding === true}
          onClick={() => onIntent?.({ kind: 'open-game', gameId: entry.id, gameKey: entry.gameKey })}
        >
          {entry.weekAction?.call ??
            (entry.standing.kind === 'playing' ? 'Open' : 'Look inside')}
          <span className={text.srOnly}>
            {' '}
            {entry.displayName ?? 'this game'}
          </span>
        </button>

        {canJoin ? (
          <button
            type="button"
            className={styles.rowJoin}
            disabled={joining}
            onClick={() => onIntent?.({ kind: 'join-game', gameId: entry.id })}
          >
            {joining ? 'Joining…' : 'Join'}
            <span className={text.srOnly}>
              {' '}
              {entry.displayName ?? 'this game'}
            </span>
          </button>
        ) : null}
      </div>

      {failure === null ? null : (
        // `role="status"` RATHER THAN `alert`. The player is not in the game,
        // which is exactly where they were before pressing — nothing is lost
        // and nothing is half-done, so the polite register is the honest one.
        //
        // THE CONTROL BESIDE IT IS THE RETRY. It has already returned to
        // "Join"; a second button would be the same press twice.
        <p
          className={`${text.micro} ${styles.rowFailure}`}
          role="status"
          data-vnext-zone="join-failed"
        >
          {failure}
        </p>
      )}
    </li>
  )
}
