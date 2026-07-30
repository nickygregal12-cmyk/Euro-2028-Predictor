import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The domain layer laws, which until now existed only as prose.
 *
 * `CLAUDE.md` states two hard architectural rules:
 *
 *   > The shared domain may not import tournament/season implementations;
 *   > tournament and season implementations may not import each other.
 *
 *   > Domain code is pure: no storage, network or ambient clock reads; time is
 *   > an input.
 *
 * Nothing enforced either. Both are currently true, which is precisely why this
 * is worth pinning now — a boundary is cheap to hold and expensive to recover,
 * and the first violation of an unenforced rule is silent.
 *
 * This is a static guard: it reads the source rather than importing it, because
 * an import graph violation is a property of the text, and a runtime test would
 * only observe it after the coupling already existed.
 *
 * Note on `import type`. Four files under `tournament/` type-import from
 * `src/services/`. Those are erased at compile time, so they create no runtime
 * dependency and are not purity violations — but they are coupling, and the
 * distinction between a type import and a value import is one word. They are
 * enumerated below so the set cannot grow silently and so a value import cannot
 * arrive disguised as one.
 *
 * The design system is different: it is a presentation layer and may depend on
 * domain-owned identity tokens, but domain may never import it — not even for a
 * type. This keeps the dependency direction design-system → domain and prevents
 * a UI type from becoming the shared model by accident.
 */

const repositoryRoot = process.cwd()
const domainRoot = resolve(repositoryRoot, 'src/domain')

type SourceFile = { path: string; area: string; source: string }

/** Every non-test TypeScript file under `src/domain`, tagged with its area. */
function domainSources(): SourceFile[] {
  const files: SourceFile[] = []

  for (const area of readdirSync(domainRoot)) {
    const areaPath = resolve(domainRoot, area)
    if (!statSync(areaPath).isDirectory()) continue

    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory)) {
        const path = resolve(directory, entry)
        if (statSync(path).isDirectory()) {
          walk(path)
          continue
        }
        if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue
        if (entry.includes('.test.')) continue
        files.push({ path: `src/domain/${area}/${entry}`, area, source: readFileSync(path, 'utf8') })
      }
    }

    walk(areaPath)
  }

  return files
}

const sources = domainSources()

/** Every module specifier a file imports from, value or type. */
function importsOf(file: SourceFile): string[] {
  return [...file.source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1])
}

/**
 * Source with comments blanked, preserving line numbers.
 *
 * Necessary rather than tidy. `resolveCompetitionStatus.ts` documents its own
 * rule with the line `/** Server time. Never `new Date()` inside this module.`,
 * and a prefix-based filter reported that comment as the very violation it
 * forbids. Documentation must not be able to fail the assertion it describes —
 * the same hazard `accountDeletionSemantics` and `enumUnionParity` both hit,
 * where a migration's own prose parsed as DDL.
 *
 * Lines are blanked rather than removed so reported line numbers stay true to
 * the file.
 */
function withoutComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (block) =>
    block.replace(/[^\n]/g, ' '),
  )
  return withoutBlocks
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

/** Whether a given import statement is type-only, and therefore erased. */
function isTypeOnlyImport(source: string, specifier: string): boolean {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const statement = new RegExp(`import\\s+(type\\s+)?[^;]*?from\\s+'${escaped}'`, 's')
  const match = statement.exec(source)
  if (!match) return false
  // `import type { X } from` and `import { type X } from` are both erased.
  return Boolean(match[1]) || /\{\s*type\s/.test(match[0])
}

describe('the domain layer exists at all', () => {
  it('finds domain sources, so the assertions below are not vacuous', () => {
    // Without this, a renamed directory would empty the file list and every
    // boundary assertion would pass by finding nothing to check.
    expect(sources.length).toBeGreaterThan(20)
    expect(new Set(sources.map((file) => file.area)).size).toBeGreaterThanOrEqual(3)
  })
})

describe('the shared competition layer depends on nothing above it', () => {
  it('imports no implementation area, service, feature or design system', () => {
    // `src/domain/competition/` is the shared authority under ADR 0011. If it
    // ever imports an implementation, the dependency inverts: the thing that is
    // supposed to be common to tournament and season starts knowing about one
    // of them, and the next competition kind inherits that assumption.
    const forbidden = [
      'tournament',
      'season',
      'competitions',
      'services',
      'features',
      'design-system',
    ]

    for (const file of sources.filter((candidate) => candidate.area === 'competition')) {
      for (const specifier of importsOf(file)) {
        for (const area of forbidden) {
          expect(
            specifier.includes(`/${area}/`) || specifier.startsWith(`../${area}`),
            `${file.path} imports '${specifier}' — the shared layer must not depend on ${area}`,
          ).toBe(false)
        }
      }
    }
  })
})

describe('implementation areas do not import each other', () => {
  it('keeps tournament and season independent', () => {
    // Neither may reach into the other. `season/` does not exist yet, so today
    // this holds trivially in one direction — which is the point of writing it
    // now. The rule is cheaper to state before the code arrives than to
    // retrofit after the first shortcut.
    const pairs = [
      ['tournament', 'season'],
      ['season', 'tournament'],
    ] as const

    for (const [from, to] of pairs) {
      for (const file of sources.filter((candidate) => candidate.area === from)) {
        for (const specifier of importsOf(file)) {
          expect(
            specifier.includes(`/${to}/`) || specifier.startsWith(`../${to}`),
            `${file.path} imports '${specifier}' — ${from} and ${to} must stay independent`,
          ).toBe(false)
        }
      }
    }
  })
})

describe('domain code takes its dependencies as inputs', () => {
  it('never imports from the design system, including type-only imports', () => {
    const offenders = sources.flatMap((file) =>
      importsOf(file)
        .filter((specifier) => /(^|\/)design-system\//.test(specifier))
        .map((specifier) => `${file.path} → ${specifier}`),
    )

    expect(
      offenders,
      'domain owns reusable data/types; the design system may depend on domain, never the reverse',
    ).toEqual([])
  })

  it('never imports a value from services or features', () => {
    // The purity rule that actually bites. A type import is erased; a value
    // import pulls a configured Supabase client into a module that is supposed
    // to be a pure function of its arguments — and the two differ by one word.
    const offenders: string[] = []

    for (const file of sources) {
      for (const specifier of importsOf(file)) {
        const reachesOut = /(^|\/)(services|features)\//.test(specifier)
        if (!reachesOut) continue
        if (isTypeOnlyImport(file.source, specifier)) continue
        offenders.push(`${file.path} → ${specifier}`)
      }
    }

    expect(offenders, 'domain code must not import a runtime value from services or features').toEqual([])
  })

  it('pins the type-only reaches into services so the set cannot grow quietly', () => {
    // These are erased at compile time and are not purity violations, but they
    // couple domain types to the service layer's shape. Pinned rather than
    // removed: unpicking them is a refactor with its own review, and an
    // unpinned exception list is how the exception becomes the rule.
    const typeOnly = sources
      .flatMap((file) =>
        importsOf(file)
          .filter((specifier) => /(^|\/)(services|features)\//.test(specifier))
          .filter((specifier) => isTypeOnlyImport(file.source, specifier))
          .map(() => file.path),
      )
      .sort()

    expect(typeOnly).toEqual([
      'src/domain/tournament/authoritativeMatchResult.ts',
      'src/domain/tournament/finalStandings.ts',
      'src/domain/tournament/matchCentrePageModel.ts',
      'src/domain/tournament/matchCentreRepositoryAdapter.ts',
    ])
  })

  it('pins every ambient clock read, because time is meant to be an input', () => {
    // All three are *defaulted* — `now` remains injectable, so tests can still
    // drive a fake clock. That is why they are pinned rather than failed: the
    // rule as written in CLAUDE.md forbids them outright, the code treats a
    // default as acceptable, and quietly picking a side in a test would settle
    // an architectural question that belongs to the owner.
    //
    // What the pin does buy: a *new* ambient read cannot appear unnoticed, and
    // an undefaulted one — where `now` is not injectable at all — would show up
    // here as a new entry rather than as a flaky test six months later.
    const reads = sources
      .flatMap((file) =>
        withoutComments(file.source)
          .split('\n')
          .map((line, index) => ({ line, number: index + 1 }))
          .filter(({ line }) => /new Date\(\)|Date\.now\(\)/.test(line))
          .map(({ number }) => `${file.path}:${number}`),
      )
      .sort()

    expect(reads).toEqual([
      'src/domain/tournament/jokerPolicy.ts:18',
      'src/domain/tournament/jokerPolicy.ts:40',
      'src/domain/tournament/matchCentreContract.ts:206',
    ])
  })

  it('keeps the shared competition layer free of any clock read', () => {
    // Stated separately from the pin above. The tournament defaults are a
    // legacy question; the shared layer has none and must acquire none, because
    // every competition kind inherits whatever it does.
    for (const file of sources.filter((candidate) => candidate.area === 'competition')) {
      expect(
        /new Date\(\)|Date\.now\(\)/.test(withoutComments(file.source)),
        `${file.path} reads an ambient clock — the shared layer takes time as an input`,
      ).toBe(false)
    }
  })
})
