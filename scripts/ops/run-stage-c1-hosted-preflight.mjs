#!/usr/bin/env node

import {
  collectEvidence,
  parseArguments,
  writeEvidence,
} from './stage-c1-evidence-lib.mjs'

const usage = `Usage:
  SUPABASE_BIN=/absolute/path/to/supabase node scripts/ops/run-stage-c1-hosted-preflight.mjs \\
    --project-ref iouzoutneyjpugbbtdem \\
    --output /secure/path/stage-c1-preflight-UTC.json`

try {
  const arguments_ = parseArguments(process.argv.slice(2))
  if (arguments_.help) {
    console.log(usage)
    process.exit(0)
  }
  const artifact = collectEvidence({
    projectRef: arguments_.project_ref,
    sqlPath: 'supabase/ops/stage-c1/stage-c1-hosted-preflight.sql',
    resultColumn: 'stage_c1_preflight',
    phase: 'preflight',
  })
  const output = writeEvidence(arguments_.output, artifact)
  console.log(`Canonical Stage C1 preflight written to ${output}`)
} catch (error) {
  console.error(`ERROR: ${error.message}`)
  process.exit(1)
}
