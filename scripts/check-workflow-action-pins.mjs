#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const FULL_SHA = /^[0-9a-f]{40}$/

/**
 * @param {string} diff
 * @returns {Array<{line: number, action: string}>}
 */
export function findFloatingAddedActionRefs(diff) {
  const findings = []

  for (const [index, line] of diff.split('\n').entries()) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue
    const action = line.match(/^\+\s*(?:-\s*)?uses:\s*([^\s#]+)/)?.[1]
    if (!action || action.startsWith('./') || action.startsWith('docker://')) {
      continue
    }

    const separator = action.lastIndexOf('@')
    const reference = separator === -1 ? '' : action.slice(separator + 1)
    if (!FULL_SHA.test(reference)) {
      findings.push({ line: index + 1, action })
    }
  }

  return findings
}

/**
 * @param {string} source
 * @param {string} [file]
 * @returns {Array<{file: string, line: number, action: string}>}
 */
export function findFloatingActionRefs(source, file = '<workflow>') {
  const findings = []

  for (const [index, line] of source.split('\n').entries()) {
    const action = line.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/)?.[1]
    if (!action || action.startsWith('./') || action.startsWith('docker://')) {
      continue
    }

    const separator = action.lastIndexOf('@')
    const reference = separator === -1 ? '' : action.slice(separator + 1)
    if (!FULL_SHA.test(reference)) {
      findings.push({ file, line: index + 1, action })
    }
  }

  return findings
}

function main() {
  const workflows = execFileSync(
    'git',
    ['ls-files', '.github/workflows/*.yml', '.github/workflows/*.yaml'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter(Boolean)
  const findings = workflows.flatMap((file) =>
    findFloatingActionRefs(readFileSync(file, 'utf8'), file),
  )

  if (findings.length === 0) {
    console.log(`All external GitHub Action references are full SHAs (${workflows.length} workflows).`)
    return
  }

  console.error('External GitHub Actions must use an exact 40-character commit SHA:')
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}: ${finding.action}`)
  }
  process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
