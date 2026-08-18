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

/**
 * A 40-character SHA is unreadable on its own: nothing in `@3d3c42e5...` says
 * which release it is, so a stale pin looks exactly like a current one and a
 * WRONG pin looks like both. The trailing `# v7` is what makes a pin auditable
 * by a human and by `zizmor`'s `ref-version-mismatch`, which resolves the tag
 * and compares. That comparison needs the network and cannot run here; this
 * does the half that can — every pin must SAY what it claims to be, so the
 * claim exists to be checked.
 *
 * @param {string} source
 * @param {string} [file]
 * @returns {Array<{file: string, line: number, action: string}>}
 */
export function findUnlabelledActionPins(source, file = '<workflow>') {
  const findings = []

  for (const [index, line] of source.split('\n').entries()) {
    const match = line.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)(.*)$/)
    const action = match?.[1]
    const trailing = match?.[2] ?? ''
    if (!action || action.startsWith('./') || action.startsWith('docker://')) {
      continue
    }

    const separator = action.lastIndexOf('@')
    const reference = separator === -1 ? '' : action.slice(separator + 1)
    // Only pinned references are in scope. An unpinned one is already a
    // finding of `findFloatingActionRefs`, and reporting it twice buries the
    // more serious of the two.
    if (!FULL_SHA.test(reference)) continue

    if (!/^\s*#\s*v\S+/.test(trailing)) {
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
  const sources = workflows.map((file) => ({
    file,
    source: readFileSync(file, 'utf8'),
  }))
  const findings = sources.flatMap(({ file, source }) =>
    findFloatingActionRefs(source, file),
  )
  const unlabelled = sources.flatMap(({ file, source }) =>
    findUnlabelledActionPins(source, file),
  )

  if (findings.length === 0 && unlabelled.length === 0) {
    console.log(`All external GitHub Action references are full SHAs carrying a version comment (${workflows.length} workflows).`)
    return
  }

  if (findings.length > 0) {
    console.error('External GitHub Actions must use an exact 40-character commit SHA:')
    for (const finding of findings) {
      console.error(`  ${finding.file}:${finding.line}: ${finding.action}`)
    }
  }

  if (unlabelled.length > 0) {
    console.error('Every pinned action must name the version it pins, as a trailing `# v<version>` comment:')
    for (const finding of unlabelled) {
      console.error(`  ${finding.file}:${finding.line}: ${finding.action}`)
    }
  }

  process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
