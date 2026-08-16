import type { Meta, StoryObj } from '@storybook/react-vite'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import { AppFrameProbe } from '../workshop/AppFrameProbe'
import { VNextNav, defaultNavItems } from '../components/navigation/VNextNav'
import { VNextRoot } from '../foundations/VNextRoot'
import typography from '../foundations/typography.module.css'
import { workshopHomeModel } from '../fixtures'
import styles from './Workshop.stories.module.css'

/**
 * The workshop's own surfaces — the canvas and the shared navigation.
 *
 * THE HOME REVIEW SURFACE IS `vNext/Home Concepts`, NOT THIS. Stage 2's
 * `WorkshopHomeSketch` used to live here and has been deleted: it was
 * explicitly disposable, and the three concepts replaced its purpose. What is
 * left is a probe for `AppFrame`'s four compositions, which
 * `e2e/vnext-workshop-layout.spec.ts` measures in a real browser because jsdom
 * evaluates no container query.
 *
 * The probe stories are tagged `!dev`, which keeps them out of the review
 * sidebar while leaving them addressable by the spec. A rig in the same list as
 * three designs is a rig that gets reviewed as a fourth design.
 */
const meta = {
  title: 'vNext/Workshop/App frame probe',
  component: WorkshopCanvas,
  parameters: { layout: 'fullscreen' },
  tags: ['!dev'],
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

const probe = <AppFrameProbe model={workshopHomeModel} />

/**
 * Every frame width at once. This is the story
 * `e2e/vnext-workshop-layout.spec.ts` opens, so its id
 * (`vnext-workshop-app-frame-probe--all-widths`) is part of that contract.
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
    children: probe,
  },
}

/** Navigation in both of its shapes, with the open-prediction badge. */
export const Navigation: StoryObj = {
  parameters: { layout: 'fullscreen' },
  tags: ['!dev'],
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
