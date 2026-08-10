// RPC arguments the database accepts as NULL, and the generated types cannot say so.
//
// THE FACT TYPESCRIPT IS MISSING. A PostgreSQL function signature carries no
// nullability information whatsoever: `p_expected_version integer` accepts NULL
// exactly as readily as it accepts 7, and there is no declaration that could say
// otherwise. Supabase's type generator therefore renders every argument as its
// bare type — `p_expected_version: number` — and has no way to add `| null`.
//
// That is not the generator guessing wrong. It is a fact about SQL that the
// generated file has no room to record.
//
// WHY THIS IS NOT A LATENT DEFECT TO NARROW AWAY. For the sites that use this
// helper, NULL is not an accident to be squeezed out — it is a specified input
// with defined behaviour, written into the function body:
//
//   `20260728190000_shared_knockout_prediction_store.sql:201` —
//     `if p_expected_version is not null and p_expected_version <> 0 then`
//   the same file, line 214 —
//     `if p_expected_version is null or p_expected_version is distinct from ...`
//   the same file, lines 183 and 188 — `p_advancing_team_id is not null` and
//     `is null`, which is how a draw is distinguished from a decided tie.
//
// A null expected version means *the client never read a row*, and the
// optimistic-concurrency contract depends on the server being able to tell that
// apart from a version of zero. Rewriting these call sites to stop sending NULL
// would change what the database is asked, which is precisely the class of
// silent behaviour change that `TYPE-001` work must not introduce.
//
// WHAT IS STILL CHECKED. Everything except the named arguments:
//
//   - `F` must be a real function in the generated schema;
//   - every key in `nullable` must be an argument of THAT function — a renamed
//     or misspelled parameter is a compile error;
//   - every other argument keeps its exact generated type, including
//     required-ness, so an omitted or misspelled argument still fails;
//   - the named arguments keep their type too, widened only by `| null`.
//
// The single assertion below spans exactly the difference between "SQL accepts
// NULL here" and "the generated type cannot express that". It cannot be used to
// launder an arbitrary object: it takes the function name, and the nullable
// arguments have to be named one by one at the call site.

import type { Database } from './database.types'

type Functions = Database['public']['Functions']

type ArgsOf<F extends keyof Functions> = Functions[F] extends { Args: infer A } ? A : never

/**
 * Arguments for `fn`, where each argument named in `nullable` may also be null.
 *
 * @param fn the function being called — named so the arguments are checked
 *   against that function's own signature and nothing else
 * @param nullable the arguments this call site sends NULL for, named
 *   individually so widening one cannot quietly widen the rest
 */
export function rpcArgs<F extends keyof Functions, K extends keyof ArgsOf<F>>(
  fn: F,
  nullable: readonly K[],
  args: Omit<ArgsOf<F>, K> & { [P in K]: ArgsOf<F>[P] | null },
): ArgsOf<F> {
  // `fn` and `nullable` are unused at runtime and load-bearing at compile time:
  // together they are what bind `args` to one function's signature and to a
  // named set of parameters within it.
  void fn
  void nullable
  return args as ArgsOf<F>
}
