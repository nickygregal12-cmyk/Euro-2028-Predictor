import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const OUT = process.env.OUT ?? '/tmp/sweep'
mkdirSync(OUT, { recursive: true })

const WIDTHS = (process.env.WIDTHS ?? '390,768,1023,1024,1280,1440,1800')
  .split(',')
  .map(Number)
const ROUTES = (process.env.ROUTES ?? '/dev/components').split(',')
const THEMES = (process.env.THEMES ?? 'dark,light').split(',')
const SHOTS = process.env.SHOTS === '1'

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

const problems = []

for (const theme of THEMES) {
  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        colorScheme: theme === 'light' ? 'light' : 'dark',
        reducedMotion: process.env.REDUCED === '1' ? 'reduce' : 'no-preference',
      })
      const page = await context.newPage()
      await page.goto(`http://localhost:5199${route}`, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)

      const report = await page.evaluate(() => {
        const doc = document.documentElement
        const overflow = doc.scrollWidth - doc.clientWidth
        const wide = []
        for (const node of document.querySelectorAll('body *')) {
          const box = node.getBoundingClientRect()
          if (box.width === 0 || box.height === 0) continue
          if (box.right > doc.clientWidth + 1 || box.left < -1) {
            // Only report a node whose own ancestors are not already reported.
            wide.push({
              tag: node.tagName.toLowerCase(),
              cls: (node.className || '').toString().slice(0, 60),
              right: Math.round(box.right),
              left: Math.round(box.left),
              scrolls: getComputedStyle(node).overflowX !== 'visible',
            })
          }
        }
        const small = []
        for (const node of document.querySelectorAll('button, a[href], input, select')) {
          // The dev harness's own scenario switchers are not shipping UI.
          if (node.closest('[data-harness]')) continue
          let target = node
          // A visually-hidden input inside a label is not the target; the label
          // is. Measuring the input would report every accessible radio group
          // as a 13px tap target.
          const label = node.closest('label')
          if (label && getComputedStyle(node).position === 'absolute') target = label
          const box = target.getBoundingClientRect()
          if (box.width === 0 || box.height === 0) continue
          if (box.height < 40) {
            small.push({
              tag: node.tagName.toLowerCase(),
              text: (target.textContent || '').trim().slice(0, 30),
              h: Math.round(box.height),
            })
          }
        }
        const rail = document.querySelector("nav[aria-label='Sections']")
        const bottom = document.querySelector("nav[aria-label='Primary']")
        const visible = (node) => node !== null && node.getBoundingClientRect().width > 0
        return {
          overflow,
          wide: wide.slice(0, 8),
          small: small.slice(0, 8),
          rail: visible(rail),
          bottomNav: visible(bottom),
        }
      })

      const label = `${route} @ ${width} ${theme}`
      if (report.overflow > 0) {
        problems.push(`OVERFLOW ${label}: ${report.overflow}px`)
        for (const node of report.wide) {
          problems.push(
            `   ${node.tag}.${node.cls} left=${node.left} right=${node.right} scrolls=${node.scrolls}`,
          )
        }
      }
      if (report.small.length > 0) {
        problems.push(
          `SMALL TARGETS ${label}: ` +
            report.small.map((node) => `${node.tag}"${node.text}"=${node.h}px`).join(', '),
        )
      }
      console.log(
        `${label.padEnd(42)} overflow=${report.overflow} rail=${report.rail} bottomNav=${report.bottomNav} small=${report.small.length}`,
      )

      if (SHOTS) {
        const slug = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root'
        await page.screenshot({
          path: `${OUT}/${slug}-${width}-${theme}.png`,
          fullPage: process.env.FULL === '1',
        })
      }
      await context.close()
    }
  }
}

await browser.close()
console.log('\n--- problems ---')
for (const line of problems) console.log(line)
if (problems.length === 0) console.log('none')
