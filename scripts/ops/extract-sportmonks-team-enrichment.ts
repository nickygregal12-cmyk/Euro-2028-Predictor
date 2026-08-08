#!/usr/bin/env -S node --experimental-strip-types
/**
 * Extract deterministic team-enrichment candidates from a retained SportMonks
 * fixture response.
 *
 * This is intentionally an offline/read-only helper. It makes no HTTP request,
 * opens no database connection and writes no canonical football state. Feed it
 * bytes already retained by the provider custody path and it emits only the
 * participant facts the Contract-134 enrichment foundation is allowed to use.
 *
 * Example:
 *   node --experimental-strip-types \
 *     scripts/ops/extract-sportmonks-team-enrichment.ts response.json
 *
 * `imageRef` is a provider reference only. The provider capability audit does
 * not establish public-display or re-hosting rights for club imagery.
 */

import { readFileSync } from 'node:fs'

export type SportMonksTeamEnrichmentCandidate = {
  providerTeamId: string
  providerName: string
  shortCode: string | null
  founded: number | null
  providerCountryId: string | null
  providerVenueId: string | null
  imageRef: string | null
}

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

function requiredText(value: unknown, field: string): string {
  const text = optionalText(value)
  if (text === null) throw new Error(`SportMonks participant is missing ${field}`)
  return text
}

function optionalInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(number)) {
    throw new Error(`SportMonks participant ${field} is not an integer`)
  }
  return number
}

function sameCandidate(
  left: SportMonksTeamEnrichmentCandidate,
  right: SportMonksTeamEnrichmentCandidate,
): boolean {
  return left.providerTeamId === right.providerTeamId
    && left.providerName === right.providerName
    && left.shortCode === right.shortCode
    && left.founded === right.founded
    && left.providerCountryId === right.providerCountryId
    && left.providerVenueId === right.providerVenueId
    && left.imageRef === right.imageRef
}

function participantCandidate(value: unknown): SportMonksTeamEnrichmentCandidate {
  if (!isObject(value)) throw new Error('SportMonks participant is not an object')

  return {
    providerTeamId: requiredText(value.id, 'id'),
    providerName: requiredText(value.name, 'name'),
    shortCode: optionalText(value.short_code),
    founded: optionalInteger(value.founded, 'founded'),
    providerCountryId: optionalText(value.country_id),
    providerVenueId: optionalText(value.venue_id),
    imageRef: optionalText(value.image_path),
  }
}

export function extractSportMonksTeamEnrichment(
  payload: unknown,
): SportMonksTeamEnrichmentCandidate[] {
  if (!isObject(payload) || !Array.isArray(payload.data)) {
    throw new Error('SportMonks response must contain a data array')
  }

  const byProviderId = new Map<string, SportMonksTeamEnrichmentCandidate>()

  for (const fixture of payload.data) {
    if (!isObject(fixture) || !Array.isArray(fixture.participants)) {
      throw new Error('SportMonks fixture must contain a participants array')
    }

    for (const participant of fixture.participants) {
      const candidate = participantCandidate(participant)
      const existing = byProviderId.get(candidate.providerTeamId)

      if (existing && !sameCandidate(existing, candidate)) {
        throw new Error(
          `SportMonks team ${candidate.providerTeamId} changed within one retained response`,
        )
      }

      byProviderId.set(candidate.providerTeamId, candidate)
    }
  }

  return [...byProviderId.values()].sort((left, right) => {
    const nameOrder = left.providerName.localeCompare(right.providerName, 'en')
    return nameOrder !== 0
      ? nameOrder
      : left.providerTeamId.localeCompare(right.providerTeamId, 'en')
  })
}

function main(): void {
  const filePath = process.argv[2]
  if (!filePath) {
    throw new Error('Usage: extract-sportmonks-team-enrichment.ts <retained-response.json>')
  }

  const payload = JSON.parse(readFileSync(filePath, 'utf8')) as unknown
  const teams = extractSportMonksTeamEnrichment(payload)

  process.stdout.write(`${JSON.stringify({ provider: 'sportmonks', teams }, null, 2)}\n`)
}

if (process.argv[1]?.endsWith('extract-sportmonks-team-enrichment.ts')) {
  main()
}
