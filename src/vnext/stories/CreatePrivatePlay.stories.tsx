import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import { VNextCreatePrivatePlay, type CreateIntent } from '../create/VNextCreatePrivatePlay'
import { shellScenarios } from '../fixtures'
import {
  DEFAULT_LMS_SETUP,
  type CreateGameOption,
  type CreatePrivatePlayModel,
  type CreatePrivatePlayView,
} from '../models/createPrivatePlay'

/**
 * CREATE PRIVATE PLAY — the reviewable vNext corridor.
 *
 * The stories are literals: nothing here creates a competition. They protect
 * the peer game choice, setup, read-only review, refusal, and verified handover
 * states at phone and desktop widths.
 */
const meta = {
  title: 'vNext/Create private play',
  component: WorkshopCanvas,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof WorkshopCanvas>

export default meta

type Story = StoryObj

const HOSTS = [
  { id: 'gc-1', competitionName: 'Caledonian Premiership', seasonLabel: '2027/28' },
  { id: 'gc-2', competitionName: 'Northern League', seasonLabel: '2027/28' },
] as const

const PREDICTOR: CreateGameOption = {
  key: 'match-predictor',
  name: 'Match Predictor',
  description:
    'A table of your friends, ranked on the Match Predictor points you are already scoring.',
  hosts: HOSTS,
  refusal: null,
}

const LMS: CreateGameOption = {
  key: 'last-man-standing',
  name: 'Last Man Standing',
  description:
    'Your own survival competition: everyone picks one club a round, and you set the rules.',
  hosts: HOSTS,
  refusal: null,
}

const CHAMPIONSHIP: CreateGameOption = {
  key: 'championship',
  name: 'Predictor Championship',
  description:
    'Your own knockout-style championship: a head-to-head tie each matchweek, decided by Match Predictor points.',
  hosts: HOSTS,
  refusal: null,
}

const BASE: CreatePrivatePlayModel = {
  generatedAt: '2027-08-14T10:00:00.000Z',
  step: 'game',
  games: [PREDICTOR, LMS, CHAMPIONSHIP],
  chosen: null,
  host: null,
  name: '',
  joinCode: '',
  lms: DEFAULT_LMS_SETUP,
  commit: { kind: 'idle' },
  created: null,
  blocked: false,
}

function world(over: Partial<CreatePrivatePlayModel>): CreatePrivatePlayView {
  return { kind: 'ready', model: { ...BASE, ...over } }
}

function Harness({ view }: { readonly view: CreatePrivatePlayView }) {
  const [last, setLast] = useState('')
  return (
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <div data-vnext-create-host="" data-vnext-last-intent={last}>
        <VNextCreatePrivatePlay
          view={view}
          onIntent={(intent: CreateIntent) => setLast(intent.kind)}
        />
      </div>
    </VNextShellProvider>
  )
}

function board(view: CreatePrivatePlayView, widths: readonly string[], scale = 1): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale}>
        <Harness view={view} />
      </WorkshopCanvas>
    ),
  }
}

const PHONE_AND_DESKTOP = ['phone-375', 'laptop-1440'] as const

export const ChooseGame: Story = board(world({}), PHONE_AND_DESKTOP, 0.8)

export const NothingToBuildOn: Story = board(
  world({
    blocked: true,
    games: [
      {
        ...PREDICTOR,
        hosts: [],
        refusal:
          'Join Match Predictor in a competition first — a private league ranks the points you score there.',
      },
      {
        ...LMS,
        hosts: [],
        refusal:
          'No competition season is open to build one on. One will appear here as soon as a league season is published.',
      },
      {
        ...CHAMPIONSHIP,
        hosts: [],
        refusal:
          'No competition season is open to build one on. One will appear here as soon as a league season is published.',
      },
    ],
  }),
  PHONE_AND_DESKTOP,
  0.8,
)

export const LmsSetup: Story = board(
  world({ step: 'setup', chosen: LMS, host: HOSTS[0], name: 'The Sunday Club' }),
  PHONE_AND_DESKTOP,
  0.8,
)

export const LmsReview: Story = board(
  world({
    step: 'review',
    chosen: LMS,
    host: HOSTS[0],
    name: 'The Sunday Club',
    lms: { ...DEFAULT_LMS_SETUP, lives: 2, saves: 1, drawsRule: 'survive' },
  }),
  PHONE_AND_DESKTOP,
  0.8,
)

export const ChampionshipSetup: Story = board(
  world({ step: 'setup', chosen: CHAMPIONSHIP, host: HOSTS[0], name: 'Office Cup' }),
  PHONE_AND_DESKTOP,
  0.8,
)

export const ChampionshipReview: Story = board(
  world({ step: 'review', chosen: CHAMPIONSHIP, host: HOSTS[0], name: 'Office Cup' }),
  PHONE_AND_DESKTOP,
  0.8,
)

export const Refused: Story = board(
  world({
    step: 'review',
    chosen: PREDICTOR,
    host: HOSTS[0],
    name: 'The Sunday Club',
    commit: { kind: 'failed', message: 'That name is already taken in this competition.' },
  }),
  PHONE_AND_DESKTOP,
  0.8,
)

export const Created: Story = board(
  world({
    step: 'created',
    created: {
      containerId: 'league-verified-1',
      game: 'match-predictor',
      name: 'The Sunday Club',
      competitionName: 'Caledonian Premiership',
      inviteCode: 'SUN4KD',
      shareUrl: 'https://example.test/join/SUN4KD',
      awaitsLaunch: false,
    },
  }),
  PHONE_AND_DESKTOP,
  0.8,
)

export const CreatedChampionship: Story = board(
  world({
    step: 'created',
    created: {
      containerId: 'championship-verified-1',
      game: 'championship',
      name: 'Office Cup',
      competitionName: 'Caledonian Premiership',
      inviteCode: 'CUP7RM',
      shareUrl: 'https://example.test/join/CUP7RM',
      awaitsLaunch: true,
    },
  }),
  PHONE_AND_DESKTOP,
  0.8,
)
