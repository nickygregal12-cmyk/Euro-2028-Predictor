const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normaliseSupportEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return SIMPLE_EMAIL.test(trimmed) ? trimmed : null
}

export function buildAdminSupportHref(
  supportEmail: string | null | undefined,
  accountEmail: string | null | undefined,
  productName = 'Predictor Hub',
): string | null {
  const recipient = normaliseSupportEmail(supportEmail)
  if (!recipient) return null

  const account = accountEmail?.trim() || 'Unavailable'
  const subject = `${productName} support`
  const body = `Account email: ${account}\n\nHow can we help?`

  return `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
