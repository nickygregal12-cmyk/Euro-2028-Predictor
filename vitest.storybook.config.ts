import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const repositoryRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    storybookTest({
      configDir: join(repositoryRoot, '.storybook'),
    }),
  ],
  test: {
    name: 'storybook',
    setupFiles: ['./.storybook/vitest.setup.ts'],
    browser: {
      enabled: true,
      provider: playwright({
        // Deterministic accessibility scans should not race system-dependent
        // entrance motion. Explicit full-motion stories still exercise that
        // path; the default production `system` path follows this preference.
        contextOptions: { reducedMotion: 'reduce' },
      }),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
})
