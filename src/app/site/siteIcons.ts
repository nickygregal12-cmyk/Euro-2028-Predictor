import type { SiteVariant } from './siteVariant.js'

/** Shared site identity colours, kept in step with the application tokens. */
export const ICON_ACCENT = '#22E06C'
export const THEME_COLOUR = {
  dark: '#080D1F',
  light: '#F6F4EF',
} as const

export type SiteIcon = {
  readonly file: string
  readonly size: number
  readonly purpose: 'any' | 'maskable'
}

/** Raster icons each installable deployment publishes. */
export const SITE_ICON_SIZES: readonly SiteIcon[] = [
  { file: 'apple-touch-icon.png', size: 180, purpose: 'any' },
  { file: 'icon-192.png', size: 192, purpose: 'any' },
  { file: 'icon-512.png', size: 512, purpose: 'any' },
  { file: 'icon-maskable-512.png', size: 512, purpose: 'maskable' },
]

/**
 * Every binary file emitted from one variant's site-identity directory.
 *
 * `og-image.png` belongs here for the same reason the installed icons do:
 * `public/` is copied verbatim to both deployments, while this directory is
 * selected by `VITE_SITE_VARIANT`. Keeping the social image in the same
 * variant-owned lane makes a Hub build physically unable to emit Euro artwork.
 */
export const SITE_ICON_FILES: readonly string[] = [
  ...SITE_ICON_SIZES.map((icon) => icon.file),
  'favicon.ico',
  'og-image.png',
  // Contract-free, but the same lane and for the same reason: an invite card is
  // per-variant artwork, so a Hub build must be physically unable to emit the
  // Euro one.
  'og-invite.png',
]

/** Where one variant's generated site-identity bytes live. */
export function siteIconDirectory(variant: SiteVariant): string {
  return `assets/site-icons/${variant}`
}

/** The mark drawn for one deployment. */
export type SiteIconMark =
  | { readonly kind: 'pitch' }
  | { readonly kind: 'wordmark'; readonly text: string }

export function siteIconMark(variant: SiteVariant): SiteIconMark {
  return variant === 'euro'
    ? { kind: 'wordmark', text: '28' }
    : { kind: 'pitch' }
}

/** Pitch geometry shared by SVG, raster icon and social-art generators. */
export const PITCH_MARK = {
  lineFrom: 0,
  lineTo: 1,
  lineWidth: 0.07,
  circleRadius: 0.26,
  circleWidth: 0.085,
  spotRadius: 0.075,
} as const

/** Scale that keeps meaningful maskable-icon geometry inside its safe circle. */
export const MASKABLE_SAFE_SCALE = 0.74

/** This site's generated SVG favicon. */
export function faviconSvg(mark: SiteIconMark, label: string): string {
  const body =
    mark.kind === 'pitch'
      ? pitchSvg(64)
      : `<text x="32" y="34" fill="${ICON_ACCENT}" text-anchor="middle" dominant-baseline="central"
        font-family="'Space Grotesk', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        font-weight="500" font-size="36" letter-spacing="0.5">${escapeXml(mark.text)}</text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${escapeXml(label)}">
  <rect width="64" height="64" rx="14" fill="${THEME_COLOUR.dark}"/>
  ${body}
</svg>
`
}

function pitchSvg(size: number): string {
  const centre = round(size / 2)
  const m = PITCH_MARK
  return `<g stroke="${ICON_ACCENT}" fill="none">
    <line x1="${round(m.lineFrom * size)}" y1="${centre}" x2="${round(m.lineTo * size)}" y2="${centre}" stroke-width="${round(m.lineWidth * size)}" />
    <circle cx="${centre}" cy="${centre}" r="${round(m.circleRadius * size)}" stroke-width="${round(m.circleWidth * size)}" />
    <circle cx="${centre}" cy="${centre}" r="${round(m.spotRadius * size)}" fill="${ICON_ACCENT}" stroke="none" />
  </g>`
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
