// Manual tie-resolutions: the user's chosen order for a set of teams that the
// automatic tie-break criteria could not separate (scoring-rules §6 step 7 and
// tournament-structure §6). This is USER DATA that the pipeline consumes — the
// domain functions receive it as input and stay pure (they never read storage).
//
// A resolution is keyed by the SET of tied team IDs (order-independent), so the
// same block of teams always maps to the same key regardless of how it happened
// to be listed. If the user's predictions later change and a different set of
// teams ends up tied, the old resolution simply stops matching (its key no
// longer corresponds to any current tie) and is ignored — no stale ordering can
// leak into the result.

export type TieResolution = {
  // The tied set, in any order — the key is derived from it, not from order.
  teamIds: string[]
  // The user's chosen finishing order: a permutation of `teamIds`, best first.
  order: string[]
}

/** Canonical, order-independent key for a set of tied team IDs. */
export function tieKey(teamIds: string[]): string {
  return [...teamIds].sort().join('|')
}

// Two arrays contain exactly the same unique members. Both sides are validated:
// callers may pass hostile/stale stored data, while the current tied block should
// still fail closed if it is ever malformed.
function sameMembers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size !== a.length || setB.size !== b.length) return false
  for (const id of setB) if (!setA.has(id)) return false
  return true
}

/**
 * The user's chosen order for a tied block, or `undefined` when they have not
 * resolved it (or every matching stored row is stale/malformed). A hostile row
 * must never mask a later valid row for the same set, so all matching candidates
 * are checked until a clean permutation is found.
 */
export function resolvedOrderFor(
  resolutions: TieResolution[],
  tiedTeamIds: string[],
): string[] | undefined {
  if (new Set(tiedTeamIds).size !== tiedTeamIds.length) return undefined

  const key = tieKey(tiedTeamIds)
  for (const candidate of resolutions) {
    if (tieKey(candidate.teamIds) !== key) continue
    // The canonical key is only an index. Re-check exact members to guard against
    // malformed IDs or delimiter collisions in hostile stored input.
    if (!sameMembers(candidate.teamIds, tiedTeamIds)) continue
    if (!sameMembers(candidate.order, tiedTeamIds)) continue
    return [...candidate.order]
  }

  return undefined
}
