import { describe, expect, it } from 'vitest'

import { extractSportMonksTeamEnrichment } from '../../scripts/ops/extract-sportmonks-team-enrichment.ts'

describe('SportMonks team enrichment extraction', () => {
  it('deduplicates repeated participants and preserves provider references', () => {
    const payload = {
      data: [
        {
          participants: [
            {
              id: 284,
              name: 'Dundee',
              short_code: 'DUD',
              founded: 1893,
              country_id: 1161,
              venue_id: 284597,
              image_path: 'https://example.invalid/dundee.png',
            },
            {
              id: 282,
              name: 'Dundee United',
              short_code: 'DUD',
              founded: 1909,
              country_id: 1161,
              venue_id: 8947,
              image_path: 'https://example.invalid/dundee-united.png',
            },
          ],
        },
        {
          participants: [
            {
              id: 284,
              name: 'Dundee',
              short_code: 'DUD',
              founded: 1893,
              country_id: 1161,
              venue_id: 284597,
              image_path: 'https://example.invalid/dundee.png',
            },
          ],
        },
      ],
    }

    expect(extractSportMonksTeamEnrichment(payload)).toEqual([
      {
        providerTeamId: '284',
        providerName: 'Dundee',
        shortCode: 'DUD',
        founded: 1893,
        providerCountryId: '1161',
        providerVenueId: '284597',
        imageRef: 'https://example.invalid/dundee.png',
      },
      {
        providerTeamId: '282',
        providerName: 'Dundee United',
        shortCode: 'DUD',
        founded: 1909,
        providerCountryId: '1161',
        providerVenueId: '8947',
        imageRef: 'https://example.invalid/dundee-united.png',
      },
    ])
  })

  it('does not treat provider short codes as unique team identity', () => {
    const teams = extractSportMonksTeamEnrichment({
      data: [
        {
          participants: [
            { id: 284, name: 'Dundee', short_code: 'DUD' },
            { id: 282, name: 'Dundee United', short_code: 'DUD' },
          ],
        },
      ],
    })

    expect(teams).toHaveLength(2)
    expect(teams.map((team) => team.shortCode)).toEqual(['DUD', 'DUD'])
  })

  it('fails closed when one provider id carries conflicting facts in the same response', () => {
    expect(() => extractSportMonksTeamEnrichment({
      data: [
        {
          participants: [
            { id: 273, name: 'Aberdeen', venue_id: 8928 },
            { id: 273, name: 'Aberdeen', venue_id: 9999 },
          ],
        },
      ],
    })).toThrow('SportMonks team 273 changed within one retained response')
  })

  it('fails closed when the expected fixture participant shape is absent', () => {
    expect(() => extractSportMonksTeamEnrichment({ data: [{}] }))
      .toThrow('SportMonks fixture must contain a participants array')
  })
})
