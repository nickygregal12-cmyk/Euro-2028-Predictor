#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultRepoRoot = resolve(scriptDir, '..')
const repoRoot = resolve(
  process.env.MIGRATION_GUARD_REPO_ROOT ?? defaultRepoRoot,
)
const migrationDirectory = 'supabase/migrations'
const migrationPattern = /^(\d{14})_.+\.sql$/

function runGit(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function outputLines(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function migrationRecord(path) {
  const filename = basename(path)
  const match = filename.match(migrationPattern)

  if (!match) {
    throw new Error(
      `Migration filename ${filename} must start with a 14-digit timestamp.`,
    )
  }

  return {
    filename,
    path,
    timestamp: match[1],
  }
}

function validate(basePaths, addedPaths) {
  const baseMigrations = basePaths.map(migrationRecord)

  if (baseMigrations.length === 0) {
    throw new Error(`origin/main has no migrations in ${migrationDirectory}.`)
  }

  const highestOnMain = baseMigrations.reduce(
    (highest, migration) =>
      migration.timestamp > highest ? migration.timestamp : highest,
    baseMigrations[0].timestamp,
  )

  if (addedPaths.length === 0) {
    return {
      addedCount: 0,
      highestOnMain,
    }
  }

  const errors = []
  let previous = null

  for (const path of addedPaths) {
    let migration

    try {
      migration = migrationRecord(path)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      continue
    }

    if (migration.timestamp <= highestOnMain) {
      errors.push(
        `${migration.filename} uses timestamp ${migration.timestamp}, which is not ` +
          `above origin/main highest ${highestOnMain}.`,
      )
    }

    if (previous && migration.timestamp <= previous.timestamp) {
      errors.push(
        `${migration.filename} uses timestamp ${migration.timestamp} after ` +
          `${previous.filename} (${previous.timestamp}); added migrations must be ` +
          `strictly ordered. origin/main highest is ${highestOnMain}.`,
      )
    }

    previous = migration
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  return {
    addedCount: addedPaths.length,
    highestOnMain,
  }
}

function checkMigrationTimestamps() {
  runGit([
    'fetch',
    '--no-tags',
    '--prune',
    'origin',
    '+refs/heads/main:refs/remotes/origin/main',
  ])

  const basePaths = outputLines(
    runGit([
      'ls-tree',
      '-r',
      '--name-only',
      'origin/main',
      '--',
      migrationDirectory,
    ]),
  ).filter((path) => path.endsWith('.sql'))

  const addedPaths = outputLines(
    runGit([
      'diff',
      '--name-only',
      '--diff-filter=A',
      'origin/main...HEAD',
      '--',
      migrationDirectory,
    ]),
  ).filter((path) => path.endsWith('.sql'))

  const result = validate(basePaths, addedPaths)

  if (result.addedCount === 0) {
    console.log(
      `Migration timestamp guard passed: no migrations added; origin/main highest is ${result.highestOnMain}.`,
    )
    return
  }

  console.log(
    `Migration timestamp guard passed: ${result.addedCount} added migration(s) are ` +
      `strictly ordered above origin/main highest ${result.highestOnMain}.`,
  )
}

try {
  checkMigrationTimestamps()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Migration timestamp guard failed:\n${message}`)
  process.exitCode = 1
}
