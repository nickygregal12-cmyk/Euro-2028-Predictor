import base from './playwright.vnext.config'
import { defineConfig } from '@playwright/test'
export default defineConfig({
  ...base,
  projects: [
    {
      name: 'vnext-local',
      use: {
        ...(base.projects?.[0]?.use ?? {}),
        launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
      },
    },
  ],
})
