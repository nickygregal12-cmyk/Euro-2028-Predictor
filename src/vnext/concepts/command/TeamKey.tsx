import type { Team } from '../../models/football'
import typography from '../../foundations/typography.module.css'
import { teamColourStyle } from '../shared/teamColour'
import styles from './command.module.css'

export type TeamKeyProps = {
  team: Team
  /** The full club name rather than the short one, where the row has room. */
  long?: boolean
}

/**
 * A club, at the smallest identity this concept allows itself.
 *
 * Concept B's answer to the workshop's open colour question is "a key, not a
 * field". The club gets a 3px bar of its primary colour beside its name — just
 * enough to tell two rows apart while scanning a dense table — and no fill, no
 * gradient and no large area anywhere on the page. That leaves every large
 * colour on this concept meaning a GAME STATE, which is the property a dense
 * screen needs most and the one a painted card would spend.
 *
 * The colour is never the identifier: the name is always written beside it.
 */
export function TeamKey({ team, long = false }: TeamKeyProps) {
  return (
    <span className={styles.teamKey} style={teamColourStyle(team)}>
      <span className={styles.teamKeyBar} aria-hidden="true" />
      <span className={`${typography.body} ${typography.truncate} ${styles.teamKeyName}`}>
        {long ? team.name : team.shortName}
      </span>
    </span>
  )
}
