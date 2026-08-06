import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HubSeasonMembership } from '../../src/services/supabase/competitionGames'
import type { CompetitionGame } from '../../src/services/supabase/competitionGamesModel'

const mocks = vi.hoisted(() => ({
  fetchHubMembership: vi.fn<() => Promise<HubSeasonMembership[]>>(),
  registerBonusCompetition: vi.fn(),
}))

vi.mock('../../src/services/supabase/competitionGames', () => ({
  fetchHubMembership: mocks.fetchHubMembership,
}))
vi.mock('../../src/services/supabase/bonusGames', () => ({
  registerBonusCompetition: mocks.registerBonusCompetition,
}))

import { createSeasonGameRegistrationRpcGateway } from '../../src/services/supabase/seasonGameRegistration'

const SEASON = 'Premier League 2026/27'
const MAIN_ID = '60000000-0000-0000-0000-000000000101'

function game(overrides: Partial<CompetitionGame> = {}): CompetitionGame {
  return {
    id: MAIN_ID,
    gameKey: 'main_predictor',
    active: true,
    displayName: 'Main Predictor',
    registrationOpensAt: '2026-07-01T00:00:00Z',
    registrationClosesAt: '2027-05-01T00:00:00Z',
    completedAt: null,
    allowRejoin: false,
    membership: null,
    ...overrides,
  }
}

function season(games: CompetitionGame[], serverNow: string | null = '2026-08-06T12:00:00Z') {
  return [
    {
      seasonName: SEASON,
      tournamentId: '60000000-0000-0000-0000-000000000001',
      seasonStatus: 'active' as const,
      seasonGames: { competitionMember: true, serverNow, games },
    },
  ]
}

function gateway() {
  return createSeasonGameRegistrationRpcGateway({
    seasonRowName: SEASON,
    gameKey: 'main_predictor',
  })
}

describe('the season game registration gateway', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads the Main Predictor, which the Games hub read cannot see', async () => {
    // `BonusGameKey` does not include `main_predictor`, and `bonusGamesModel`
    // skips a key it does not model — so the hub-backed gateway would report
    // an eligible player's game as unlisted. This one reads the catalogue.
    mocks.fetchHubMembership.mockResolvedValue(season([game()]))

    const facts = await gateway().load()

    expect(facts.competitionId).toBe(MAIN_ID)
    expect(facts.registrationOpensAt).toBe('2026-07-01T00:00:00Z')
    expect(facts.serverNow).toBe('2026-08-06T12:00:00Z')
  })

  it('counts only an active membership as entered', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([
        game({
          membership: { status: 'left', joinedAt: null, leftAt: null, disqualifiedAt: null },
        }),
      ]),
    )

    expect((await gateway().load()).entered).toBe(false)
  })

  it('reports an active entrant as entered, with when they joined', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([
        game({
          membership: {
            status: 'active',
            joinedAt: '2026-08-01T09:00:00Z',
            leftAt: null,
            disqualifiedAt: null,
          },
        }),
      ]),
    )

    const facts = await gateway().load()
    expect(facts.entered).toBe(true)
    expect(facts.joinedAt).toBe('2026-08-01T09:00:00Z')
  })

  it('refuses to choose when a season lists the same game twice', async () => {
    // Contract 107 mints a fresh Last Man Standing successor on every wipeout
    // restart, so "the season's competition for this key" is the server's
    // question. Guessing would quietly register somebody into a predecessor.
    mocks.fetchHubMembership.mockResolvedValue(
      season([game(), game({ id: 'another-one' })]),
    )

    await expect(gateway().load()).rejects.toThrow(/more than one competition/)
    expect(mocks.registerBonusCompetition).not.toHaveBeenCalled()
  })

  it('says so when the season does not list the game at all', async () => {
    mocks.fetchHubMembership.mockResolvedValue(
      season([game({ gameKey: 'last_man_standing', id: 'lms' })]),
    )

    await expect(gateway().load()).rejects.toThrow(/not listed for this season/)
  })

  it('says so when the season itself is not listed', async () => {
    mocks.fetchHubMembership.mockResolvedValue([])

    await expect(gateway().load()).rejects.toThrow(/season is no longer listed/)
  })

  it('joins the competition the key resolved to', async () => {
    mocks.fetchHubMembership.mockResolvedValue(season([game()]))

    await gateway().join()

    expect(mocks.registerBonusCompetition).toHaveBeenCalledWith(MAIN_ID)
  })

  it('re-resolves on join rather than trusting an id held from the load', async () => {
    // The panel reloads after every attempt, so an id remembered from an
    // earlier read would outlive the facts it was read with.
    mocks.fetchHubMembership.mockResolvedValue(season([game()]))
    const registration = gateway()

    await registration.load()
    await registration.join()

    expect(mocks.fetchHubMembership).toHaveBeenCalledTimes(2)
  })

  it('fails closed when the read carries no server instant', async () => {
    // An empty instant makes both registration windows fail closed in the
    // model, which is safer than opening a join the server would refuse.
    mocks.fetchHubMembership.mockResolvedValue(season([game()], null))

    expect((await gateway().load()).serverNow).toBe('')
  })
})
