import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const boundary = readFileSync(
  resolve(repositoryRoot, 'src/app/ApplicationErrorBoundary.tsx'),
  'utf8',
)

describe('fatal fallback support correlation', () => {
  it('generates one reference and uses it for both reporting and fallback state', () => {
    expect(boundary).toContain(
      'const reference = correlationReference(new Date(), Math.random())',
    )
    expect(boundary).toContain(
      'reportFatalRenderError(error, reference, info.componentStack)',
    )
    expect(boundary).toContain('this.setState({ offerRecovery, reference })')
  })

  it('keeps the same support reference even when session storage is unavailable', () => {
    expect(boundary).toContain(
      'this.setState({ offerRecovery: false, reference })',
    )
    expect(boundary).not.toContain(
      'this.setState({ offerRecovery: false, reference: null })',
    )
  })

  it('renders the stored reference for the player to quote', () => {
    expect(boundary).toContain('If you contact support, quote')
    expect(boundary).toContain('{reference}</code>')
  })
})
