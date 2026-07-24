import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')

function hasGitWorkTree(): boolean {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })

  return !result.error && result.status === 0 && result.stdout.trim() === 'true'
}

function isIgnored(path: string): boolean {
  const result = spawnSync('git', ['check-ignore', '--quiet', '--no-index', path], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      `git check-ignore failed for ${path}: ${result.stderr || `exit ${result.status}`}`,
    )
  }

  return result.status === 0
}

const describeEnvironmentFileHygiene = hasGitWorkTree() ? describe : describe.skip

describeEnvironmentFileHygiene(
  'environment file hygiene (requires a Git work tree)',
  () => {
    it.each([
      '.env',
      '.env.local',
      '.env.development',
      '.env.production',
      '.env.test',
      '.env.deploy-preview',
      '.env.production.local',
    ])('ignores sensitive environment file %s', (path) => {
      expect(isIgnored(path)).toBe(true)
    })

    it('keeps the documented environment template committable', () => {
      expect(isIgnored('.env.example')).toBe(false)
    })
  },
)
