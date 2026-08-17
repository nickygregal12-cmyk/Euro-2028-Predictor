import type { Meta, StoryObj } from '@storybook/react-vite'
import { PrimaryActionCard } from '../components/game/PrimaryActionCard'
import { PredictionChip } from '../components/game/PredictionChip'
import { RankMovementIndicator } from '../components/game/RankMovementIndicator'
import { StatTile } from '../components/game/StatTile'
import { formatNumber, formatOrdinal } from '../foundations/format'
import typography from '../foundations/typography.module.css'
import { MATCHDAY_NOW, workshopHomeModel } from '../fixtures'
import { vnextStory } from './vnextDecorator'
import styles from './Game.stories.module.css'

const meta = {
  title: 'vNext/Game/Primary action',
  component: PrimaryActionCard,
  decorators: [vnextStory()],
  args: {
    now: MATCHDAY_NOW,
    action: workshopHomeModel.primaryAction,
    onAct: () => {},
  },
} satisfies Meta<typeof PrimaryActionCard>

export default meta
type Story = StoryObj<typeof meta>

/** The matchday state: two predictions open, 38 minutes to the first lock. */
export const Urgent: Story = {}

export const Soon: Story = {
  args: {
    action: {
      ...workshopHomeModel.primaryAction,
      urgency: 'soon',
      title: '2 predictions to make',
      deadline: '2027-08-21T19:00:00.000Z',
    },
  },
}

/** Everything is in. The card stops shouting and changes job. */
export const NothingToDo: Story = {
  args: {
    action: {
      type: 'review',
      title: 'All five predictions are in',
      description: 'Two matches are live now. Points update as they play.',
      deadline: null,
      progress: { completed: 5, total: 5 },
      routePlaceholder: 'matchweek-4',
      urgency: 'calm',
    },
  },
}

/** Every prediction state the chip has to draw. */
export const PredictionStates: StoryObj = {
  render: () => (
    <div className={styles.column}>
      <PredictionChip prediction={null} />
      <PredictionChip
        prediction={{
          score: { home: 2, away: 0 },
          status: 'submitted',
          isJoker: false,
          outcome: null,
          points: null,
          pointsAreProvisional: false,
        }}
      />
      <PredictionChip
        prediction={{
          score: { home: 2, away: 1 },
          status: 'locked',
          isJoker: false,
          outcome: null,
          points: 6,
          pointsAreProvisional: true,
        }}
      />
      <PredictionChip
        prediction={{
          score: { home: 1, away: 2 },
          status: 'locked',
          isJoker: true,
          outcome: null,
          points: 0,
          pointsAreProvisional: true,
        }}
      />
      <PredictionChip
        prediction={{
          score: { home: 1, away: 2 },
          status: 'settled',
          isJoker: false,
          outcome: 'exact',
          points: 6,
          pointsAreProvisional: false,
        }}
      />
      <PredictionChip
        prediction={{
          score: { home: 0, away: 2 },
          status: 'settled',
          isJoker: false,
          outcome: 'result',
          points: 3,
          pointsAreProvisional: false,
        }}
      />
      <PredictionChip
        prediction={{
          score: { home: 3, away: 0 },
          status: 'settled',
          isJoker: false,
          outcome: 'missed',
          points: 0,
          pointsAreProvisional: false,
        }}
      />
    </div>
  ),
}

export const Stats: StoryObj = {
  render: () => {
    const performance = workshopHomeModel.recentPerformance
    return (
      <div className={styles.statGrid}>
        <StatTile
          label="Total points"
          value={formatNumber(performance.totalPoints)}
          meta={`${performance.pointsToday} banked today`}
        />
        {/* The gallery follows Home's own reading of a nullable standing rather
            than asserting the fixture's values, so a tile is shown here exactly
            as Home would draw it for an unranked player. */}
        <StatTile
          label="Overall rank"
          value={performance.rank === null ? 'Unranked' : formatOrdinal(performance.rank)}
          meta={
            performance.rankOutOf === null ? undefined : `of ${formatNumber(performance.rankOutOf)}`
          }
          trailing={
            performance.rankMovement === null ? undefined : (
              <RankMovementIndicator movement={performance.rankMovement} />
            )
          }
        />
        <StatTile
          label="On the pitch"
          value={performance.provisionalPoints}
          meta="Provisional, not awarded"
          tone="live"
          emphasise
        />
        <StatTile
          label="Exact scores"
          value={performance.accuracy.exact}
          meta={`of ${performance.accuracy.predicted} predicted`}
          tone="accent"
        />
      </div>
    )
  },
}

export const RankMovement: StoryObj = {
  render: () => (
    <div className={styles.column}>
      <span className={typography.caption}>
        Up <RankMovementIndicator movement={{ direction: 'up', places: 214 }} />
      </span>
      <span className={typography.caption}>
        Down <RankMovementIndicator movement={{ direction: 'down', places: 3 }} />
      </span>
      <span className={typography.caption}>
        Unchanged <RankMovementIndicator movement={{ direction: 'none', places: 0 }} />
      </span>
      <span className={typography.caption}>
        New <RankMovementIndicator movement={{ direction: 'new', places: 0 }} />
      </span>
    </div>
  ),
}
