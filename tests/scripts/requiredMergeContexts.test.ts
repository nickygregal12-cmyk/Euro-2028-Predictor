import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  evaluateRulesetDrift,
  extractRequiredContexts,
  findUnpublishedContexts,
} from '../../scripts/control-plane/ruleset.mjs'
import {
  jobNames,
  parseRecord,
  resolveRepository,
  rulesUrl,
} from '../../scripts/check-required-merge-contexts.mjs'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const record = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'config/required-merge-contexts.json'), 'utf8'),
)

/** One required_status_checks rule as GitHub's effective-rules endpoint returns it. */
function rule(contexts: string[], { strict = false, rulesetId = 20508177 } = {}) {
  return {
    type: 'required_status_checks',
    parameters: {
      strict_required_status_checks_policy: strict,
      required_status_checks: contexts.map((context) => ({ context })),
    },
    ruleset_id: rulesetId,
  }
}

describe('reading the hosted required set', () => {
  it('unions the contexts across every ruleset that applies to the branch', () => {
    // Reading one ruleset by id would miss an organisation-level rule, and the
    // day the repository ruleset is renumbered it would report an unprotected
    // branch that is in fact protected.
    const live = extractRequiredContexts([
      rule(['CI / Required merge gate'], { rulesetId: 20508177 }),
      rule(['Org / Signed commits'], { rulesetId: 999 }),
    ])
    expect(live.contexts).toEqual(['CI / Required merge gate', 'Org / Signed commits'])
    expect(live.rulesetIds).toEqual([999, 20508177])
  })

  it('separates an unreadable answer from an unprotected branch', () => {
    // These are the same empty list and they mean opposite things. Collapsing
    // them is how a failed API call becomes "nothing is required, carry on".
    const unreadable = extractRequiredContexts(null)
    expect(unreadable.readable).toBe(false)
    expect(unreadable.protected).toBe(false)

    const unprotected = extractRequiredContexts([{ type: 'deletion' }])
    expect(unprotected.readable).toBe(true)
    expect(unprotected.protected).toBe(false)
  })

  it('reports strict policy as true when any applying ruleset sets it', () => {
    expect(extractRequiredContexts([rule(['a'], { strict: true })]).strict).toBe(true)
    expect(extractRequiredContexts([rule(['a'])]).strict).toBe(false)
  })

  it('ignores a rule whose context is missing or empty rather than inventing one', () => {
    const live = extractRequiredContexts([
      { type: 'required_status_checks', parameters: { required_status_checks: [{ context: '' }, {}] } },
    ])
    expect(live.protected).toBe(true)
    expect(live.contexts).toEqual([])
  })
})

describe('drift between the hosted set and the tracked record', () => {
  const tracked = {
    required: ['CI / Required merge gate', 'Migration safety / Required migration gate'],
    requirableNotRequired: [{ context: 'vNext merged browser gate' }],
  }

  it('matches when the hosted set is exactly the record', () => {
    const drift = evaluateRulesetDrift({ effectiveRules: [rule(tracked.required)], record: tracked })
    expect(drift.status).toBe('MATCHED')
    expect(drift.ok).toBe(true)
  })

  it('fails on a context the record expects and the ruleset does not require', () => {
    // THE FAIL-OPEN DIRECTION, and the reason this module exists. Believing a
    // context gates a merge when it does not means treating evidence as
    // blocking that blocks nothing — exactly the error #1047 made about
    // `vNext merged browser gate`.
    const drift = evaluateRulesetDrift({
      effectiveRules: [rule(['CI / Required merge gate'])],
      record: tracked,
    })
    expect(drift.status).toBe('MISSING_REQUIRED')
    expect(drift.ok).toBe(false)
    expect(drift.missing).toEqual(['Migration safety / Required migration gate'])
  })

  it('fails on a context the ruleset requires and the record does not list', () => {
    const drift = evaluateRulesetDrift({
      effectiveRules: [rule([...tracked.required, 'Some / New gate'])],
      record: tracked,
    })
    expect(drift.status).toBe('UNDECLARED_REQUIRED')
    expect(drift.undeclared).toEqual(['Some / New gate'])
  })

  it('names a promoted requirable gate as promoted rather than as unknown', () => {
    // A gate moving from requirable to required is a recorded event, not a
    // context appearing from nowhere. It still fails: the record is now wrong.
    const drift = evaluateRulesetDrift({
      effectiveRules: [rule([...tracked.required, 'vNext merged browser gate'])],
      record: tracked,
    })
    expect(drift.ok).toBe(false)
    expect(drift.promoted).toEqual(['vNext merged browser gate'])
    expect(drift.undeclared).toEqual([])
  })

  it('never passes when the rules could not be read', () => {
    const drift = evaluateRulesetDrift({ effectiveRules: undefined, record: tracked })
    expect(drift.status).toBe('UNREADABLE')
    expect(drift.ok).toBe(false)
    // Every expected context is owed, because none of them was verified.
    expect(drift.missing).toEqual([...tracked.required].sort())
  })

  it('treats a branch with no required_status_checks rule as protection absent', () => {
    const drift = evaluateRulesetDrift({ effectiveRules: [{ type: 'deletion' }], record: tracked })
    expect(drift.status).toBe('PROTECTION_ABSENT')
    expect(drift.ok).toBe(false)
  })
})

describe('parsing job names out of a workflow', () => {
  it('reads job names and not step names', () => {
    // A job key sits at two spaces and its name at four; a step name is deeper
    // and is not a check-run name. Getting this wrong would let a step called
    // "CI / Required merge gate" satisfy the check below.
    const workflow = [
      'jobs:',
      '  merge-gate:',
      '    name: CI / Required merge gate',
      '    steps:',
      '      - name: Not a check run',
      '  quoted:',
      '    name: "Database parity / Required parity gate"',
    ].join('\n')
    expect(jobNames(workflow)).toEqual([
      'CI / Required merge gate',
      'Database parity / Required parity gate',
    ])
  })
})

describe('the tracked record against this repository', () => {
  it('lists a context no workflow job publishes as unpublished', () => {
    expect(findUnpublishedContexts({ required: ['A', 'B'], jobNames: ['A'] })).toEqual(['B'])
  })

  it('has a workflow job publishing every context it calls required', () => {
    // THE HALF THAT NEEDS NO NETWORK, and the one that runs on the pull request
    // that would break it. GitHub matches a required context to a check run by
    // name, so renaming the job stops the context posting — and a required
    // context that never posts blocks every pull request for ever.
    const workflows = execFileSync(
      'git',
      ['ls-files', '.github/workflows/*.yml', '.github/workflows/*.yaml'],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)
    const published = workflows.flatMap((file) =>
      jobNames(readFileSync(resolve(repositoryRoot, file), 'utf8')),
    )
    expect(findUnpublishedContexts({ required: record.required, jobNames: published })).toEqual([])
  })

  it('names a real workflow job for every gate it calls requirable', () => {
    // A record listing a context nothing publishes would be describing a gate
    // that cannot be required at all — the same class of unverifiable claim as
    // the `required` half, one step further from being noticed because nothing
    // depends on it until someone tries to promote it.
    const workflows = execFileSync(
      'git',
      ['ls-files', '.github/workflows/*.yml', '.github/workflows/*.yaml'],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)
    const published = workflows.flatMap((file) =>
      jobNames(readFileSync(resolve(repositoryRoot, file), 'utf8')),
    )
    const requirable = (record.requirableNotRequired ?? []).map(
      (entry: { context: string }) => entry.context,
    )
    expect(findUnpublishedContexts({ required: requirable, jobNames: published })).toEqual([])
  })

  it('does not claim a requirable gate is also required', () => {
    // The two lists answer different questions and an entry in both would make
    // the record contradict itself — which is the class of error it exists to
    // catch in the first place.
    for (const entry of record.requirableNotRequired ?? []) {
      expect(record.required).not.toContain(entry.context)
    }
  })
})

describe('refusing a malformed record instead of crashing on it', () => {
  // This check runs in CI. `Cannot read properties of undefined` tells whoever
  // broke the record nothing, and the argument of this whole file is that an
  // unverifiable answer should be loud rather than confusing.
  const valid = JSON.stringify({ branch: 'main', required: ['CI / Required merge gate'] })

  it('accepts a well-formed record', () => {
    expect(parseRecord(valid).required).toEqual(['CI / Required merge gate'])
  })

  it.each([
    ['not JSON at all', '{'],
    ['a top level that is not an object', '[]'],
    ['no branch', JSON.stringify({ required: ['a'] })],
    ['an empty required list', JSON.stringify({ branch: 'main', required: [] })],
    ['a non-string context', JSON.stringify({ branch: 'main', required: [42] })],
    ['a blank context', JSON.stringify({ branch: 'main', required: ['  '] })],
    [
      'a requirable entry with no context',
      JSON.stringify({ branch: 'main', required: ['a'], requirableNotRequired: [{ reason: 'x' }] }),
    ],
  ])('refuses %s with a diagnostic naming the file', (_label, source) => {
    expect(() => parseRecord(source, 'config/x.json')).toThrow(/config\/x\.json/)
  })

  it('refuses a branch that would not be safe in a URL path', () => {
    // The branch is read from a file and then interpolated into the request, so
    // it is untrusted by construction — which is what CodeQL flagged. A branch
    // that needs escaping here is one this record should not be naming.
    for (const branch of ['../../etc', 'main?x=1', 'main#frag', '-leading-dash', '']) {
      expect(() => parseRecord(JSON.stringify({ branch, required: ['a'] }))).toThrow(/branch/)
    }
  })
})

describe('deciding which repository the live check is about', () => {
  it('prefers the environment when CI set it', () => {
    expect(resolveRepository('owner/repo', 'https://github.com/other/thing.git')).toBe('owner/repo')
  })

  it('falls back to the origin remote in both URL forms', () => {
    expect(resolveRepository(undefined, 'https://github.com/owner/repo.git')).toBe('owner/repo')
    expect(resolveRepository(undefined, 'https://github.com/owner/repo')).toBe('owner/repo')
    expect(resolveRepository(undefined, 'git@github.com:owner/repo.git')).toBe('owner/repo')
  })

  it('refuses rather than guessing a repository', () => {
    // The first version hard-coded this repository as the fallback. Run from a
    // fork it would have read someone else's ruleset and reported MATCHED — an
    // answer about the wrong subject, which is false rather than merely weak.
    expect(() => resolveRepository(undefined, '')).toThrow(/GITHUB_REPOSITORY/)
    expect(() => resolveRepository(undefined, 'https://gitlab.com/owner/repo.git')).toThrow()
  })
})

describe('a request that cannot address anything but the API', () => {
  it('builds the expected URL', () => {
    const url = rulesUrl('owner/repo', 'main', 2, 100)
    expect(url.toString()).toBe(
      'https://api.github.com/repos/owner/repo/rules/branches/main?per_page=100&page=2',
    )
  })

  it('encodes a branch containing a separator rather than extending the path', () => {
    expect(rulesUrl('owner/repo', 'release/2028', 1, 100).pathname).toBe(
      '/repos/owner/repo/rules/branches/release%2F2028',
    )
  })

  it('refuses anything that is not an owner/repo pair', () => {
    for (const repository of ['owner', 'owner/repo/extra', '../etc', 'owner/', '/repo']) {
      expect(() => rulesUrl(repository, 'main', 1, 100), repository).toThrow()
    }
  })

  it('refuses a branch that escapes the path, whatever the record said', () => {
    // Validating the shape earlier argues the value is harmless — a claim about
    // every future edit to the record. This asserts the conclusion instead, so
    // it holds even if the shape check is one day loosened.
    for (const branch of ['https://evil.example/x', '//evil.example/x', 'a@evil.example']) {
      const url = rulesUrl('owner/repo', branch, 1, 100)
      expect(url.origin).toBe('https://api.github.com')
    }
  })
})
