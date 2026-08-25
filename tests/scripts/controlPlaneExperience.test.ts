import { describe, expect, it } from 'vitest'

import {
  failingChecks,
  gatherExperience,
  previouslyGreenOnSameSha,
} from '../../scripts/control-plane/experience.mjs'
import { normalisePullRequest, triagePullRequest } from '../../scripts/control-plane/github.mjs'

const HEAD = '33cc8b3a0ced2438849aea77a898aa8c46da888f'
const BASE = '5e32086ad5c847cc87f0a26e9bf3e865aa14b208'

function run(name: string, conclusion: string | null, startedAt: string, status = 'completed') {
  return { name, status, conclusion, started_at: startedAt, head_sha: HEAD }
}

describe('a flake is a claim about one commit', () => {
  it('names a check that passed on this commit and then did not', () => {
    const runs = [
      run('ci', 'success', '2026-08-25T10:00:00Z'),
      run('ci', 'failure', '2026-08-25T11:00:00Z'),
      run('lint', 'success', '2026-08-25T10:00:00Z'),
    ]

    expect(previouslyGreenOnSameSha(runs)).toEqual(['ci'])
  })

  it('will not call a first failure a flake', () => {
    expect(previouslyGreenOnSameSha([run('ci', 'failure', '2026-08-25T10:00:00Z')])).toEqual([])
  })

  it('will not call it a flake when the green came after, because nothing is failing', () => {
    // A check that failed and was re-run green has no failure left to classify.
    // Reading the pair as "flaky" would classify a green check.
    const runs = [
      run('ci', 'failure', '2026-08-25T10:00:00Z'),
      run('ci', 'success', '2026-08-25T11:00:00Z'),
    ]

    expect(previouslyGreenOnSameSha(runs)).toEqual([])
  })

  it('does not read two skips as a pass and a failure', () => {
    // Measured against real data: `Supabase Preview` reported `skipped` twice on
    // one commit. Two runs of a name are not evidence of anything by themselves.
    const runs = [
      run('Supabase Preview', 'skipped', '2026-08-25T23:08:13Z'),
      run('Supabase Preview', 'skipped', '2026-08-25T23:08:17Z'),
    ]

    expect(previouslyGreenOnSameSha(runs)).toEqual([])
    expect(failingChecks(runs)).toEqual([])
  })

  it('ignores a run that has not finished, in either direction', () => {
    const runs = [
      run('ci', 'success', '2026-08-25T10:00:00Z'),
      run('ci', null, '2026-08-25T11:00:00Z', 'in_progress'),
    ]

    expect(previouslyGreenOnSameSha(runs)).toEqual([])
    expect(failingChecks(runs)).toEqual([])
  })

  it('orders by when a run started, not by the order the API returned them', () => {
    const outOfOrder = [
      run('ci', 'failure', '2026-08-25T11:00:00Z'),
      run('ci', 'success', '2026-08-25T10:00:00Z'),
    ]

    expect(previouslyGreenOnSameSha(outOfOrder)).toEqual(['ci'])
  })

  it('reads a red base as red, and a skipped or neutral one as neither', () => {
    expect(failingChecks([
      run('ci', 'failure', '2026-08-25T10:00:00Z'),
      run('lint', 'timed_out', '2026-08-25T10:00:00Z'),
      run('docs', 'neutral', '2026-08-25T10:00:00Z'),
      run('parity', 'success', '2026-08-25T10:00:00Z'),
    ])).toEqual(['ci', 'lint'])
  })
})

describe('gathering both answers from the commits they are about', () => {
  function github(bodies: Record<string, unknown>, { baseThrows = false } = {}) {
    const paths: string[] = []
    return {
      paths,
      read: async (path: string) => {
        paths.push(path)
        if (baseThrows && path.includes(BASE)) throw new Error('GET answered 503')
        return bodies[path] ?? { check_runs: [] }
      },
    }
  }

  const repository = 'nickygregal12-cmyk/Euro-2028-Predictor'
  const headPath = `repos/${repository}/commits/${HEAD}/check-runs?per_page=100&filter=all`
  const basePath = `repos/${repository}/commits/${BASE}/check-runs?per_page=100&filter=all`

  it('asks for every run, not the latest per name', async () => {
    const { read, paths } = github({})

    await gatherExperience({ read, repository, headSha: HEAD })

    // `filter=all` is the whole point: the earlier attempt is the evidence.
    expect(paths).toEqual([headPath])
  })

  it('supplies both lists that triage has always accepted and never received', async () => {
    const { read } = github({
      [headPath]: { check_runs: [
        run('ci', 'success', '2026-08-25T10:00:00Z'),
        run('ci', 'failure', '2026-08-25T11:00:00Z'),
      ] },
      [basePath]: { check_runs: [{ name: 'lint', status: 'completed', conclusion: 'failure', started_at: '2026-08-25T09:00:00Z' }] },
    })

    expect(await gatherExperience({ read, repository, headSha: HEAD, baseSha: BASE })).toEqual({
      previouslyGreenOnSameSha: ['ci'],
      redOnBase: ['lint'],
      baseRead: 'read',
    })
  })

  it('owns the failure when it cannot read the base', async () => {
    const { read } = github({ [headPath]: { check_runs: [] } }, { baseThrows: true })

    // Assuming the base was red would let a real regression through as
    // INHERITED_FAILURE. Not knowing must never become the convenient answer.
    expect(await gatherExperience({ read, repository, headSha: HEAD, baseSha: BASE })).toMatchObject({
      redOnBase: [], baseRead: 'unavailable',
    })
  })
})

describe('the two policy branches that nothing could reach', () => {
  const REQUIRED = ['CI / Required merge gate']

  function triageWith(experience: { previouslyGreenOnSameSha?: string[], redOnBase?: string[] }) {
    const pr = normalisePullRequest({
      number: 1, state: 'open', head: { sha: HEAD }, base: { sha: BASE }, mergeable: true,
      checkRuns: [{ name: REQUIRED[0], status: 'completed', conclusion: 'failure', head_sha: HEAD }],
    }, { requiredCheckNames: REQUIRED, baseSha: BASE })
    return triagePullRequest(pr, {
      previouslyGreenOnSameSha: experience.previouslyGreenOnSameSha ?? [],
      redOnBase: experience.redOnBase ?? [],
    })
  }

  it('classifies the same red three different ways, given three different histories', () => {
    // Same failing check, same commit. Only the evidence differs — which is the
    // point: without it, every one of these was the same answer.
    expect(triageWith({}).failures[0]?.failureClass).not.toBe('FLAKY_TEST')
    expect(triageWith({ previouslyGreenOnSameSha: REQUIRED }).failures[0]?.failureClass).toBe('FLAKY_TEST')
    expect(triageWith({ redOnBase: REQUIRED }).failures[0]?.failureClass).toBe('INHERITED_FAILURE')
  })
})
