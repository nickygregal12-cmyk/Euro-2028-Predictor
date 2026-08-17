import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

const repositoryRoot = process.cwd()
const scriptPath = resolve(
  repositoryRoot,
  'scripts/validate-deployment-contract.mjs',
)

const contract = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'config/deployment-contract.json'), 'utf8'),
) as { requiredRpcSignatures: string[] }

/** Canonicalise a PostgreSQL type list so the contract and the SQL agree. */
function normaliseType(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\btimestamptz\b/g, 'timestamp with time zone')
    .replace(/\bint\b/g, 'integer')
    .replace(/\bint2\b/g, 'smallint')
    .replace(/\bbool\b/g, 'boolean')
}

function normaliseSignature(signature: string): string {
  const open = signature.indexOf('(')
  const name = signature.slice(0, open)
  const args = signature
    .slice(open + 1, signature.lastIndexOf(')'))
    .split(',')
    .map((arg) => normaliseType(arg))
    .filter(Boolean)
  return `${name}(${args.join(',')})`
}

/**
 * Every function signature the committed migrations mention, from both the
 * creation sites and the grant/revoke statements. Function bodies are stripped
 * first so SQL inside `$$ … $$` cannot contribute false matches.
 */
function migrationSignatures(): Set<string> {
  const signatures = new Set<string>()
  const migrationsDir = resolve(repositoryRoot, 'supabase/migrations')

  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8').replace(
      /\$\$[\s\S]*?\$\$/g,
      ' ',
    )

    for (const match of sql.matchAll(
      /on\s+function\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)/gi,
    )) {
      const args = at(match, 2).split(',').map(normaliseType).filter(Boolean)
      signatures.add(`public.${match[1]}(${args.join(',')})`)
    }

    for (const match of sql.matchAll(
      /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)/gi,
    )) {
      const args = at(match, 2)
        .split(',')
        .map((arg) => {
          const parts = normaliseType(arg).split(' ')
          // `p_name uuid` → uuid; a bare `uuid` keeps itself.
          return (parts.slice(1).join(' ') || at(parts, 0)).replace(/ default.*$/, '')
        })
        .filter(Boolean)
      signatures.add(`public.${match[1]}(${args.join(',')})`)
    }
  }

  return signatures
}

function calledRpcNames(): Set<string> {
  const names = new Set<string>()
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        walk(entryPath)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      for (const match of readFileSync(entryPath, 'utf8').matchAll(
        /\.rpc\(\s*'([a-z0-9_]+)'/g,
      )) {
        names.add(at(match, 1))
      }
    }
  }
  walk(resolve(repositoryRoot, 'src'))
  return names
}

describe('deployment contract RPC allowlist', () => {
  const declared = contract.requiredRpcSignatures
  const declaredNames = declared.map((s) =>
    s.replace(/^public\./, '').replace(/\(.*$/, ''),
  )

  it('parses a plausible set of signatures from the migrations', () => {
    // Without this, a broken regex would make the coverage assertions vacuous.
    const signatures = migrationSignatures()
    expect(signatures.size).toBeGreaterThan(declared.length)
    expect(calledRpcNames().size).toBeGreaterThan(20)
  })

  it('declares every signature against a function the migrations define', () => {
    // Catches a renamed, re-signatured or dropped function leaving a stale
    // allowlist entry behind.
    const signatures = migrationSignatures()
    const unresolved = declared.filter(
      (signature) => !signatures.has(normaliseSignature(signature)),
    )

    expect(unresolved).toEqual([])
  })

  it('declares every RPC the browser calls', () => {
    // The allowlist previously omitted twelve league/entry RPCs the app calls,
    // so the deploy gate did not cover them.
    const undeclared = [...calledRpcNames()].filter(
      (name) => !declaredNames.includes(name),
    )

    expect(undeclared).toEqual([])
  })

  it('declares each RPC exactly once', () => {
    expect([...new Set(declaredNames)]).toHaveLength(declaredNames.length)
  })

  it('covers the league and entry RPCs that were previously missing', () => {
    // Pinned so a future edit cannot quietly drop them again.
    for (const name of [
      'submit_entry',
      'create_league',
      'get_league',
      'get_my_leagues',
      'get_league_preview',
      'join_league',
      'leave_league',
      'delete_league',
      'transfer_ownership',
      'get_league_match_picks',
      'get_rival_entry',
      'get_match_prediction_distribution',
    ]) {
      expect(declaredNames).toContain(name)
    }
  })

  it('fails the deploy gate when a called RPC is undeclared', () => {
    // Proves the prebuild script enforces this, not just the test suite.
    expect(() =>
      execFileSync(process.execPath, [scriptPath], {
        encoding: 'utf8',
        stdio: 'pipe',
        cwd: repositoryRoot,
      }),
    ).not.toThrow()

    const script = readFileSync(scriptPath, 'utf8')
    expect(script).toContain('verifyRpcAllowlist(contract)')
    expect(script).toMatch(/does not declare/)
  })
})
