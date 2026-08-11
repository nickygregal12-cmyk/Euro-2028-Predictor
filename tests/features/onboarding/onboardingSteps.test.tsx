import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OnboardingCompetitionStep } from '../../../src/features/onboarding/OnboardingCompetitionStep'
import { OnboardingFavouriteStep } from '../../../src/features/onboarding/OnboardingFavouriteStep'
import { OnboardingGamesStep } from '../../../src/features/onboarding/OnboardingGamesStep'
import { OnboardingReviewStep } from '../../../src/features/onboarding/OnboardingReviewStep'
import {
  EMPTY_DRAFT,
  toggleFollowed,
  toggleGame,
  setFavourite,
} from '../../../src/features/onboarding/onboardingDraft'
import { twentyCompetitionPlayer } from '../../../src/dev/scaleFixture'
import { presentPlayerCompetitions } from '../../../src/features/hub/playerCompetitions'
import { catalogueFromPublishedSeasons } from '../../../src/features/hub/competitionCatalogue'
import { ONBOARDING_GAME_OFFERS, ONBOARDING_TEAMS } from '../../../src/dev/onboardingFixture'

/**
 * The onboarding steps, as presentation.
 *
 * THEY ARE NOT WIRED INTO A LIVE JOURNEY, deliberately: no authority can
 * persist a follow, a favourite or onboarding progress (`MIG-UI-10`), and a
 * flow that collected these and lost them on refresh would be worse than none
 * because it would look finished. These assertions cover the states the
 * direction lists, and — more importantly — the two claims the steps must never
 * make: that following joins something, and that the draft has been saved.
 */

const PLAYER = twentyCompetitionPlayer()

describe('choosing competitions', () => {
  it('scales to a twenty-competition catalogue with the selection pinned', () => {
    const draft = toggleFollowed(EMPTY_DRAFT, 'Champions League 2026/27')
    render(
      <OnboardingCompetitionStep player={PLAYER} draft={draft} onToggle={() => {}} />,
    )

    const selected = screen.getByRole('heading', { name: 'Selected' })
    expect(selected).toBeInTheDocument()
    expect(screen.getByText('1 competition selected')).toBeInTheDocument()
    // Pressed state is spoken, not only coloured.
    expect(
      screen.getByRole('button', { name: /Champions League/ }).getAttribute('aria-pressed'),
    ).toBe('true')
    // And the other nineteen are still reachable below it.
    expect(screen.getByRole('heading', { name: 'More competitions' })).toBeInTheDocument()
  })

  it('says that following joins nothing, on the step where that is confused', () => {
    render(<OnboardingCompetitionStep player={PLAYER} draft={EMPTY_DRAFT} onToggle={() => {}} />)
    expect(screen.getByText(/does not enter you into any game/i)).toBeInTheDocument()
  })

  it('distinguishes loading, failure and an empty catalogue', () => {
    const { unmount } = render(
      <OnboardingCompetitionStep player={null} draft={EMPTY_DRAFT} onToggle={() => {}} />,
    )
    expect(screen.getByRole('region', { name: 'Choose your competitions' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    unmount()

    const failed = render(
      <OnboardingCompetitionStep player={null} failed draft={EMPTY_DRAFT} onToggle={() => {}} />,
    )
    expect(screen.getByText('We could not load the competitions')).toBeInTheDocument()
    failed.unmount()

    const bare = presentPlayerCompetitions([], [])
    render(<OnboardingCompetitionStep player={bare} draft={EMPTY_DRAFT} onToggle={() => {}} />)
    expect(screen.getByText(/No competitions are published yet/)).toBeInTheDocument()
  })

  it('offers a newly published competition as an ordinary, selectable choice', () => {
    // Before contract 147 a published season the frontend had no slug for was
    // listed under "Newly published" and deliberately not selectable, because
    // nothing could build its URL. The slug is a server field now, so that
    // state cannot occur and the competition is simply one of the choices.
    const player = presentPlayerCompetitions(
      catalogueFromPublishedSeasons(
        [
          {
            competitionSlug: 'bundesliga',
            seasonKey: '2026-27',
            competitionId: 'competition-1',
            competitionName: 'Bundesliga',
            seasonId: 'season-1',
            seasonName: 'Bundesliga 2026/27',
            status: 'active',
            timeZone: 'Europe/Berlin',
          },
        ],
        [],
      ),
      [],
    )
    render(<OnboardingCompetitionStep player={player} draft={EMPTY_DRAFT} onToggle={() => {}} />)

    expect(screen.getByRole('button', { name: /Bundesliga/ })).toBeInTheDocument()
  })
})

describe('the favourite team step', () => {
  it('is optional, with a real skip and no competitive language', () => {
    render(
      <OnboardingFavouriteStep
        teams={ONBOARDING_TEAMS}
        selectedTeamId={null}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Skip this step' })).toBeInTheDocument()
    expect(screen.getByText(/does not follow a competition, enter a game/i)).toBeInTheDocument()
    expect(screen.getByText('No favourite selected')).toBeInTheDocument()
  })

  it('keeps the team name visible beside the shirt, never the shirt alone', () => {
    render(
      <OnboardingFavouriteStep
        teams={ONBOARDING_TEAMS}
        selectedTeamId={ONBOARDING_TEAMS[0]?.teamId ?? null}
        onSelect={() => {}}
      />,
    )
    const first = ONBOARDING_TEAMS[0]
    expect(first).toBeDefined()
    expect(screen.getByRole('button', { name: new RegExp(first?.name ?? '') })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear favourite' })).toBeInTheDocument()
  })
})

describe('choosing games', () => {
  it('offers bulk and per-competition modes when several are followed', () => {
    let draft = toggleFollowed(EMPTY_DRAFT, ONBOARDING_GAME_OFFERS[0]?.key ?? '')
    draft = toggleFollowed(draft, ONBOARDING_GAME_OFFERS[1]?.key ?? '')
    render(
      <OnboardingGamesStep
        competitions={ONBOARDING_GAME_OFFERS.slice(0, 2)}
        draft={draft}
        onToggleGame={() => {}}
        onApplyToAll={() => {}}
      />,
    )
    // Two by design: the mode switch at the top, and the submit at the bottom
    // of the bulk block. Both say the same thing because both do.
    expect(screen.getAllByRole('button', { name: /Apply to all 2/ })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Customise by competition' })).toBeInTheDocument()
    // Replacing rather than merging, said before it happens.
    expect(screen.getByText(/replaces the game choices/i)).toBeInTheDocument()
  })

  it('never offers a control for an unavailable or already joined game', () => {
    const competition = ONBOARDING_GAME_OFFERS[2]
    expect(competition).toBeDefined()
    render(
      <OnboardingGamesStep
        competitions={[competition as NonNullable<typeof competition>]}
        draft={toggleFollowed(EMPTY_DRAFT, competition?.key ?? '')}
        onToggleGame={() => {}}
        onApplyToAll={() => {}}
      />,
    )

    // The refused game states why, in a sentence, and is not a button.
    expect(screen.getByText(/registration is not open/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Last Man Standing/ })).not.toBeInTheDocument()
    // And an existing membership is reported, not offered again.
    expect(screen.getByText('Already joined')).toBeInTheDocument()
  })

  it('says there is nothing to choose before a competition is selected', () => {
    render(
      <OnboardingGamesStep
        competitions={[]}
        draft={EMPTY_DRAFT}
        onToggleGame={() => {}}
        onApplyToAll={() => {}}
      />,
    )
    expect(screen.getByText(/Choose a competition first/)).toBeInTheDocument()
  })
})

describe('the review step', () => {
  it('shows the three choices apart, and refuses to claim they are saved', () => {
    let draft = toggleFollowed(EMPTY_DRAFT, ONBOARDING_GAME_OFFERS[0]?.key ?? '')
    draft = toggleGame(draft, ONBOARDING_GAME_OFFERS[0]?.key ?? '', 'main_predictor')
    draft = toggleFollowed(draft, ONBOARDING_GAME_OFFERS[1]?.key ?? '')
    draft = setFavourite(draft, ONBOARDING_TEAMS[0]?.teamId ?? null)

    render(
      <OnboardingReviewStep
        competitions={ONBOARDING_GAME_OFFERS}
        teams={ONBOARDING_TEAMS}
        draft={draft}
      />,
    )

    const following = screen.getByRole('heading', { name: 'Following' })
    const games = screen.getByRole('heading', { name: 'Games you will join' })
    const favourite = screen.getByRole('heading', { name: 'Favourite team' })
    expect([following, games, favourite].every(Boolean)).toBe(true)

    // Following without playing is stated as a fact, not flagged as an error.
    expect(screen.getByText(/Following without joining a game/)).toBeInTheDocument()

    // No Finish button that would silently drop the draft.
    expect(screen.queryByRole('button', { name: 'Finish setup' })).not.toBeInTheDocument()
    expect(screen.getByText('These choices are not saved yet')).toBeInTheDocument()
  })

  it('offers the real submit once a caller supplies one', () => {
    const onFinish = vi.fn()
    render(
      <OnboardingReviewStep
        competitions={ONBOARDING_GAME_OFFERS}
        teams={ONBOARDING_TEAMS}
        draft={EMPTY_DRAFT}
        onFinish={onFinish}
      />,
    )
    expect(screen.getByRole('button', { name: 'Finish setup' })).toBeInTheDocument()
    expect(screen.queryByText('These choices are not saved yet')).not.toBeInTheDocument()
  })

  it('says nothing was chosen rather than rendering three empty blocks', () => {
    render(
      <OnboardingReviewStep
        competitions={ONBOARDING_GAME_OFFERS}
        teams={ONBOARDING_TEAMS}
        draft={EMPTY_DRAFT}
      />,
    )
    const games = screen.getByRole('heading', { name: 'Games you will join' }).parentElement
    expect(games).toBeTruthy()
    expect(within(games as HTMLElement).getByText(/No games selected/)).toBeInTheDocument()
  })
})
