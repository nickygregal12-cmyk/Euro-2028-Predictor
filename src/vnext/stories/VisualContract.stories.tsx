import type { ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextRoot, type VNextThemeSetting } from '../foundations/VNextRoot'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { VNextHome } from '../home/VNextHome'
import { VNextMatchPredictor } from '../predictor/VNextMatchPredictor'
import { VNextMatches } from '../matches/VNextMatches'
import { VNextMatchCentre } from '../matches/VNextMatchCentre'
import { VNextGames } from '../games/VNextGames'
import { VNextLeagues } from '../leagues/VNextLeagues'
import { VNextPlayerProfile } from '../player/VNextPlayerProfile'
import { VNextLms } from '../lms/VNextLms'
import { VNextChampionship } from '../championship/VNextChampionship'
import { VNextDiscovery } from '../discovery/VNextDiscovery'
import { VNextAccount } from '../account/VNextAccount'
import { VNextInvite } from '../invite/VNextInvite'
import { VNextOnboarding } from '../onboarding/VNextOnboarding'
import { VNextCreatePrivatePlay } from '../create/VNextCreatePrivatePlay'
import { VNextNotice } from '../states/VNextStates'
import {
  accountScenarios,
  championshipScenarios,
  discoveryScenarios,
  gamesScenarios,
  homeScenarios,
  inviteScenarios,
  leaguesScenarios,
  lmsScenarios,
  matchCentreScenarios,
  matchesScenarios,
  onboardingScenarios,
  playerProfileScenarios,
  predictorScenarios,
  shellScenarios,
} from '../fixtures'
import type { PredictorActions } from '../models/predictor'
import { DEFAULT_LMS_SETUP, type CreatePrivatePlayView } from '../models/createPrivatePlay'

/**
 * THE CANONICAL VISUAL CONTRACT — one real surface per frame, at the browser's
 * own width.
 *
 * ============================ WHY THESE ARE NOT WORKSHOP BOARDS =========
 *
 * Every other story in this lane renders inside `WorkshopCanvas`, which places
 * the surface in a device frame and scales the result so six widths can be
 * compared side by side. That is the right harness for a design review and the
 * wrong one for a screenshot artifact:
 *
 *   • a scaled frame photographs at a size no player's device has, so a
 *     reviewer comparing two runs is comparing two pictures of a picture;
 *   • a board is several compositions in one image, so a diff cannot say which
 *     of them moved;
 *   • and the frame, not the window, answers the container queries — which is
 *     correct for review and means the screenshot is not evidence about what a
 *     375px phone actually renders.
 *
 * These render ONE surface in ONE `VNextRoot` at `layout: 'fullscreen'`, so the
 * Playwright viewport is the composition's real width and the image is the
 * product at that size. `e2e/vnext-visual-contract.spec.ts` captures them.
 *
 * ============================ WHAT IS HERE, AND WHAT IS DELIBERATELY NOT =
 *
 * One world per surface, chosen to be the ORDINARY one rather than the
 * interesting one: a screenshot suite that photographed every edge case would
 * be the workshop again, and the thing worth noticing between two runs is that
 * the everyday product moved. Two exceptions earn their place — Leagues appears
 * twice because its season table and a private league table are two different
 * compositions with two different rank authorities, and one refusal state is
 * captured because "what this looks like when a read fails" is a design
 * question rather than an error path.
 *
 * ============================ AND THE THEME IS AN ARG ===================
 *
 * `?args=theme:light` selects the light ramp, so the same story provides both
 * without a second export per surface. `DEC-016` ships both and the contract
 * should photograph both for the surfaces that carry the most colour.
 */

type Args = { readonly theme: VNextThemeSetting }

const meta = {
  title: 'vNext/Visual contract',
  parameters: { layout: 'fullscreen' },
  argTypes: { theme: { control: 'inline-radio', options: ['dark', 'light'] } },
  args: { theme: 'dark' },
} satisfies Meta<Args>

export default meta

type Story = StoryObj<Args>

/** Inert. A screenshot suite must not be able to write anything. */
const INERT_PREDICTOR: PredictorActions = {
  setPrediction: () => {},
  clearPrediction: () => {},
  setJoker: () => {},
  confirmCard: () => {},
  retrySave: () => {},
  reload: () => {},
  refreshAfterDeadline: () => {},
}

function surface(node: (args: Args) => ReactNode): Story {
  return {
    render: (args) => (
      <VNextRoot theme={args.theme}>
        <VNextShellProvider model={shellScenarios.fourCompetitions}>
          {node(args)}
        </VNextShellProvider>
      </VNextRoot>
    ),
  }
}

export const Home: Story = surface(() => <VNextHome model={homeScenarios.decision} />)

export const MatchPredictor: Story = surface(() => (
  <VNextMatchPredictor model={predictorScenarios.open} actions={INERT_PREDICTOR} />
))

export const Matches: Story = surface(() => (
  <VNextMatches model={matchesScenarios.upcomingMatchweek} />
))

export const MatchCentre: Story = surface(() => (
  <VNextMatchCentre model={matchCentreScenarios.fullTime} />
))

export const Games: Story = surface(() => (
  <VNextGames model={gamesScenarios.allOpen} onIntent={() => {}} />
))

/** THE SEASON TABLE — one of the two rank authorities Stage 9 kept apart. */
export const LeaguesSeason: Story = surface(() => (
  <VNextLeagues model={leaguesScenarios.seasonTable} onIntent={() => {}} />
))

/** A PRIVATE LEAGUE — the other one, and a different composition. */
export const LeaguesPrivate: Story = surface(() => (
  <VNextLeagues model={leaguesScenarios.leagueSettled} onIntent={() => {}} />
))

export const PlayerProfile: Story = surface(() => (
  <VNextPlayerProfile model={playerProfileScenarios.openProfile} />
))

export const LastManStanding: Story = surface(() => (
  <VNextLms model={lmsScenarios.openRound} onIntent={() => {}} />
))

export const Championship: Story = surface(() => (
  <VNextChampionship model={championshipScenarios.drawnBracket} onIntent={() => {}} />
))

export const Discovery: Story = surface(() => (
  <VNextDiscovery model={discoveryScenarios.someFollowed} onIntent={() => {}} />
))

export const Account: Story = surface(() => (
  <VNextAccount
    model={accountScenarios.ordinary}
    onIntent={() => {}}
    actions={{
      setDisplayName: async () => ({ ok: true }),
      setPassword: async () => ({ ok: true }),
      setEmail: async () => ({ ok: true }),
      setReminderEmails: async () => ({ ok: true }),
    }}
  />
))

export const Invite: Story = surface(() => (
  <VNextInvite model={inviteScenarios.leagueOpen} onIntent={() => {}} />
))

export const Onboarding: Story = surface(() => (
  <VNextOnboarding view={onboardingScenarios.games} onIntent={() => {}} />
))

const CREATE: CreatePrivatePlayView = {
  kind: 'ready',
  model: {
    generatedAt: '2027-08-14T10:00:00.000Z',
    step: 'game',
    games: [
      {
        key: 'match-predictor',
        name: 'Match Predictor',
        description:
          'A table of your friends, ranked on the Match Predictor points you are already scoring.',
        hosts: [
          { id: 'gc-1', competitionName: 'Caledonian Premiership', seasonLabel: '2027/28' },
        ],
        refusal: null,
      },
      {
        key: 'last-man-standing',
        name: 'Last Man Standing',
        description:
          'Your own survival competition: everyone picks one club a round, and you set the rules.',
        hosts: [
          { id: 's-1', competitionName: 'Caledonian Premiership', seasonLabel: '2027/28' },
        ],
        refusal: null,
      },
      {
        key: 'championship',
        name: 'Predictor Championship',
        description:
          'Your own knockout-style championship: a head-to-head tie each matchweek, decided by Match Predictor points.',
        hosts: [
          { id: 's-1', competitionName: 'Caledonian Premiership', seasonLabel: '2027/28' },
        ],
        refusal: null,
      },
    ],
    chosen: null,
    host: null,
    name: '',
    joinCode: '',
    lms: DEFAULT_LMS_SETUP,
    commit: { kind: 'idle' },
    created: null,
    blocked: false,
  },
}

export const CreatePrivatePlay: Story = surface(() => (
  <VNextCreatePrivatePlay view={CREATE} onIntent={() => {}} />
))

/**
 * ONE REFUSAL, because what a failed read LOOKS like is a design question.
 *
 * It is a `VNextNotice` rather than a blank page, and the contract should show
 * that the shell survives it — the navigation, the competition and the way out
 * are all still there.
 */
export const ReadFailed: Story = surface(() => (
  <VNextNotice
    destination="leagues"
    heading="Leagues"
    title="We could not load this table"
    body="Your account is fine — this is our end. Nothing you have done is affected."
    onRetry={() => {}}
  />
))
