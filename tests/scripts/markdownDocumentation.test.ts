import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const ignoredDirectories = new Set(['.git', 'dist', 'node_modules'])

function collectMarkdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : collectMarkdownFiles(entryPath)
    }

    return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : []
  })
}

function stripFencedCode(content: string): string {
  return content.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '')
}

function relativeFileTarget(rawTarget: string): string | null {
  let target = rawTarget.trim()

  if (target.startsWith('<') && target.endsWith('>')) {
    target = target.slice(1, -1)
  }

  target = target.match(/^\S+/)?.[0] ?? target

  if (
    !target ||
    target.startsWith('#') ||
    target.startsWith('/') ||
    target.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/i.test(target)
  ) {
    return null
  }

  const pathOnly = target.split('#', 1)[0]?.split('?', 1)[0]
  if (!pathOnly) {
    return null
  }

  try {
    return decodeURIComponent(pathOnly)
  } catch {
    return pathOnly
  }
}

describe('Markdown documentation integrity', () => {
  it('has no broken relative inline links', () => {
    const brokenLinks: string[] = []
    const markdownLink = /!?\[[^\]]*]\(([^)\n]+)\)/g

    for (const file of collectMarkdownFiles(repositoryRoot)) {
      const content = stripFencedCode(readFileSync(file, 'utf8'))

      for (const match of content.matchAll(markdownLink)) {
        const target = relativeFileTarget(match[1] ?? '')
        if (!target) {
          continue
        }

        const resolvedTarget = resolve(dirname(file), target)
        if (!existsSync(resolvedTarget)) {
          brokenLinks.push(
            `${relative(repositoryRoot, file)} -> ${target}`,
          )
        }
      }
    }

    expect(brokenLinks).toEqual([])
  })

  it('does not restore obsolete entry-test phase and batch references', () => {
    const testScript = readFileSync(resolve(repositoryRoot, 'docs/test-script.md'), 'utf8')
    const obsoleteReferences = [
      'Phase 2 exit gate',
      'UI/CRO audit follow-ups',
      'Batch A',
      'Batch B',
      'Batch C',
      'Fix before Phase 3',
    ]

    for (const reference of obsoleteReferences) {
      expect(testScript).not.toContain(reference)
    }
  })
})
