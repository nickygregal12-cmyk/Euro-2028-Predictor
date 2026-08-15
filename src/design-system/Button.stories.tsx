import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './Button'

const meta = {
  title: 'Design System/Button',
  component: Button,
  args: {
    children: 'Save prediction',
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {}

export const Secondary: Story = {
  args: { variant: 'secondary' },
}

export const Loading: Story = {
  args: { loading: true },
}

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Leave league' },
}
