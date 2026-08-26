import { describe, expect, it } from 'vitest'

import {
  assertCommitSha,
  assertPullNumber,
  observeHandlers,
  observePullRequest,
} from '../../scripts/control-plane/observe.mjs'
import { normalisePullRequest, triagePullRequest } from '../../scripts/control-plane/github.mjs'

const REPOSITORY = 'nickygregal12-cmyk/Euro-2028-Predictor'
const HEAD = '631f780445e2e12464385251165672b60469ed78'
const REQUIRED = [
  'CI / Required merge gate',
  'Migration safety / Required migration gate',
  'Database parity / Required parity gate',
]

/** A GitHub that answers from a fixture and records every path it was asked for. */
function githubReturning(overrides: Record<string, unknown> = {}) {
  const paths: string[] = []
  const bodies: Record<string, unknown> = {
    [`repos/${REPOSITORY}/pulls/1056`]: {
      number: 1056, state: 'open', draft: false, merged: false, mergeable: true,
      head: { sha: HEAD }, base: { sha: 'BASE' },
    },
    [`repos/${REPOSITORY}/commits/${HEAD}/check-runs?per_page=100`]: {
      check_runs: REQUIRED.map((name) => ({
        name, status: 'completed', conclusion: 'success', head_sha: HEAD,
      })),
    },
    [`repos/${REPOSITORY}/commits/${HEAD}/status`]: { statuses: [] },
    // The experience reads: every run for the head, and the base's own runs.
    // Separate from the latest-per-name set above on purpose — see the comment
    // in observePullRequest.
    [`repos/${REPOSITORY}/commits/${HEAD}/check-runs?per_page=100&filter=all`]: {
      check_runs: [
        { name: REQUIRED[0], status: 'completed', conclusion: 'success', started_at: '2026-08-25T10:00:00Z', head_sha: HEAD },
        { name: REQUIRED[0], status: 'completed', conclusion: 'failure', started_at: '2026-08-25T11:00:00Z', head_sha: HEAD },
      ],
    },
    [`repos/${REPOSITORY}/commits/BASE/check-runs?per_page=100&filter=all`]: { check_runs: [] },
    [`repos/${REPOSITORY}/pulls/1056/reviews?per_page=100`]: [],
    ...overrides,
  }
  const read = async (path: string) => {
    paths.push(path)
    if (!(path in bodies)) throw new Error(`GET ${path} answered 404`)
    return bodies[path]
  }
  return { read, paths }
}

describe('observation fetches, and decides nothing', () => {
  it('reads the head from the pull request rather than accepting one', async () => {
    const { read, paths } = githubReturning()

    const observed = await observePullRequest({ number: 1056, repository: REPOSITORY, read })

    // Evidence gathered for a head someone else supplied is how a green check
    // ends up vouching for a commit it never measured.
    expect(paths).toContain(`repos/${REPOSITORY}/commits/${HEAD}/check-runs?per_page=100`)
    expect(observed.checkRuns).toHaveLength(3)
    expect(paths.every((path) => path.startsWith(`repos/${REPOSITORY}/`))).toBe(true)
    // The full history is fetched separately from the latest-per-name set:
    // merging them would let an older attempt become the verdict.
    expect(paths).toContain(`repos/${REPOSITORY}/commits/${HEAD}/check-runs?per_page=100&filter=all`)
  })

  it('hands github.mjs something it can triage without any further shaping', async () => {
    const { read } = githubReturning()

    const observed = await observePullRequest({ number: 1056, repository: REPOSITORY, read })
    const triage = triagePullRequest(
      normalisePullRequest(observed, { requiredCheckNames: REQUIRED, baseSha: 'BASE' }),
    )

    expect(triage.status).toBe('ELIGIBLE')
    expect(triage.headSha).toBe(HEAD)
  })

  it('refuses anything that is not a pull request number', () => {
    for (const value of ['', ' ', '0', '-1', '1.5', '1 OR 1', '../../other/pulls/1', null, undefined, {}]) {
      expect(() => assertPullNumber(value), JSON.stringify(value)).toThrow(/not a pull request number/)
    }
    expect(assertPullNumber('1056')).toBe(1056)
    expect(assertPullNumber(1056)).toBe(1056)
  })

  it('refuses anything that is not a commit sha', () => {
    for (const value of ['', 'main', '../../x', 'ZZZZZZZ', '631f78', null, `${HEAD}0`]) {
      expect(() => assertCommitSha(value), JSON.stringify(value)).toThrow(/not a commit sha/)
    }
    expect(assertCommitSha(HEAD)).toBe(HEAD)
  })

  it('refuses a pull request whose head it cannot read, rather than guessing', async () => {
    const { read } = githubReturning({
      [`repos/${REPOSITORY}/pulls/1056`]: { number: 1056, state: 'open', head: {} },
    })

    await expect(observePullRequest({ number: 1056, repository: REPOSITORY, read }))
      .rejects.toThrow(/not a commit sha/)
  })
})

describe('the ci.observe handler releases a parked task or leaves it parked', () => {
  function handler(overrides: Record<string, unknown> = {}) {
    const written: Array<[string, string]> = []
    const { read } = githubReturning(overrides)
    const handlers = observeHandlers({
      repository: REPOSITORY,
      read,
      writeObservation: (path, contents) => written.push([path, contents]),
    })
    return { handlers, written }
  }

  it('writes an observation the existing triage handler can read', async () => {
    const { handlers, written } = handler()

    const result = await handlers['ci.observe']({
      at: '2026-08-25T22:00:00.000Z',
      task: { pullNumber: 1056, observationFile: '/tmp/observation.json' },
    })

    expect(result.ok).toBe(true)
    expect(result.checkpoint?.sha).toBe(HEAD)
    expect(written).toHaveLength(1)
    expect(written[0]?.[0]).toBe('/tmp/observation.json')
    const observation = JSON.parse(String(written[0]?.[1]))
    expect(observation.checkRuns).toHaveLength(3)
    // The evidence triage has always accepted and never been given.
    expect(observation.experience).toMatchObject({
      previouslyGreenOnSameSha: [REQUIRED[0]], redOnBase: [], baseRead: 'read',
    })
  })

  it('refuses to observe into nowhere', async () => {
    const { handlers, written } = handler()

    const result = await handlers['ci.observe']({ at: '2026-08-25T22:00:00.000Z', task: { pullNumber: 1056 } })

    expect(result.ok).toBe(false)
    expect(result.evidence).toContain('observationFile')
    expect(written).toEqual([])
  })

  it('classifies a reach-GitHub failure rather than stamping one word on it', async () => {
    // The loop needs to tell a 403 from a 429 from a 503, because waiting helps
    // for exactly one of them.
    const cases: Array<[string, string]> = [
      ['GET repos/x/pulls/1 answered 403', 'AUTH_REQUIRED'],
      ['GET repos/x/pulls/1 answered 429', 'PROVIDER_LIMIT'],
      ['GET repos/x/pulls/1 answered 503', 'PROVIDER_OUTAGE'],
    ]
    for (const [message, expected] of cases) {
      const handlers = observeHandlers({
        repository: REPOSITORY,
        read: async () => { throw new Error(message) },
        writeObservation: () => {},
      })

      const result = await handlers['ci.observe']({
        at: '2026-08-25T22:00:00.000Z',
        task: { pullNumber: 1056, observationFile: '/tmp/observation.json' },
      })

      expect(result.ok, message).toBe(false)
      expect(result.failureClass, message).toBe(expected)
    }
  })

  it('leaves a failure it does not recognise as UNKNOWN rather than inventing a class', async () => {
    // A 404 on the pinned repository is not a transient reach failure, and the
    // classifier is deliberately conservative: anything not positively
    // recognised gets diagnosed rather than retried.
    const { handlers } = handler()

    const result = await handlers['ci.observe']({
      at: '2026-08-25T22:00:00.000Z',
      task: { pullNumber: 4242, observationFile: '/tmp/observation.json' },
    })

    expect(result.ok).toBe(false)
    expect(result.failureClass).toBe('UNKNOWN')
    expect(result.evidence).toContain('404')
  })
})
