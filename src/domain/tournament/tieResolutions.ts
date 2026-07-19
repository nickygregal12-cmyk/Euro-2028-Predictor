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

// Two arrays contain exactly the same members (used to reject a stored order
// that no longer matches the currently-tied set).
function sameMembers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  if (setA.size !== a.length) return false // guard against duplicates in input
  for (const id of b) if (!setA.has(id)) return false
  return true
}

/**
 * The user's chosen order for a tied block, or `undefined` when they have not
 * resolved it (or the stored order is stale — not a clean permutation of the
 * current tied set). Never returns a partial or reordered-but-invalid result:
 * an unusable resolution is treated as absent so the block stays unresolved.
 */
export function resolvedOrderFor(
  resolutions: TieResolution[],
  tiedTeamIds: string[],
): string[] | undefined {
  const key = tieKey(tiedTeamIds)
  const match = resolutions.find((r) => tieKey(r.teamIds) === key)
  if (!match) return undefined
  if (!sameMembers(match.order, tiedTeamIds)) return undefined
  return match.order
}
