import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { SeasonMatchesPage } from '../../../src/features/season/SeasonMatchesPage'
import { mapSeasonFixtureList } from '../../../src/services/supabase/seasonFixtureListModel'
import { resolveClubIdentity } from '../../../src/domain/clubIdentity/clubIdentityTokens'
import type { MatchPredictorPage } from '../../../src/features/season/matchPredictorModel'
import { mapSeasonClubForm } from '../../../src/services/supabase/seasonClubFormModel'
import type { SeasonFootballContext } from '../../../src/features/season/SeasonMatchCentre'
import type { SeasonFixtureWindowGateway } from '../../../src/features/season/useSeasonFixtureWindow'

/**
 * The Match Centre where a player actually meets it: opened from a row in the
 * Matches list.
 *
 * The arithmetic is proven in `matchCentreModel.test.ts`. What is asserted here
 * is the behaviour a model cannot hold — that the card is read on demand rather
 * than for every row, that a fixture with nothing behind it is not a control,
 * and that a non-entrant is told they are not playing rather than shown an
 * error or an empty prediction.
 */

const ZONE = 'Europe/London'

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    kickoff_at: '2026-08-08T14:00:00Z',
    status: 'scheduled',
    round: { id: 'r5', ordinal: 5, label: 'Matchweek 5' },
    home: { name: 'Dundee', short_code: 'DUN', club_colours: 'Navy / White' },
    away: { name: 'Aberdeen', short_code: 'ABE', club_colours: 'Red / White' },
    result: null,
    live: null,
    ...overrides,
  }
}

function windowOf(fixtures: Record<string, unknown>[]) {
  return mapSeasonFixtureList({
    competition: {
      id: 'season-1',
      name: 'Scottish Premiership',
      season_key: '2026-27',
      time_zone: ZONE,
    },
    window: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-22T00:00:00.000Z' },
    server_now: '2026-08-08T09:00:00Z',
    fixtures,
  })
}

const club = (name: string) => ({
  name,
  shortName: name,
  tokens: resolveClubIdentity({ externalId: name, name }),
})

function card(prediction: { home: number; away: number } | null): MatchPredictorPage {
  return {
    competition: { name: 'Scottish Premiership', seasonLabel: '2026/27', timeZone: ZONE },
    matchweek: { number: 5, of: 38 },
    fixtures: [
      {
        fixtureId: 'f1',
        kickoffAt: '2026-08-08T14:00:00Z',
        home: club('Dundee'),
        away: club('Aberdeen'),
        prediction,
        result: null,
        points: null,
      },
    ],
    cardStatus: prediction ? 'provisional' : 'no_submission',
    lock: { status: 'open', locked: false, lockAt: null, reason: 'before_scope_lock' },
    joker: { playedHere: false, remainingThisHalf: 4, playable: true },
    settledPoints: null,
  }
}

function gateway(fixtures: Record<string, unknown>[]): SeasonFixtureWindowGateway {
  return { load: vi.fn(async () => windowOf(fixtures)) }
}

describe('opening a fixture from the Matches list', () => {
  it('reads no card until a fixture is opened, and then only that one', async () => {
    // The list shows a fortnight. Reading a card per row would ask for the
    // player's whole entry to render a list that does not show it.
    const read = vi.fn(async () => card({ home: 2, away: 1 }))
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture(), fixture({ id: 'f2', kickoff_at: '2026-08-09T14:00:00Z' })])}
        timeZone={ZONE}
        readMatchweekCard={read}
      />,
    )

    await waitFor(() => expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(2))
    expect(read).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByRole('button', { expanded: false })[0]!)

    await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
    expect(read).toHaveBeenCalledWith(5)
  })

  it('shows the player their own prediction against the fixture', async () => {
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() => expect(screen.getByText('Your prediction')).toBeTruthy())
    expect(screen.getByText('2 - 1')).toBeTruthy()
    // Not "—". The absence of a result is a statement about the confirmation
    // gate rather than missing data.
    expect(screen.getByText('Not confirmed')).toBeTruthy()
  })

  it('closes again rather than stacking a second panel', async () => {
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
      />,
    )

    const row = await screen.findByRole('button', { expanded: false })
    fireEvent.click(row)
    await waitFor(() => expect(screen.getByText('Your prediction')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { expanded: true }))
    await waitFor(() => expect(screen.queryByText('Your prediction')).toBeNull())
  })

  it('tells a refused caller they are not playing rather than showing an error', async () => {
    // A 42501 from the card read. NOTE this is not how an ordinary non-entrant
    // arrives — that read tolerates a missing entry and returns an empty card,
    // which is why the entry standing below exists — but the refusal is still
    // reachable and must not be dressed as a broken page.
    const refusal = Object.assign(new Error('refused'), { code: '42501' })
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={() => Promise.reject(refusal)}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() =>
      expect(screen.getByText(/not playing the Match Predictor/)).toBeTruthy(),
    )
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('never shows an empty prediction to somebody with no entry', async () => {
    // The defect a browser found. `get_season_matchweek_card` returns an EMPTY
    // CARD for a non-entrant rather than refusing, so the panel rendered
    // "Your prediction — None" to a player who had never joined the game.
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card(null)}
        football={{ entryStanding: 'not_entered' }}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() => expect(screen.getByText(/have not joined/)).toBeTruthy())
    expect(screen.queryByText('Your prediction')).toBeNull()
    expect(screen.queryByText('None')).toBeNull()
  })

  it('explains a card read that failed BECAUSE there is no game here', async () => {
    // The second thing the browser taught. `get_season_matchweek_card` emits
    // `joker: null` for a caller with no entry and the gateway's shape check
    // rejects that, so the read throws — and showing "Your entry could not be
    // read" over a competition that does not run the game reports a fault
    // where there is none. The explaining fact wins.
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={() =>
          Promise.reject(new Error('The season card response was not in the expected shape.'))
        }
        football={{ entryStanding: 'not_offered' }}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() =>
      expect(screen.getByText(/does not run a Match Predictor/)).toBeTruthy(),
    )
    expect(screen.queryByText('Your entry could not be read')).toBeNull()
  })

  it('still reports a failure when nothing explains it', async () => {
    // The Alert is not retired: a read that fails for an entrant, or before the
    // standing is known, is a genuine fault and still says so.
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={() => Promise.reject(new Error('offline'))}
        football={{ entryStanding: 'entered' }}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() => expect(screen.getByText('Your entry could not be read')).toBeTruthy())
  })

  it('says the competition runs no Match Predictor where it does not', async () => {
    // A different fact from "you have not joined", and only one of them is
    // something the player can act on.
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card(null)}
        football={{ entryStanding: 'not_offered' }}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() =>
      expect(screen.getByText(/does not run a Match Predictor/)).toBeTruthy(),
    )
  })

  it('shows the card normally once the caller is known to be entered', async () => {
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
        football={{ entryStanding: 'entered' }}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() => expect(screen.getByText('Your prediction')).toBeTruthy())
    expect(screen.getByText('2 - 1')).toBeTruthy()
  })

  it('reports a genuine read failure as a failure', async () => {
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={() => Promise.reject(new Error('offline'))}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() => expect(screen.getByText('Your entry could not be read')).toBeTruthy())
  })

  it('leaves the rows as rows where there is no entry to read', async () => {
    // A control that opens nothing is worse than no control.
    render(<SeasonMatchesPage gateway={gateway([fixture()])} timeZone={ZONE} />)

    await waitFor(() => expect(screen.getAllByText('Dundee')[0]).toBeTruthy())
    expect(screen.queryByRole('button', { expanded: false })).toBeNull()
    expect(screen.queryByRole('button', { expanded: true })).toBeNull()
  })
})

describe('contract 141’s football beside the player’s own side of it', () => {
  const FORM = mapSeasonClubForm({
    server_now: '2026-08-08T09:00:00Z',
    matches: 6,
    clubs: [
      {
        team_id: 't-dundee',
        name: 'Dundee',
        played: 4,
        won: 3,
        drawn: 0,
        lost: 1,
        goals_for: 8,
        goals_against: 4,
        form: ['W', 'W', 'L', 'W'],
      },
      {
        team_id: 't-aberdeen',
        name: 'Aberdeen',
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        form: [],
      },
    ],
  })

  function football(overrides: Partial<SeasonFootballContext> = {}): SeasonFootballContext {
    const byName = new Map(FORM.clubs.map((entry) => [entry.name, entry]))
    return { formFor: (name) => byName.get(name) ?? null, ...overrides }
  }

  function tableRow(name: string, over: Record<string, unknown> = {}) {
    return {
      position: 4,
      teamId: `t-${name}`,
      teamName: name,
      played: 12,
      won: 7,
      drawn: 3,
      lost: 2,
      goalsFor: 22,
      goalsAgainst: 11,
      goalDifference: 11,
      points: 24,
      adjustment: null,
      boundary: null,
      ...over,
    }
  }

  it('shows where both clubs sit, from contract 160 and not from the form', async () => {
    // Third in `UI-F06`'s hierarchy, after form: a run of four can flatter or
    // slander a club and the table is the season. Every figure is the
    // server's, applied under the competition's own stored rules.
    const rows = new Map([
      ['Dundee', tableRow('Dundee', { position: 1, points: 30, goalDifference: 18 })],
      ['Aberdeen', tableRow('Aberdeen', { position: 11, points: 14, goalDifference: -3 })],
    ])
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
        football={football({ tableFor: (name) => rows.get(name) ?? null })}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() => expect(screen.getByText('In the table')).toBeTruthy())
    expect(screen.getByText(/1st · 30 pts from 12 · \+18 GD/)).toBeTruthy()
    // Negative goal difference keeps its sign rather than reading as a plain
    // number that could be either.
    expect(screen.getByText(/11th · 14 pts from 12 · -3 GD/)).toBeTruthy()
  })

  it('shows the table for both clubs or for neither', async () => {
    // One position beside a blank invites the reading that the other club is
    // unranked, when in fact the table did not contain a name this fixture
    // used. An absence is a defect worth seeing; a half-drawn comparison is
    // one that hides.
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
        football={football({
          tableFor: (name) => (name === 'Dundee' ? tableRow('Dundee') : null),
        })}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() => expect(screen.getByText('Recent form')).toBeTruthy())
    expect(screen.queryByText('In the table')).toBeNull()
  })

  it('shows no table block at all where the competition has none', async () => {
    // `get_competition_table` refuses anything that is not a league season.
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
        football={football()}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() => expect(screen.getByText('Recent form')).toBeTruthy())
    expect(screen.queryByText('In the table')).toBeNull()
  })

  it('shows both clubs’ form, and says which club has not played yet', async () => {
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
        football={football()}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() =>
      expect(screen.getByText('Won 3, drawn 0, lost 1 of the last 4 · +4 goals')).toBeTruthy(),
    )
    expect(screen.getByText('No settled matches yet')).toBeTruthy()
  })

  it('shows the football even when the player’s own entry could not be read', async () => {
    // The two are independent by design: form is the same for everybody and
    // costs no provider request, so a refused card must not take it down.
    const refusal = Object.assign(new Error('refused'), { code: '42501' })
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={() => Promise.reject(refusal)}
        football={football()}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() =>
      expect(screen.getByText(/not playing the Match Predictor/)).toBeTruthy(),
    )
    expect(screen.getByText('Recent form')).toBeTruthy()
  })

  it('reports this season’s meetings from the home club’s point of view', async () => {
    const headToHead = vi.fn(async () => ({
      team: { teamId: 't-dundee', name: 'Dundee' },
      opponent: { teamId: 't-aberdeen', name: 'Aberdeen' },
      summary: { played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 2 },
      meetings: [
        {
          seasonFixtureId: 'earlier',
          kickoffAt: '2026-08-01T14:00:00Z',
          atHome: false,
          goalsFor: 0,
          goalsAgainst: 2,
          outcome: 'L' as const,
          round: 'Matchweek 1',
        },
      ],
    }))

    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
        football={football({ headToHead })}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    // Keyed on the team ids the FORM read supplied, because the fixture read
    // carries none.
    await waitFor(() => expect(headToHead).toHaveBeenCalledWith('t-dundee', 't-aberdeen'))
    await waitFor(() =>
      expect(screen.getByText('Dundee · Matchweek 1 · lost 0 - 2 · away')).toBeTruthy(),
    )
  })

  it('asks for no head-to-head when the form read does not name both clubs', async () => {
    // Without both team ids the call cannot be made, and guessing one would ask
    // about the wrong pair of clubs.
    const headToHead = vi.fn()
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture({ away: { name: 'Unknown FC' } })])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
        football={football({ headToHead })}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() => expect(screen.getByText('Recent form')).toBeTruthy())
    expect(headToHead).not.toHaveBeenCalled()
  })

  it('shows no form section at all where the read is unavailable', async () => {
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() => expect(screen.getByText('Your prediction')).toBeTruthy())
    expect(screen.queryByText('Recent form')).toBeNull()
  })
})

describe('what a fixture means for the player’s Last Man Standing entry', () => {
  const round = (pick: string | null) => ({
    available: true,
    entered: true,
    entryOutcome: 'active' as const,
    round: {
      windowId: 'w3',
      sequence: 3,
      label: 'Round 3',
      opensAt: '2026-08-05T09:00:00Z',
      locksAt: '2026-08-08T13:30:00Z',
    },
    fixtures: [
      {
        fixtureId: 'f1',
        kickoffAt: '2026-08-08T14:00:00Z',
        status: 'scheduled',
        home: { teamId: 't-dundee', name: 'Dundee', used: false },
        away: { teamId: 't-aberdeen', name: 'Aberdeen', used: false },
        score: null,
      },
    ],
    pick: pick ? { teamId: pick } : null,
    pickOutcome: null,
  })

  it('says the entry is riding on the match when the pick is in it', async () => {
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
        football={{ lmsRound: round('t-aberdeen') }}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() => expect(screen.getByText(/riding on this match/)).toBeTruthy())
    expect(screen.getByText(/Round 3 pick is Aberdeen/)).toBeTruthy()
  })

  it('renders no form block while only the round has answered', async () => {
    // Absent form is not "both clubs have played nothing". The block stays away
    // entirely rather than reporting an unloaded read as a fact.
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
        football={{ lmsRound: round('t-aberdeen') }}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() => expect(screen.getByText(/riding on this match/)).toBeTruthy())
    expect(screen.queryByText('Recent form')).toBeNull()
    expect(screen.queryByText('No settled matches yet')).toBeNull()
  })

  it('says nothing to an eliminated player', async () => {
    render(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
        football={{ lmsRound: { ...round('t-aberdeen'), entryOutcome: 'eliminated' } }}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    await waitFor(() => expect(screen.getByText('Your prediction')).toBeTruthy())
    expect(screen.queryByText(/Last Man Standing/)).toBeNull()
  })
})

describe('getting from a fixture to the card that predicts it', () => {
  // The flow gap a player reported as navigation that does not flow: opening a
  // match and having no way to reach the matchweek it belongs to. The route
  // used to carry no matchweek and always opened at the current one, so a link
  // would have landed somewhere else.
  const inRouter = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>)

  it('links to the fixture’s OWN matchweek, not to whichever is current', async () => {
    inRouter(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
        football={{ entryStanding: 'entered' }}
        predictHref={(matchweek) => `/competitions/x/y/games/match-predictor?matchweek=${matchweek}`}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))

    // The seeded fixture is Matchweek 5, so the link must say 5 — the whole
    // point of the change.
    const link = await screen.findByRole('link', { name: 'Open Matchweek 5' })
    expect(link.getAttribute('href')).toBe(
      '/competitions/x/y/games/match-predictor?matchweek=5',
    )
  })

  it('offers no link where the route cannot be reached', async () => {
    // A link to a page that renders Not Found is the dead control this batch
    // removes, reintroduced by a different door.
    inRouter(
      <SeasonMatchesPage
        gateway={gateway([fixture()])}
        timeZone={ZONE}
        readMatchweekCard={async () => card({ home: 2, away: 1 })}
        football={{ entryStanding: 'entered' }}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { expanded: false }))
    await waitFor(() => expect(screen.getByText('Your prediction')).toBeTruthy())
    expect(screen.queryByRole('link', { name: /Open Matchweek/ })).toBeNull()
  })
})
