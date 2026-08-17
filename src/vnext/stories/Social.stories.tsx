import type { Meta, StoryObj } from '@storybook/react-vite'
import { LeagueLadder } from '../components/social/LeagueLadder'
import { ConsensusBar } from '../components/social/ConsensusBar'
import { RivalStrip } from '../components/social/RivalStrip'
import typography from '../foundations/typography.module.css'
import {
  againstTheCrowdMatch,
  featuredLiveMatch,
  workshopHomeModel,
} from '../fixtures'
import { vnextStory } from './vnextDecorator'
import styles from './Social.stories.module.css'

const [workshopLeague, workshopSecondLeague] = workshopHomeModel.privateLeagues
if (workshopLeague === undefined || workshopSecondLeague === undefined) {
  throw new Error('workshopHomeModel.privateLeagues must have at least two entries')
}

/**
 * The social half of the game: where the user sits, who is next to them, and
 * whether the crowd agrees. These are first-class surfaces in vNext rather than
 * a secondary card, which is what these stories exist to make reviewable.
 */
const meta = {
  title: 'vNext/Social/League ladder',
  component: LeagueLadder,
  decorators: [vnextStory()],
  args: {
    league: workshopLeague,
    onOpen: () => {},
  },
} satisfies Meta<typeof LeagueLadder>

export default meta
type Story = StoryObj<typeof meta>

/** Second, two behind Jamie, up two places. The shape from the brief. */
export const ChasingTheLeader: Story = {}

/** Leading, with a deliberately long league name to squeeze the header. */
export const LeadingWithLongName: Story = {
  args: { league: workshopSecondLeague },
}

export const Rivals: StoryObj = {
  render: () => <RivalStrip rivals={workshopHomeModel.rivals} />,
}

/**
 * Consensus in its two interesting shapes: one where the user is with the
 * crowd, and one where 76% went the other way.
 */
export const Consensus: StoryObj = {
  render: () => (
    <div className={styles.column}>
      <h3 className={typography.label}>User agrees with a popular score</h3>
      {featuredLiveMatch.consensus ? (
        <ConsensusBar
          group={featuredLiveMatch.consensus.community}
          homeName={featuredLiveMatch.home.team.shortName}
          awayName={featuredLiveMatch.away.team.shortName}
          userScore={featuredLiveMatch.prediction?.score ?? null}
        />
      ) : null}

      <h3 className={typography.label}>User is against the crowd</h3>
      {againstTheCrowdMatch.consensus ? (
        <ConsensusBar
          group={againstTheCrowdMatch.consensus.community}
          homeName={againstTheCrowdMatch.home.team.shortName}
          awayName={againstTheCrowdMatch.away.team.shortName}
          userScore={againstTheCrowdMatch.prediction?.score ?? null}
        />
      ) : null}

      <h3 className={typography.label}>Friends only, smaller sample</h3>
      {againstTheCrowdMatch.consensus?.friends ? (
        <ConsensusBar
          group={againstTheCrowdMatch.consensus.friends}
          homeName={againstTheCrowdMatch.home.team.shortName}
          awayName={againstTheCrowdMatch.away.team.shortName}
          userScore={againstTheCrowdMatch.prediction?.score ?? null}
        />
      ) : null}
    </div>
  ),
}
