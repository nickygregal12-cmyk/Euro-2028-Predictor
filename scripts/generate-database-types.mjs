#!/usr/bin/env node
/**
 * Regenerate `src/services/supabase/database.types.ts` from hosted Development.
 *
 * WHY HOSTED AND NOT LOCAL. `supabase gen types --local` would be the better
 * source — it reads the committed migrations, needs no credentials, and cannot
 * disagree with the repository. It needs a running local Supabase, which needs
 * Docker. This script therefore targets hosted Development, and the tradeoff is
 * stated rather than hidden: **the generated file is true of Development at the
 * instant it ran**, which is only the same thing as the repository when the two
 * are level. The meta file records the contract it was generated at so that
 * question is answerable, and `databaseTypes.test.ts` fails when the repository
 * moves past it.
 *
 * IT REFUSES PRODUCTION BY NAME. The project is read from
 * `config/development-hosted-contract.json` rather than taken as an argument,
 * and the ref in `config/production-hosted-contract.json` is rejected outright
 * even if it somehow appears there. This mirrors the contract-144 backfill job,
 * which refuses the Production project by name for the same reason: a read is
 * harmless right up until the day the script grows a write.
 *
 * IT IS READ-ONLY. `supabase gen types` issues no DDL and no DML. Running it
 * against Development is hosted INSPECTION, which `AGENTS.md` permits by
 * default; it is not a hosted mutation and it is not a hosted claim.
 *
 * REQUIRES either `SUPABASE_DEV_DB_URL` (preferred, and already a repository
 * secret) or `SUPABASE_ACCESS_TOKEN` in the environment. See the branch below
 * for why there are two and why neither may reach Production.
 *
 * Still deliberately not wired into ordinary CI: making every pull request
 * depend on a hosted service being reachable would fail builds for reasons that
 * have nothing to do with the change under review, and would fail them
 * legitimately whenever Development trails the repository — which ADR 0024
 * treats as the normal working state. `regenerate-database-types.yml` runs it
 * on demand instead, which is a different thing from running it on every push.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const TYPES_PATH = 'src/services/supabase/database.types.ts'
const META_PATH = 'src/services/supabase/database.types.meta.json'

const HEADER = `// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Regenerate with \`npm run generate:types\` (see that script for what it needs).
// Provenance — which schema this was generated from, and when — is in the
// machine-readable sibling \`database.types.meta.json\`, not in this header,
// because a header comment does not survive regeneration and a provenance
// record that the generator silently deletes is worse than none.
//
// WHAT IT CLOSES. \`TYPE-001\`: every Supabase call in this repository was
// hand-typed or cast, so a column rename in a migration compiled clean and
// failed at runtime. With 151 migrations and 53 tables that was the
// highest-probability route to a silent defect.
//
// WHAT IT DOES NOT CLOSE. This file being present does not mean it is USED.
// It is only load-bearing where a caller consumes it; see \`client.ts\`.

`

/** @param {string} path */
function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'))
}

function migrationCount() {
  return readdirSync(resolve(root, 'supabase/migrations')).filter((name) =>
    name.endsWith('.sql'),
  ).length
}

const development = readJson('config/development-hosted-contract.json')
const production = readJson('config/production-hosted-contract.json')

const projectRef = development.projectRef
if (!projectRef) {
  console.error('The development hosted record names no projectRef.')
  process.exit(1)
}

// The refusal. Not a formality: if the two records were ever edited into
// agreement by mistake, this is what stops a generation reading Production.
if (projectRef === production.projectRef) {
  console.error(
    `Refusing to generate types: the development record names ${projectRef}, ` +
      'which is the Production project. Nothing in this script may read Production.',
  )
  process.exit(1)
}

/*
 * TWO WAYS TO REACH THE SAME DEVELOPMENT SCHEMA, and the reason there are two.
 *
 * `--project-id` needs `SUPABASE_ACCESS_TOKEN`, a Supabase MANAGEMENT token.
 * That token is held by nobody: it is not in the environment and no workflow
 * carries it, so on 11 August 2026 the repository could not regenerate its own
 * types and the staleness guard stayed red at `expected 151 to be 157` with no
 * route to green. A guard nobody can satisfy stops being a guard and becomes
 * noise people learn to scroll past.
 *
 * `--db-url` needs only a connection string, and `SUPABASE_DEV_DB_URL` already
 * exists as a repository secret — the development fast lane uses it. Same
 * hosted Development database, same schema, no new credential to mint.
 *
 * The db-url path is preferred when available and the token path is kept, so
 * an owner with a management token still gets the behaviour the header
 * describes. What is NOT relaxed is the refusal: whichever path runs, this
 * script must not read Production, so the connection string is checked for the
 * Production ref by name exactly as the project ref is above.
 */
const devDbUrl = process.env.SUPABASE_DEV_DB_URL?.trim()

if (devDbUrl && production.projectRef && devDbUrl.includes(production.projectRef)) {
  console.error(
    'Refusing to generate types: SUPABASE_DEV_DB_URL resolves to the Production ' +
      `project ${production.projectRef}. Nothing in this script may read Production.`,
  )
  process.exit(1)
}

if (devDbUrl && !devDbUrl.includes(projectRef)) {
  console.error(
    `Refusing to generate types: SUPABASE_DEV_DB_URL names neither ${projectRef} ` +
      'nor any known project. An unrecognised target is not a Development target.',
  )
  process.exit(1)
}

if (!devDbUrl && !process.env.SUPABASE_ACCESS_TOKEN) {
  console.error(
    'Neither SUPABASE_DEV_DB_URL nor SUPABASE_ACCESS_TOKEN is set, so there is no\n' +
      'way to read the Development schema. Either works; the connection string is\n' +
      'the one this repository already holds as a secret.',
  )
  process.exit(1)
}

const generatorArgs = devDbUrl
  ? ['--yes', 'supabase', 'gen', 'types', 'typescript', '--db-url', devDbUrl, '--schema', 'public']
  : ['--yes', 'supabase', 'gen', 'types', 'typescript', '--project-id', projectRef, '--schema', 'public']

console.log(
  `Generating types from Development (${projectRef}) via ` +
    `${devDbUrl ? 'the database connection' : 'the management API'}…`,
)

const generated = execFileSync('npx', generatorArgs, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})

if (!generated.includes('export type Database')) {
  console.error('Generation produced no Database type. Refusing to overwrite the committed file.')
  process.exit(1)
}

writeFileSync(resolve(root, TYPES_PATH), HEADER + generated)

// The contract the types describe. Recorded rather than inferred later, because
// after the write there is nothing in the file itself that says which schema it
// came from.
const meta = {
  '//': [
    'Provenance for database.types.ts. Written by scripts/generate-database-types.mjs.',
    'generatedFromContract is the repository migration COUNT at generation time,',
    'which databaseTypes.test.ts compares against the current count to detect a',
    'types file left behind by a later migration.',
  ],
  source: 'hosted-development',
  projectRef,
  generatedFromContract: migrationCount(),
  developmentHostedContract: development.requiredMigrationCount,
  developmentVerifiedAt: development.verifiedAt,
}
writeFileSync(resolve(root, META_PATH), `${JSON.stringify(meta, null, 2)}\n`)

console.log(`Wrote ${TYPES_PATH} and ${META_PATH} at contract ${meta.generatedFromContract}.`)

if (meta.generatedFromContract !== development.requiredMigrationCount) {
  console.warn(
    `\nWARNING: the repository holds ${meta.generatedFromContract} migrations but hosted ` +
      `Development is recorded at ${development.requiredMigrationCount}.\n` +
      'The generated types describe DEVELOPMENT, so they do not yet describe the ' +
      'repository. Apply the pending migrations and regenerate before relying on them.',
  )
}
