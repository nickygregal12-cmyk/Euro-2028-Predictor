// Reproducible source for the PER-SITE installed identity in `assets/site-icons/`:
//   apple-touch-icon.png (180), icon-192.png, icon-512.png,
//   icon-maskable-512.png and favicon.ico, once for each site variant.
//
// WHY THESE ARE PER-VARIANT AND NOT IN `public/`. `public/` is copied verbatim
// into both deployments, so a single icon set there gives one product the other
// product's installed identity — which is precisely what ADR 0026's seam and
// `src/app/site/documentMetadata.ts` exist to prevent for the document head.
// A home-screen icon is a stronger claim than a `<title>`: it survives on the
// device after the tab is closed. `vite.config.ts` emits only the variant being
// built.
//
// WHY A BROWSER RENDERS THEM. There is no local SVG rasterizer in this
// repository and these marks must render in the app's own typeface (self-hosted
// Space Grotesk 500). `scripts/og/renderAssets.js` already established the
// canonical generator as the app's own canvas; this script automates the same
// approach with the Playwright Chromium that is already a devDependency, so the
// output is reproducible from a command rather than from a console paste.
//
//   node scripts/og/generate-site-icons.mjs
//
// It writes only when bytes change, and prints what it wrote.

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const repositoryRoot = new URL('../../', import.meta.url)

const fontUrl = fileURLToPath(
  new URL(
    'node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2',
    repositoryRoot,
  ),
)

/**
 * A page whose only job is to have the typeface loaded and a canvas to draw on.
 *
 * The font is embedded as a data URL rather than linked: a `file://` page
 * fetching a sibling `file://` font is subject to Chromium's local-file access
 * rules, and an icon that silently rendered in a fallback sans would be a very
 * quiet regression to notice.
 */
function harnessHtml() {
  const font = readFileSync(fontUrl).toString('base64')
  return `<!doctype html><meta charset="utf-8"><style>
@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 500;
  src: url('data:font/woff2;base64,${font}') format('woff2');
}
body { font-family: 'Space Grotesk'; }
</style><body>Space Grotesk</body>`
}

/**
 * The site authority, loaded through Vite rather than re-stated here.
 *
 * `src/app/site/*.ts` is written for the bundler's resolver — TypeScript
 * sources referred to by their `.js` specifiers — which bare Node cannot
 * follow. Loading it through Vite's SSR module runner is how this script reads
 * exactly the values the build will emit, rather than a copy of them that can
 * drift. `configFile: false` keeps the project's build plugins out of a script
 * that only wants three modules.
 */
async function loadSiteAuthority() {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(repositoryRoot),
    logLevel: 'warn',
    server: { middlewareMode: true },
  })
  try {
    const [variants, icons] = await Promise.all([
      server.ssrLoadModule('/src/app/site/siteVariant.ts'),
      server.ssrLoadModule('/src/app/site/siteIcons.ts'),
    ])
    return {
      SITE_VARIANTS: variants.SITE_VARIANTS,
      SITE_ICON_SIZES: icons.SITE_ICON_SIZES,
      THEME_COLOUR: icons.THEME_COLOUR,
      ICON_ACCENT: icons.ICON_ACCENT,
      PITCH_MARK: icons.PITCH_MARK,
      MASKABLE_SAFE_SCALE: icons.MASKABLE_SAFE_SCALE,
      siteIconMark: icons.siteIconMark,
    }
  } finally {
    await server.close()
  }
}

async function main() {
  const {
    SITE_VARIANTS,
    SITE_ICON_SIZES,
    THEME_COLOUR,
    ICON_ACCENT,
    PITCH_MARK,
    MASKABLE_SAFE_SCALE,
    siteIconMark,
  } = await loadSiteAuthority()

  // A sandboxed or pinned environment may hold a Chromium that Playwright's
  // own download layout does not name. The override exists so the generator can
  // be run there; an ordinary checkout needs nothing.
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  const browser = await chromium.launch(
    executablePath ? { executablePath } : {},
  )
  const page = await browser.newPage()
  await page.setContent(harnessHtml())
  await page.evaluate(() => document.fonts.ready)

  const written = []
  for (const variant of SITE_VARIANTS) {
    const mark = siteIconMark(variant)
    // The geometry travels with the request rather than being closed over:
    // `page.evaluate` serialises the drawing function into the browser, so
    // nothing from this module's scope is visible to it.
    const geometry = { ...PITCH_MARK }
    const directory = new URL(`assets/site-icons/${variant}/`, repositoryRoot)
    mkdirSync(fileURLToPath(directory), { recursive: true })

    for (const icon of SITE_ICON_SIZES) {
      const dataUrl = await page.evaluate(drawIcon, {
        size: icon.size,
        mark,
        geometry,
        // A maskable icon must survive an arbitrary platform mask, so its mark
        // sits inside the 80% safe circle the specification guarantees. An
        // "any" icon is shown as drawn, so it uses the full tile.
        scale: icon.purpose === 'maskable' ? MASKABLE_SAFE_SCALE : 1,
        background: THEME_COLOUR.dark,
        accent: ICON_ACCENT,
      })
      written.push(
        writeIfChanged(new URL(icon.file, directory), decodeDataUrl(dataUrl)),
      )
    }

    // The ICO container wraps the three raster sizes browsers actually pick
    // from. It is a fallback for engines that ignore `favicon.svg`, which is
    // generated as text from the same authority at build time.
    const ico = []
    for (const size of [16, 32, 48]) {
      const dataUrl = await page.evaluate(drawIcon, {
        size,
        mark,
        geometry,
        scale: 1,
        background: THEME_COLOUR.dark,
        accent: ICON_ACCENT,
        rounded: true,
      })
      ico.push({ size, png: decodeDataUrl(dataUrl) })
    }
    written.push(
      writeIfChanged(new URL('favicon.ico', directory), icoContainer(ico)),
    )
  }

  await browser.close()

  const changed = written.filter((entry) => entry.changed)
  if (changed.length === 0) {
    console.log(`${written.length} icons already up to date.`)
    return
  }
  for (const entry of changed) console.log(`wrote ${entry.path}`)
}

/**
 * @typedef {{ kind: 'pitch' } | { kind: 'wordmark', text: string }} IconMark
 * @typedef {{
 *   lineFrom: number, lineTo: number, lineWidth: number,
 *   circleRadius: number, circleWidth: number, spotRadius: number,
 * }} PitchGeometry
 * @typedef {{
 *   size: number, mark: IconMark, geometry: PitchGeometry, scale: number,
 *   background: string, accent: string, rounded?: boolean,
 * }} DrawOptions
 */

/**
 * Drawn inside the page. Deliberately self-contained: `page.evaluate` serialises
 * the function, so it may close over nothing from this module.
 *
 * @param {DrawOptions} options
 * @returns {string}
 */
function drawIcon({ size, mark, geometry, scale, background, accent, rounded }) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  // A 2d context is only null when the element is not a canvas or the context
  // was already claimed as something else. Neither can happen two lines below
  // `createElement('canvas')`.
  const context = /** @type {CanvasRenderingContext2D} */ (
    canvas.getContext('2d')
  )

  context.fillStyle = background
  if (rounded) {
    const radius = size * 0.22
    context.beginPath()
    context.moveTo(radius, 0)
    context.arcTo(size, 0, size, size, radius)
    context.arcTo(size, size, 0, size, radius)
    context.arcTo(0, size, 0, 0, radius)
    context.arcTo(0, 0, size, 0, radius)
    context.closePath()
    context.fill()
  } else {
    context.fillRect(0, 0, size, size)
  }

  context.fillStyle = accent
  context.strokeStyle = accent

  if (mark.kind === 'pitch') {
    // `scale` shrinks the mark about the tile centre. Everything below is a
    // fraction of the tile, so one multiplier is the whole safe-zone treatment.
    const centre = size / 2

    // THE HALFWAY LINE IS NEVER SCALED IN. It runs touchline to touchline, and
    // on a maskable tile the platform's own crop is what shortens it — which is
    // exactly how a pitch behind a rounded mask should look. Only the circle
    // and the spot, which are the mark's meaning, are pulled inside the safe
    // zone.
    context.lineWidth = geometry.lineWidth * size
    context.beginPath()
    context.moveTo(geometry.lineFrom * size, centre)
    context.lineTo(geometry.lineTo * size, centre)
    context.stroke()

    context.lineWidth = geometry.circleWidth * size * scale
    context.beginPath()
    context.arc(centre, centre, geometry.circleRadius * size * scale, 0, Math.PI * 2)
    context.stroke()

    context.beginPath()
    context.arc(centre, centre, geometry.spotRadius * size * scale, 0, Math.PI * 2)
    context.fill()
    return canvas.toDataURL('image/png')
  }

  // A wordmark is fitted rather than assumed: a font size chosen for two
  // characters crops three, and the tile has no other way to find out.
  const box = size * scale
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.letterSpacing = `${Math.round(size * 0.01)}px`

  let fontSize = Math.round(size * 0.56 * scale)
  for (let attempt = 0; attempt < 24; attempt += 1) {
    context.font = `500 ${fontSize}px 'Space Grotesk', system-ui, sans-serif`
    if (context.measureText(mark.text).width <= box * 0.7) break
    fontSize -= Math.max(1, Math.round(fontSize * 0.06))
  }

  context.fillText(mark.text, size / 2, size * 0.545)
  context.letterSpacing = '0px'
  return canvas.toDataURL('image/png')
}

/**
 * @param {string} dataUrl
 * @returns {Buffer}
 */
function decodeDataUrl(dataUrl) {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
}

/**
 * A minimal ICO container around already-encoded PNG frames.
 *
 * @param {{ size: number, png: Buffer }[]} frames
 * @returns {Buffer}
 */
function icoContainer(frames) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)

  const directory = Buffer.alloc(16 * frames.length)
  let offset = header.length + directory.length
  frames.forEach((frame, index) => {
    const at = index * 16
    directory.writeUInt8(frame.size === 256 ? 0 : frame.size, at)
    directory.writeUInt8(frame.size === 256 ? 0 : frame.size, at + 1)
    directory.writeUInt8(0, at + 2)
    directory.writeUInt8(0, at + 3)
    directory.writeUInt16LE(1, at + 4)
    directory.writeUInt16LE(32, at + 6)
    directory.writeUInt32LE(frame.png.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += frame.png.length
  })

  return Buffer.concat([header, directory, ...frames.map((f) => f.png)])
}

/**
 * @param {URL} url
 * @param {Buffer | string} bytes
 * @returns {{ path: string, changed: boolean }}
 */
function writeIfChanged(url, bytes) {
  const path = fileURLToPath(url)
  let existing = null
  try {
    existing = readFileSync(path)
  } catch {
    existing = null
  }
  const changed =
    existing === null ||
    createHash('sha256').update(existing).digest('hex') !==
      createHash('sha256').update(bytes).digest('hex')
  if (changed) writeFileSync(path, bytes)
  return { path: path.replace(fileURLToPath(repositoryRoot), ''), changed }
}

await main()
