import type { InvitePageModel } from '../../models/invite'

/**
 * THE INVITE'S DETERMINISTIC WORLDS.
 *
 * EVERY REFUSAL THE SERVER CAN MAKE HAS A WORLD, because the binding property
 * of this surface is that it never offers a button the database would refuse.
 * A fixture set that only held the happy path would let that be reviewed as
 * "there is a Join button, good".
 */

const INVITE_NOW = '2027-08-01T12:00:00.000Z'

function world(panel: InvitePageModel['panel'], accepting = false): InvitePageModel {
  return { generatedAt: INVITE_NOW, panel, accepting }
}

const LEAGUE = {
  container: 'league' as const,
  name: 'The Thursday League',
  season: 'Caledonian Premiership 2027/28',
  game: 'Match Predictor',
}

const COMPETITION = {
  container: 'competition' as const,
  name: 'Office Championship',
  season: 'Caledonian Premiership 2027/28',
  game: 'Predictor Championship',
}

/* ==========================================================================
   THE WORLDS
   ========================================================================== */

/** A league invitation that can be accepted. */
const leagueOpen = world({
  kind: 'invite',
  details: { ...LEAGUE, action: { kind: 'accept' } },
})

/** A private competition invitation that can be accepted. */
const competitionOpen = world({
  kind: 'invite',
  details: { ...COMPETITION, action: { kind: 'accept' } },
})

/** Mid-accept. The one control is busy and nothing else moves. */
const accepting = world(
  { kind: 'invite', details: { ...COMPETITION, action: { kind: 'accept' } } },
  true,
)

/**
 * THE BINDING WORLD. The league's underlying game has not been joined, so the
 * server would refuse. The page sends the player to the GAME rather than
 * offering an accept — which is the whole reason the read carries the flag.
 */
const needsGameFirst = world({
  kind: 'invite',
  details: { ...LEAGUE, action: { kind: 'needs-game-first', gameName: 'Match Predictor' } },
})

/** The same, with the game unnamed. The page does not invent a name. */
const needsUnnamedGame = world({
  kind: 'invite',
  details: { ...LEAGUE, game: null, action: { kind: 'needs-game-first', gameName: null } },
})

/** Already in. There is nothing to accept, and no button. */
const alreadyIn = world({
  kind: 'invite',
  details: { ...LEAGUE, action: { kind: 'already-in' } },
})

/** The player set it up. Its own sentence, not "already in". */
const owner = world({
  kind: 'invite',
  details: { ...COMPETITION, action: { kind: 'owner' } },
})

/** Finished, or an organiser started it. Stated, never joined. */
const closed = world({
  kind: 'invite',
  details: { ...COMPETITION, action: { kind: 'closed' } },
})

/** A competition with no season and no game named. */
const bareInvite = world({
  kind: 'invite',
  details: { ...COMPETITION, season: null, game: null, action: { kind: 'accept' } },
})

/** Looking the code up. */
const looking = world({ kind: 'looking' })

/**
 * The code resolved to nothing. ONE sentence and no diagnosis: unknown,
 * malformed and rotated codes are indistinguishable by design.
 */
const notFound = world({ kind: 'not-found' })

/** The lookup itself did not answer. The only state here worth retrying. */
const failed = world({ kind: 'failed', message: 'Something went wrong. Please try again.' })

/** A very long competition name, for the width tests. It must not be clipped. */
const longName = world({
  kind: 'invite',
  details: {
    ...COMPETITION,
    name: 'The Royal Caledonian and Borders Office Championship Invitational 2027/28',
    action: { kind: 'accept' },
  },
})

/* ==========================================================================
   THE REGISTRY
   ========================================================================== */

export const inviteScenarios = {
  leagueOpen,
  competitionOpen,
  accepting,
  needsGameFirst,
  needsUnnamedGame,
  alreadyIn,
  owner,
  closed,
  bareInvite,
  looking,
  notFound,
  failed,
  longName,
} as const

export type InviteScenarioName = keyof typeof inviteScenarios

export const inviteScenarioNames = Object.keys(inviteScenarios) as InviteScenarioName[]

export const inviteScenarioPremises: Readonly<Record<InviteScenarioName, string>> = {
  leagueOpen: 'A league invitation that can be accepted.',
  competitionOpen: 'A private competition invitation that can be accepted.',
  accepting: 'Mid-accept. The one control is busy and nothing else on the page moves.',
  needsGameFirst:
    'THE binding world. The league’s underlying game has not been joined, so the server would refuse. The page sends the player to the GAME instead of offering a button the database refuses — which is the whole reason the read carries `requiresGameEntry`.',
  needsUnnamedGame: 'The same, with the game unnamed. The page does not invent a name for it.',
  alreadyIn: 'Already in. Nothing to accept, and no control at all rather than a disabled one.',
  owner: 'The player set it up. Its own sentence, because "already in" is not what a person would say.',
  closed: 'Finished, or an organiser started it. Stated, never joined — and never recomputed from a clock.',
  bareInvite: 'A competition with no season and no game named. The subtitle disappears rather than showing a separator with nothing round it.',
  looking: 'Looking the code up.',
  notFound:
    'The code resolved to nothing. ONE sentence and no diagnosis: unknown, malformed and rotated codes were made indistinguishable by the server, and a client that told them apart would undo that.',
  failed: 'The lookup itself did not answer. The only state here worth retrying.',
  longName: 'A very long competition name. It must not be clipped — a player deciding whether to accept has to be able to read the whole thing.',
}
