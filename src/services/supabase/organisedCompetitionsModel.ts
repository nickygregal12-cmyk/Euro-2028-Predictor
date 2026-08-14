/**
 * What an organiser may see about the competition they own (contract 165).
 *
 * OWNING A COMPETITION IS NOT A REVEAL EXEMPTION, and the contract is explicit
 * about it: an organiser is shown THAT an entrant has picked and never WHAT.
 * `hasPickedCurrentRound` is the whole of it — there is no `pick` field on this
 * shape at all, so a surface built on it cannot leak a selection even by
 * accident. An organiser who wants to know what somebody picked waits for the
 * round to lock like everybody else.
 *
 * THERE IS NO ORGANISER COMMAND OVER ANOTHER ENTRANT, AND ITS ABSENCE IS THE
 * DESIGN. Contract 165 adds none, because no accepted authority grants an
 * organiser power to change another entrant's competitive position. Contract
 * 179 separately exposes whether a private Championship the caller owns can be
 * launched; that is authority over the caller's own container, not over an
 * entrant's pick.
 *
 * IT IS OWNER-SCOPED, NOT ADMINISTRATOR-SCOPED. These reads answer about
 * competitions the CALLER owns. They are not an administration surface and must
 * never be reached from one — contract 168's reads are that, and they are
 * separate on purpose.
 *
 * PURE.
 */

export type OrganisedCompetitionSummary = {
  id: string
  name: string
  gameKey: string | null
  seasonName: string | null
  seasonKey: string | null
  inviteCode: string | null
  published: boolean
  availabilityStatus: string | null
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  completedAt: string | null
  createdAt: string | null
}

export type OrganisedSetup = {
  lives: number
  saves: number
  drawsRule: string | null
  endgameScope: string | null
  endgameOnWipeout: string | null
}

export type OrganisedRound = {
  windowId: string
  sequence: number | null
  label: string | null
  opensAt: string | null
  locksAt: string | null
  locked: boolean
}

export type OrganisedCounts = {
  entrants: number
  remaining: number
  eliminated: number
  left: number
  /** Null when there is no current round to be awaiting a pick in. */
  awaitingPick: number | null
}

export type OrganisedEntrant = {
  userId: string
  displayName: string
  isMe: boolean
  joinedAt: string | null
  outcome: string | null
  stillIn: boolean
  livesRemaining: number | null
  savesRemaining: number | null
  membershipStatus: string | null
  leftAt: string | null
  /**
   * THAT they have picked, never what. Null when there is no current round.
   *
   * There is deliberately no sibling field carrying the club.
   */
  hasPickedCurrentRound: boolean | null
}

export type OrganisedCompetition = {
  competition: OrganisedCompetitionSummary
  setup: OrganisedSetup | null
  currentRound: OrganisedRound | null
  counts: OrganisedCounts
  entrants: readonly OrganisedEntrant[]
  /** Empty until an organiser command is ever accepted. Carried, never assumed. */
  organiserCommandsAvailable: readonly string[]
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function arrayOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : []
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function integerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function countOf(value: unknown): number {
  const parsed = integerOrNull(value)
  return parsed !== null && parsed >= 0 ? parsed : 0
}

function mapSummary(value: unknown): OrganisedCompetitionSummary | null {
  const row = objectOf(value)
  // Contract 165 intentionally uses two wire shapes: the addressed detail read
  // nests `competition.id`, while the bounded list names the same identity
  // `competition_id`. The previous decoder accepted only the detail spelling,
  // so every REAL list row decoded to null and the organiser could never return
  // to a competition after leaving its create flow. Accept exactly those two
  // authority-owned spellings; do not invent a third identifier fallback.
  const id = stringOrNull(row.id) ?? stringOrNull(row.competition_id)
  const name = stringOrNull(row.name)
  if (!id || !name) return null
  return {
    id,
    name,
    gameKey: stringOrNull(row.game_key),
    seasonName: stringOrNull(row.season_name),
    seasonKey: stringOrNull(row.season_key),
    inviteCode: stringOrNull(row.invite_code),
    published: row.published === true,
    availabilityStatus: stringOrNull(row.availability_status),
    registrationOpensAt: stringOrNull(row.registration_opens_at),
    registrationClosesAt: stringOrNull(row.registration_closes_at),
    completedAt: stringOrNull(row.completed_at),
    createdAt: stringOrNull(row.created_at),
  }
}

function mapEntrant(value: unknown): OrganisedEntrant | null {
  const row = objectOf(value)
  const userId = stringOrNull(row.user_id)
  if (!userId) return null
  return {
    userId,
    displayName: stringOrNull(row.display_name) ?? 'Player',
    isMe: row.is_me === true,
    joinedAt: stringOrNull(row.joined_at),
    outcome: stringOrNull(row.outcome),
    stillIn: row.still_in === true,
    livesRemaining: integerOrNull(row.lives_remaining),
    savesRemaining: integerOrNull(row.saves_remaining),
    membershipStatus: stringOrNull(row.membership_status),
    leftAt: stringOrNull(row.left_at),
    hasPickedCurrentRound:
      typeof row.has_picked_current_round === 'boolean'
        ? row.has_picked_current_round
        : null,
  }
}

export function mapOrganisedCompetition(payload: unknown): OrganisedCompetition | null {
  const root = objectOf(payload)
  const competition = mapSummary(root.competition)
  // A payload with no competition is not an organised competition. Null rather
  // than an empty shell, because a shell would render a management screen for
  // something that does not exist.
  if (!competition) return null

  const setup = objectOf(root.setup)
  const lives = integerOrNull(setup.lives)
  const round = objectOf(root.current_round)
  const windowId = stringOrNull(round.window_id)
  const counts = objectOf(root.counts)

  return {
    competition,
    setup:
      lives === null
        ? null
        : {
            lives,
            saves: countOf(setup.saves),
            drawsRule: stringOrNull(setup.draws_rule),
            endgameScope: stringOrNull(setup.endgame_scope),
            endgameOnWipeout: stringOrNull(setup.endgame_on_wipeout),
          },
    currentRound: windowId
      ? {
          windowId,
          sequence: integerOrNull(round.sequence),
          label: stringOrNull(round.label),
          opensAt: stringOrNull(round.opens_at),
          locksAt: stringOrNull(round.locks_at),
          locked: round.locked === true,
        }
      : null,
    counts: {
      entrants: countOf(counts.entrants),
      remaining: countOf(counts.remaining),
      eliminated: countOf(counts.eliminated),
      left: countOf(counts.left),
      awaitingPick: integerOrNull(counts.awaiting_pick),
    },
    entrants: arrayOf(root.entrants)
      .map(mapEntrant)
      .filter((entrant): entrant is OrganisedEntrant => entrant !== null),
    organiserCommandsAvailable: arrayOf(root.organiser_commands_available).filter(
      (entry): entry is string => typeof entry === 'string',
    ),
  }
}

export function mapOrganisedCompetitions(
  payload: unknown,
): readonly OrganisedCompetitionSummary[] {
  const root = objectOf(payload)
  const rows = Array.isArray(root.competitions)
    ? root.competitions
    : Array.isArray(payload)
      ? payload
      : []
  return rows
    .map(mapSummary)
    .filter((row): row is OrganisedCompetitionSummary => row !== null)
}
