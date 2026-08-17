import type { PlayerRef } from '../../models/ia'
import { workshopPeople } from '../players/people'

/**
 * The people the Stage 7.5 lab ranks.
 *
 * THE SIX EXISTING WORKSHOP PEOPLE ARE REUSED RATHER THAN REPLACED. They
 * already carry the shapes a table has to survive — a one-word name, a
 * double-barrelled one and an accented one — and inventing a second cast would
 * mean two places to keep that property. Only the fields this model needs are
 * carried across; `favouriteTeamId` belongs to Home's model and has no meaning
 * in a navigation lab.
 *
 * THE EXTRAS EXIST FOR TWO REASONS. A leaderboard needs enough rows to look
 * like a leaderboard, and the long-name scenario needs a name that is genuinely
 * hostile to a dense row rather than merely longish.
 */

function fromWorkshop(person: {
  id: string
  name: string
  initials: string
}): PlayerRef {
  return { id: person.id, name: person.name, initials: person.initials }
}

export const iaPeople = {
  user: fromWorkshop(workshopPeople.user),
  jamie: fromWorkshop(workshopPeople.jamie),
  martin: fromWorkshop(workshopPeople.martin),
  aisha: fromWorkshop(workshopPeople.aisha),
  soren: fromWorkshop(workshopPeople.soren),
  bea: fromWorkshop(workshopPeople.bea),
  priya: { id: 'player-priya', name: 'Priya Balasubramanian', initials: 'PB' },
  callum: { id: 'player-callum', name: 'Callum Mac an Bhaird', initials: 'CM' },
  dee: { id: 'player-dee', name: 'Dee', initials: 'D' },
  /** The worst realistic string a standings row has to survive. */
  marguerite: {
    id: 'player-marguerite',
    name: 'Marguerite Ostrowska-Fitzwilliam',
    initials: 'MO',
  },
} as const satisfies Readonly<Record<string, PlayerRef>>
