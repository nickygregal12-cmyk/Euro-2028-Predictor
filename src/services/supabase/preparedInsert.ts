// Rows whose competition scope the DATABASE fills, not the caller.
//
// THE PROBLEM THIS SOLVES, AND WHY IT IS NOT A PER-SITE FIX.
//
// `20260730235602_stage_c1_competition_season_foundation.sql` declares
// `tournament_id` `not null` on the entry-owned prediction tables, and then
// fills it from a `before insert or update` trigger —
// `a_prepare_competition_season_scope`, which resolves the tournament from the
// row's own `entry_id` (or `competition_id`, or `match_id`) and assigns it. The
// same migration says so in as many words at line 1169: *"Old RPC/insert shapes
// remain valid through the preparation trigger."*
//
// Supabase's type generator derives an `Insert` type from column nullability
// alone. It cannot see a trigger, so it demands `tournament_id` from every
// caller — and three call sites correctly do not supply it.
//
// Adding the column at those three sites would be wrong twice over: it would
// duplicate a value the database owns, and it would hand a browser caller a
// competition-scope field that the Stage C1 design deliberately keeps
// server-owned. Suppressing the three errors individually would be three
// unexplained assertions that the next reader has to re-derive.
//
// So the gap is closed once, here, where the reason can be written down.
//
// WHAT IS STILL CHECKED. Everything except the one column:
//
//   - `T` must be a real table in the generated schema;
//   - that table must genuinely have a `tournament_id` in its `Insert` type —
//     `PreparedTable` is computed from the schema, so naming a table without
//     one is a compile error rather than a silent pass;
//   - the row must match every OTHER column of that table's `Insert` type
//     exactly, including excess-property rejection.
//
// The single assertion below spans exactly the difference between "the schema
// says this column is required" and "a trigger supplies it", which is a fact
// TypeScript has no way to represent. It is deliberately not exported as a
// general-purpose widener: it takes the table name so it cannot be pointed at
// an arbitrary shape.

import type { Database } from './database.types'

type Tables = Database['public']['Tables']

/** Tables whose generated `Insert` type carries a `tournament_id`. */
export type PreparedTable = {
  [K in keyof Tables]: 'tournament_id' extends keyof Tables[K]['Insert'] ? K : never
}[keyof Tables]

type InsertOf<T extends PreparedTable> = Tables[T]['Insert']

/**
 * A row for `table` with the trigger-filled competition scope left out.
 *
 * @param table the table being written — named so the row is checked against
 *   that table's own `Insert` type and nothing else
 * @param row every column the caller owns, checked in full
 */
export function preparedInsert<T extends PreparedTable>(
  table: T,
  row: Omit<InsertOf<T>, 'tournament_id'>,
): InsertOf<T> {
  // The one assertion, and the whole reason this file exists. `table` is unused
  // at runtime and load-bearing at compile time: it is what binds `row` to a
  // single table's shape.
  void table
  return row as InsertOf<T>
}
