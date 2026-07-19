// Host-city → flag code for the venue flag on match cards. Euro 2028 is UK &
// Ireland; everything not listed is an English host city.
const VENUE_COUNTRY: Record<string, string> = {
  Cardiff: 'gb-wls',
  Glasgow: 'gb-sct',
  Dublin: 'ie',
  Belfast: 'gb-nir',
}

export function venueCountryCode(venue: string): string {
  return VENUE_COUNTRY[venue] ?? 'gb-eng'
}
