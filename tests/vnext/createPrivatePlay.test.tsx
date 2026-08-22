import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from './vnextAxe'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { VNextCreateScreen } from '../../src/vnext/integration/create/VNextCreateScreen'
import type { CreateWrites } from '../../src/vnext/integration/create/VNextCreateScreen'
import { shellScenarios } from '../../src/vnext/fixtures'
import type { PlayerCompetitions } from '../../src/features/hub/playerCompetitions'

const player = {
  mine: [
    {
      tournamentId: 'season-1',
      competition: {
        seasonRowName: 'caledonian-2027-28',
        name: 'Caledonian Premiership',
        seasonLabel: '2027/28',
      },
      games: [
        { gameKey: 'main_predictor', id: 'game-competition-mp', membership: { status: 'active' } },
      ],
    },
  ],
  catalogue: [
    {
      seasonRowName: 'caledonian-2027-28',
      tournamentId: 'season-1',
      name: 'Caledonian Premiership',
      seasonLabel: '2027/28',
      status: 'live',
      games: [],
    },
  ],
} as unknown as PlayerCompetitions

function writes(over: Partial<CreateWrites> = {}): CreateWrites {
  let leagueName = 'Private league'
  let lmsName = 'Private LMS'
  let cupName = 'Private Championship'

  const base: CreateWrites = {
    createLeague: vi.fn(async (id: string, name: string) => {
      leagueName = name
      return { id: 'lg-1', name, inviteCode: `MUTATION-${id}` }
    }),
    createLms: vi.fn(async (id: string, name: string) => {
      lmsName = name
      return { competitionId: 'comp-1', name, inviteCode: `MUTATION-LMS-${id}` }
    }),
    createCup: vi.fn(async (id: string, name: string) => {
      cupName = name
      return { competitionId: 'comp-2', name, inviteCode: `MUTATION-CUP-${id}` }
    }),
    readLeagues: vi.fn(async (id: string) => [
      {
        id: 'lg-1',
        name: leagueName,
        inviteCode: `LEAGUE-${id}`,
        isOwner: true,
      },
    ]),
    readPrivateCompetitions: vi.fn(async () => [
      {
        competitionId: 'comp-1',
        name: lmsName,
        gameKey: 'last_man_standing' as const,
        tournamentId: 'season-1',
        isOwner: true,
        inviteCode: 'LMS-season-1',
      },
      {
        competitionId: 'comp-2',
        name: cupName,
        gameKey: 'predictor_cup' as const,
        tournamentId: 'season-1',
        isOwner: true,
        inviteCode: 'CUP-season-1',
      },
    ]),
  }
  return { ...base, ...over }
}

function renderCorridor(
  props: Partial<React.ComponentProps<typeof VNextCreateScreen>> = {},
) {
  const perform = (props.writes as CreateWrites | undefined) ?? writes()
  const view = render(
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <VNextCreateScreen
        userId="account-1"
        authLoading={false}
        player={player}
        loading={false}
        failed={false}
        {...props}
        writes={perform}
      />
    </VNextShellProvider>,
  )
  return { ...view, perform }
}

function chooseGame(game: string) {
  const zone = within(
    document.querySelector('[data-vnext-zone="choose-game"]') as HTMLElement,
  )
  fireEvent.click(zone.getByRole('button', { name: new RegExp(`^${game}`) }))
}

function chooseAndName(game: string, name: string) {
  chooseGame(game)
  fireEvent.change(screen.getByRole('textbox', { name: /what is it called/i }), {
    target: { value: name },
  })
}

function review() {
  fireEvent.click(screen.getByRole('button', { name: 'Review' }))
  return within(document.querySelector('[data-vnext-zone="review"]') as HTMLElement)
}

function createFromReview() {
  const zone = review()
  fireEvent.click(zone.getByRole('button', { name: 'Create it' }))
}

describe('the create corridor offers all three games as peers', () => {
  it('draws a row for every game, including the ones it cannot create', () => {
    renderCorridor({
      player: { mine: [], catalogue: [] } as unknown as PlayerCompetitions,
    })

    for (const name of ['Match Predictor', 'Last Man Standing', 'Predictor Championship']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    expect(screen.getByText(/Join Match Predictor in a competition first/)).toBeInTheDocument()
  })

  it('offers no control for a game that cannot be created', () => {
    renderCorridor({
      player: { mine: [], catalogue: [] } as unknown as PlayerCompetitions,
    })
    const zone = within(
      document.querySelector('[data-vnext-zone="choose-game"]') as HTMLElement,
    )
    expect(zone.queryByRole('button', { name: /^Match Predictor/ })).toBeNull()
  })
})

describe('review is a real mutation gate', () => {
  it('does not create from setup and lets the player edit the reviewed choices', () => {
    const { perform } = renderCorridor()
    chooseAndName('Match Predictor', 'The Sunday Club')

    expect(screen.queryByRole('button', { name: 'Create it' })).toBeNull()
    const zone = review()
    expect(perform.createLeague).not.toHaveBeenCalled()
    expect(zone.getByText(/The Sunday Club/)).toBeInTheDocument()
    expect(zone.getByText(/Caledonian Premiership/)).toBeInTheDocument()

    fireEvent.click(zone.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('textbox', { name: /what is it called/i })).toHaveValue(
      'The Sunday Club',
    )
  })
})

describe('each container is created by its own authority and then reread', () => {
  it('creates a private league against the game membership', async () => {
    const { perform } = renderCorridor()

    chooseAndName('Match Predictor', 'The Sunday Club')
    createFromReview()

    await waitFor(() =>
      expect(perform.createLeague).toHaveBeenCalledWith(
        'game-competition-mp',
        'The Sunday Club',
      ),
    )
    await waitFor(() => expect(perform.readLeagues).toHaveBeenCalledWith('game-competition-mp'))
    expect(perform.createLms).not.toHaveBeenCalled()
    expect(perform.createCup).not.toHaveBeenCalled()
  })

  it('creates Last Man Standing against the season with its reviewed rules', async () => {
    const { perform } = renderCorridor()

    chooseAndName('Last Man Standing', 'Survivors')
    fireEvent.click(screen.getByRole('button', { name: 'A draw keeps you in' }))
    const zone = review()
    expect(zone.getByText('A draw keeps you in')).toBeInTheDocument()
    fireEvent.click(zone.getByRole('button', { name: 'Create it' }))

    await waitFor(() => expect(perform.createLms).toHaveBeenCalled())
    const call = (perform.createLms as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call?.[0]).toBe('season-1')
    expect(call?.[1]).toBe('Survivors')
    expect(call?.[2]).toMatchObject({ drawsRule: 'survive' })
    await waitFor(() => expect(perform.readPrivateCompetitions).toHaveBeenCalledTimes(1))
    expect(perform.createLeague).not.toHaveBeenCalled()
  })

  it('creates a Championship against the season and does not launch it', async () => {
    const { perform } = renderCorridor()

    chooseAndName('Predictor Championship', 'Office Cup')
    createFromReview()

    await waitFor(() => expect(perform.createCup).toHaveBeenCalledWith('season-1', 'Office Cup'))
    expect(await screen.findByText(/Nobody is drawn yet/)).toBeInTheDocument()
  })
})

describe('success means the authoritative destination can find the container', () => {
  it('shows the invite from the authoritative reread, not the mutation response', async () => {
    renderCorridor()

    chooseAndName('Match Predictor', 'The Sunday Club')
    createFromReview()

    expect(await screen.findByText('LEAGUE-game-competition-mp')).toBeInTheDocument()
    expect(screen.queryByText('MUTATION-game-competition-mp')).toBeNull()
    expect(screen.getByText(/The Sunday Club is ready/)).toBeInTheDocument()
  })

  it('does not claim success when the write returns but the authoritative reread misses it', async () => {
    const perform = writes({ readLeagues: vi.fn(async () => []) })
    renderCorridor({ writes: perform })

    chooseAndName('Match Predictor', 'The Sunday Club')
    createFromReview()

    const warning = await screen.findByRole('alert')
    expect(warning).toHaveTextContent(/could not confirm it in your private-play list/i)
    expect(warning).toHaveTextContent(/do not create a duplicate/i)
    expect(screen.queryByText(/is ready/)).toBeNull()
    expect(perform.createLeague).toHaveBeenCalledTimes(1)
  })

  it('does not double-submit a create while the first call is in flight', async () => {
    let release: (() => void) | undefined
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const perform = writes({
      createLeague: vi.fn(async (_id: string, name: string) => {
        await blocked
        return { id: 'lg-1', name, inviteCode: 'MUTATION' }
      }),
    })
    renderCorridor({ writes: perform })

    chooseAndName('Match Predictor', 'The Sunday Club')
    const zone = review()
    const button = zone.getByRole('button', { name: 'Create it' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(perform.createLeague).toHaveBeenCalledTimes(1)

    release?.()
    expect(await screen.findByText(/The Sunday Club is ready/)).toBeInTheDocument()
  })

  it('reports a write refusal in safe copy and retains the setup for editing', async () => {
    renderCorridor({
      writes: writes({
        createLeague: vi.fn(async () => {
          throw new Error('duplicate key value violates unique constraint')
        }),
      }),
    })

    chooseAndName('Match Predictor', 'The Sunday Club')
    createFromReview()

    const refusal = await screen.findByRole('alert')
    expect(refusal).toHaveTextContent('We could not create that just now.')
    expect(refusal.textContent).not.toContain('unique constraint')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('textbox', { name: /what is it called/i })).toHaveValue(
      'The Sunday Club',
    )
  })
})

describe('the other way in', () => {
  it('takes whatever was pasted to the address that owns invite codes', () => {
    const onJoinCode = vi.fn()
    renderCorridor({ onJoinCode })

    const join = within(document.querySelector('[data-vnext-zone="join"]') as HTMLElement)
    fireEvent.change(join.getByRole('textbox'), {
      target: { value: 'https://example.test/join/SUN4KD' },
    })
    fireEvent.click(join.getByRole('button', { name: 'Open it' }))

    expect(onJoinCode).toHaveBeenCalledWith('SUN4KD')
  })

  it('validates nothing about the code itself', () => {
    const onJoinCode = vi.fn()
    renderCorridor({ onJoinCode })

    const join = within(document.querySelector('[data-vnext-zone="join"]') as HTMLElement)
    fireEvent.change(join.getByRole('textbox'), { target: { value: 'nonsense' } })
    fireEvent.click(join.getByRole('button', { name: 'Open it' }))

    expect(onJoinCode).toHaveBeenCalledWith('nonsense')
  })
})

describe('accessibility', () => {
  it('has no violations on the game choice', async () => {
    await expectNoAxeViolations(
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextCreateScreen
          userId="account-1"
          authLoading={false}
          player={player}
          loading={false}
          failed={false}
          writes={writes()}
        />
      </VNextShellProvider>,
    )
  })
})
