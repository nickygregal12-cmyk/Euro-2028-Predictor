import type { Meta, StoryObj } from '@storybook/react-vite'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import { WorkshopHomeSketch } from '../workshop/WorkshopHomeSketch'
import { VNextNav, defaultNavItems } from '../components/navigation/VNextNav'
import { VNextRoot } from '../foundations/VNextRoot'
import typography from '../foundations/typography.module.css'
import { workshopHomeModel } from '../fixtures'
import styles from './Workshop.stories.module.css'

/**
 * The workshop itself.
 *
 * NOTHING HERE IS THE HOME SCREEN. The sketch is a rig for judging whether the
 * foundations, the model and the components hold together at each width. The
 * next stage builds three materially different Home concepts against exactly
 * this canvas, and one of those — not this — becomes Home.
 */
const meta = {
  title: 'vNext/Workshop/Responsive canvas',
  component: WorkshopCanvas,
  parameters: { layout: 'fullscreen' },
  args: {
    motion: 'system' as const,
  },
  argTypes: {
    motion: {
      control: 'inline-radio',
      options: ['system', 'full', 'reduced'],
    },
    viewports: {
      control: 'check',
      options: [
        'phone-375',
        'phone-430',
        'tablet-768',
        'laptop-1440',
        'desktop-1920',
      ],
    },
  },
} satisfies Meta<typeof WorkshopCanvas>

export default meta
type Story = StoryObj<typeof meta>

const sketch = <WorkshopHomeSketch model={workshopHomeModel} />

/** The smallest screen the product has to work on, at full size. */
export const Phone: Story = {
  args: { viewports: ['phone-375'], children: sketch },
}

/** Mobile and desktop side by side — the comparison the brief asks for. */
export const MobileAndDesktop: Story = {
  args: {
    viewports: ['phone-430', 'laptop-1440'],
    scale: 0.7,
    children: sketch,
  },
}

/**
 * Every target width at once. The frames are visually scaled only; container
 * queries still see the real widths, so each composition is the true one.
 */
export const AllWidths: Story = {
  args: {
    viewports: [
      'phone-375',
      'phone-430',
      'tablet-768',
      'laptop-1440',
      'desktop-1920',
    ],
    scale: 0.36,
    children: sketch,
  },
}

/** The reduced-motion path, at the two widths that matter most. */
export const ReducedMotion: Story = {
  args: {
    viewports: ['phone-430', 'laptop-1440'],
    scale: 0.7,
    motion: 'reduced',
    children: sketch,
  },
}

/** Navigation in both of its shapes, with the open-prediction badge. */
export const Navigation: StoryObj = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <VNextRoot>
      <div className={styles.navBoard}>
        <div className={styles.navSample}>
          <p className={typography.label}>Bottom bar (compact)</p>
          <div className={styles.barWidth}>
            <VNextNav
              variant="bar"
              activeId="home"
              items={defaultNavItems.map((item) =>
                item.id === 'fixtures' ? { ...item, badge: 2 } : item,
              )}
            />
          </div>
        </div>
        <div className={styles.navSample}>
          <p className={typography.label}>Side rail (expanded)</p>
          <div className={styles.railWidth}>
            <VNextNav
              variant="rail"
              activeId="leagues"
              items={defaultNavItems.map((item) =>
                item.id === 'fixtures' ? { ...item, badge: 2 } : item,
              )}
            />
          </div>
        </div>
      </div>
    </VNextRoot>
  ),
}
