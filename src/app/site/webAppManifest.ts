import { SITE_ICON_SIZES, THEME_COLOUR } from './siteIcons.js'
import type { SitePublicMetadata } from './sitePublicMetadata.js'

/**
 * The web app manifest one deployment publishes.
 *
 * ADR 0016 PHASE 1, WHICH THIS IS THE FOUNDATION OF. That record accepts an
 * installable progressive web application as the first delivery phase and names
 * the manifest, service worker and offline shell as its content. `index.html`
 * said in a comment that there was no manifest because the treatment was
 * parked; this is what replaces that comment.
 *
 * GENERATED FROM `SitePublicMetadata`, NOT AUTHORED. A committed
 * `manifest.webmanifest` in `public/` would be a second branding source shipped
 * verbatim to both deployments — the Hub would install itself under the Euro
 * product's name and icon, which is a worse version of the failure
 * `documentMetadata.ts` exists to prevent, because an installed application
 * keeps its name and icon on the device after the tab is gone.
 *
 * EVERY URL IS ROOT-RELATIVE, DELIBERATELY. `canonicalOrigin` is null until a
 * domain is configured for a site, and unlike a canonical tag or an Open Graph
 * URL a manifest needs no absolute address: the browser resolves `start_url`,
 * `scope` and every icon against the manifest's own location. So this file is
 * correct on a deploy preview, on `netlify.app` and on the eventual custom
 * domain without knowing which it is on — and there is no branch here that can
 * emit the other site's origin.
 *
 * NO `orientation`. The specification allows locking one, and nothing here
 * justifies it: the same surfaces are used one-handed in portrait on a phone
 * and in a resizable window on a desktop, and a lock would take the choice away
 * from a player holding a tablet sideways for the Match Centre.
 *
 * Pure and Node-importable, like its siblings: `vite.config.ts` calls it at
 * build time so no byte of it reaches the entry chunk.
 */

type WebAppManifestIcon = {
  readonly src: string
  readonly sizes: string
  readonly type: string
  readonly purpose: 'any' | 'maskable'
}

export type WebAppManifest = {
  readonly id: string
  readonly name: string
  readonly short_name: string
  readonly description: string
  readonly start_url: string
  readonly scope: string
  readonly display: 'standalone'
  readonly theme_color: string
  readonly background_color: string
  readonly lang: string
  readonly dir: 'ltr'
  readonly categories: readonly string[]
  readonly icons: readonly WebAppManifestIcon[]
}

/** Where the generated manifest is served from, on both deployments. */
export const WEB_APP_MANIFEST_PATH = '/manifest.webmanifest'

/**
 * The apple-touch icon is not in here and cannot be: iOS reads no manifest when
 * a page is added to the home screen, only `<link rel="apple-touch-icon">`.
 * `documentMetadata.ts` emits that tag for the same variant's file.
 */
export function webAppManifest(metadata: SitePublicMetadata): WebAppManifest {
  return {
    // A stable identity, so a later change of `start_url` is recognised as the
    // same installed application rather than as a second one.
    id: '/',
    name: metadata.productName,
    short_name: metadata.brand.shortName,
    description: metadata.brand.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // The installed window's chrome and the launch screen behind first paint.
    // The dark value is used for both because dark is the product's default
    // theme; a launch screen in the other theme would flash white before the
    // application had a chance to read the player's choice.
    theme_color: THEME_COLOUR.dark,
    background_color: THEME_COLOUR.dark,
    lang: 'en-GB',
    dir: 'ltr',
    categories: ['sports'],
    icons: SITE_ICON_SIZES.filter((icon) => icon.file !== 'apple-touch-icon.png').map(
      (icon) => ({
        src: `/${icon.file}`,
        sizes: `${icon.size}x${icon.size}`,
        type: 'image/png',
        purpose: icon.purpose,
      }),
    ),
  }
}

/** The manifest as the bytes a build emits. */
export function webAppManifestJson(metadata: SitePublicMetadata): string {
  return `${JSON.stringify(webAppManifest(metadata), null, 2)}\n`
}
