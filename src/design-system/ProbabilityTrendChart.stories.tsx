import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProbabilityTrendChart } from './ProbabilityTrendChart'

const meta = {
  title: 'Football Data/Probability Trend',
  component: ProbabilityTrendChart,
  args: {
    points: [
      { label: 'Mon', home: 0.54, draw: 0.25, away: 0.21 },
      { label: 'Wed', home: 0.58, draw: 0.24, away: 0.18 },
      { label: 'Fri', home: 0.62, draw: 0.22, away: 0.16 },
      { label: 'KO', home: 0.6, draw: 0.23, away: 0.17 },
    ],
  },
} satisfies Meta<typeof ProbabilityTrendChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
