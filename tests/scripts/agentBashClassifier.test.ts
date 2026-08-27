import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Behavioural coverage for the PreToolUse Bash gate in `.claude/hooks/allow-bash.py`.
 *
 * This file proves the classifier decides correctly. It deliberately does NOT
 * prove the classifier is *reachable* — a hook that never loads classifies
 * nothing. That second property is a deployment concern and is covered by
 * `npm run check:bash-enforcement`; see the `$deployment-note` in
 * agent-bash-allow.json for why the two must be tested separately.
 */

const repositoryRoot = process.cwd()
const hook = resolve(repositoryRoot, '.claude/hooks/allow-bash.py')

type Verdict = 'ALLOW' | 'DENY'

/** Ask the real hook, exactly as Claude Code would, and read its decision. */
function classify(agent: string, command: string): Verdict {
  const payload = JSON.stringify({ tool_name: 'Bash', tool_input: { command } })
  const stdout = execFileSync('python3', [hook, agent], {
    input: payload,
    encoding: 'utf8',
  })
  return stdout.includes('"permissionDecision"') ? 'DENY' : 'ALLOW'
}

/**
 * Adversarial cases from the independent Codex review of 27 August 2026, plus
 * the shapes that review's findings generalised to. Every one must be refused.
 *
 * Kept as behaviour, not documentation: the point is that the classifier says
 * no, not that a reader learns the payloads. Each entry names the invariant it
 * defends so a future edit that breaks one fails with a legible reason.
 */
const ADVERSARIAL: ReadonlyArray<readonly [string, string]> = [
  // Invariant 1: an allowed executable path must not escape its directory.
  ['traversal out of the allowlisted script directory',
    "bash scripts/agent-tools/../../../../../bin/sh -c 'git commit -m x'"],
  ['traversal with an encoded payload',
    "bash scripts/agent-tools/../../../../../bin/bash -c $'git log \\x24\\x28git commit\\x29'"],
  ['traversal reached by here-string',
    "bash scripts/agent-tools/../../../../../bin/sh <<<'git commit -m x'"],

  // Invariant 2: a read/network git command must not gain execution.
  ['git transport helper that executes a command',
    'git fetch --upload-pack=\'sh -c "git commit -m x"\' .'],
  ['git external transport',
    'git fetch "ext::sh -c git% commit% -m% x"'],
  ['git configured before its subcommand',
    "git -c alias.x='!sh' x"],
  ['git redirected to another repository',
    'git -C /elsewhere log'],

  // Invariant 3: whitespace must not defeat a denial.
  ['branch creation with a doubled space', 'git switch  -c gate-bypass'],
  ['checkout branch creation with a doubled space', 'git checkout  -b gate-bypass'],

  // Invariant 4: redirects are allowlisted, not enumerated.
  ['numbered stdout redirect', 'git log 1>/tmp/gate-output'],
  ['arbitrary fd redirect', 'git log 3>/tmp/gate-output'],
  ['combined output redirect', 'git log >&/tmp/gate-output'],
  ['plain file redirect', 'git log > /tmp/gate-output'],
  ['append redirect', 'git log >> /tmp/gate-output'],

  // Invariant 5: shell-control syntax fails closed.
  ['command substitution', 'echo $(rm -rf src)'],
  ['backtick substitution', 'echo `rm -rf src`'],
  ['process substitution', 'cat <(rm -rf src)'],
  ['chained destructive command', 'git log && rm -rf src'],
  ['sequenced destructive command', 'git status; git commit -m x'],
  ['newline-separated command', 'git log\ngit commit -m x'],
  ['carriage-return hidden command', 'git log\rgit commit -m x'],
  ['line continuation', 'git log\\\ngit commit -m x'],
  ['backgrounded command', 'git log &'],
  ['subshell grouping', '(git commit -m x)'],
  ['brace grouping', '{ git commit -m x; }'],
  ['environment prefix', 'env FOO=1 git commit -m x'],
  ['assignment prefix', 'FOO=1 git log'],
  ['command builtin wrapper', 'command git commit -m x'],
  ['pipe into a shell', 'git log | sh'],
  ['pipe into xargs', 'git log | xargs rm'],
] as const

/** Commands the builder legitimately needs. Refusing these makes it useless. */
const BUILDER_ALLOWED = [
  'git status',
  'git diff 2>&1',
  'git log >/dev/null',
  'git branch --show-current',
  'git switch main',
  'git checkout main',
  'git add -A',
  'npx vitest run',
  'npx tsc --noEmit',
  'npm run check:required-contexts',
  'bash scripts/agent-tools/owner-commit.sh',
] as const

/**
 * The denials the owner-* wrappers depend on. If any of these becomes allowed,
 * config/pre-live-owner-authority.json is advisory rather than binding.
 */
const BUILDER_DENIED = [
  'git commit -m x',
  'git push',
  'git push --force',
  'gh pr create --title x',
  'gh pr merge 1',
  'git switch -c feature/x',
  'git checkout -b feature/x',
  'git branch newthing',
  'git branch -d old',
  'git checkout HEAD -- src/',
  'git checkout -- src/app.tsx',
  'npm install left-pad',
] as const

describe('Bash gate classifier', () => {
  describe('refuses every adversarial shape', () => {
    for (const [name, command] of ADVERSARIAL) {
      it(name, () => {
        expect(classify('predictor-builder', command)).toBe('DENY')
      })
    }
  })

  describe('still allows the builder to work', () => {
    for (const command of BUILDER_ALLOWED) {
      it(command, () => {
        expect(classify('predictor-builder', command)).toBe('ALLOW')
      })
    }
  })

  describe('keeps git writes routed through the owner wrappers', () => {
    for (const command of BUILDER_DENIED) {
      it(command, () => {
        expect(classify('predictor-builder', command)).toBe('DENY')
      })
    }
  })

  describe('keeps the roles separated', () => {
    it('the critic gathers no executable evidence', () => {
      expect(classify('predictor-critic', 'npm test')).toBe('DENY')
      expect(classify('predictor-critic', 'git log --oneline -5')).toBe('ALLOW')
    })

    it('visual QA runs browser lanes but not the general gate set', () => {
      expect(classify('predictor-visual-qa', 'npx playwright test')).toBe('ALLOW')
      expect(classify('predictor-visual-qa', 'npm run build')).toBe('DENY')
    })

    it('the release verifier runs gates but cannot mutate', () => {
      expect(classify('predictor-release-verifier', 'npx vitest run')).toBe('ALLOW')
      expect(classify('predictor-release-verifier', 'git commit -m x')).toBe('DENY')
    })

    it('the conductor delegates rather than running gates itself', () => {
      expect(classify('predictor-conductor', 'bash scripts/agent-tools/ox-review.sh "x"')).toBe('ALLOW')
      expect(classify('predictor-conductor', 'npm test')).toBe('DENY')
    })
  })

  describe('fails closed on its own inputs', () => {
    it('refuses an agent with no profile rather than allowing it', () => {
      expect(classify('not-a-real-agent', 'git status')).toBe('DENY')
    })

    it('allows read-only filters downstream but never as the first command', () => {
      expect(classify('predictor-critic', 'git log | head -5')).toBe('ALLOW')
      expect(classify('predictor-critic', 'head -5 /etc/passwd')).toBe('DENY')
    })
  })
})
