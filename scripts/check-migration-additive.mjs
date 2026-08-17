#!/usr/bin/env node
/**
 * Decide whether a migration is additive, for the ADR 0024 development fast
 * lane.
 *
 * The fast lane exists because development data is disposable; it admits
 * additive migrations only, and anything destructive goes to
 * `development-migration-rollout.yml`, the guarded lane.
 *
 * This comment and the refusal below used to name `stage-c1-development-rollout.yml`,
 * which is a SPENT one-shot pinned to contract 65 and refuses everything else.
 * So for months the refusal pointed at a door that was bricked up, and the gap
 * was invisible precisely because the message looked like an answer.
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
 *
 * TRIGGER RE-CREATION, which is the third category's shape and not the first's.
 * `drop trigger` is named in DESTRUCTIVE deliberately: a trigger that goes and
 * does not come back removes an enforcement, and enforcement is exactly what a
 * migration must not remove quietly. But this repository's house form for
 * defining a trigger — used by sixteen migrations, because PostgreSQL had no
 * `create or replace trigger` when the earliest were written — is
 *
 *     drop trigger if exists <name> on <table>;
 *     create trigger <name> ... on <table> ...;
 *
 * which removes nothing: the trigger that leaves on one line is back on the
 * next, and in contract 103 it had never existed before the same migration
 * created it. Contract 103 was the first migration carrying this form to reach
 * the fast lane, and the lane refused it — correctly by the letter, wrongly by
 * the intent, and with no general guarded lane to fall back to.
 *
 * So a drop is reclassified ONLY when it is immediately followed by a create of
 * the SAME trigger on the SAME table. The pairing is what makes it safe, so the
 * pairing is what is checked: `if exists` is optional and proves nothing on its
 * own. A drop with no matching create, a create of a DIFFERENT trigger, or
 * anything between the two, all stay destructive — as does a form this cannot
 * parse, which keeps the direction of failure pointing at refusal. The pairing
 * is still REPORTED, for the same reason the other structural statements are.
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
 * A `drop trigger` statement, captured so its trigger and table can be compared
 * against whatever follows it.
 *
 * Only unquoted identifiers match. A quoted one ("MyTrigger") falls through to
 * DESTRUCTIVE, which is the direction this file fails in on purpose.
 */
const DROP_TRIGGER =
  /\bdrop\s+trigger\s+(?:if\s+exists\s+)?((?:[A-Za-z_][\w$]*\.)?[A-Za-z_][\w$]*)\s+on\s+((?:[A-Za-z_][\w$]*\.)?[A-Za-z_][\w$]*)\s*;/gi

/** The create that must follow immediately for the drop to be a re-creation. */
const CREATE_TRIGGER_HEAD =
  /^\s*create\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+((?:[A-Za-z_][\w$]*\.)?[A-Za-z_][\w$]*)\b/i

/** The table a create-trigger statement binds to. */
const CREATE_TRIGGER_TABLE = /\bon\s+((?:[A-Za-z_][\w$]*\.)?[A-Za-z_][\w$]*)/i

/**
 * PostgreSQL folds unquoted identifiers to lower case, and `public.matches` and
 * `matches` are the same table written two ways — both appear in this
 * repository, sometimes on either side of a single pairing.
 *
 * @param {string} identifier
 * @returns {string}
 */
function bareName(identifier) {
  const parts = identifier.toLowerCase().split('.')
  // `split` always yields at least one element, so the last is a string; the
  // fallback keeps the declared return type honest without inventing a name.
  return parts[parts.length - 1] ?? identifier.toLowerCase()
}

/**
 * Locate every `drop trigger` that is immediately re-created.
 *
 * Returns the span of each such drop statement so the caller can exclude it
 * from the destructive scan, plus a label for the report.
 *
 * @param {string} scannable Text already stripped of comments and routine bodies.
 * @returns {{ start: number, end: number, label: string }[]}
 */
export function triggerRecreations(scannable) {
  /** @type {{ start: number, end: number, label: string }[]} */
  const found = []

  for (const drop of scannable.matchAll(DROP_TRIGGER)) {
    const start = drop.index ?? 0
    const end = start + drop[0].length

    // The trigger name and table this drop names. Both groups are mandatory in
    // DROP_TRIGGER, so an absent one means the pattern stopped matching what it
    // claims to — treated as "not a recognised drop" rather than compared
    // against `undefined`, which would silently pair two unrelated statements.
    const droppedTrigger = drop[1]
    const droppedTable = drop[2]
    if (droppedTrigger === undefined || droppedTable === undefined) continue

    // "Immediately": the very next statement, with only whitespace between.
    // Anything else — another statement, a partial rewrite — means the trigger
    // was genuinely absent for part of the migration, so the drop stands.
    const rest = scannable.slice(end)
    const head = CREATE_TRIGGER_HEAD.exec(rest)
    if (head === null) continue
    const createdTrigger = head[1]
    if (createdTrigger === undefined) continue
    if (bareName(createdTrigger) !== bareName(droppedTrigger)) continue

    // The trigger name alone is not identity: PostgreSQL scopes a trigger to
    // its table, so the same name may legitimately exist on two tables and
    // dropping one is not re-created by creating the other.
    const terminator = rest.indexOf(';')
    const statement = terminator === -1 ? rest : rest.slice(0, terminator)
    const table = CREATE_TRIGGER_TABLE.exec(statement.slice(head[0].length))
    if (table === null) continue
    const createdTable = table[1]
    if (createdTable === undefined) continue
    if (bareName(createdTable) !== bareName(droppedTable)) continue

    found.push({
      start,
      end,
      label: `drop trigger ${bareName(droppedTrigger)} on ${bareName(droppedTable)} (re-created immediately)`,
    })
  }

  return found
}

/**
 * Blank a span while preserving length, so later offsets stay meaningful.
 *
 * @param {string} text
 * @param {{ start: number, end: number }[]} spans
 */
function blank(text, spans) {
  let out = text
  for (const { start, end } of spans) {
    out = out.slice(0, start) + ' '.repeat(end - start) + out.slice(end)
  }
  return out
}

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
  // An immediately re-created trigger is structural, not destructive. Blanking
  // the drop rather than filtering the matches keeps every other `drop trigger`
  // in this file — including a second, unpaired one — fully visible.
  const withoutRecreations = blank(scannable, triggerRecreations(scannable))
  return [...withoutRecreations.matchAll(DESTRUCTIVE)].map((match) =>
    match[0].replace(/\s+/g, ' ').trim(),
  )
}

/** @param {string} sql */
export function structuralStatements(sql) {
  const scannable = withoutRoutineBodies(withoutComments(sql))
  return [
    ...[...scannable.matchAll(STRUCTURAL)].map((match) =>
      match[0].replace(/\s+/g, ' ').trim().toLowerCase(),
    ),
    ...triggerRecreations(scannable).map(({ label }) => label),
  ]
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
    console.error('Use development-migration-rollout.yml, the guarded lane: it names the')
    console.error('boundary by filename, proves the live source, and requires the')
    console.error('destructive batch to be acknowledged before it applies anything.')
    process.exit(1)
  }
}
