import type { Decorator } from '@storybook/react-vite'
import { VNextRoot } from '../foundations/VNextRoot'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import styles from './vnextDecorator.module.css'

/**
 * Puts a story inside the vNext lane.
 *
 * Every vNext story needs a `VNextRoot`, because that element is where the
 * tokens are declared — a component rendered outside one has no colours at all.
 * The decorator also gives the story a padded board at a readable measure, so
 * component stories are judged on the component rather than on how the story
 * happened to be sized.
 *
 * `motion` reads from the story's `globals`-free args by way of the `motion`
 * parameter, so a story can show the reduced path without a global switch.
 */
export function vnextStory(motion: VNextMotionSetting = 'system'): Decorator {
  return function VNextStoryDecorator(Story) {
    return (
      <VNextRoot motion={motion}>
        <div className={styles.board}>
          <Story />
        </div>
      </VNextRoot>
    )
  }
}
