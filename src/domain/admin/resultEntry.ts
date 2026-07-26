import type { MatchRound } from '../../services/supabase/tournamentData'

export type ResultEntryDraft = {
  home90: string
  away90: string
  wentToExtraTime: boolean
  homeExtraTime: string
  awayExtraTime: string
  wentToPenalties: boolean
  homePenalties: string
  awayPenalties: string
}

export type ResultEntryValue = {
  home90: number
  away90: number
  homeAfterExtraTime: number | null
  awayAfterExtraTime: number | null
  homePenalties: number | null
  awayPenalties: number | null
}

export type ResultEntryValidation =
  | { ok: true; value: ResultEntryValue }
  | { ok: false; errors: string[] }

function score(value: string, label: string, errors: string[]): number | null {
  if (!/^\d{1,2}$/.test(value.trim())) {
    errors.push(`${label} must be a whole number from 0 to 99.`)
    return null
  }
  const parsed = Number.parseInt(value, 10)
  if (parsed < 0 || parsed > 99) {
    errors.push(`${label} must be a whole number from 0 to 99.`)
    return null
  }
  return parsed
}

export function validateResultEntry(round: MatchRound, draft: ResultEntryDraft): ResultEntryValidation {
  const errors: string[] = []
  const home90 = score(draft.home90, 'Home score after 90 minutes', errors)
  const away90 = score(draft.away90, 'Away score after 90 minutes', errors)

  if (round === 'group' && (draft.wentToExtraTime || draft.wentToPenalties)) {
    errors.push('Group-stage matches cannot use extra time or penalties.')
  }

  if (draft.wentToPenalties && !draft.wentToExtraTime) {
    errors.push('Penalties can only be recorded after extra time.')
  }

  let homeAfterExtraTime: number | null = null
  let awayAfterExtraTime: number | null = null
  if (draft.wentToExtraTime) {
    homeAfterExtraTime = score(draft.homeExtraTime, 'Home score after extra time', errors)
    awayAfterExtraTime = score(draft.awayExtraTime, 'Away score after extra time', errors)

    if (home90 !== null && away90 !== null && home90 !== away90) {
      errors.push('Extra time is only valid when the 90-minute score is level.')
    }
    if (homeAfterExtraTime !== null && home90 !== null && homeAfterExtraTime < home90) {
      errors.push('The home score after extra time cannot be lower than the 90-minute score.')
    }
    if (awayAfterExtraTime !== null && away90 !== null && awayAfterExtraTime < away90) {
      errors.push('The away score after extra time cannot be lower than the 90-minute score.')
    }
  }

  let homePenalties: number | null = null
  let awayPenalties: number | null = null
  if (draft.wentToPenalties) {
    homePenalties = score(draft.homePenalties, 'Home penalty score', errors)
    awayPenalties = score(draft.awayPenalties, 'Away penalty score', errors)

    if (homeAfterExtraTime !== null && awayAfterExtraTime !== null && homeAfterExtraTime !== awayAfterExtraTime) {
      errors.push('Penalties are only valid when the score remains level after extra time.')
    }
    if (homePenalties !== null && awayPenalties !== null && homePenalties === awayPenalties) {
      errors.push('A penalty shoot-out cannot finish level.')
    }
  } else if (
    round !== 'group' &&
    home90 !== null &&
    away90 !== null &&
    !draft.wentToExtraTime &&
    home90 === away90
  ) {
    errors.push('A knockout match cannot finish level after 90 minutes without extra time.')
  }

  if (errors.length || home90 === null || away90 === null) return { ok: false, errors }

  return {
    ok: true,
    value: {
      home90,
      away90,
      homeAfterExtraTime,
      awayAfterExtraTime,
      homePenalties,
      awayPenalties,
    },
  }
}
