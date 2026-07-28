export type NavigableMatch = {
  matchRef: string
  kickoffAt: string | null
}

export type AdjacentMatchRefs = {
  previous: string | null
  next: string | null
}

const matchRefParts = (matchRef: string): Array<string | number> =>
  matchRef
    .split(/(\d+)/)
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLocaleLowerCase()))

function compareMatchRefs(left: string, right: string): number {
  const a = matchRefParts(left)
  const b = matchRefParts(right)
  const length = Math.max(a.length, b.length)

  for (let index = 0; index < length; index += 1) {
    const leftPart = a[index]
    const rightPart = b[index]
    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1
    if (leftPart === rightPart) continue
    if (typeof leftPart === 'number' && typeof rightPart === 'number') {
      return leftPart - rightPart
    }
    return String(leftPart).localeCompare(String(rightPart))
  }
  return 0
}

export function orderMatchesForNavigation<T extends NavigableMatch>(matches: T[]): T[] {
  return [...matches].sort((left, right) => {
    const leftTime = left.kickoffAt ? Date.parse(left.kickoffAt) : Number.POSITIVE_INFINITY
    const rightTime = right.kickoffAt ? Date.parse(right.kickoffAt) : Number.POSITIVE_INFINITY

    if (leftTime !== rightTime) return leftTime - rightTime
    return compareMatchRefs(left.matchRef, right.matchRef)
  })
}

export function adjacentMatchRefs(
  matches: NavigableMatch[],
  currentMatchRef: string,
): AdjacentMatchRefs {
  const ordered = orderMatchesForNavigation(matches)
  const index = ordered.findIndex((match) => match.matchRef === currentMatchRef)
  if (index === -1) return { previous: null, next: null }

  return {
    previous: index > 0 ? ordered[index - 1].matchRef : null,
    next: index < ordered.length - 1 ? ordered[index + 1].matchRef : null,
  }
}
