import { motion } from 'framer-motion'
import type { GameEntry, GamesPageModel, GamesPanel } from '../models/games'
import { offersEntry, partitionByPlaying } from '../models/games'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
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
  | { readonly kind: 'open-game'; readonly gameId: string }
  | { readonly kind: 'join-game'; readonly gameId: string }

export type VNextGamesProps = {
  readonly model: GamesPageModel
  readonly onRetry?: (() => void) | undefined
  readonly refreshing?: boolean
  readonly onIntent?: ((intent: GamesIntent) => void) | undefined
  /** A join is in flight. Named per game so one row's work does not disable the rest. */
  readonly joiningGameId?: string | null
}

export function VNextGames({
  model,
  onRetry,
  refreshing = false,
  onIntent,
  joiningGameId = null,
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
          context="This season"
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
          />
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
}: {
  readonly panel: GamesPanel
  readonly onRetry?: (() => void) | undefined
  readonly refreshing: boolean
  readonly onIntent?: ((intent: GamesIntent) => void) | undefined
  readonly joiningGameId: string | null
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

  if (panel.kind === 'not-a-member') {
    // ABOUT THE CALLER, NOT ABOUT THE GAMES. The competition runs whatever it
    // runs; this player is not in it, and an empty catalogue would say the
    // opposite thing.
    return (
      <p className={`${text.body} ${styles.empty}`} data-vnext-zone="not-a-member">
        You are not in this competition, so its games are not yours to play yet.
      </p>
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
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
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
}: {
  readonly entry: GameEntry
  readonly onIntent?: ((intent: GamesIntent) => void) | undefined
  readonly joining: boolean
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

        {entry.active ? null : (
          // A GAME SWITCHED OFF IS NOT A GAME MISSING, and the catalogue says
          // which it is.
          <p className={`${text.micro} ${styles.inactive}`} data-vnext-zone="inactive">
            Not running at the moment.
          </p>
        )}
      </div>

      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.rowAction}
          onClick={() => onIntent?.({ kind: 'open-game', gameId: entry.id })}
        >
          {entry.standing.kind === 'playing' ? 'Open' : 'Look inside'}
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
    </li>
  )
}
