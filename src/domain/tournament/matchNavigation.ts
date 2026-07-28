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

const navigationTime = (kickoffAt: string | null): number => {
  if (!kickoffAt) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(kickoffAt)
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

export function orderMatchesForNavigation<T extends NavigableMatch>(matches: T[]): T[] {
  return [...matches].sort((left, right) => {
    const timeDifference = navigationTime(left.kickoffAt) - navigationTime(right.kickoffAt)
    if (timeDifference !== 0 && !Number.isNaN(timeDifference)) return timeDifference
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

export function matchCentreHref(matchRef: string, leagueId: string | null): string {
  const path = `/match/${encodeURIComponent(matchRef)}`
  if (!leagueId) return path

  const query = new URLSearchParams({ league: leagueId }).toString()
  return `${path}?${query}`
}
