#!/usr/bin/env node
// Generate NOW.md — one page of current facts, derived rather than maintained.
//
// WHY THIS IS GENERATED AND NOT WRITTEN. `DOC-001` has been open in the risk
// register through two reconciliations for one reason: a document that states a
// moving value has to be edited every time the value moves, and the edit is what
// gets forgotten. Development sat at contract 120 on `main` for two hours after
// the fast lane took it to 122, while a correct record existed on a branch. The
// documentation authorities are sound now; what was missing is a single small
// surface that CANNOT be stale, because nobody types into it.
//
// So this reads the machine-readable sources and refuses to guess:
//
//   FAIL CLOSED  when two sources disagree, the generator errors rather than
//                choosing one. A wrong current-state page is worse than none,
//                because it is the page an agent trusts fastest.
//
//   LINK, DO NOT COPY  accepted-but-unbuilt requirements are counted and linked.
//                Copying them here would create a second list to keep in step,
//                which is the duplication the reconciliation removed.
//
//   PRODUCTION IS READ, NEVER INFERRED  promotion authorisation is a fact in the
//                hosted record. It is not derivable from how far the repository
//                has come, and a page that implied otherwise would be an
//                argument for promoting production.
//
//   AND READ FROM PRODUCTION'S OWN RECORD  production's contract is stated in
//                `config/production-hosted-contract.json` and nowhere else. It
//                used to be read from a copy kept in the *development* record,
//                which the development follow-up refreshed after a development
//                rollout — so a PRODUCTION rollout left the copy behind, and
//                `--check` could not catch it because it regenerated from the
//                same stale copy. On 10 August 2026 this page told every reader
//                production was at 145 while production stood at 151. A
//                duplicated fact with a one-directional check fails this way
//                eventually; the copy is gone, and the generator now refuses a
//                development record that restates production at all.
//
// Usage:
//   node scripts/generate-now.mjs            # write NOW.md
//   node scripts/generate-now.mjs --check    # exit 1 if NOW.md is out of date
//   node scripts/generate-now.mjs --stdout   # print, write nothing
//   node scripts/generate-now.mjs --root DIR # operate on another tree (tests)

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const GENERATED_BY = 'scripts/generate-now.mjs'

/** @param {string} message */
function fail(message) {
  console.error(`NOW.md generation failed: ${message}`)
  process.exit(1)
}

/** @param {string} root @param {string} relative */
function readJson(root, relative) {
  const path = resolve(root, relative)
  if (!existsSync(path)) fail(`${relative} is missing`)
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return fail(`${relative} is not valid JSON: ${String(error)}`)
  }
}

/** @param {string} root */
function migrations(root) {
  const directory = resolve(root, 'supabase/migrations')
  if (!existsSync(directory)) fail('supabase/migrations is missing')
  return readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

/**
 * The flags that decide which implementation serves a journey, read from the
 * module that owns them rather than from a list kept beside it.
 * @param {string} root
 */
function journeyFlags(root) {
  const source = readFileSync(resolve(root, 'src/app/routeFlags.ts'), 'utf8')
  const netlify = existsSync(resolve(root, 'netlify.toml'))
    ? readFileSync(resolve(root, 'netlify.toml'), 'utf8')
    : ''

  const names = [...source.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)].map((m) => m[1])
  if (names.length === 0) fail('no journey flags found in src/app/routeFlags.ts')

  return [...new Set(names)].sort().map((name) => {
    // Which Netlify context, if any, sets it. Anything unset fails closed to
    // the legacy journey, which is routeFlags.ts's own stated rule.
    const contexts = [...netlify.matchAll(/\[context\.([a-z-]+)\.environment]([\s\S]*?)(?=\n\[|$)/g)]
      .filter(([, , body]) => new RegExp(`^\\s*${name}\\s*=`, 'm').test(body))
      .map(([, context]) => context)
    const inBuild = new RegExp(`\\[build\\.environment][\\s\\S]*?^\\s*${name}\\s*=`, 'm').test(netlify)
    return { name, contexts, inBuild }
  })
}

/**
 * Counts only, and a link. Deliberately not the rows: a second copy of the
 * register would need keeping in step with the first.
 * @param {string} root
 */
function acceptedRequirements(root) {
  const path = resolve(root, 'docs/quality/accepted-requirements.md')
  if (!existsSync(path)) return null
  const source = readFileSync(path, 'utf8')

  const rows = source
    .split('\n')
    .filter((line) => /^\| `(?:SITE|ACCOUNT|EURO|AGE|PRIV|INGEST|CAP)-\d{3}` \|/.test(line))

  // The register also carries rows that HAVE shipped — they stay in it, marked,
  // because deleting one destroys the only trace the requirement existed. This
  // page counts what is outstanding, so those are excluded rather than counted
  // under a heading that says "not built".
  // Matched without a closing delimiter on purpose: the register writes both
  // `**Implemented**` and `**Implemented and in force**`, and an exact-pair
  // regex silently counted the second as outstanding. Lowercase "not
  // implemented" cannot match, because the capital follows the asterisks.
  const outstanding = rows.filter((row) => !/\*\*Implemented/.test(row))

  const prefixes = new Map()
  let blocked = 0
  for (const row of outstanding) {
    const id = /`([A-Z]+)-\d{3}`/.exec(row)?.[1]
    if (id) prefixes.set(id, (prefixes.get(id) ?? 0) + 1)
    if (/\bblocked\b/i.test(row)) blocked += 1
  }

  return {
    total: outstanding.length,
    implemented: rows.length - outstanding.length,
    prefixes: [...prefixes.entries()].sort(),
    blocked,
  }
}

/** @param {string} root */
export function collect(root) {
  const deployment = readJson(root, 'config/deployment-contract.json')
  const hosted = readJson(root, 'config/development-hosted-contract.json')
  const production = readJson(root, 'config/production-hosted-contract.json')
  const chain = migrations(root)
  const latest = chain.at(-1)

  // ---- fail-closed checks -------------------------------------------------
  //
  // Each of these is a disagreement between two sources that both claim to
  // describe the same fact. Publishing either answer would be a guess.

  if (deployment.requiredMigrationCount !== chain.length) {
    fail(
      `deployment contract claims ${deployment.requiredMigrationCount} migrations, ` +
        `the chain holds ${chain.length}`,
    )
  }

  if (deployment.contractVersion !== deployment.requiredMigrationCount) {
    fail(
      `deployment contract version ${deployment.contractVersion} and migration count ` +
        `${deployment.requiredMigrationCount} disagree`,
    )
  }

  if (typeof production.promotionAuthorised !== 'boolean') {
    fail('the production hosted record does not state promotionAuthorised as a boolean')
  }

  if (!Number.isInteger(production.requiredMigrationCount)) {
    fail('the production hosted record does not state requiredMigrationCount as an integer')
  }

  // One record states production, and it is production's own. A second copy
  // does not disagree on the day it is written; it disagrees on the day one of
  // the two moves, and the mover is whichever the writer did not think of.
  for (const field of ['productionContract', 'productionPromotionAuthorised']) {
    if (hosted[field] !== undefined) {
      fail(
        `the development hosted record restates production as \`${field}\`. ` +
          'Production is stated in config/production-hosted-contract.json and nowhere else — ' +
          'delete the field rather than keeping the two in step.',
      )
    }
  }

  if (hosted.requiredMigrationCount > deployment.requiredMigrationCount) {
    // Development cannot lead: a migration cannot be applied before it exists.
    fail(
      `development is recorded at ${hosted.requiredMigrationCount}, ahead of the repository ` +
        `at ${deployment.requiredMigrationCount}`,
    )
  }

  if (production.requiredMigrationCount > deployment.requiredMigrationCount) {
    fail(
      `production is recorded at ${production.requiredMigrationCount}, ahead of the repository ` +
        `at ${deployment.requiredMigrationCount}`,
    )
  }

  const hostedLatest = `${hosted.latestMigrationVersion}_${hosted.latestMigrationName}.sql`
  if (!chain.includes(hostedLatest)) {
    fail(`the hosted record names ${hostedLatest}, which is not in the migration chain`)
  }

  const pending = chain.slice(hosted.requiredMigrationCount)

  return {
    repositoryContract: deployment.requiredMigrationCount,
    latestMigration: latest,
    developmentContract: hosted.requiredMigrationCount,
    developmentLatest: hostedLatest,
    developmentVerifiedAt: hosted.verifiedAt ?? null,
    developmentRunId: hosted.evidence?.workflowRunId ?? null,
    productionContract: production.requiredMigrationCount,
    productionPromotionAuthorised: production.promotionAuthorised,
    pending,
    nextFreeContract: deployment.requiredMigrationCount + 1,
    flags: journeyFlags(root),
    requirements: acceptedRequirements(root),
  }
}

/** @param {ReturnType<typeof collect>} f */
export function render(f) {
  const pending =
    f.pending.length === 0
      ? 'None. Hosted development is level with the repository.'
      : `${f.pending.length} — ${f.pending.map((name) => `\`${name}\``).join(', ')}`

  const flags = f.flags
    .map((flag) => {
      const where =
        flag.contexts.length > 0
          ? `set in \`${flag.contexts.join('`, `')}\``
          : flag.inBuild
            ? 'set in the base build environment'
            : '**unset everywhere** — the journey serves its legacy implementation'
      return `| \`${flag.name}\` | ${where} |`
    })
    .join('\n')

  const requirements = f.requirements
    ? `**${f.requirements.total}** accepted requirements are outstanding` +
      (f.requirements.blocked > 0 ? `, of which **${f.requirements.blocked}** are blocked` : '') +
      ` — ${f.requirements.prefixes.map(([p, n]) => `${p} ${n}`).join(', ')}.` +
      (f.requirements.implemented > 0
        ? ` A further ${f.requirements.implemented} are marked implemented and retained in the register.`
        : '')
    : 'The requirement register is missing.'

  return `# NOW

<!-- GENERATED BY ${GENERATED_BY} — DO NOT EDIT BY HAND.
     Run \`npm run generate:now\` after any contract or hosted-record change.
     This is an index of current facts. It decides nothing: every authority it
     names outranks it, and where it disagrees with one, it is the one that is
     wrong. -->

One page of current facts, generated from the machine-readable sources. It is
**not** a decision authority and holds no rule.

## Contracts

| | Contract | Detail |
| --- | ---: | --- |
| Repository | **${f.repositoryContract}** | latest \`${f.latestMigration}\` |
| Development hosted | **${f.developmentContract}** | at \`${f.developmentLatest}\`, verified \`${f.developmentVerifiedAt ?? 'unrecorded'}\`${f.developmentRunId ? `, fast-lane run \`${f.developmentRunId}\`` : ''} |
| Production | **${f.productionContract}** | promotion **${f.productionPromotionAuthorised ? 'AUTHORISED' : 'not authorised'}** |

Production is read from production's own hosted record, and promotion
authorisation with it. It is never inferred from how far the repository or
development has come, and it is never copied into a second file — a copy goes
stale the moment the other one moves.

**Pending development migrations:** ${pending}

**Next free contract number:** ${f.nextFreeContract}. Check open pull requests
before claiming it — two branches claiming one number is a known failure here.

## Journey flags

| Flag | State |
| --- | --- |
${flags}

An unset flag fails closed to the legacy journey, per \`src/app/routeFlags.ts\`.

## Accepted and not built

${requirements}

They are listed with their dependencies and acceptance evidence in
[\`docs/quality/accepted-requirements.md\`](docs/quality/accepted-requirements.md).
They are deliberately **not** copied here — a second list is a second thing to
keep in step.

## Where the answers live

| Question | Authority |
| --- | --- |
| What is true now | [\`docs/quality/current-status.md\`](docs/quality/current-status.md) |
| What was decided, and what was rejected | [\`docs/adr/README.md\`](docs/adr/README.md) |
| What was accepted and is not built | [\`docs/quality/accepted-requirements.md\`](docs/quality/accepted-requirements.md) |
| What happens next, in order | [\`docs/roadmap.md\`](docs/roadmap.md) |
| The detailed task inventory | [\`MASTER-TODO.md\`](MASTER-TODO.md) |
| Current risks and findings | [\`docs/quality/risk-register.md\`](docs/quality/risk-register.md) |
| Migration inventory and hosted applied state | [\`docs/ops/ops-pending-migrations.md\`](docs/ops/ops-pending-migrations.md) |
| Agent operating rules | [\`AGENTS.md\`](AGENTS.md) |

Dated audits, investigations, reconciliations and automation runs are historical
evidence at their recorded commit. They are never refreshed to look current.

## Which commit you are reading

\`\`\`bash
git rev-parse HEAD
\`\`\`

Deliberately a command rather than a value. A committed file cannot contain its
own commit hash — the hash does not exist until after the write — so any SHA
printed here would name the commit *before* this page, and would be wrong from
the moment it was correct. Ask git.
`
}

const args = process.argv.slice(2)
const rootFlag = args.indexOf('--root')
const root = rootFlag === -1 ? process.cwd() : resolve(args[rootFlag + 1] ?? '.')
const output = render(collect(root))
const target = resolve(root, 'NOW.md')

if (args.includes('--stdout')) {
  process.stdout.write(output)
} else if (args.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : ''
  if (current !== output) {
    fail('NOW.md is out of date. Run `npm run generate:now`.')
  }
  console.log(`NOW.md is current: repository ${collect(root).repositoryContract}.`)
} else {
  writeFileSync(target, output)
  console.log(`NOW.md written: repository ${collect(root).repositoryContract}.`)
}
