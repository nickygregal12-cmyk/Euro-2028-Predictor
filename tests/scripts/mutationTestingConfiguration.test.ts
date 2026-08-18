import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

describe('mutation testing assurance', () => {
  it('covers a bounded set of critical pure scoring authorities', () => {
    const config = read('stryker.config.mjs')

    expect(config).toContain('src/domain/tournament/calculateScore.ts')
    expect(config).toContain('src/domain/tournament/scoringConfig.ts')
    expect(config).toContain('src/domain/season/standings.ts')
    expect(config).toContain('inPlace: true')
    expect(config).toContain("disableTypeChecks: 'src/**/*.{ts,tsx}'")
    expect(config).toContain('break: 90')
  })

  it('blocks relevant pull requests instead of silently reporting failure', () => {
    const workflow = read('.github/workflows/mutation-testing.yml')

    expect(workflow).toContain('pull_request:')
    expect(workflow).toContain("- 'stryker.config.mjs'")
    expect(workflow).not.toContain('continue-on-error')
    expect(workflow).toContain('npm run test:mutation')
  })
})
