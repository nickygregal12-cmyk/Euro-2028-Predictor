// Reproducible source for the two deployments' Open Graph artwork.
//
// `public/` is copied verbatim into both Netlify builds, so a single social
// image there is necessarily cross-branded. This generator instead writes one
// `og-image.png` beside each site's already-separated installed identity in
// `assets/site-icons/<variant>/`; Vite emits only the current variant.
//
// The words and marks come from the SAME authorities as the document head and
// installed icons. There is no second brand map here. Playwright Chromium is
// already a devDependency and the repository already uses it to generate raster
// site icons, so this follows that reproducible path rather than adding another
// graphics dependency.
//
//   node scripts/og/generate-site-open-graph.mjs

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const repositoryRoot = new URL('../../', import.meta.url)
const WIDTH = 1200
const HEIGHT = 630

const fontUrl = fileURLToPath(
  new URL(
    'node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2',
    repositoryRoot,
  ),
)

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

async function loadSiteAuthority() {
  const server = await createServer({
    configFile: false,
    root: fileURLToPath(repositoryRoot),
    logLevel: 'warn',
    server: { middlewareMode: true },
  })
  try {
    const [variants, icons, metadata] = await Promise.all([
      server.ssrLoadModule('/src/app/site/siteVariant.ts'),
      server.ssrLoadModule('/src/app/site/siteIcons.ts'),
      server.ssrLoadModule('/src/app/site/sitePublicMetadata.ts'),
    ])
    return {
      SITE_VARIANTS: variants.SITE_VARIANTS,
      THEME_COLOUR: icons.THEME_COLOUR,
      ICON_ACCENT: icons.ICON_ACCENT,
      PITCH_MARK: icons.PITCH_MARK,
      siteIconMark: icons.siteIconMark,
      siteIconDirectory: icons.siteIconDirectory,
      sitePublicMetadata: metadata.sitePublicMetadata,
    }
  } finally {
    await server.close()
  }
}

async function main() {
  const authority = await loadSiteAuthority()
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  const browser = await chromium.launch(executablePath ? { executablePath } : {})
  const page = await browser.newPage()
  await page.setContent(harnessHtml())
  await page.evaluate(() => document.fonts.ready)

  const written = []
  for (const variant of authority.SITE_VARIANTS) {
    const metadata = authority.sitePublicMetadata(variant)
    const dataUrl = await page.evaluate(drawOpenGraphCard, {
      width: WIDTH,
      height: HEIGHT,
      productName: metadata.productName,
      tagline: metadata.brand.tagline,
      mark: authority.siteIconMark(variant),
      geometry: { ...authority.PITCH_MARK },
      background: authority.THEME_COLOUR.dark,
      accent: authority.ICON_ACCENT,
    })
    const directory = new URL(`${authority.siteIconDirectory(variant)}/`, repositoryRoot)
    mkdirSync(fileURLToPath(directory), { recursive: true })
    written.push(
      writeIfChanged(new URL('og-image.png', directory), decodeDataUrl(dataUrl)),
    )
  }

  await browser.close()
  const changed = written.filter((entry) => entry.changed)
  if (changed.length === 0) {
    console.log(`${written.length} Open Graph images already up to date.`)
    return
  }
  for (const entry of changed) console.log(`wrote ${entry.path}`)
}

/**
 * Draw one social card inside Chromium. Everything needed is passed in because
 * `page.evaluate` serialises this function and cannot see module scope.
 */
function drawOpenGraphCard({
  width,
  height,
  productName,
  tagline,
  mark,
  geometry,
  background,
  accent,
}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'))

  context.fillStyle = background
  context.fillRect(0, 0, width, height)

  // Quiet football geometry gives the image identity without depending on any
  // club badge, provider image or licensed competition artwork.
  context.strokeStyle = 'rgba(255,255,255,0.08)'
  context.lineWidth = 2
  for (let x = 0; x <= width; x += 120) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height)
    context.stroke()
  }
  context.beginPath()
  context.arc(width * 0.79, height * 0.5, height * 0.34, 0, Math.PI * 2)
  context.stroke()

  context.fillStyle = accent
  context.font = "500 24px 'Space Grotesk', system-ui, sans-serif"
  context.letterSpacing = '4px'
  context.fillText('FOOTBALL PREDICTION', 78, 96)
  context.letterSpacing = '0px'

  context.fillStyle = '#FFFFFF'
  context.font = "500 78px 'Space Grotesk', system-ui, sans-serif"
  drawWrappedText(context, productName, 78, 196, 620, 88, 2)

  context.fillStyle = 'rgba(255,255,255,0.72)'
  context.font = "500 31px 'Space Grotesk', system-ui, sans-serif"
  drawWrappedText(context, tagline, 80, 392, 600, 43, 3)

  context.fillStyle = accent
  context.strokeStyle = accent
  const markX = width * 0.8
  const markY = height * 0.5
  const markSize = 310

  if (mark.kind === 'pitch') {
    context.lineWidth = geometry.lineWidth * markSize
    context.beginPath()
    context.moveTo(markX - markSize / 2, markY)
    context.lineTo(markX + markSize / 2, markY)
    context.stroke()

    context.lineWidth = geometry.circleWidth * markSize
    context.beginPath()
    context.arc(markX, markY, geometry.circleRadius * markSize, 0, Math.PI * 2)
    context.stroke()

    context.beginPath()
    context.arc(markX, markY, geometry.spotRadius * markSize, 0, Math.PI * 2)
    context.fill()
  } else {
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = "500 230px 'Space Grotesk', system-ui, sans-serif"
    context.fillText(mark.text, markX, markY + 8)
    context.textAlign = 'start'
    context.textBaseline = 'alphabetic'
  }

  context.fillStyle = accent
  context.fillRect(78, height - 70, 112, 8)
  context.fillStyle = 'rgba(255,255,255,0.45)'
  context.font = "500 20px 'Space Grotesk', system-ui, sans-serif"
  context.fillText('PREDICT • COMPETE • SETTLE IT', 212, height - 58)

  return canvas.toDataURL('image/png')

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = text.split(/\s+/)
    const lines = []
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= maxWidth || line.length === 0) {
        line = candidate
      } else {
        lines.push(line)
        line = word
        if (lines.length === maxLines - 1) break
      }
    }
    if (line && lines.length < maxLines) lines.push(line)
    lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight))
  }
}

function decodeDataUrl(dataUrl) {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
}

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
