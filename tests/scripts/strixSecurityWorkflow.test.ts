import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * The Strix assessment workflow, checked as configuration.
 *
 * Strix drives an agentic pentester that sends real traffic at a running
 * application. Every property below is one that would be cheap to break with a
 * plausible-looking edit and expensive to discover afterwards:
 *
 *   MANUAL ONLY   adding `push:` or `schedule:` would put a non-deterministic,
 *                 LLM-priced attack on every commit. The comment in the
 *                 workflow says so; this makes it enforced.
 *
 *   NOT PRODUCTION  the target choice list constrains the UI only. A
 *                   workflow_dispatch API call can pass any string, so the job
 *                   must re-check the resolved host.
 *
 *   FAILS CLOSED  with no credential the job must stop, not pass. A green tick
 *                 on an assessment that never ran reads as a clean result.
 *
 *   NO SECRETS OUT  a pentest log quotes request and response bodies, which is
 *                   where a token ends up.
 */

const repositoryRoot = process.cwd()

const workflow = readFileSync(
  resolve(repositoryRoot, '.github/workflows/security-strix.yml'),
  'utf8',
)

/** The `on:` block, up to the next top-level key. */
function triggerBlock(): string {
  const match = workflow.match(/^on:\n([\s\S]*?)(?=^\S)/m)
    ?? workflow.match(/^on:\n([\s\S]*)$/m)
  if (match === null) throw new Error('workflow has no on: block')
  return at(match, 1)
}

describe('Strix workflow triggers', () => {
  it('runs only on manual dispatch', () => {
    const triggers = triggerBlock()
    expect(triggers).toContain('workflow_dispatch:')
  })

  it.each(['push', 'pull_request', 'pull_request_target', 'schedule', 'repository_dispatch'])(
    'has no %s trigger',
    (trigger) => {
      // Matched at the trigger block's own indentation so the word appearing
      // in prose or in an input description cannot satisfy or fail this.
      expect(new RegExp(`^\\s{2}${trigger}:`, 'm').test(triggerBlock())).toBe(false)
    },
  )

  it('requires a typed confirmation', () => {
    expect(workflow).toMatch(/confirm:/)
    expect(workflow).toContain("!= 'ASSESS'")
  })
})

describe('Strix target scope', () => {
  it('offers no production option', () => {
    const options = workflow.match(/options:\n((?:\s+- .*\n)+)/)
    if (options === null) throw new Error('target input has no options list')
    const listed = at(options, 1).toLowerCase()
    expect(listed).toContain('local-preview')
    expect(listed).toContain('staging')
    expect(listed).not.toContain('production')
    expect(listed).not.toContain('prod')
  })

  it('refuses the production hosts by name, not only by dropdown', () => {
    // The dropdown is a UI constraint. The API is not constrained by it, so
    // the resolved host has to be checked in the job.
    for (const host of ['euro28predictor.com', 'predictorhub.com', 'supabase.co']) {
      expect(workflow, `${host} must be explicitly refused`).toContain(host)
    }
    expect(workflow).toContain('is a production or hosted-platform host')
  })

  it('refuses deploy previews, which carry real configuration', () => {
    expect(workflow).toContain('deploy previews are not an approved target')
  })

  it('rejects an unknown target rather than falling through', () => {
    // A `case` with no default would let an unrecognised value continue with
    // an empty URL, which is the shape that quietly assesses the wrong thing.
    expect(workflow).toContain("STOP: unknown target")
  })
})

describe('Strix fails closed', () => {
  it('stops when the assessment credential is absent', () => {
    expect(workflow).toContain('STRIX_LLM_API_KEY')
    expect(workflow).toContain('is not configured for this repository')
  })

  it('never references a football or odds provider credential', () => {
    // Assessment spend must not be able to become provider spend.
    for (const secret of [
      'ODDS_API',
      'AI_ODDS_POLL',
      'SPORTMONKS',
      'FOOTBALL_DATA',
      'API_FOOTBALL',
    ]) {
      expect(workflow.toUpperCase()).not.toContain(secret)
    }
  })

  it('never references a Supabase service role or production database URL', () => {
    for (const secret of [
      'SERVICE_ROLE',
      'SUPABASE_PROD_DB_URL',
      'SUPABASE_SERVICE',
      'NETLIFY_AUTH_TOKEN',
    ]) {
      expect(workflow.toUpperCase()).not.toContain(secret)
    }
  })

  it('builds the local preview with a loopback Supabase URL', () => {
    // So the application under test has no route to a real project, and an
    // agent probing it cannot reach one either.
    expect(workflow).toMatch(/VITE_SUPABASE_URL:\s*http:\/\/127\.0\.0\.1/)
  })
})

describe('Strix output handling', () => {
  it('redacts credential-shaped strings before uploading', () => {
    expect(workflow).toContain('Redact anything credential-shaped')
    expect(workflow).toContain('redacted-jwt')
  })

  it('uploads findings as a retained artefact rather than committing them', () => {
    expect(workflow).toContain('upload-artifact')
    expect(workflow).toMatch(/retention-days:\s*\d+/)
    // Nothing may write results back into the repository.
    expect(workflow).not.toMatch(/git\s+(?:commit|push)/)
  })

  it('grants the job no write permission', () => {
    expect(workflow).toMatch(/permissions:\n\s+contents:\s*read/)
    expect(workflow).not.toContain('contents: write')
  })
})

describe('Strix is non-gating and pinned', () => {
  it('is report-only for now', () => {
    // #809's pattern: arrive report-only, become blocking on evidence.
    expect(workflow).toContain('continue-on-error: true')
  })

  it('pins Strix to an exact version', () => {
    expect(workflow).toMatch(/strix-agent==\d+\.\d+\.\d+/)
  })

  it('pins every action to a commit SHA', () => {
    const uses = [...workflow.matchAll(/uses:\s*(\S+)/g)].map((match) => match[1])
    expect(uses.length).toBeGreaterThan(0)
    for (const action of uses) {
      expect(action, `${action} must be pinned to a 40-character SHA`).toMatch(
        /@[0-9a-f]{40}$/,
      )
    }
  })

  it('bounds its own runtime', () => {
    // An agentic loop with no ceiling is an unbounded bill.
    expect(workflow).toMatch(/timeout-minutes:\s*\d+/)
  })

  it('does not run two assessments against one target at once', () => {
    expect(workflow).toContain('concurrency:')
  })
})
