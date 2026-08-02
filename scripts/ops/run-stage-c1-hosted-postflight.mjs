#!/usr/bin/env node

import {
  assertPreserved,
  collectEvidence,
  parseArguments,
  readPreflightArtifact,
  writeEvidence,
} from './stage-c1-evidence-lib.mjs'

const usage = `Usage (linked mode by default; CI sets STAGE_C1_TARGET_MODE=db-url
and consumes SUPABASE_DEV_DB_URL only from the environment):
  SUPABASE_BIN=/absolute/path/to/supabase node scripts/ops/run-stage-c1-hosted-postflight.mjs \\
    --project-ref iouzoutneyjpugbbtdem \\
    --baseline /secure/path/stage-c1-preflight-UTC.json \\
    --output /secure/path/stage-c1-postflight-UTC.json`

try {
  const arguments_ = parseArguments(process.argv.slice(2), { baseline: true })
  if (arguments_.help) {
    console.log(usage)
    process.exit(0)
  }
  const baseline = readPreflightArtifact(arguments_.baseline)
  const artifact = collectEvidence({
    projectRef: arguments_.project_ref,
    sqlPath: 'supabase/ops/stage-c1/stage-c1-hosted-postflight.sql',
    resultColumn: 'stage_c1_postflight',
    phase: 'postflight',
  })
  assertPreserved(baseline, artifact)
  artifact.preservation_comparison = 'passed'
  const output = writeEvidence(arguments_.output, artifact)
  console.log(`Canonical Stage C1 postflight written to ${output}`)
} catch (error) {
  console.error(`ERROR: ${error.message}`)
  process.exit(1)
}
