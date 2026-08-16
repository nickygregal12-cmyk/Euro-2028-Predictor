import type { StoryObj } from '@storybook/react-vite'
import { VNextNav, defaultNavItems } from '../components/navigation/VNextNav'
import { VNextRoot } from '../foundations/VNextRoot'
import typography from '../foundations/typography.module.css'
import styles from './Workshop.stories.module.css'

/**
 * The shared navigation, in both of the shapes Home uses.
 *
 * WHAT USED TO BE HERE. Stage 2's `WorkshopHomeSketch` and then Stage 3's
 * `AppFrameProbe` — a rig that populated `AppFrame`'s four regions so the frame
 * had something to measure in a browser. Both are gone, and so is `AppFrame`.
 * Stage 3 found that all three Home concepts wrote their own shell rather than
 * bending to the frame; Stage 4's Home did the same, which made it four
 * compositions out of four declining it. A layout primitive nothing chooses,
 * kept alive by a probe that exists to test it, is dead architecture, and the
 * browser measurement it was carrying now runs against the real Home in
 * `e2e/vnext-home.spec.ts` — which is a more useful thing to measure anyway.
 *
 * The navigation survived that clear-out because Home uses it. It is the one
 * piece of chrome shared across vNext surfaces, so it is worth reviewing on its
 * own, at the width each shape is actually used at.
 */
export default {
  title: 'vNext/Workshop/Navigation',
  parameters: { layout: 'fullscreen' },
}

const withBadge = defaultNavItems.map((item) =>
  item.id === 'fixtures' ? { ...item, badge: 2 } : item,
)

/** Both shapes, with the open-prediction badge on Fixtures. */
export const Shapes: StoryObj = {
  render: () => (
    <VNextRoot>
      <div className={styles.navBoard}>
        <div className={styles.navSample}>
          <p className={typography.label}>Bottom bar — compact</p>
          <div className={styles.barWidth}>
            <VNextNav variant="bar" activeId="home" items={withBadge} />
          </div>
        </div>
        <div className={styles.navSample}>
          <p className={typography.label}>Masthead band — expanded</p>
          <div className={styles.bandWidth}>
            <VNextNav variant="band" activeId="leagues" items={withBadge} />
          </div>
        </div>
      </div>
    </VNextRoot>
  ),
}

/** The reduced-motion path: the marker appears rather than travelling. */
export const ShapesReducedMotion: StoryObj = {
  render: () => (
    <VNextRoot motion="reduced">
      <div className={styles.navBoard}>
        <div className={styles.navSample}>
          <p className={typography.label}>Bottom bar — reduced motion</p>
          <div className={styles.barWidth}>
            <VNextNav variant="bar" activeId="home" items={withBadge} />
          </div>
        </div>
      </div>
    </VNextRoot>
  ),
}
