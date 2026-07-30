import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every committed TypeScript source belongs to a compiler project.
 *
 * `tsc -b` checks the projects the root config references and nothing else, so
 * a directory that no project includes is not "passing" — it is unexamined, and
 * it looks identical to passing from CI. That gap has now been found three
 * separate times:
 *
 *   - `tests/` (170 files) was outside every project until PR #255, which
 *     surfaced sixteen errors including two assertions that could never fail;
 *   - `e2e/` and `scripts/**` followed in PR #258;
 *   - `production-smoke/` — the spec that asserts production is not pointed at
 *     the development Supabase project — was still uncovered after both.
 *
 * Each was found by hand. This test is what makes the next one fail instead.
 *
 * It works from `git ls-files`, so a new directory of TypeScript is caught the
 * moment it is committed, not when someone thinks to look.
 */

const repositoryRoot = process.cwd()

/** Roots covered by the four referenced projects, as declared in their `include`. */
const COVERED_PREFIXES = [
  'src/',
  'tests/',
  'e2e/',
  'production-smoke/',
  'scripts/',
] as const

/** Individually-named root files. */
const COVERED_FILES = [
  'vite.config.ts',
  'playwright.config.ts',
  'playwright.auth.config.ts',
  'playwright.production.config.ts',
] as const

function committedTypeScriptSources(): string[] {
  return execFileSync('git', ['ls-files', '*.ts', '*.tsx'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
}

function projectReferences(): string[] {
  const root = JSON.parse(readFileSync(resolve(repositoryRoot, 'tsconfig.json'), 'utf8')) as {
    references: { path: string }[]
  }
  return root.references.map((reference) => reference.path)
}

/**
 * `tsconfig.*.json` files carry both `//` and block comments, so they are not
 * plain JSON.
 *
 * Stripping them with a regex gets this wrong in a way that is easy to miss:
 * `tsconfig.tools.json` includes the glob `"scripts/**` + `/*.ts"`, whose `/*`
 * sits inside a string. A naive block-comment pattern starts a comment there
 * and swallows the rest of the include list. So the scanner tracks string state
 * and only treats a delimiter as a comment when it is outside one.
 */
function stripJsonComments(source: string): string {
  let output = ''
  let inString = false
  let inLine = false
  let inBlock = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]

    if (inLine) {
      if (character === '\n') {
        inLine = false
        output += character
      }
      continue
    }
    if (inBlock) {
      if (character === '*' && next === '/') {
        inBlock = false
        index += 1
      }
      continue
    }
    if (inString) {
      if (character === '\\') {
        output += character + (next ?? '')
        index += 1
        continue
      }
      if (character === '"') inString = false
      output += character
      continue
    }
    if (character === '"') {
      inString = true
      output += character
      continue
    }
    if (character === '/' && next === '/') {
      inLine = true
      index += 1
      continue
    }
    if (character === '/' && next === '*') {
      inBlock = true
      index += 1
      continue
    }
    output += character
  }

  return output
}

function readProjectConfig(file: string): {
  extends?: string
  compilerOptions?: Record<string, unknown>
} {
  const source = stripJsonComments(readFileSync(resolve(repositoryRoot, file), 'utf8'))
  return JSON.parse(source) as {
    extends?: string
    compilerOptions?: Record<string, unknown>
  }
}

const sources = committedTypeScriptSources()

describe('TypeScript project coverage', () => {
  it('reads a plausible number of sources at all', () => {
    // Without this, a `git ls-files` that returned nothing would make the
    // coverage assertion below pass while checking no files.
    expect(sources.length).toBeGreaterThan(400)
  })

  it('assigns every committed TypeScript source to a project', () => {
    const uncovered = sources
      .filter(
        (file) =>
          !COVERED_PREFIXES.some((prefix) => file.startsWith(prefix)) &&
          !(COVERED_FILES as readonly string[]).includes(file),
      )
      .sort()

    expect(uncovered).toEqual([])
  })

  it('references all four projects from the root config', () => {
    // The prefixes above are only true because these projects are built. A
    // reference removed here would silently un-cover a whole tree.
    expect(projectReferences().sort()).toEqual([
      './tsconfig.app.json',
      './tsconfig.node.json',
      './tsconfig.test.json',
      './tsconfig.tools.json',
    ])
  })
})

describe('TypeScript strictness', () => {
  it('states strict rather than inheriting it', () => {
    // TypeScript 6 enables `strict` by default, so these declarations change
    // nothing today. They exist so the guarantee belongs to the repository
    // instead of to the pinned compiler major: without them, a compiler
    // upgrade that changed the default, or a downgrade to TypeScript 5, would
    // switch off strictNullChecks and noImplicitAny with nothing failing.
    for (const project of ['tsconfig.app.json', 'tsconfig.node.json']) {
      expect(readProjectConfig(project).compilerOptions?.strict).toBe(true)
    }
  })

  it('keeps the derived projects extending the strict base', () => {
    // `tsconfig.test.json` and `tsconfig.tools.json` carry no `strict` of their
    // own; they must keep extending the app project or they lose it.
    for (const project of ['tsconfig.test.json', 'tsconfig.tools.json']) {
      const config = readProjectConfig(project)
      expect(config.extends).toBe('./tsconfig.app.json')
      expect(config.compilerOptions?.strict).toBeUndefined()
    }
  })
})
