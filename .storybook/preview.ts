import type { Preview } from '@storybook/react-vite'
import '../src/styles/fonts.css'
import '../src/styles/flags.css'
import '../src/styles/tokens.css'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: { expanded: true },
  },
}

export default preview
