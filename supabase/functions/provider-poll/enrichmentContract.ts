export const PROVIDER_ENRICHMENT_AUTHORITY = 'enrichment-only' as const

export const POLLED_PROVIDER_NAMES = [
  'sportmonks',
  'api-football',
  'football-data',
  'the-odds-api',
] as const

export const ENRICHMENT_PROVIDER_NAMES = [
  ...POLLED_PROVIDER_NAMES,
  'sportdb-dev',
] as const

export type PolledProviderName = (typeof POLLED_PROVIDER_NAMES)[number]
export type EnrichmentProviderName = (typeof ENRICHMENT_PROVIDER_NAMES)[number]

export type ProviderCapability =
  | 'fixture-evidence'
  | 'odds-market'
  | 'team-profile'
  | 'player-profile'
  | 'venue'
  | 'standings'
  | 'kit-colours'
  | 'confirmed-lineup'
  | 'predicted-lineup'
  | 'match-events'
  | 'match-statistics'
  | 'injuries-suspensions'

export type ProviderRuntimeState = 'configured' | 'candidate-unverified'

export type ProviderCapabilityRecord = {
  readonly runtimeState: ProviderRuntimeState
  readonly implemented: readonly ProviderCapability[]
  readonly plannedUnverified: readonly ProviderCapability[]
  readonly productPriority: 'active' | 'deferred'
}

const FOOTBALL_CONTEXT_CAPABILITIES = [
  'team-profile',
  'player-profile',
  'venue',
  'standings',
  'kit-colours',
  'confirmed-lineup',
  'predicted-lineup',
  'match-events',
  'match-statistics',
  'injuries-suspensions',
] as const satisfies readonly ProviderCapability[]

/**
 * Repository capability, not subscription entitlement.
 *
 * `implemented` means the current repository has a decoder/import path for the
 * capability. `plannedUnverified` is intentionally weaker: it must not be
 * promoted merely because provider documentation says an endpoint exists or a
 * secret is configured. Hosted subscription coverage, licensing and retained
 * representative payloads are separate evidence gates.
 */
export const PROVIDER_CAPABILITIES = {
  sportmonks: {
    runtimeState: 'configured',
    implemented: ['fixture-evidence'],
    plannedUnverified: FOOTBALL_CONTEXT_CAPABILITIES,
    productPriority: 'active',
  },
  'api-football': {
    runtimeState: 'configured',
    implemented: ['fixture-evidence'],
    plannedUnverified: FOOTBALL_CONTEXT_CAPABILITIES,
    productPriority: 'active',
  },
  'football-data': {
    runtimeState: 'configured',
    implemented: ['fixture-evidence'],
    plannedUnverified: [
      'team-profile',
      'venue',
      'standings',
    ],
    productPriority: 'active',
  },
  'the-odds-api': {
    runtimeState: 'configured',
    implemented: ['odds-market'],
    plannedUnverified: [],
    productPriority: 'deferred',
  },
  'sportdb-dev': {
    runtimeState: 'candidate-unverified',
    implemented: [],
    plannedUnverified: [
      'team-profile',
      'player-profile',
      'venue',
    ],
    productPriority: 'active',
  },
} as const satisfies Record<EnrichmentProviderName, ProviderCapabilityRecord>

export type ProviderSourceStamp = {
  readonly provider: EnrichmentProviderName
  readonly providerEntityId: string | null
  readonly fetchedAt: string
  readonly authority: typeof PROVIDER_ENRICHMENT_AUTHORITY
}

export type FreshnessState = 'fresh' | 'stale' | 'unknown'

export type ProviderFreshness = {
  readonly state: FreshnessState
  readonly ageMs: number | null
}

export function createProviderSourceStamp(
  provider: EnrichmentProviderName,
  fetchedAt: string,
  providerEntityId: string | null = null,
): ProviderSourceStamp {
  return {
    provider,
    providerEntityId,
    fetchedAt,
    authority: PROVIDER_ENRICHMENT_AUTHORITY,
  }
}

/**
 * Evaluate display freshness without consulting the wall clock implicitly.
 * Callers supply `now` so tests, SSR and historical views remain reproducible.
 * Invalid timestamps and future observations fail closed to `unknown` rather
 * than being presented as current football facts.
 */
export function evaluateProviderFreshness(
  fetchedAt: string,
  maxAgeMs: number,
  now: string,
): ProviderFreshness {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
    throw new RangeError('maxAgeMs must be a finite non-negative number')
  }

  const fetchedAtMs = Date.parse(fetchedAt)
  const nowMs = Date.parse(now)
  if (!Number.isFinite(fetchedAtMs) || !Number.isFinite(nowMs)) {
    return { state: 'unknown', ageMs: null }
  }

  const ageMs = nowMs - fetchedAtMs
  if (ageMs < 0) return { state: 'unknown', ageMs: null }

  return {
    state: ageMs <= maxAgeMs ? 'fresh' : 'stale',
    ageMs,
  }
}

export function hasImplementedProviderCapability(
  provider: EnrichmentProviderName,
  capability: ProviderCapability,
): boolean {
  return PROVIDER_CAPABILITIES[provider].implemented.some(
    (implemented) => implemented === capability,
  )
}
