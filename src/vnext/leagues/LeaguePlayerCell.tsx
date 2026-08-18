import type { LeaguePlayer } from '../models/leagues'
import { leaguePlayerIsOpen } from '../models/leagues'
import text from '../foundations/typography.module.css'
import styles from './leagues.module.css'

/**
 * ONE PERSON IN A STANDINGS ROW, AND THE ONLY PLACE THAT DECIDES WHETHER THEY
 * CAN BE OPENED.
 *
 * ============================ THE RULE, IN ONE LINE ======================
 *
 * A name becomes a button when `leaguePlayerIsOpen(player)` — which is
 * `destination.kind === 'open'` and nothing else. Not "does it have a
 * playerId", not "is it not me", not "is this a private league". The server
 * decided in contract 191's `reach` and the mapper turned that into a
 * destination; this component reads the answer.
 *
 * ============================ IT NEVER NAVIGATES BY NAME =================
 *
 * The intent carries `playerId` from the destination union, which is the only
 * place an id exists. There is no code path here that could put `displayName`
 * into a destination, because the intent has no field for it. Two players
 * called "Sam" therefore stay two players all the way through: the row is keyed
 * by `player.ref` upstream and opened by `destination.playerId` here, and
 * neither is the name.
 *
 * ============================ A CLOSED ROW IS NOT A BROKEN ROW ===========
 *
 * `closed` renders as PLAIN TEXT. Not a disabled button, not a link that
 * refuses, not a lock icon: a disabled control teaches a player there is
 * something they are missing out on, when the truthful reading is that most of
 * a season's entrants are simply people you have never shared a league with.
 *
 * The one place a reason is said out loud is the sr-only sentence, and only for
 * `not-stated` — where the server said a profile exists but did not say where,
 * which is a different fact from "you two share nothing" and is the one worth
 * being able to hear.
 *
 * ============================ "YOU" IS MARKED, NOT LINKED ================
 *
 * You do not open yourself from a table you are already standing in. The row
 * says so in a word as well as with an accent, because §31's rule that state is
 * never carried by colour alone is not relaxed for a standings table.
 */
export type LeaguePlayerCellProps = {
  readonly player: LeaguePlayer
  readonly onOpen?: ((playerId: string) => void) | undefined
}

export function LeaguePlayerCell({ player, onOpen }: LeaguePlayerCellProps) {
  const destination = player.destination

  if (destination.kind === 'you') {
    return (
      <span className={styles.playerCell}>
        <span className={`${text.body} ${styles.playerName}`}>{player.displayName}</span>
        <span className={styles.youTag}>You</span>
      </span>
    )
  }

  if (leaguePlayerIsOpen(player) && destination.kind === 'open' && onOpen) {
    const playerId = destination.playerId
    return (
      <span className={styles.playerCell}>
        <button
          type="button"
          className={`${text.body} ${styles.playerName} ${styles.playerOpen}`}
          onClick={() => onOpen(playerId)}
        >
          {player.displayName}
        </button>
      </span>
    )
  }

  return (
    <span className={styles.playerCell}>
      <span className={`${text.body} ${styles.playerName}`}>{player.displayName}</span>
      {destination.kind === 'closed' && destination.reason === 'not-stated' ? (
        <span className={text.srOnly}>Profile not available</span>
      ) : null}
    </span>
  )
}
