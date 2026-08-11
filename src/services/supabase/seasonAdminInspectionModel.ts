/**
 * The staged provider proposals and the entrant list an administrator can now
 * actually see (contract 168, `DFA-009`).
 *
 * WHY IT EXISTS. Contract 132 let a competition administrator APPROVE an initial
 * provider calendar and contract 138 gave them the review queues, but neither
 * showed the proposals themselves. So the approval was a decision taken over
 * data nobody could inspect. This is that data.
 *
 * A BLOCKER IS NAMED, NEVER COUNTED. The migration says it plainly: "12
 * problems" tells an administrator to refuse and tells them nothing to fix. Each
 * proposal carries its own list — an unmapped club, the same club on both sides,
 * a kickoff already in the past, a fixture that already exists — and a surface
 * must render the names rather than a total.
 *
 * NO RAW PROVIDER PAYLOAD CROSSES THIS BOUNDARY. `rawResponseId` is a reference
 * for provenance, not a document: the read returns the decoded facts and the id
 * of the retained response, and nothing here fetches or renders the body.
 *
 * `disqualifiable` IS THE SERVER'S PREDICTION OF ITS OWN REFUSAL, and it is
 * contract 140's lesson applied again — an entrant who has already been
 * disqualified is not a candidate, and one who has left is not either. A surface
 * offers the control where this is true and explains where it is not, rather
 * than offering it everywhere and reporting the refusal afterwards.
 *
 * PURE.
 */

export type ProviderProposalClub = {
  providerId: string | null
  providerName: string | null
  /** Null when the provider's club is not mapped to one of ours. */
  mappedTeamId: string | null
  mappedTeamName: string | null
}

export type ProviderProposal = {
  proposalId: string
  provider: string | null
  providerFixtureId: string | null
  roundProviderId: string | null
  proposedKickoffAt: string | null
  providerStatus: string | null
  /** Provenance only. Never fetched, never rendered as a document. */
  rawResponseId: string | null
  stagedAt: string | null
  state: string | null
  decidedAt: string | null
  decidedBy: string | null
  decisionReason: string | null
  createdFixtureId: string | null
  home: ProviderProposalClub
  away: ProviderProposalClub
  /** Named individually. A count is not an instruction. */
  blockers: readonly string[]
}

export type ProviderProposalPage = {
  tournamentId: string | null
  total: number
  limit: number
  offset: number
  hasMore: boolean
  /** Count per proposal state, as the server grouped it. */
  states: Readonly<Record<string, number>>
  blockedTotal: number
  proposals: readonly ProviderProposal[]
}

export type AdminEntrant = {
  userId: string
  displayName: string
  joinedAt: string | null
  outcome: string | null
  membershipStatus: string | null
  leftAt: string | null
  disqualifiedAt: string | null
  rejoinCount: number
  /** The server's own prediction of whether it would accept a disqualification. */
  disqualifiable: boolean
}

export type AdminEntrantsPage = {
  competition: {
    id: string
    name: string
    gameKey: string | null
    gameName: string | null
    seasonName: string | null
    seasonKey: string | null
  }
  total: number
  limit: number
  offset: number
  hasMore: boolean
  entrants: readonly AdminEntrant[]
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

function mapClub(value: unknown): ProviderProposalClub {
  const row = objectOf(value)
  return {
    providerId: stringOrNull(row.provider_id),
    providerName: stringOrNull(row.provider_name),
    mappedTeamId: stringOrNull(row.mapped_team_id),
    mappedTeamName: stringOrNull(row.mapped_team_name),
  }
}

function mapProposal(value: unknown): ProviderProposal | null {
  const row = objectOf(value)
  const proposalId = stringOrNull(row.proposal_id)
  if (!proposalId) return null
  return {
    proposalId,
    provider: stringOrNull(row.provider),
    providerFixtureId: stringOrNull(row.provider_fixture_id),
    roundProviderId: stringOrNull(row.round_provider_id),
    proposedKickoffAt: stringOrNull(row.proposed_kickoff_at),
    providerStatus: stringOrNull(row.provider_status),
    rawResponseId: stringOrNull(row.raw_response_id),
    stagedAt: stringOrNull(row.staged_at),
    state: stringOrNull(row.state),
    decidedAt: stringOrNull(row.decided_at),
    decidedBy: stringOrNull(row.decided_by),
    decisionReason: stringOrNull(row.decision_reason),
    createdFixtureId: stringOrNull(row.created_fixture_id),
    home: mapClub(row.home),
    away: mapClub(row.away),
    blockers: arrayOf(row.blockers).filter(
      (entry): entry is string => typeof entry === 'string',
    ),
  }
}

export function mapProviderProposalPage(payload: unknown): ProviderProposalPage {
  const root = objectOf(payload)
  const states = objectOf(root.states)
  const counted: Record<string, number> = {}
  for (const [key, value] of Object.entries(states)) {
    const count = integerOrNull(value)
    if (count !== null) counted[key] = count
  }
  return {
    tournamentId: stringOrNull(root.tournament_id),
    total: countOf(root.total),
    limit: countOf(root.limit),
    offset: countOf(root.offset),
    hasMore: root.has_more === true,
    states: counted,
    blockedTotal: countOf(root.blocked_total),
    proposals: arrayOf(root.proposals)
      .map(mapProposal)
      .filter((row): row is ProviderProposal => row !== null),
  }
}

function mapEntrant(value: unknown): AdminEntrant | null {
  const row = objectOf(value)
  const userId = stringOrNull(row.user_id)
  if (!userId) return null
  return {
    userId,
    displayName: stringOrNull(row.display_name) ?? 'Player',
    joinedAt: stringOrNull(row.joined_at),
    outcome: stringOrNull(row.outcome),
    membershipStatus: stringOrNull(row.membership_status),
    leftAt: stringOrNull(row.left_at),
    disqualifiedAt: stringOrNull(row.disqualified_at),
    rejoinCount: countOf(row.rejoin_count),
    // Defaults to FALSE, not true. A control offered because a field was
    // missing is a control that fails on press.
    disqualifiable: row.disqualifiable === true,
  }
}

export function mapAdminEntrantsPage(payload: unknown): AdminEntrantsPage | null {
  const root = objectOf(payload)
  const competition = objectOf(root.competition)
  const id = stringOrNull(competition.id)
  if (!id) return null
  return {
    competition: {
      id,
      name: stringOrNull(competition.name) ?? '',
      gameKey: stringOrNull(competition.game_key),
      gameName: stringOrNull(competition.game_name),
      seasonName: stringOrNull(competition.season_name),
      seasonKey: stringOrNull(competition.season_key),
    },
    total: countOf(root.total),
    limit: countOf(root.limit),
    offset: countOf(root.offset),
    hasMore: root.has_more === true,
    entrants: arrayOf(root.entrants)
      .map(mapEntrant)
      .filter((row): row is AdminEntrant => row !== null),
  }
}

/** A blocker's name, in words an administrator can act on. */
export function blockerLabel(blocker: string): string {
  switch (blocker) {
    case 'unmapped_home_team':
      return 'Home club is not mapped to one of ours'
    case 'unmapped_away_team':
      return 'Away club is not mapped to one of ours'
    case 'same_club_both_sides':
      return 'Both sides map to the same club'
    case 'kickoff_in_the_past':
      return 'Kick-off is already in the past'
    case 'fixture_already_exists':
      return 'A fixture already exists for this pairing'
    default:
      // The server's own token rather than nothing: a blocker this build has no
      // phrase for must still be visible, because it is still a reason to
      // refuse.
      return blocker
  }
}
