import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview'
import { setProjectAnnotations } from '@storybook/react-vite'
import { beforeAll } from 'vitest'
import * as projectAnnotations from './preview'

// The panel addon alone only displays findings. Applying its preview
// annotations to the transformed story tests is what makes `a11y.test = error`
// produce a failing CLI/CI result.
const annotations = setProjectAnnotations([
  a11yAddonAnnotations,
  projectAnnotations,
])

beforeAll(annotations.beforeAll)
