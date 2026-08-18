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

const productionRow = `| Production Supabase | **${production.requiredMigrationCount}** |`
if (!inventory.includes(productionRow)) {
  fail(`Migration inventory is missing the current production row: ${productionRow}`)
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
