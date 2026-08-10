import { db } from './client'
import type { CupPhaseKind, CupTableRow } from '../../features/season/cupPhaseModel'

export type ChampionshipVisibility = 'public' | 'private'
export type ChampionshipFixtureStatus = 'pending' | 'settled'
export type ChampionshipFixtureResult =
  | 'win'
  | 'loss'
  | 'draw'
  | 'walkover_win'
  | 'walkover_loss'
  | 'void'
  | null

export type ChampionshipOpponent = {
  userId: string
  displayName: string
}

export type ChampionshipFixtureSummary = {
  fixtureId: string
  windowSequence: number
  windowLabel: string
  locksAt: string | null
  matchday: number | null
  isHome: boolean
  opponent: ChampionshipOpponent
  status: ChampionshipFixtureStatus
  myPoints: number | null
  opponentPoints: number | null
  result: ChampionshipFixtureResult
}

export type ChampionshipInstance = {
  competitionId: string
  visibility: ChampionshipVisibility
  availabilityStatus: string
  entered: boolean
  entrantCount: number
  completedAt: string | null
  registrationClosesAt: string | null
  phaseKind: CupPhaseKind | null
  groupOrdinal: number | null
  currentFixture: ChampionshipFixtureSummary | null
}

export type ChampionshipDiscovery = {
  tournamentId: string
  serverNow: string
  instances: readonly ChampionshipInstance[]
}

export type ChampionshipMember = {
  userId: string
  displayName: string
  isYou: boolean
}

export type ChampionshipGroupFixture = {
  fixtureId: string
  windowSequence: number
  windowLabel: string
  opensAt: string | null
  locksAt: string | null
  matchday: number | null
  home: ChampionshipOpponent
  away: ChampionshipOpponent
  isMyFixture: boolean
  isHome: boolean
  status: ChampionshipFixtureStatus
  homePoints: number | null
  awayPoints: number | null
  result: ChampionshipFixtureResult
}

export type ChampionshipPlayerView = {
  competitionId: string
  entered: boolean
  phaseReady: boolean
  visibility: ChampionshipVisibility | null
  availabilityStatus: string | null
  phaseKind: CupPhaseKind | null
  group: {
    id: string
    ordinal: number
    size: number
    phaseKind: CupPhaseKind
    parentGroupId: string | null
  } | null
  members: readonly ChampionshipMember[]
  table: readonly CupTableRow[]
  fixtures: readonly ChampionshipGroupFixture[]
}

export type SeasonCupDiscoveryGateway = {
  load(): Promise<ChampionshipDiscovery>
}

export type SeasonCupPlayerViewGateway = {
  load(): Promise<ChampionshipPlayerView>
}

type InstancePayload = {
  competition_id: string
  visibility_kind: ChampionshipVisibility
  availability_status: string
  entered: boolean
  entrant_count: number
  completed_at: string | null
  registration_closes_at: string | null
  phase_kind: CupPhaseKind | null
  group_ordinal: number | null
  current_fixture: FixtureSummaryPayload | null
}

type FixtureSummaryPayload = {
  fixture_id: string
  window_sequence: number
  window_label: string
  locks_at: string | null
  matchday: number | null
  is_home: boolean
  opponent: { user_id: string; display_name: string }
  status: ChampionshipFixtureStatus
  my_points: number | null
  opponent_points: number | null
  result: ChampionshipFixtureResult
}

type DiscoveryPayload = {
  tournament_id: string
  server_now: string
  instances: readonly InstancePayload[]
}

type MemberPayload = {
  user_id: string
  display_name: string
  is_you: boolean
}

type GroupFixturePayload = {
  fixture_id: string
  window_sequence: number
  window_label: string
  opens_at: string | null
  locks_at: string | null
  matchday: number | null
  home: { user_id: string; display_name: string }
  away: { user_id: string; display_name: string }
  is_my_fixture: boolean
  is_home: boolean
  status: ChampionshipFixtureStatus
  home_points: number | null
  away_points: number | null
  result: ChampionshipFixtureResult
}

type PlayerViewPayload = {
  competition_id: string
  entered: boolean
  phase_ready?: boolean
  visibility_kind?: ChampionshipVisibility
  availability_status?: string
  phase_kind?: CupPhaseKind
  group?: {
    id: string
    ordinal: number
    size: number
    phase_kind: CupPhaseKind
    parent_group_id: string | null
  }
  members?: readonly MemberPayload[]
  table?: readonly {
    user_id: string
    is_you: boolean
    group_rank: number
    table_points: number
    points_for: number
    points_against: number
    window_points: number
    exacts: number
    corrects: number
    scoreline_error: number
  }[]
  fixtures?: readonly GroupFixturePayload[]
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The Predictor Championship response was not in the expected shape.')
  }
  return value as Record<string, unknown>
}

function discoveryPayload(value: unknown): DiscoveryPayload {
  const payload = object(value) as unknown as DiscoveryPayload
  if (
    typeof payload.tournament_id !== 'string' ||
    typeof payload.server_now !== 'string' ||
    !Array.isArray(payload.instances)
  ) {
    throw new Error('The Predictor Championship discovery response was not in the expected shape.')
  }
  return payload
}

function playerViewPayload(value: unknown): PlayerViewPayload {
  const payload = object(value) as unknown as PlayerViewPayload
  if (typeof payload.competition_id !== 'string' || typeof payload.entered !== 'boolean') {
    throw new Error('The Predictor Championship player response was not in the expected shape.')
  }
  if (payload.entered && typeof payload.phase_ready !== 'boolean') {
    throw new Error('The Predictor Championship player response was not in the expected shape.')
  }
  if (payload.phase_ready && (!payload.group || !Array.isArray(payload.table))) {
    throw new Error('The Predictor Championship player response was not in the expected shape.')
  }
  return payload
}

function opponent(payload: { user_id: string; display_name: string }): ChampionshipOpponent {
  return { userId: payload.user_id, displayName: payload.display_name }
}

function fixtureSummary(payload: FixtureSummaryPayload): ChampionshipFixtureSummary {
  return {
    fixtureId: payload.fixture_id,
    windowSequence: payload.window_sequence,
    windowLabel: payload.window_label,
    locksAt: payload.locks_at,
    matchday: payload.matchday,
    isHome: payload.is_home,
    opponent: opponent(payload.opponent),
    status: payload.status,
    myPoints: payload.my_points,
    opponentPoints: payload.opponent_points,
    result: payload.result,
  }
}

export function createSeasonCupDiscoveryRpcGateway(options: {
  tournamentId: string
}): SeasonCupDiscoveryGateway {
  return {
    async load(): Promise<ChampionshipDiscovery> {
      const { data, error } = await db.rpc('get_my_season_cup_instances', {
        p_tournament_id: options.tournamentId,
      })
      if (error) throw error
      const payload = discoveryPayload(data)
      return {
        tournamentId: payload.tournament_id,
        serverNow: payload.server_now,
        instances: payload.instances.map((instance) => ({
          competitionId: instance.competition_id,
          visibility: instance.visibility_kind,
          availabilityStatus: instance.availability_status,
          entered: instance.entered,
          entrantCount: instance.entrant_count,
          completedAt: instance.completed_at,
          registrationClosesAt: instance.registration_closes_at,
          phaseKind: instance.phase_kind,
          groupOrdinal: instance.group_ordinal,
          currentFixture: instance.current_fixture
            ? fixtureSummary(instance.current_fixture)
            : null,
        })),
      }
    },
  }
}

export function createSeasonCupPlayerViewRpcGateway(options: {
  competitionId: string
}): SeasonCupPlayerViewGateway {
  return {
    async load(): Promise<ChampionshipPlayerView> {
      const { data, error } = await db.rpc('get_season_cup_player_view', {
        p_competition_id: options.competitionId,
      })
      if (error) throw error
      const payload = playerViewPayload(data)

      if (!payload.entered) {
        return {
          competitionId: payload.competition_id,
          entered: false,
          phaseReady: false,
          visibility: null,
          availabilityStatus: null,
          phaseKind: null,
          group: null,
          members: [],
          table: [],
          fixtures: [],
        }
      }

      const phaseReady = payload.phase_ready === true
      return {
        competitionId: payload.competition_id,
        entered: true,
        phaseReady,
        visibility: payload.visibility_kind ?? null,
        availabilityStatus: payload.availability_status ?? null,
        phaseKind: payload.phase_kind ?? null,
        group: phaseReady && payload.group
          ? {
              id: payload.group.id,
              ordinal: payload.group.ordinal,
              size: payload.group.size,
              phaseKind: payload.group.phase_kind,
              parentGroupId: payload.group.parent_group_id,
            }
          : null,
        members: (payload.members ?? []).map((member) => ({
          userId: member.user_id,
          displayName: member.display_name,
          isYou: member.is_you,
        })),
        table: (payload.table ?? []).map((row) => ({
          userId: row.user_id,
          isYou: row.is_you,
          groupRank: row.group_rank,
          tablePoints: row.table_points,
          pointsFor: row.points_for,
          pointsAgainst: row.points_against,
          windowPoints: row.window_points,
          exacts: row.exacts,
          corrects: row.corrects,
          scorelineError: row.scoreline_error,
        })),
        fixtures: (payload.fixtures ?? []).map((fixture) => ({
          fixtureId: fixture.fixture_id,
          windowSequence: fixture.window_sequence,
          windowLabel: fixture.window_label,
          opensAt: fixture.opens_at,
          locksAt: fixture.locks_at,
          matchday: fixture.matchday,
          home: opponent(fixture.home),
          away: opponent(fixture.away),
          isMyFixture: fixture.is_my_fixture,
          isHome: fixture.is_home,
          status: fixture.status,
          homePoints: fixture.home_points,
          awayPoints: fixture.away_points,
          result: fixture.result,
        })),
      }
    },
  }
}
