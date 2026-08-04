import fs from 'node:fs'

const repository = JSON.parse(fs.readFileSync('config/deployment-contract.json', 'utf8'))
const hosted = JSON.parse(fs.readFileSync('config/development-hosted-contract.json', 'utf8'))
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

if (hosted.productionPromotionAuthorised !== false) {
  fail('Production promotion must remain fail-closed in the hosted contract record.')
}

if (!inventory.includes('config/development-hosted-contract.json')) {
  fail('Migration inventory must reference config/development-hosted-contract.json.')
}

const developmentRow = `| Development Supabase \`${hosted.projectRef}\` | **${hosted.requiredMigrationCount}** |`
if (!inventory.includes(developmentRow)) {
  fail(`Migration inventory is missing the current development row: ${developmentRow}`)
}

const productionRow = `| Production Supabase | **${hosted.productionContract}** |`
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
  `Hosted migration inventory aligned: repository ${repository.requiredMigrationCount}, development ${hosted.requiredMigrationCount}, production ${hosted.productionContract}.`,
)
