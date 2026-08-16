import type { Meta, StoryObj } from '@storybook/react-vite'
import { MatchCard } from '../components/football/MatchCard'
import { FormRun } from '../components/football/FormRun'
import { TeamCrest } from '../components/football/TeamCrest'
import typography from '../foundations/typography.module.css'
import {
  MATCHDAY_NOW,
  againstTheCrowdMatch,
  deadlineMatch,
  featuredLiveMatch,
  halfTimeLiveMatch,
  postponedMatch,
  settledMatch,
  workshopTeamList,
} from '../fixtures'
import { vnextStory } from './vnextDecorator'
import styles from './Football.stories.module.css'

/**
 * Football states, from the one deterministic workshop matchday. Every story
 * below is a real state the interface has to survive, not a mock-up of one.
 */
const meta = {
  title: 'vNext/Football/Match card',
  component: MatchCard,
  decorators: [vnextStory()],
  args: {
    now: MATCHDAY_NOW,
  },
} satisfies Meta<typeof MatchCard>

export default meta
type Story = StoryObj<typeof meta>

/** Live, featured, and the user's 2–1 is exactly right at this moment. */
export const LiveFeatured: Story = {
  args: {
    match: featuredLiveMatch,
    variant: 'feature',
    showContext: true,
    onAction: () => {},
  },
}

/** Live, at half-time, with a joker on the wrong scoreline. */
export const LiveHalfTime: Story = {
  args: { match: halfTimeLiveMatch, showContext: true },
}

/** The state the whole surface should be pushing at: 38 minutes, no prediction. */
export const UpcomingNeedsPrediction: Story = {
  args: { match: deadlineMatch, showContext: true, onAction: () => {} },
}

/** 76% of everyone went the other way. The user's call is marked in the list. */
export const UpcomingAgainstTheCrowd: Story = {
  args: { match: againstTheCrowdMatch, showContext: true },
}

/** Settled, exact score, six points. */
export const Settled: Story = {
  args: { match: settledMatch, showContext: true, onAction: () => {} },
}

/** The dense form the rails use: no context block, no action. */
export const Compact: Story = {
  args: { match: deadlineMatch },
}

/**
 * Postponed. The clubs and their context stay; the kick-off and the prediction
 * action go, because both would claim a fixture that is not happening. `onAction`
 * is passed deliberately — the card refuses it rather than the story hiding it.
 */
export const Postponed: Story = {
  args: { match: postponedMatch, showContext: true, onAction: () => {} },
}

/**
 * Every club identity at every size, including the patterned kits and the one
 * club whose primary colour needs dark text on it.
 */
export const TeamIdentity: StoryObj = {
  render: () => (
    <div className={styles.identityGrid}>
      {workshopTeamList.map((team) => (
        <div key={team.id} className={styles.identityRow}>
          <TeamCrest team={team} size="lg" />
          <TeamCrest team={team} size="md" decorative />
          <TeamCrest team={team} size="sm" decorative />
          <div className={styles.identityMeta}>
            <span className={`${typography.body} ${typography.clamp2}`}>
              {team.name}
            </span>
            <span className={typography.micro}>
              {team.kitPattern} · text {team.colours.onPrimary}
            </span>
          </div>
        </div>
      ))}
    </div>
  ),
}

/** Form runs, including a promoted side with only three results to show. */
export const Form: StoryObj = {
  render: () => (
    <div className={styles.formGrid}>
      <FormRun form={['win', 'win', 'draw', 'loss', 'win']} teamName="Glenmore Athletic" />
      <FormRun form={['loss', 'loss', 'draw']} teamName="Newly promoted side" />
      <FormRun form={['win', 'win', 'win', 'win', 'win']} teamName="Porthaven City" />
    </div>
  ),
}
