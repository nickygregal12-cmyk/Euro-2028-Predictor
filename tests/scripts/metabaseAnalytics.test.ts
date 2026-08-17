import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The Metabase analytics surface, checked without a database.
 *
 * Metabase is an INTERNAL operations tool. It authenticates as one role for
 * everybody who opens it, so `auth.uid()` is null for every query it issues
 * and RLS written in terms of the signed-in player cannot express "this
 * analyst may see this row". Pointing it at base tables would therefore hand
 * one role every player's predictions.
 *
 * The defence is that Metabase only ever sees aggregate views, and the role
 * can reach nothing else. These tests hold the parts of that which are
 * checkable from the repository:
 *
 *   - every table the views read actually exists in the committed migrations,
 *     so a rename cannot leave a silently broken reporting layer behind;
 *   - no view exposes an identifying or credential column;
 *   - the role is never granted a base table, DDL, or write of any kind;
 *   - no Metabase package reaches the frontend;
 *   - no secret is committed.
 */

const repositoryRoot = process.cwd()

function read(relativePath: string): string {
  return readFileSync(resolve(repositoryRoot, relativePath), 'utf8')
}

const VIEWS_SQL = 'ops/metabase/analytics-views.sql'
const COMPOSE = 'ops/metabase/docker-compose.yml'
const ENV_TEMPLATE = 'ops/metabase/.env.example'

const viewSql = read(VIEWS_SQL)

/** Table names created by the committed migrations, as `schema.table`. */
function migrationTables(): Set<string> {
  const files = execFileSync('git', ['ls-files', 'supabase/migrations/*.sql'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)

  const sql = files.map((file) => read(file)).join('\n')
  const tables = new Set<string>()
  const pattern =
    /create table (?:if not exists )?([a-z_]+\.)?([a-z_][a-z0-9_]*)\s*\(/gi

  for (const match of sql.matchAll(pattern)) {
    const schema = (match[1] ?? 'public.').replace(/\.$/, '')
    tables.add(`${schema}.${match[2]}`.toLowerCase())
  }
  return tables
}

/** Every `schema.table` the analytics views read from. */
function referencedTables(): string[] {
  const pattern = /\b(?:from|join)\s+((?:public|ai|predictor_internal)\.[a-z_][a-z0-9_]*)/gi
  return [...new Set([...viewSql.matchAll(pattern)].map((m) => m[1].toLowerCase()))]
}

describe('Metabase analytics views', () => {
  it('reads only tables the committed migrations create', () => {
    // A renamed or dropped table would otherwise leave a reporting layer that
    // fails at the moment somebody opens a dashboard, which is the worst time
    // to discover it.
    const known = migrationTables()
    const referenced = referencedTables()

    expect(referenced.length).toBeGreaterThan(0)
    expect(referenced.filter((table) => !known.has(table))).toEqual([])
  })

  it('creates every view inside the analytics schema', () => {
    const created = [
      ...viewSql.matchAll(/create or replace view\s+([a-z_]+)\.([a-z_][a-z0-9_]*)/gi),
    ]
    expect(created.length).toBeGreaterThan(0)
    for (const [, schema] of created) {
      expect(schema.toLowerCase()).toBe('analytics')
    }
  })

  it('never selects an identifying or credential column', () => {
    // A league's invite code is a credential: anyone holding it can join.
    // A display name and an email identify a person. None of them belong in
    // an aggregate reporting layer.
    for (const forbidden of [
      'invite_code',
      'display_name',
      'email',
      'password',
      'encrypted_password',
    ]) {
      expect(
        new RegExp(`\\b${forbidden}\\b`).test(stripComments(viewSql)),
        `${forbidden} must not appear in an analytics view`,
      ).toBe(false)
    }
  })

  it('exposes no per-player row', () => {
    // `user_id` may only appear inside an aggregate. Selecting it would make
    // each row describe one identifiable person.
    const body = stripComments(viewSql)
    const selectsUserId = /select[^;]*?\buser_id\b(?![^;]*?count\s*\()/is.test(body)
    expect(selectsUserId).toBe(false)
  })

  it('grants the reader role nothing outside the analytics schema', () => {
    // Whole statements, not just the text after `grant`. The scope of
    // `alter default privileges in schema analytics grant select ...` sits
    // BEFORE the verb, so reading from `grant` onwards would drop exactly the
    // clause that makes the statement safe.
    const grants = stripComments(viewSql)
      .split(';')
      .map((statement) => statement.replace(/\s+/g, ' ').trim().toLowerCase())
      .filter((statement) => /(?:^|\s)grant\s/.test(statement))

    expect(grants.length).toBeGreaterThan(0)
    for (const grant of grants) {
      expect(grant, `grant is not scoped to analytics: ${grant}`).toContain(
        'analytics',
      )
      // No write, no DDL, no ownership.
      for (const forbidden of [
        'insert',
        'update',
        'delete',
        'truncate',
        'create',
        'all privileges',
      ]) {
        expect(grant, `grant must not include ${forbidden}`).not.toContain(
          forbidden,
        )
      }
    }
  })

  it('revokes the reader role from the public schema', () => {
    // A later blanket `grant ... on all tables in schema public` is the
    // realistic way this widens by accident. Revoking explicitly means such a
    // grant has to overwrite a stated decision rather than fill a silence.
    const body = stripComments(viewSql).toLowerCase()
    expect(body).toContain('revoke all on all tables in schema public')
    expect(body).toContain('revoke all on schema public')
  })

  it('creates the role without a committed password', () => {
    expect(/create role\s+metabase_readonly/i.test(viewSql)).toBe(true)
    // `create role ... password '...'` would put a credential in git history,
    // where deleting it later does not remove it.
    expect(/create role[^;]*password\s*'/i.test(viewSql)).toBe(false)
  })

  it('never references the service role or a superuser', () => {
    for (const forbidden of ['service_role', 'supabase_admin', 'postgres_superuser']) {
      expect(viewSql.toLowerCase()).not.toContain(forbidden)
    }
  })
})

describe('Metabase deployment configuration', () => {
  it('pins the Metabase image rather than tracking latest', () => {
    const compose = read(COMPOSE)
    const images = [...compose.matchAll(/image:\s*(\S+)/g)].map((match) => match[1])
    expect(images.length).toBeGreaterThan(0)
    for (const image of images) {
      expect(image, `${image} must be pinned`).not.toMatch(/:latest$/)
      expect(image, `${image} must carry a tag`).toContain(':')
    }
  })

  it('binds the UI to loopback only', () => {
    // Metabase's first-run wizard is unauthenticated. Publishing it on every
    // interface would offer whoever reaches it an admin account.
    const compose = read(COMPOSE)
    const ports = [...compose.matchAll(/^\s*-\s*'([^']*:\d+:\d+)'/gm)].map((m) => m[1])
    expect(ports.length).toBeGreaterThan(0)
    for (const port of ports) {
      expect(port.startsWith('127.0.0.1:')).toBe(true)
    }
  })

  it('gives Metabase its own application database', () => {
    // A BI tool writing its dashboards into the product database would need a
    // write grant it must never have.
    const compose = read(COMPOSE)
    expect(compose).toMatch(/MB_DB_HOST:\s*metabase-appdb/)
  })

  it('commits no credential', () => {
    const template = read(ENV_TEMPLATE)
    for (const line of template.split('\n')) {
      if (line.trimStart().startsWith('#')) continue
      const [, ...rest] = line.split('=')
      const value = rest.join('=').trim()
      if (!value) continue
      // A placeholder is allowed; anything that looks like a real secret is not.
      expect(value).toMatch(/^[a-z0-9-]*$/i)
      expect(value.length).toBeLessThan(40)
    }
  })

  it('keeps a filled-in env file out of git', () => {
    expect(existsSync(resolve(repositoryRoot, 'ops/metabase/.env'))).toBe(false)
    const ignored = execFileSync(
      'git',
      ['check-ignore', '--no-index', 'ops/metabase/.env'],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
    expect(ignored.trim()).toBe('ops/metabase/.env')
  })
})

describe('Metabase stays out of the product', () => {
  it('is imported by no application source', () => {
    const sources = execFileSync('git', ['ls-files', 'src'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })
      .split('\n')
      .filter((file) => /\.(?:ts|tsx)$/.test(file))

    const offenders = sources.filter((file) => /metabase/i.test(read(file)))
    expect(offenders).toEqual([])
  })

  it('adds no package dependency', () => {
    const manifest = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const declared = Object.keys({
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    })
    expect(declared.filter((name) => /metabase/i.test(name))).toEqual([])
  })
})

/** SQL with `--` comments removed, so prose cannot satisfy or fail a check. */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}
