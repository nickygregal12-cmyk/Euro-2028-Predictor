import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('Storybook accessibility integration', () => {
  it('loads the official addon at the same major as Storybook', () => {
    const manifest = JSON.parse(read('package.json')) as {
      devDependencies: Record<string, string>
    }
    const main = read('.storybook/main.ts')

    expect(manifest.devDependencies['@storybook/addon-a11y']).toBe('10.5.8')
    expect(main).toContain("'@storybook/addon-a11y'")
  })

  it('runs automatic axe checks and treats violations as errors in test-capable clients', () => {
    const preview = read('.storybook/preview.ts')

    expect(preview).toContain('a11y: {')
    expect(preview).toContain("test: 'error'")
  })

  it('turns stories into real browser tests rather than only building them', () => {
    const manifest = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>
      devDependencies: Record<string, string>
    }
    const config = read('vitest.storybook.config.ts')
    const setup = read('.storybook/vitest.setup.ts')

    expect(manifest.devDependencies['@storybook/addon-vitest']).toBe('10.5.8')
    expect(manifest.devDependencies['@vitest/browser-playwright']).toBe('4.1.10')
    expect(manifest.scripts['test:storybook']).toContain(
      '--config vitest.storybook.config.ts',
    )
    expect(config).toContain("from '@storybook/addon-vitest/vitest-plugin'")
    expect(config).toContain("from '@vitest/browser-playwright'")
    expect(config).toContain("browser: 'chromium'")
    expect(config).toContain("reducedMotion: 'reduce'")
    expect(setup).toContain("from '@storybook/addon-a11y/preview'")
  })

  it('waits for entrance motion while preserving blocking contrast checks', () => {
    const preview = read('.storybook/preview.ts')

    expect(preview).toContain('afterEach: async () =>')
    expect(preview).toContain('window.setTimeout(resolve, 900)')
    expect(preview).toContain("{ id: 'landmark-no-duplicate-banner', enabled: false }")
    expect(preview).toContain("{ id: 'landmark-no-duplicate-main', enabled: false }")
    expect(preview).toContain("{ id: 'landmark-unique', enabled: false }")
    expect(preview).not.toMatch(/id: ['"]color-contrast['"], enabled: false/)
  })

  it('installs Chromium and executes the story tests in CI', () => {
    const workflow = read('.github/workflows/storybook.yml')
    expect(workflow).toContain('npx playwright install --with-deps chromium')
    expect(workflow).toContain('npm run test:storybook')
    expect(workflow).toMatch(/step-security\/harden-runner@[0-9a-f]{40}/)
    for (const action of workflow.matchAll(/uses:\s*[^@\s]+@([^\s#]+)/g)) {
      expect(action[1]).toMatch(/^[0-9a-f]{40}$/)
    }
  })
})
