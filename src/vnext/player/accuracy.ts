import { formatNumber, formatShare } from '../foundations/format'

/**
 * A COUNT AND ITS SHARE, WHERE A SHARE WOULD BE TRUE.
 *
 * Two ways a rate lies on this page, and the model's `accuracyRate` only guards
 * the first:
 *
 *   1. A ZERO DENOMINATOR. It refuses that and returns null, because "0% exact"
 *      is an accusation against somebody who has not predicted anything.
 *   2. ROUNDING. `formatShare` rounds to whole percent, so in a 380-fixture
 *      season one exact score renders "0%" — the same accusation, reached the
 *      long way round — and 379 of 380 renders "100%", claiming a perfect
 *      season that did not happen.
 *
 * So a non-zero numerator never prints 0% and a non-perfect record never prints
 * 100%. `formatShare` is the foundation's and is left alone: this is a rule
 * about what an ACCURACY may claim, not about how a share is written.
 */
export function accuracyValue(count: number, rate: number | undefined): string {
  const formatted = formatNumber(count)
  if (rate === undefined) return formatted
  return `${formatted} (${shareLabel(rate)})`
}

function shareLabel(rate: number): string {
  if (rate > 0 && rate < 0.005) return '<1%'
  if (rate < 1 && rate >= 0.995) return '>99%'
  return formatShare(rate)
}
