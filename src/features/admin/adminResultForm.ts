import type {
  AdminMatchResult,
  AdminResultMethod,
  AdminResultMutation,
} from '../../services/supabase/adminResults'
import type { MatchRound } from '../../services/supabase/tournamentData'

export type AdminResultAction = 'confirm' | 'correct' | 'clear'

export type AdminResultFormValues = {
  method: AdminResultMethod
  home90: string
  away90: string
  home120: string
  away120: string
  homePenalties: string
  awayPenalties: string
  reason: string
}

export type AdminResultFormErrors = Partial<
  Record<keyof AdminResultFormValues | 'form', string>
>

export type ParsedAdminResult =
  | { ok: true; mutation: AdminResultMutation | null; reason: string }
  | { ok: false; errors: AdminResultFormErrors }

export const EMPTY_ADMIN_RESULT_FORM: AdminResultFormValues = {
  method: 'regulation',
  home90: '',
  away90: '',
  home120: '',
  away120: '',
  homePenalties: '',
  awayPenalties: '',
  reason: '',
}

function displayScore(value: number | null): string {
  return value === null ? '' : String(value)
}

export function formValuesFromResult(
  result: AdminMatchResult | null,
): AdminResultFormValues {
  if (!result || result.state === 'scheduled') {
    return {
      ...EMPTY_ADMIN_RESULT_FORM,
      method: 'regulation',
    }
  }

  return {
    method: result.method ?? 'regulation',
    home90: displayScore(result.home90),
    away90: displayScore(result.away90),
    home120: displayScore(result.home120),
    away120: displayScore(result.away120),
    homePenalties: displayScore(result.homePenalties),
    awayPenalties: displayScore(result.awayPenalties),
    reason: '',
  }
}

function score(
  value: string,
  key: keyof AdminResultFormValues,
  label: string,
  errors: AdminResultFormErrors,
): number | null {
  if (!value.trim()) {
    errors[key] = `${label} is required.`
    return null
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 99) {
    errors[key] = `${label} must be a whole number from 0 to 99.`
    return null
  }
  return parsed
}

export function validateAdminResultForm({
  action,
  matchId,
  round,
  values,
}: {
  action: AdminResultAction
  matchId: string
  round: MatchRound
  values: AdminResultFormValues
}): ParsedAdminResult {
  const errors: AdminResultFormErrors = {}
  const reason = values.reason.trim()

  if ((action === 'correct' || action === 'clear') && !reason) {
    errors.reason = `A ${action === 'clear' ? 'clear' : 'correction'} reason is required.`
  }

  if (action === 'clear') {
    return Object.keys(errors).length > 0
      ? { ok: false, errors }
      : { ok: true, mutation: null, reason }
  }

  const method = round === 'group' ? 'regulation' : values.method
  const home90 = score(values.home90, 'home90', 'Home 90-minute score', errors)
  const away90 = score(values.away90, 'away90', 'Away 90-minute score', errors)

  let home120: number | null = null
  let away120: number | null = null
  let homePenalties: number | null = null
  let awayPenalties: number | null = null

  if (method === 'extra_time' || method === 'penalties') {
    home120 = score(values.home120, 'home120', 'Home 120-minute score', errors)
    away120 = score(values.away120, 'away120', 'Away 120-minute score', errors)
  }

  if (method === 'penalties') {
    homePenalties = score(
      values.homePenalties,
      'homePenalties',
      'Home penalty score',
      errors,
    )
    awayPenalties = score(
      values.awayPenalties,
      'awayPenalties',
      'Away penalty score',
      errors,
    )
  }

  if (home90 !== null && away90 !== null) {
    if (round !== 'group' && method === 'regulation' && home90 === away90) {
      errors.form = 'A knockout match cannot finish level in regulation.'
    }
    if (
      (method === 'extra_time' || method === 'penalties') &&
      home90 !== away90
    ) {
      errors.form = 'Extra time requires the 90-minute score to be level.'
    }
  }

  if (home120 !== null && away120 !== null) {
    if (method === 'extra_time' && home120 === away120) {
      errors.form = 'An extra-time result requires a winner after 120 minutes.'
    }
    if (method === 'penalties' && home120 !== away120) {
      errors.form = 'A penalty shootout requires the 120-minute score to be level.'
    }
  }

  if (
    method === 'penalties' &&
    homePenalties !== null &&
    awayPenalties !== null &&
    homePenalties === awayPenalties
  ) {
    errors.form = 'A penalty shootout cannot finish level.'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    mutation: {
      matchId,
      method,
      home90: home90 as number,
      away90: away90 as number,
      home120,
      away120,
      homePenalties,
      awayPenalties,
      reason: reason || null,
    },
    reason,
  }
}
