import fs from 'node:fs'

const repository = JSON.parse(fs.readFileSync('config/deployment-contract.json', 'utf8'))
const hosted = JSON.parse(fs.readFileSync('config/development-hosted-contract.json', 'utf8'))
// Production is read from production's own record. It used to be read from a
// copy in the development record, refreshed only by a development rollout — so
// after a production rollout this check looked for the OLD production row, and
// found it, because the inventory keeps its superseded entries. It passed while
// checking a historical fact.
const production = JSON.parse(fs.readFileSync('config/production-hosted-contract.json', 'utf8'))
const inventory = fs.readFileSync('docs/ops/ops-pending-migrations.md', 'utf8')

/** @param {string} message */
const fail = (message) => {
  console.error(message)
  process.exitCode = 1
}

if (hosted.requiredMigrationCount > repository.requiredMigrationCount) {
  fail(
    `Hosted development contract ${hosted.requiredMigrationCount} cannot lead repository contract ${repository.requiredMigrationCount}.`,
  )
}

// ADR 0024's ordering rule, as a property of the RECORDS rather than of a
// workflow. Production must never be the first hosted environment to see a
// migration, and nothing here checked it: the pair sat at development 189 and
// production 190 -- Production a contract AHEAD -- and this script passed,
// because the only comparison it made was against the repository. Measurement
// on 18 August 2026 then found hosted Development actually holding 190, so the
// records had been wrong rather than the ordering broken; the gate is added so
// that the next time the two disagree, something says so before a promotion
// reads a stale number and believes it.
if (production.requiredMigrationCount > hosted.requiredMigrationCount) {
  fail(
    `Production is recorded at ${production.requiredMigrationCount}, ahead of development ` +
      `${hosted.requiredMigrationCount}. Production must not be the first hosted environment ` +
      'to see a migration. Apply it to development, reconcile that record, and try again.',
  )
}

if (production.promotionAuthorised !== false) {
  fail('Production promotion must remain fail-closed in the hosted contract record.')
}

if (hosted.productionContract !== undefined || hosted.productionPromotionAuthorised !== undefined) {
  fail(
    'The development hosted record must not restate production. ' +
      'config/production-hosted-contract.json is its only authority.',
  )
}

if (!inventory.includes('config/development-hosted-contract.json')) {
  fail('Migration inventory must reference config/development-hosted-contract.json.')
}

const developmentRow = `| Development Supabase \`${hosted.projectRef}\` | **${hosted.requiredMigrationCount}** |`
if (!inventory.includes(developmentRow)) {
  fail(`Migration inventory is missing the current development row: ${developmentRow}`)
}

// NAMED, LIKE THE DEVELOPMENT ROW ABOVE IT. The two rows are the same kind of
// claim and only one of them said WHICH project it was about, which is exactly
// the ambiguity a hosted record exists to remove — there are six Supabase
// projects on this account and two of them have "Euro 2028 Predictor" in the
// name. The ref comes from the record rather than from the page, so a row that
// named the wrong project would fail here rather than read plausibly.
const productionRow = `| Production Supabase \`${production.projectRef}\` | **${production.requiredMigrationCount}** |`
if (!inventory.includes(productionRow)) {
  fail(`Migration inventory is missing the current production row: ${productionRow}`)
}

// The inventory is newest-first and deliberately retains historical rollout
// evidence. A whole-document "maximum contract mentioned" check therefore
// cannot distinguish history from the CURRENT heading and summary. PR #857
// demonstrated the failure mode: its current table said 198/198/198 while the
// heading still said 198/190/189 and the next paragraph said 191-198 were
// applied nowhere. Every existing documentation test passed.
//
// Hold the first Current state heading to the three machine records exactly.
// This is the one place in the document where an older number is never history.
const currentStateHeading = /^## Current state — repository (\d+), Production (\d+), Development (\d+) \([^)]+\)$/m.exec(
  inventory,
)
if (currentStateHeading === null) {
  fail('Migration inventory is missing its current-state repository/Production/Development heading.')
} else {
  const [, repositoryClaim, productionClaim, developmentClaim] = currentStateHeading.map(Number)
  const expected = [
    repository.requiredMigrationCount,
    production.requiredMigrationCount,
    hosted.requiredMigrationCount,
  ]
  const stated = [repositoryClaim, productionClaim, developmentClaim]
  if (stated.some((value, index) => value !== expected[index])) {
    fail(
      `Migration inventory current-state heading says repository ${repositoryClaim}, ` +
        `Production ${productionClaim}, Development ${developmentClaim}; records say ` +
        `repository ${expected[0]}, Production ${expected[1]}, Development ${expected[2]}.`,
    )
  }
}

// When all three records are level the current section must say so explicitly.
// This catches contradictory adjacent prose without trying to reinterpret the
// historical sections that intentionally retain lower contract numbers.
if (
  repository.requiredMigrationCount === hosted.requiredMigrationCount &&
  hosted.requiredMigrationCount === production.requiredMigrationCount
) {
  const levelStatement =
    `**There are no pending hosted migrations: repository, Development and Production ` +
    `are level at Contract ${repository.requiredMigrationCount}.**`
  const currentSection = inventory.slice(
    currentStateHeading?.index ?? 0,
    inventory.indexOf('\n## Current state', (currentStateHeading?.index ?? 0) + 1) === -1
      ? inventory.length
      : inventory.indexOf('\n## Current state', (currentStateHeading?.index ?? 0) + 1),
  )
  if (!currentSection.includes(levelStatement)) {
    fail(`Migration inventory current state must contain: ${levelStatement}`)
  }
}

if (/Complete all exact combined-head contract 66 gates|development not applied/i.test(inventory)) {
  fail('Migration inventory still contains superseded contract-66 rollout instructions.')
}

if (!inventory.includes('historic Netlify project `euro28-predictor-dev` is out of scope')) {
  fail('Migration inventory must explicitly exclude the historic Netlify project.')
}

if (process.exitCode) process.exit(process.exitCode)

console.log(
  `Hosted migration inventory aligned: repository ${repository.requiredMigrationCount}, development ${hosted.requiredMigrationCount}, production ${production.requiredMigrationCount}.`,
)
