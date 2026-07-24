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

function stableIds(content: string): Set<string> {
  return new Set(content.match(/\b(?:FEAT|PLAN|SAFE)-\d{3}\b/g) ?? [])
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

  it('preserves feature-baseline identifier continuity', () => {
    const liveBaseline = readFileSync(
      resolve(repositoryRoot, 'docs/quality/feature-baseline.md'),
      'utf8',
    )
    const archivedBaseline = readFileSync(
      resolve(repositoryRoot, 'docs/quality/history/feature-baseline-2026-07-23R.md'),
      'utf8',
    )

    const expectedArchivedIds = new Set([
      ...Array.from({ length: 44 }, (_, index) => `FEAT-${String(index + 1).padStart(3, '0')}`),
      ...Array.from({ length: 8 }, (_, index) => `PLAN-${String(index + 1).padStart(3, '0')}`),
      ...Array.from({ length: 44 }, (_, index) => `SAFE-${String(index + 1).padStart(3, '0')}`),
    ])
    const archivedIds = stableIds(archivedBaseline)
    const liveIds = stableIds(liveBaseline)

    expect([...archivedIds].sort()).toEqual([...expectedArchivedIds].sort())
    expect([...archivedIds].filter((id) => !liveIds.has(id))).toEqual([])

    expect(liveBaseline).toContain('## Identifier continuity and archived dispositions')
    expect(liveBaseline).toContain('## New identifier register')
    expect(liveBaseline).not.toContain('`DOC-005`, open')

    const compactBaseline = liveBaseline.split(
      '## Identifier continuity and archived dispositions',
      1,
    )[0]
    const compactTableRows = compactBaseline
      .split('\n')
      .filter(
        (line) =>
          line.startsWith('| ') &&
          !line.startsWith('| ID |') &&
          !line.startsWith('| --- |'),
      )
    const primaryIds = compactTableRows.map(
      (line) => line.match(/^\| `((?:FEAT|PLAN|SAFE)-\d{3})` \|/)?.[1],
    )

    expect(compactTableRows).toHaveLength(59)
    expect(primaryIds.every(Boolean)).toBe(true)
    expect(new Set(primaryIds).size).toBe(primaryIds.length)

    const newIdentifierSection =
      liveBaseline
        .split('## New identifier register', 2)[1]
        ?.split('## Current route and data baseline', 1)[0] ?? ''
    const newIds = stableIds(newIdentifierSection)

    expect([...newIds].filter((id) => archivedIds.has(id))).toEqual([])
  })
})
