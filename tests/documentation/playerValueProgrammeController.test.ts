import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The player-value programme controller is machine state, so the rule that
 * matters is not "someone wrote a status" but "the status it holds could
 * actually be true".
 *
 * Two failures this repository has already paid for are what shape the checks
 * below.
 *
 * A stage marked done without a merge SHA is the first. A programme record is
 * read by the next agent as fact, and "complete" with nothing on `main` behind
 * it is the most expensive kind of wrong: it removes the work from the queue
 * without the work existing. So `complete` here is not a word an agent may
 * write. It requires a pull request number, an exact head, and a merge commit,
 * and it requires every dependency to be complete first.
 *
 * Two branches claiming one contract number is the second, and it is the reason
 * Stage 0 exists at all. The runway record therefore holds claims against exact
 * pull-request heads and nothing else, and this test derives the repository's
 * own position from `config/deployment-contract.json` rather than letting the
 * controller keep a second copy of it. A claim that the repository has already
 * reached is not stale documentation — it is a duplicate identity waiting to
 * happen, and it fails here.
 *
 * The validator is exercised against deliberately broken states as well as the
 * real one. A validator only ever tested on valid input is a validator nobody
 * knows the shape of.
 */

const root = resolve(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

type StageStatus = 'not_started' | 'in_progress' | 'blocked' | 'ready' | 'complete'

interface Stage {
  id: string
  title: string
  dependencies: string[]
  status: StageStatus
  pr: number | null
  headSha: string | null
  mergedSha: string | null
  acceptanceEvidence: string[]
  blocker: string | null
}

interface ContractClaim {
  pr: number
  branch: string
  headSha: string
  contract: number
  migration: string
}

interface PullRequestClassification {
  pr: number
  branch: string
  headSha: string
  draft: boolean
  classification: string
  rationale: string
}

interface Programme {
  schemaVersion: number
  programme: string
  completionPredicate: string
  controller: string
  contractRunway: {
    authority: string
    note: string
    claimedByOpenPullRequests: ContractClaim[]
  }
  openPullRequestClassification: PullRequestClassification[]
  stages: Stage[]
}

const STAGE_IDS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

const STAGE_STATUSES = new Set<StageStatus>([
  'not_started',
  'in_progress',
  'blocked',
  'ready',
  'complete',
])

const CLASSIFICATIONS = new Set([
  'needed_prerequisite',
  'overlapping_but_compatible',
  'superseded',
  'unrelated',
  'blocked',
  'ready_to_merge',
])

const SHA = /^[0-9a-f]{40}$/

/**
 * Prose that would make this file a second authority for something it does not
 * own. A contract number, a hosted position or a loose commit hash written into
 * a rationale is a copy, and a copy goes stale the moment the original moves.
 */
const DUPLICATED_FACT = [
  /contract\s+\d+/i,
  /\b(?:repository|development|production)\s+(?:is|sits|stands)?\s*(?:at|on)\s+\d+/i,
  /\b[0-9a-f]{40}\b/,
  /promotion\s+(?:is\s+)?(?:not\s+)?authoris/i,
]

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/** Every way the recorded state could not be true, as plain strings. */
export function validateProgramme(state: Programme, repositoryContract: number): string[] {
  const problems: string[] = []
  const say = (problem: string) => problems.push(problem)

  if (state.schemaVersion !== 1) say('schemaVersion must be 1')
  if (state.programme !== 'player-value') say('programme must be player-value')

  const ids = state.stages.map((stage) => stage.id)
  if (ids.join(',') !== STAGE_IDS.join(',')) say(`stages must be exactly ${STAGE_IDS.join(',')}`)

  const byId = new Map(state.stages.map((stage) => [stage.id, stage]))

  for (const stage of state.stages) {
    const at = `stage ${stage.id}`

    if (!STAGE_STATUSES.has(stage.status)) say(`${at}: unknown status ${stage.status}`)
    if (!stage.title.trim()) say(`${at}: needs a title`)

    if (new Set(stage.dependencies).size !== stage.dependencies.length) {
      say(`${at}: duplicate dependency`)
    }
    for (const dependency of stage.dependencies) {
      if (dependency === stage.id) say(`${at}: depends on itself`)
      else if (!byId.has(dependency)) say(`${at}: depends on unknown stage ${dependency}`)
      else if (Number(dependency) > Number(stage.id)) say(`${at}: depends on later stage ${dependency}`)
    }

    if (stage.status === 'blocked') {
      if (!stage.blocker?.trim()) say(`${at}: blocked without a named blocker`)
    } else if (stage.blocker !== null) {
      say(`${at}: carries a blocker while ${stage.status}`)
    }

    // An empty string is not evidence, and `length > 0` cannot tell the
    // difference. A stage marked complete on [''] would satisfy the one check
    // this record exists to make unfakeable.
    const evidence = stage.acceptanceEvidence.filter((line) => line.trim().length > 0)
    if (evidence.length !== stage.acceptanceEvidence.length) {
      say(`${at}: acceptance evidence with nothing written in it`)
    }

    if (stage.status === 'not_started') {
      if (stage.pr !== null) say(`${at}: not_started with a pull request`)
      if (stage.headSha !== null) say(`${at}: not_started with a head`)
      if (stage.acceptanceEvidence.length > 0) say(`${at}: not_started with acceptance evidence`)
    }

    if (stage.status === 'ready') {
      if (!isPositiveInteger(stage.pr)) say(`${at}: ready without a pull request`)
      if (!stage.headSha || !SHA.test(stage.headSha)) say(`${at}: ready without an exact head`)
      if (evidence.length === 0) say(`${at}: ready without acceptance evidence`)
    }

    if (stage.status !== 'complete' && stage.mergedSha !== null) {
      say(`${at}: records a merge while ${stage.status}`)
    }

    if (stage.status === 'complete') {
      if (!isPositiveInteger(stage.pr)) say(`${at}: complete without a pull request`)
      if (!stage.headSha || !SHA.test(stage.headSha)) say(`${at}: complete without an exact head`)
      if (!stage.mergedSha || !SHA.test(stage.mergedSha)) say(`${at}: complete without a merge commit`)
      if (evidence.length === 0) say(`${at}: complete without acceptance evidence`)
      for (const dependency of stage.dependencies) {
        if (byId.get(dependency)?.status !== 'complete') {
          say(`${at}: complete before dependency ${dependency}`)
        }
      }
    }

    for (const prose of [stage.title, stage.blocker ?? '', ...stage.acceptanceEvidence]) {
      for (const pattern of DUPLICATED_FACT) {
        if (pattern.test(prose)) say(`${at}: copies a fact this record does not own — ${prose}`)
      }
    }
  }

  if (state.stages.filter((stage) => stage.status === 'in_progress').length > 1) {
    say('more than one stage in_progress; the programme runs one bounded pull request at a time')
  }

  const claimed = state.contractRunway.claimedByOpenPullRequests
  const claimedNumbers = claimed.map((claim) => claim.contract)
  if (new Set(claimedNumbers).size !== claimedNumbers.length) {
    say('two open pull requests claim one contract number')
  }
  for (const claim of claimed) {
    if (!isPositiveInteger(claim.pr)) say(`claim on ${claim.branch}: needs a pull request number`)
    if (!SHA.test(claim.headSha)) say(`claim on ${claim.branch}: needs an exact head`)
    if (!claim.migration.startsWith('supabase/migrations/')) {
      say(`claim on ${claim.branch}: must name the migration it claims the number for`)
    }
    if (claim.contract <= repositoryContract) {
      say(
        `claim on ${claim.branch}: the repository has already reached ${claim.contract}, so this is a duplicate identity`,
      )
    }
  }
  const expected = [...claimedNumbers].sort((a, b) => a - b)
  for (const [index, contract] of expected.entries()) {
    if (contract !== repositoryContract + 1 + index) {
      say(`claimed numbers must run contiguously from the repository position; found ${contract}`)
    }
  }

  const classifiedPrs = state.openPullRequestClassification.map((entry) => entry.pr)
  if (new Set(classifiedPrs).size !== classifiedPrs.length) say('a pull request is classified twice')
  for (const pattern of DUPLICATED_FACT) {
    if (pattern.test(state.contractRunway.note)) {
      say('the runway note copies a fact this record does not own')
    }
  }

  for (const entry of state.openPullRequestClassification) {
    const at = `pull request ${entry.pr}`
    // A rationale is prose like any other. A hash pasted into one is the same
    // stale copy it would be in a stage's evidence, and the exact-head field
    // beside it is where a hash belongs.
    for (const pattern of DUPLICATED_FACT) {
      if (pattern.test(entry.rationale)) {
        say(`${at}: rationale copies a fact this record does not own`)
      }
    }
    if (!isPositiveInteger(entry.pr)) say(`${at}: needs a number`)
    if (!SHA.test(entry.headSha)) say(`${at}: classified without an exact head`)
    if (!CLASSIFICATIONS.has(entry.classification)) say(`${at}: unknown classification ${entry.classification}`)
    if (entry.rationale.trim().length < 40) say(`${at}: classification needs a stated reason`)
    if (entry.draft && entry.classification === 'ready_to_merge') {
      say(`${at}: a draft is not ready to merge`)
    }
  }
  for (const claim of claimed) {
    if (!classifiedPrs.includes(claim.pr)) say(`pull request ${claim.pr} claims a number but is unclassified`)
  }

  return problems
}

const state = JSON.parse(read('config/player-value-programme.json')) as Programme
const repositoryContract = (
  JSON.parse(read('config/deployment-contract.json')) as { requiredMigrationCount: number }
).requiredMigrationCount
const rootAgents = read('AGENTS.md')
const controller = read('docs/product/player-value-programme-controller.md')

/** The real state with one field bent, so a negative case stays a one-liner. */
function bend(mutate: (draft: Programme) => void): Programme {
  const draft = JSON.parse(JSON.stringify(state)) as Programme
  mutate(draft)
  return draft
}
const stageIn = (draft: Programme, id: string) => draft.stages.find((stage) => stage.id === id)!

/**
 * A draft guaranteed to carry one runway claim and its classification.
 *
 * The cases below are about the RULES, not about which pull requests happen to
 * be open today. Both lists are legitimately empty when nothing is in flight —
 * the moment the last open migration branch merges, this record's claim list
 * empties — and a harness that threw at that moment would fail the gate for a
 * state the validator accepts, on a day when nothing was wrong. So a baseline
 * is seeded when the real state has none, and used as-is when it has one.
 */
function withOneClaim(
  mutate: (draft: Programme, claim: ContractClaim, entry: PullRequestClassification) => void,
): Programme {
  return bend((draft) => {
    let claim = draft.contractRunway.claimedByOpenPullRequests[0]
    if (!claim) {
      claim = {
        pr: 999_999,
        branch: 'seeded/no-open-claim',
        headSha: 'd'.repeat(40),
        contract: repositoryContract + 1,
        migration: 'supabase/migrations/29990101000000_seeded_by_the_gate.sql',
      }
      draft.contractRunway.claimedByOpenPullRequests.push(claim)
    }

    let entry = draft.openPullRequestClassification.find((candidate) => candidate.pr === claim.pr)
    if (!entry) {
      entry = {
        pr: claim.pr,
        branch: claim.branch,
        headSha: claim.headSha,
        draft: true,
        classification: 'unrelated',
        rationale:
          'Seeded by the gate so the runway cases can be built when no open pull request happens to claim a number.',
      }
      draft.openPullRequestClassification.push(entry)
    }

    mutate(draft, claim, entry)
  })
}

describe('player-value programme controller', () => {
  it('holds a state that could actually be true', () => {
    expect(validateProgramme(state, repositoryContract)).toEqual([])
  })

  it('refuses a stage marked complete with nothing merged behind it', () => {
    const noMerge = bend((draft) => {
      const stage = stageIn(draft, '0')
      stage.status = 'complete'
      stage.pr = 1000
      stage.headSha = 'a'.repeat(40)
      stage.acceptanceEvidence = ['proved']
    })
    expect(validateProgramme(noMerge, repositoryContract)).toContain(
      'stage 0: complete without a merge commit',
    )

    const noEvidence = bend((draft) => {
      const stage = stageIn(draft, '0')
      stage.status = 'complete'
      stage.pr = 1000
      stage.headSha = 'a'.repeat(40)
      stage.mergedSha = 'b'.repeat(40)
    })
    expect(validateProgramme(noEvidence, repositoryContract)).toContain(
      'stage 0: complete without acceptance evidence',
    )
  })

  it('refuses a stage completed ahead of what it depends on', () => {
    const outOfOrder = bend((draft) => {
      const stage = stageIn(draft, '2')
      stage.status = 'complete'
      stage.pr = 1000
      stage.headSha = 'a'.repeat(40)
      stage.mergedSha = 'b'.repeat(40)
      stage.acceptanceEvidence = ['proved']
    })
    expect(validateProgramme(outOfOrder, repositoryContract)).toContain(
      'stage 2: complete before dependency 1',
    )
  })

  it('refuses a blocked stage that does not name its blocker, and a blocker on a stage that is not blocked', () => {
    const unnamed = bend((draft) => {
      stageIn(draft, '1').status = 'blocked'
    })
    expect(validateProgramme(unnamed, repositoryContract)).toContain(
      'stage 1: blocked without a named blocker',
    )

    const stray = bend((draft) => {
      stageIn(draft, '1').blocker = 'waiting on the owner'
    })
    expect(validateProgramme(stray, repositoryContract)).toContain(
      'stage 1: carries a blocker while not_started',
    )
  })

  it('refuses more than one stage in flight', () => {
    const parallel = bend((draft) => {
      stageIn(draft, '3').status = 'in_progress'
    })
    expect(validateProgramme(parallel, repositoryContract)).toContain(
      'more than one stage in_progress; the programme runs one bounded pull request at a time',
    )
  })

  it('refuses two open branches claiming one contract number', () => {
    const duplicate = withOneClaim((draft, claim, entry) => {
      draft.contractRunway.claimedByOpenPullRequests.push({
        ...claim,
        pr: claim.pr + 1,
        branch: 'some/other-branch',
      })
      draft.openPullRequestClassification.push({
        ...entry,
        pr: claim.pr + 1,
        branch: 'some/other-branch',
      })
    })
    expect(validateProgramme(duplicate, repositoryContract)).toContain(
      'two open pull requests claim one contract number',
    )
  })

  it('refuses a claim the repository has already reached', () => {
    const overtaken = withOneClaim((draft) => {
      for (const claim of draft.contractRunway.claimedByOpenPullRequests) {
        claim.contract = repositoryContract
      }
    })
    const problems = validateProgramme(overtaken, repositoryContract)
    expect(problems.some((problem) => problem.includes('duplicate identity'))).toBe(true)
  })

  it('refuses a claim that leaves a hole in the runway', () => {
    const gap = withOneClaim((draft) => {
      for (const claim of draft.contractRunway.claimedByOpenPullRequests) {
        claim.contract = repositoryContract + 3
      }
    })
    const problems = validateProgramme(gap, repositoryContract)
    expect(problems.some((problem) => problem.includes('contiguously'))).toBe(true)
  })

  it('refuses an unclassified open pull request that claims a number', () => {
    let claimingPr = 0
    const unclassified = withOneClaim((draft, claim) => {
      claimingPr = claim.pr
      draft.openPullRequestClassification = draft.openPullRequestClassification.filter(
        (entry) => entry.pr !== claim.pr,
      )
    })
    expect(validateProgramme(unclassified, repositoryContract)).toContain(
      `pull request ${claimingPr} claims a number but is unclassified`,
    )
  })

  it('refuses a draft called ready to merge', () => {
    let classifiedPr = 0
    const draftReady = withOneClaim((_draft, _claim, entry) => {
      classifiedPr = entry.pr
      entry.draft = true
      entry.classification = 'ready_to_merge'
    })
    expect(validateProgramme(draftReady, repositoryContract)).toContain(
      `pull request ${classifiedPr}: a draft is not ready to merge`,
    )
  })

  it('refuses acceptance evidence with nothing written in it', () => {
    for (const status of ['ready', 'complete'] as const) {
      const blank = bend((draft) => {
        const stage = stageIn(draft, '0')
        stage.status = status
        stage.pr = 1000
        stage.headSha = 'a'.repeat(40)
        stage.mergedSha = status === 'complete' ? 'b'.repeat(40) : null
        stage.acceptanceEvidence = ['   ']
      })
      const problems = validateProgramme(blank, repositoryContract)
      expect(problems, status).toContain('stage 0: acceptance evidence with nothing written in it')
      expect(problems, status).toContain(`stage 0: ${status} without acceptance evidence`)
    }
  })

  it('refuses a classification rationale that copies a fact it does not own', () => {
    const copied = withOneClaim((_draft, _claim, entry) => {
      entry.rationale = `Checked at ${'e'.repeat(40)}, and it is fine, which is a reason of sorts.`
    })
    const problems = validateProgramme(copied, repositoryContract)
    expect(problems.some((problem) => problem.includes('rationale copies a fact'))).toBe(true)
  })

  it('refuses to become a second authority for a fact it does not own', () => {
    for (const copied of ['repository is at contract 214', 'merged at ' + 'c'.repeat(40)]) {
      const copy = bend((draft) => {
        const stage = stageIn(draft, '0')
        stage.acceptanceEvidence = [copied]
      })
      const problems = validateProgramme(copy, repositoryContract)
      expect(problems.some((problem) => problem.includes('copies a fact')), copied).toBe(true)
    }
  })

  it('keeps the moving numbers out of the record and in their own authorities', () => {
    const serialised = JSON.stringify(state.stages) + JSON.stringify(state.openPullRequestClassification)
    expect(serialised).not.toMatch(/contract\s+\d+/i)
    expect(state.contractRunway.authority).toBe('config/deployment-contract.json')
    expect(controller).not.toMatch(/contract\s+\d+/i)
    expect(controller).not.toMatch(/\b[0-9a-f]{40}\b/)
  })

  it('is reachable from the root agent router', () => {
    expect(rootAgents).toContain('config/player-value-programme.json')
    expect(rootAgents).toContain('docs/product/player-value-programme-controller.md')
    expect(state.controller).toBe('docs/product/player-value-programme-controller.md')
  })

  it('states why a stage cannot record its own merge', () => {
    expect(controller).toContain('cannot contain its own merge commit')
    expect(controller).toContain('the next stage')
  })

  it('does not weaken the merge gate to make the programme progress', () => {
    expect(controller).toContain('exact head')
    expect(controller).toContain('Do not weaken a gate')
    expect(state.completionPredicate).toBe('every_stage_complete_with_its_merged_pr_present_on_main')
  })
})
