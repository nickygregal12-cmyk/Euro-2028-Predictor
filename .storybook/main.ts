import type { StorybookConfig } from '@storybook/react-vite'

const APP_ONLY_VITE_PLUGINS = new Set([
  'euro28-site-metadata',
  'euro28-release-metadata',
  // Derives the `/join/:code` document from the built `index.html`. Storybook
  // builds `iframe.html` and never an `index.html`, so the plugin's own guard —
  // which is right to fail loudly for the application — fails every workbench
  // build instead.
  'euro28-invite-document',
])

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {},
  viteFinal(viteConfig) {
    // Storybook intentionally reuses the application's Vite config. The two
    // plugins below are app-document concerns: one requires the generated
    // SITE METADATA sentinel in index.html and the other emits release.json.
    // Storybook builds iframe.html instead, so carrying either plugin into the
    // component workbench is both unnecessary and (for site metadata) invalid.
    viteConfig.plugins = viteConfig.plugins?.filter(
      (plugin) => !isAppOnlyVitePlugin(plugin),
    )
    return viteConfig
  },
}

function isAppOnlyVitePlugin(plugin: unknown): boolean {
  if (typeof plugin !== 'object' || plugin === null || !('name' in plugin)) {
    return false
  }

  const name = (plugin as { name?: unknown }).name
  return typeof name === 'string' && APP_ONLY_VITE_PLUGINS.has(name)
}

export default config
