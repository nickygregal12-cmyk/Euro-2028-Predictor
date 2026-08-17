import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../src/services/supabase/client', () => ({
  db: { from: mocks.from },
}))

import { fetchTournamentData } from '../../src/services/supabase/tournamentData'
import { at } from '../support/indexed'

const EURO = '40000000-0000-0000-0000-000000000001'
const OTHER = '40000000-0000-0000-0000-000000000002'
const EURO_GROUP_A = '40000000-0000-0000-0000-0000000000a1'
const EURO_GROUP_B = '40000000-0000-0000-0000-0000000000a2'
const OTHER_GROUP_A = '40000000-0000-0000-0000-0000000000b1'

type Row = Record<string, unknown>

/**
 * A mixed-format reference dataset. The earlier league-season root is first on
 * purpose: the legacy tournament provider must select by format, not whichever
 * row happens to sort first after C1b adds domestic season roots.
 */
const DATASET: Record<string, Row[]> = {
  tournaments: [
    {
      id: OTHER,
      name: 'Scottish Premiership 2026/27',
      year: 2026,
      starts_on: null,
      ends_on: null,
      lock_at: null,
      kind: 'league_season',
    },
    {
      id: EURO,
      name: 'Euro 2028',
      year: 2028,
      starts_on: '2028-06-09',
      ends_on: '2028-07-09',
      lock_at: '2028-06-09T19:00:00Z',
      kind: 'tournament',
    },
  ],
  groups: [
    { id: EURO_GROUP_A, letter: 'A', tournament_id: EURO },
    { id: EURO_GROUP_B, letter: 'B', tournament_id: EURO },
    { id: OTHER_GROUP_A, letter: 'A', tournament_id: OTHER },
  ],
  group_teams: [
    { slot: 1, group_id: EURO_GROUP_A, team: { id: 'euro-1', name: 'England' } },
    { slot: 2, group_id: EURO_GROUP_B, team: { id: 'euro-2', name: 'Wales' } },
    { slot: 1, group_id: OTHER_GROUP_A, team: { id: 'other-1', name: 'Foreign Club' } },
  ],
  matches: [
    { id: 'm-euro', match_ref: 'M1', round: 'group', tournament_id: EURO, match_date: '2028-06-09' },
    { id: 'm-other', match_ref: 'M1', round: 'group', tournament_id: OTHER, match_date: '2029-06-09' },
  ],
}

type Options = {
  kindColumnFails?: boolean
  lockAtFails?: boolean
  groups?: Row[]
  tournaments?: Row[]
}

function installClient({
  kindColumnFails = false,
  lockAtFails = false,
  groups,
  tournaments,
}: Options = {}) {
  const queries: { table: string; filters: Row }[] = []
  const data: Record<string, Row[]> = {
    ...DATASET,
    ...(groups ? { groups } : {}),
    ...(tournaments ? { tournaments } : {}),
  }

  mocks.from.mockImplementation((table: string) => {
    const filters: Row = {}
    const record = { table, filters }
    queries.push(record)

    let selected = ''
    let single = false

    const builder: Record<string, unknown> = {
      select: (columns: string) => {
        selected = columns
        return builder
      },
      order: () => builder,
      limit: (n: number) => {
        filters.limit = n
        return builder
      },
      eq: (column: string, value: unknown) => {
        filters[column] = value
        return builder
      },
      in: (column: string, values: unknown[]) => {
        filters[`${column}__in`] = values
        return builder
      },
      single: () => {
        single = true
        return builder
      },
      // The Supabase query builder is itself thenable — awaiting it is what
      // sends the request — so the fake has to be thenable to stand in for it.
      // eslint-disable-next-line unicorn/no-thenable
      then: (
        resolve: (result: { data: unknown; error: unknown }) => unknown,
      ) => {
        if (
          table === 'tournaments' &&
          !single &&
          kindColumnFails &&
          filters.kind === 'tournament'
        ) {
          return resolve({
            data: null,
            error: { code: '42703', message: 'column tournaments.kind does not exist' },
          })
        }

        if (table === 'tournaments' && single) {
          if (kindColumnFails && /\bkind\b/.test(selected)) {
            return resolve({
              data: null,
              error: { code: '42703', message: 'column tournaments.kind does not exist' },
            })
          }

          return resolve(
            lockAtFails && selected === 'lock_at'
              ? { data: null, error: { message: 'column lock_at does not exist' } }
              : {
                  data: (data.tournaments ?? []).find((r) => r.id === filters.id) ?? null,
                  error: null,
                },
          )
        }

        let rows = data[table] ?? []
        for (const [key, value] of Object.entries(filters)) {
          if (key === 'limit') continue
          if (key.endsWith('__in')) {
            const column = key.slice(0, -'__in'.length)
            rows = rows.filter((row) => (value as unknown[]).includes(row[column]))
            continue
          }
          rows = rows.filter((row) => row[key] === value)
        }
        if (typeof filters.limit === 'number') rows = rows.slice(0, filters.limit)

        return resolve({ data: rows, error: null })
      },
    }

    return builder
  })

  return queries
}

describe('tournament reference data is scoped to one tournament', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps legacy tournament routes on tournament-format seasons', async () => {
    const queries = installClient()

    const result = await fetchTournamentData()

    const selection = queries.find(
      (query) => query.table === 'tournaments' && query.filters.limit === 1,
    )
    expect(selection?.filters.kind).toBe('tournament')
    expect(result.tournament.id).toBe(EURO)
    expect(result.tournament.name).toBe('Euro 2028')
  })

  it('falls back only when a pre-Stage-C schema has no kind column', async () => {
    const legacyTournaments = [
      { ...at(at(DATASET, 'tournaments'), 1) },
      { ...at(at(DATASET, 'tournaments'), 0) },
    ]
    const queries = installClient({ kindColumnFails: true, tournaments: legacyTournaments })

    const result = await fetchTournamentData()

    const selections = queries.filter(
      (query) => query.table === 'tournaments' && query.filters.limit === 1,
    )
    expect(selections).toHaveLength(2)
    expect(selections[0]?.filters.kind).toBe('tournament')
    expect(selections[1]?.filters.kind).toBeUndefined()
    expect(result.tournament.id).toBe(EURO)
    expect(result.tournament.kind).toBeNull()
  })

  it('never blends another tournament’s group teams into the team list', () => {
    // Regression guard: the group_teams select carried no tournament filter, so
    // a second competition row put both tournaments' teams in one team list.
    installClient()

    return fetchTournamentData().then((result) => {
      expect(result.teams.map((team) => team.id)).toEqual(['euro-1', 'euro-2'])
      expect(result.teams.map((team) => team.name)).not.toContain('Foreign Club')
    })
  })

  it('scopes group teams through the selected tournament’s group ids', async () => {
    const queries = installClient()

    await fetchTournamentData()

    const groupTeams = queries.find((query) => query.table === 'group_teams')
    expect(groupTeams).toBeDefined()
    expect(groupTeams?.filters.group_id__in).toEqual([EURO_GROUP_A, EURO_GROUP_B])
  })

  it('keeps groups and matches scoped by tournament id', async () => {
    const queries = installClient()

    const result = await fetchTournamentData()

    expect(queries.find((q) => q.table === 'groups')?.filters.tournament_id).toBe(EURO)
    expect(queries.find((q) => q.table === 'matches')?.filters.tournament_id).toBe(EURO)
    expect(result.groups.map((group) => group.id)).toEqual([EURO_GROUP_A, EURO_GROUP_B])
    expect(result.matches.map((match) => match.id)).toEqual(['m-euro'])
  })

  it('issues no group-teams query when the tournament has no groups', async () => {
    // `.in('group_id', [])` is not a meaningful filter, so the query is skipped
    // rather than sent unscoped.
    const queries = installClient({ groups: [] })

    const result = await fetchTournamentData()

    expect(queries.some((query) => query.table === 'group_teams')).toBe(false)
    expect(result.teams).toEqual([])
  })

  it('still loads when the lock_at column is absent', async () => {
    // Preserved behaviour: lock_at is a follow-up-migration column and is read
    // best-effort, so its failure must not fail the whole load.
    installClient({ lockAtFails: true })

    const result = await fetchTournamentData()

    expect(result.tournament.lockAt).toBeNull()
    expect(result.teams).toHaveLength(2)
  })

  it('returns the lock instant when it is present', async () => {
    installClient()

    const result = await fetchTournamentData()

    expect(result.tournament.lockAt).toBe('2028-06-09T19:00:00Z')
    expect(result.tournament.name).toBe('Euro 2028')
  })
})
