#!/usr/bin/env node
/**
 * Decide whether a migration is additive, for the ADR 0024 development fast
 * lane.
 *
 * The fast lane exists because development data is disposable; it admits
 * additive migrations only, and anything destructive goes back to
 * `stage-c1-development-rollout.yml` with its backup and restore rehearsal.
 *
 * The first version of this check was an inline `grep -Ei` over the whole
 * migration file. It refused contract 66 on this line:
 *
 *     delete from public.bonus_competition_entrants entrant
 *
 * which is inside the body of the "leave a game" RPC. That statement is what
 * the function does when a player leaves — runtime behaviour of a function the
 * migration *creates*. The migration itself dropped nothing. A whole-file grep
 * cannot tell a definition from an execution, and since almost every real
 * migration defines an RPC that deletes or updates something, the lane would
 * have refused nearly everything and quietly become unused.
 *
 * So the body of a `create function` / `create procedure` is excluded, and two
 * things deliberately are not:
 *
 *   - `do $$ ... $$` blocks, which execute during the migration;
 *   - everything at statement level, which is the migration itself.
 *
 * Direction of failure: anything this cannot parse confidently is reported as
 * destructive. Refusing an additive migration costs a slower rollout; admitting
 * a destructive one costs the thing the backup would have restored.
 *
 * THIRD CATEGORY, added because it was slipping through by accident rather than
 * by decision. `alter table ... drop constraint` and `drop index` remove a
 * GUARANTEE but no row, and the destructive pattern above never named them — so
 * the lane admitted them in silence, which is the one outcome neither category
 * was meant to produce. They are now recognised and REPORTED: the lane still
 * carries them, because a backup restores rows and there are no rows to lose,
 * but the rollout record names the guarantee that went. Silence would have read
 * as "nothing structural happened".
 */

import { readFileSync } from 'node:fs'
import process from 'node:process'

/** Statements that change or remove existing data or structure. */
const DESTRUCTIVE =
  /(drop\s+(table|column|schema|type|function|trigger|policy)|truncate\s|delete\s+from|alter\s+table\s+[^;]*drop\s+column)/gi

/**
 * Removes a guarantee, not a row. Reported rather than refused — see the header.
 *
 * `if exists` is matched optionally because `drop constraint if exists` is the
 * idiomatic form and would otherwise read as an unrecognised statement.
 */
const STRUCTURAL = /drop\s+(?:constraint|index)(?:\s+if\s+exists)?/gi

/**
 * Strip `--` line comments and block comments.
 *
 * @param {string} sql
 * @returns {string}
 */
export function withoutComments(sql) {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * Remove the dollar-quoted bodies of function and procedure definitions.
 *
 * PostgreSQL allows an arbitrary tag between the dollars (`$$`, `$fn$`), and
 * the closing tag must match the opening one — so the tag is captured and
 * searched for rather than assuming `$$`.
 *
 * @param {string} sql
 * @returns {string}
 */
export function withoutRoutineBodies(sql) {
  const opening = /\bcreate\s+(?:or\s+replace\s+)?(?:function|procedure)\b/gi
  let result = ''
  let index = 0

  for (;;) {
    opening.lastIndex = index
    const match = opening.exec(sql)
    if (match === null) break

    const tagMatch = /\$([A-Za-z_0-9]*)\$/.exec(sql.slice(match.index))
    if (tagMatch === null) break

    const bodyStart = match.index + tagMatch.index
    const tag = tagMatch[0]
    const bodyEnd = sql.indexOf(tag, bodyStart + tag.length)
    if (bodyEnd === -1) break

    // Keep everything up to the opening tag: the signature, and any statement
    // that preceded it. Drop only what lies between the matching tags.
    result += sql.slice(index, bodyStart)
    index = bodyEnd + tag.length
  }

  return result + sql.slice(index)
}

/** @param {string} sql */
export function destructiveStatements(sql) {
  const scannable = withoutRoutineBodies(withoutComments(sql))
  return [...scannable.matchAll(DESTRUCTIVE)].map((match) =>
    match[0].replace(/\s+/g, ' ').trim(),
  )
}

/** @param {string} sql */
export function structuralStatements(sql) {
  const scannable = withoutRoutineBodies(withoutComments(sql))
  return [...scannable.matchAll(STRUCTURAL)].map((match) =>
    match[0].replace(/\s+/g, ' ').trim().toLowerCase(),
  )
}

/** @param {string[]} files */
export function inspect(files) {
  return files.map((file) => {
    const sql = readFileSync(file, 'utf8')
    return {
      file,
      destructive: destructiveStatements(sql),
      structural: structuralStatements(sql),
    }
  })
}

const invokedAs = process.argv[1]?.split('/').pop() ?? ''
if (invokedAs !== '' && import.meta.url.endsWith(invokedAs)) {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    console.error('Usage: check-migration-additive.mjs <migration.sql> [...]')
    process.exit(2)
  }

  let refused = false
  for (const { file, destructive, structural } of inspect(files)) {
    if (destructive.length > 0) {
      refused = true
      console.error(`REFUSED: ${file} contains destructive statements at migration level:`)
      for (const statement of [...new Set(destructive)]) console.error(`  ${statement}`)
    } else if (structural.length > 0) {
      // Carried, but never in silence: the rollout record must name the
      // guarantee that was removed.
      console.log(`additive: ${file}`)
      console.log(`  structural (no rows lost, carried by the lane, reported):`)
      for (const statement of [...new Set(structural)]) console.log(`    ${statement}`)
    } else {
      console.log(`additive: ${file}`)
    }
  }

  if (refused) {
    console.error('Destructive migrations do not use the fast lane.')
    console.error('Use stage-c1-development-rollout.yml, which keeps the backup and rehearsal.')
    process.exit(1)
  }
}
