/**
 * Contract 174's staged provider calendar changes, decoded. Pure: no Supabase
 * import, no network, no clock — the configured wrapper is
 * `providerChangeProposals.ts`.
 *
 * NO RAW PROVIDER PAYLOAD REACHES A BROWSER. Contract 174 returns the DECODED
 * proposal and what we already hold, field by field; the retained response body
 * stays on the server. This decoder cannot ask for one.
 *
 * WARNINGS AND BLOCKERS ARE NAMED, NEVER COUNTED. That is contract 174's whole
 * correction of contract 117, which incremented two counters into a jsonb
 * report nothing read. A number is not something an administrator can act on.
 *
 * `decidable` IS THE SERVER'S AND IS NOT RE-DERIVED. It means pending with no
 * blockers; a browser recomputing it from the two fields would be a second
 * opinion that can drift, and the one it would drift from is the one that
 * decides whether the write succeeds.
 *
 * THE KIND IS DELIBERATELY NOT NARROWED TO A UNION. Contract 174 records
 * `discovered`, `postponed`, `abandoned`, `cancelled` and `withdrawn`; a token
 * this build does not recognise is carried through and labelled as itself,
 * because dropping the row would hide a staged change from the only person who
 * can decide it.
 */

export type ProviderChangeState = 'pending' | 'approved' | 'rejected'

export type ProviderChangeProposal = {
  id: string
  /** `discovered`, `postponed`, `abandoned`, `cancelled`, `withdrawn`. */
  kind: string
  state: ProviderChangeState
  provider: string | null
  providerFixtureId: string | null
  detectedAt: string | null
  /** How many times the provider has repeated this since it was staged. */
  seenCount: number
  lastSeenAt: string | null
  round: string | null
  roundOrdinal: number | null
  homeTeam: string | null
  awayTeam: string | null
  /** The decoded proposal, as the server built it. Never the raw response. */
  proposed: Record<string, unknown>
  /** What this platform currently holds for the same fixture. */
  observed: Record<string, unknown>
  warnings: readonly string[]
  blockers: readonly string[]
  /** The server's own answer to "may this be approved". Never re-derived. */
  decidable: boolean
  decidedAt: string | null
  decisionReason: string | null
  resultingAction: Record<string, unknown> | null
}

export type ProviderChangeProposalPage = {
  tournamentId: string | null
  /** The state filter this page was read under, or null for all of them. */
  state: string | null
  total: number
  returned: number
  truncated: boolean
  proposals: readonly ProviderChangeProposal[]
}

export type ProviderChangeDecision = {
  proposalId: string
  state: ProviderChangeState
  /** True when the same decision had already been taken. Not a failure. */
  repeated: boolean
  resultingAction: Record<string, unknown> | null
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function integerOr(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function stateOf(value: unknown): ProviderChangeState {
  return value === 'approved' || value === 'rejected' ? value : 'pending'
}

function mapProposal(value: unknown): ProviderChangeProposal | null {
  const row = objectOf(value)
  const id = stringOrNull(row.id)
  const kind = stringOrNull(row.kind)
  // Without an id it cannot be decided, and without a kind it cannot be
  // described. Both are drops rather than guesses.
  if (id === null || kind === null) return null

  return {
    id,
    kind,
    state: stateOf(row.state),
    provider: stringOrNull(row.provider),
    providerFixtureId: stringOrNull(row.providerFixtureId),
    detectedAt: stringOrNull(row.detectedAt),
    seenCount: integerOr(row.seenCount, 1) ?? 1,
    lastSeenAt: stringOrNull(row.lastSeenAt),
    round: stringOrNull(row.round),
    roundOrdinal: integerOr(row.roundOrdinal, null),
    homeTeam: stringOrNull(row.homeTeam),
    awayTeam: stringOrNull(row.awayTeam),
    proposed: objectOf(row.proposed),
    observed: objectOf(row.observed),
    warnings: stringList(row.warnings),
    blockers: stringList(row.blockers),
    // Defaults to NOT decidable. A missing flag must never open the one write
    // path in the repository that can add a fixture to a published season.
    decidable: row.decidable === true,
    decidedAt: stringOrNull(row.decidedAt),
    decisionReason: stringOrNull(row.decisionReason),
    resultingAction:
      row.resultingAction && typeof row.resultingAction === 'object'
        ? objectOf(row.resultingAction)
        : null,
  }
}

export function mapProviderChangeProposals(value: unknown): ProviderChangeProposalPage {
  const payload = objectOf(value)
  const raw = Array.isArray(payload.proposals) ? payload.proposals : []
  const proposals = raw
    .map(mapProposal)
    .filter((proposal): proposal is ProviderChangeProposal => proposal !== null)

  return {
    tournamentId: stringOrNull(payload.tournament_id),
    state: stringOrNull(payload.state),
    total: integerOr(payload.total, proposals.length) ?? proposals.length,
    returned: proposals.length,
    truncated: payload.truncated === true || proposals.length < raw.length,
    proposals,
  }
}

export function mapProviderChangeDecision(value: unknown): ProviderChangeDecision {
  const payload = objectOf(value)
  const proposalId = stringOrNull(payload.proposal_id)
  if (proposalId === null) {
    throw new Error('The proposal decision response was not in the expected shape.')
  }
  return {
    proposalId,
    state: stateOf(payload.state),
    repeated: payload.repeated === true,
    resultingAction:
      payload.resulting_action && typeof payload.resulting_action === 'object'
        ? objectOf(payload.resulting_action)
        : null,
  }
}
