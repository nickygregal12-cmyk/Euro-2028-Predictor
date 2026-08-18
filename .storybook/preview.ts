import type { Preview } from '@storybook/react-vite'
import '../src/styles/fonts.css'
import '../src/styles/flags.css'
import '../src/styles/tokens.css'
import '../src/index.css'

const preview: Preview = {
  // The a11y addon runs in Storybook's afterEach phase. Give entrance motion
  // time to reach its final, fully opaque state first so axe measures the UI a
  // user can read rather than an in-between animation frame.
  afterEach: async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 900))
  },
  parameters: {
    layout: 'centered',
    controls: { expanded: true },
    // The official addon runs axe whenever a story is visited. Clients that
    // execute Storybook tests must fail rather than merely annotate violations.
    a11y: {
      test: 'error',
      config: {
        rules: [
          // Workshop stories deliberately render multiple complete app frames
          // side by side. Their repeated header/main/nav landmarks belong to
          // separate simulated viewports, not one production document. Axe
          // cannot infer that boundary without real iframes, so only its three
          // document-wide landmark uniqueness rules are excluded here. All
          // per-element semantics and color contrast remain blocking.
          { id: 'landmark-no-duplicate-banner', enabled: false },
          { id: 'landmark-no-duplicate-main', enabled: false },
          { id: 'landmark-unique', enabled: false },
        ],
      },
    },
  },
}

export default preview
