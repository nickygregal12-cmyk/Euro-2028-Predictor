#!/usr/bin/env node
// Compressed bundle budgets (ACQ-R20).
//
// Budgets are gzip, because that is what the browser downloads — raw byte size
// over-reports by roughly 3x here and would drift for reasons nobody acts on.
// Netlify serves brotli where the client supports it, so gzip is the
// conservative proxy: a bundle inside the gzip budget is inside brotli too.
//
// Each budget sits above the measured value at the time it was set, so this is
// a ratchet against regression rather than a target to hit. Raising one should
// be a deliberate edit with a reason, not a reflex.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, resolve } from 'node:path'

const root = process.argv[2] ?? resolve(process.cwd(), 'dist')

// Measured 30 July 2026 at contract 63: entry 63.4 KB, all JS 254.7 KB,
// all CSS 35.6 KB.
//
// CSS RE-RATCHETED 6 AUGUST 2026, DOWNWARDS. `cssCodeSplit: false` collapsed
// 39 per-route stylesheets into one and took all CSS from 44.5 KB to 29.8 KB —
// the 15 KB was per-file gzip loss rather than content, and the reasoning is
// recorded at length in `vite.config.ts`. Leaving the ceiling at 45 would have
// banked the saving as silent room and invited exactly the drift that caused
// it, so the budget follows the measurement down. 34 KB keeps roughly four
// kilobytes of headroom, which is now a great deal of it: a new surface's
// styles join an existing dictionary instead of starting a fresh one, so they
// cost a fraction of what they used to.
//
// THE ENTRY CHUNK WAS RAISED 9 AUGUST 2026, FROM 75 TO 76, AND THE ATTEMPTS
// THAT FAILED FIRST ARE THE REASON. At 75 the ceiling had 0.166 KB of headroom:
// `main` measured 74.834 KB gz and one route registration plus a title took it
// to 74.962 here, which CI's own build — not byte-identical to a local one —
// rounded past 75.000 and failed. A ceiling that a single route cannot fit
// under is not a ratchet, it is a stop.
//
// The obvious lever makes it WORSE, measured three times rather than assumed:
//
//   • lazy-loading the tournament data boundary          75.0 -> 76.9 KB gz
//   • lazy-loading the admin gate and its layout         75.0 -> 80.9 KB gz
//   • both, with the pages beneath them already lazy     no better
//
// Splitting a route out of this bundle hoists the modules it shares with the
// rest into the entry chunk, so the chunk grows while total JavaScript barely
// moves. That is worth knowing before the next session spends an afternoon on
// it. What DID work was removing something genuinely unreachable: the nine
// `/dev/*` route titles now build only in development, matching the routes
// themselves, for about 0.1 KB.
//
// 76 leaves roughly one kilobyte over the measured 74.962 and still refuses
// both split variants above, so the ceiling continues to catch the direction
// that made things worse rather than licensing it.
//
// ALL JS IS THE TIGHT ONE, and it moved from 292.8 to 228.5 of 300 KB when
// `cssCodeSplit: false` landed and the season surfaces were split out. Recorded
// so the next session meets the position rather than a surprise on a red check.
//
// RAISED FROM 300 TO 312 ON 11 AUGUST 2026, with the measurement and the reason
// rather than to make a check go green. The UI-finalisation consumption pass
// added the competition league table (contract 160), the action centre and the
// preference, onboarding, private-creation and invite surfaces, and the total
// crossed 300 by 0.3 KB — 0.1%. Reducing was considered first and the entry
// chunk WAS reduced, from 80.7 back to 75.0, by making the action-centre panel
// lazy and deferring `loadCompetitionWeek`; that is the number that decides
// what a first paint costs, and it is the one held tight at 76.
//
// The total is a different control: it bounds how much JavaScript the product
// is, across every route, and real features move it. 312 sits roughly twelve
// kilobytes above the measured 300.3, which is the same headroom-to-measurement
// shape the entry ceiling uses, so it still refuses a careless import while not
// refusing the features this pass was asked to build.
//
// RAISED FROM 312 TO 322 ON 11 AUGUST 2026, AND THE REASON IS THAT THIS NUMBER
// NOW MEASURES TWO PRODUCTS. ADR 0026's site-variant seam landed, so `dist`
// carries the route chunks of BOTH deployments — the weekly Prediction Hub's
// landing page and the Euro tournament's, and every surface each of them
// reaches. No visitor downloads both: the variant is fixed at build time and
// the two landing pages are separately lazy, so a Hub visitor never fetches a
// byte of the tournament page. The total crossed 312 by 1.0 KB.
//
// THE ENTRY CHUNK IS STILL THE TIGHT ONE, and it was reduced rather than
// excused: the site configuration first put the entry chunk 0.2 KB OVER 76, and
// the fix was to move the per-game copy into `siteGames.ts`, which only the
// lazily-routed games and landing surfaces import. That is recorded in that
// file, because it is a measured reason and not a stylistic one.
//
// 322 sits about ten kilobytes above the measured 313.0, the same
// headroom-to-measurement shape as before. If this number is raised again
// without the entry chunk holding, the thing to check first is whether one
// deployment's code has leaked into the other's critical path.
//
// THE ENTRY CHUNK WAS RAISED 11 AUGUST 2026, FROM 76 TO 77, AND THE TWO
// CHEAPER FIXES WERE MEASURED FIRST RATHER THAN ASSUMED. ADR 0026's variant
// destinations put the route ownership of BOTH products in the shell: the four
// shared addresses now resolve through a dispatcher rather than straight to the
// Hub's pages, which is the whole of what stops a signed-in Euro visitor being
// handed the domestic product. Measured from 75.8:
//
//   • the dispatcher static, both candidate pages lazy      76.4 KB gz
//   • the dispatcher itself ALSO lazy                       90.2 KB gz
//   • the Euro signup gate statically imported beside it    77.5 KB gz
//
// The second is the same hoisting effect recorded above and is far worse — the
// modules the four destinations share with the rest of the shell get pulled up
// while the total JavaScript barely moves. The third WAS reduced rather than
// excused: making `EuroSignupGate` lazy took 1.1 KB back out, because it drags
// contract 143's publication read and its lifecycle presentation table behind
// it to guard one route most visitors never open. That leaves 76.4 against a
// ceiling of 76.
//
// 77 leaves roughly half a kilobyte over the measurement, which is tighter than
// this ceiling has been. That is deliberate: it still refuses the lazy-
// dispatcher shape by a wide margin, and it keeps the number that decides what a
// first paint costs under pressure now that one shell serves two products.
// RAISED FROM 322 TO 336 AND FROM 34 TO 36 ON 11 AUGUST 2026, FOR ELEVEN NEW
// PRODUCT SURFACES, AND THE ENTRY CHUNK IS THE EVIDENCE THAT THEY LANDED IN THE
// RIGHT PLACE. The Innovation Lab UI pass added the What-If projection and the
// divergence line to the Match Centre, Prediction DNA to a player's season,
// side honours to a private league, closest misses and a submission receipt to
// the matchweek card, the matchday briefing to Home and `/play`, the Matchday
// TV screen, the share entry points, the app badge and view transitions.
// Measured against `main`, chunk by chunk:
//
//   • entry (`index`)                                       +0.3 KB gz
//   • SeasonMatchCentreRoute                                +2.9 KB gz
//   • SeasonGameRouteBundle                                 +2.4 KB gz
//   • SeasonPlayerProfileRoute                              +2.1 KB gz
//   • SeasonTvModeRoute (new, lazy, reached from one link)  +2.3 KB gz
//   • BriefingPanel, ShareAction (new shared chunks)        +2.0 KB gz
//   • HubPage                                               +0.2 KB gz
//
// TWELVE POINT SEVEN KILOBYTES OF WHICH THREE HUNDRED BYTES REACH A FIRST
// PAINT. That distribution is the thing worth checking and it is why this raise
// is a budget change rather than a defect: every heavy feature is inside the
// route chunk of the surface that shows it, the television screen is its own
// lazy chunk that no ordinary navigation loads, and the entry chunk — the
// number that decides what a first paint costs — is 76.3 against a ceiling of
// 77 and is NOT raised here. If the total is raised again while the entry chunk
// also moves, the thing to check first is whether one of these panels has been
// imported statically into the shell.
//
// 336 sits about four kilobytes above the measured 332.0, which is tighter than
// the previous raises deliberately: this pass added eleven surfaces at once and
// the next one should have to justify itself rather than inherit the headroom.
// CSS is a single file here and is not route-split, so eleven new stylesheets
// move one number; 36 leaves roughly a kilobyte over the measured 34.8.
//
// RAISED FROM 336 TO 344 ON 12 AUGUST 2026, FOR THE CONTRACTS 174–178
// CONSUMPTION, AND THE PREVIOUS RAISE'S OWN TEST IS WHAT JUSTIFIES IT. That
// note says: "If the total is raised again while the entry chunk also moves,
// the thing to check first is whether one of these panels has been imported
// statically into the shell." The entry chunk did NOT move — 76.3 KB gz before
// and after, against a ceiling of 77 that is not raised here. Measured against
// `main` at `6e07b30`, chunk by chunk:
//
//   • SeasonAdminPage           +3.5 KB gz  contracts 174 and 178's two panels
//   • SeasonGameRouteBundle     +2.4 KB gz  the offline drafting strip and hook
//   • SeasonPlayerProfileRoute  +1.6 KB gz  Prediction DNA over contract 176
//   • SeasonMatchCentreRoute    +0.6 KB gz  What-If over contract 175
//   • seasonLms                 +0.5 KB gz  shared season service chunk
//   • entry (`index`)            0.0 KB gz
//
// EIGHT POINT SIX KILOBYTES, NONE OF WHICH REACHES A FIRST PAINT. The largest
// single increase is the administration page, which no player loads at all.
// Two of the five surfaces got SMALLER work rather than larger: the What-If and
// Prediction DNA derivations were deleted and replaced by decoders, so +0.6 and
// +1.6 are the net of a new service against a removed derivation rather than
// the cost of the panels themselves.
//
// 344 sits about three kilobytes above the measured 340.6, keeping the same
// deliberate tightness the previous raise chose. CSS is unchanged at 36: the
// four new stylesheets took the measurement from 34.8 to 35.6, inside it.
//
// RAISED FROM 344 TO 352 AND FROM 36 TO 38 ON 12 AUGUST 2026, FOR THE
// PRESENTATION-LAYER FINISHING PASS, AND THE SAME TEST APPLIES AND PASSES. The
// note above says to check, whenever the total is raised, whether the ENTRY
// chunk also moved — because that is what would mean a panel had been imported
// statically into the shell. It did not: 76.3 KB gz on `main` and 76.3 KB gz
// here, against a ceiling of 77 that is not raised. Measured against `main` at
// `9037d28` in a clean worktree, chunk by chunk:
//
//   • SeasonAdminPage            +1.9 KB gz  contract 172's health panel
//   • LandingPage                +1.5 KB gz  the four-frame scripted preview
//   • reminderDeliveryHealth*    +1.0 KB gz  its decoder and its wrapper
//   • SeasonMatchPredictorRoute  +1.1 KB gz  the club-form read moving INTO the
//                                            route's own shared chunk, which is
//                                            why `seasonClubForm` drops 1.1
//                                            immediately below — a rechunk, and
//                                            net zero
//   • SeasonGameRouteBundle      +0.6 KB gz  the matchweek form panel and model
//   • ExploreCompetitionsPage    +0.6 KB gz  the Follow control
//   • GlobalLeaguesPage          +0.5 KB gz  the private-play explainer
//   • SeasonMatchesRoute         +0.2 KB gz  the club-form panel layout
//   • EuroLandingPage            +0.2 KB gz  the hero status card
//   • entry (`index`)             0.0 KB gz
//
// The vendor chunks also re-split — `lib` disappears and `jsx-runtime` grows by
// almost exactly as much, a net −1.1 KB that belongs to Vite's chunking rather
// than to this change. Recorded so the next reader does not spend time on the
// largest two lines of the diff.
//
// FIVE POINT THREE KILOBYTES, NONE OF WHICH REACHES A FIRST PAINT, and the
// largest single line is again the administration page no player loads.
//
// CSS IS THE ONE THAT NEEDED THE MORE HONEST NUMBER. It is a single unsplit
// file, so every panel's stylesheet moves one measurement, and 36 had roughly
// 0.4 KB gz of headroom left — less than one new component. This pass added six
// stylesheets and the measured value went 35.6 → 36.6. Raising to 38 gives
// about a kilobyte and a half over the measurement, which is deliberately more
// than the last two raises left: a ceiling with less headroom than a single
// component costs is not a ratchet, it is a stop, and the last two CSS raises
// were each one component away from that.
//
// RAISED FROM 352 TO 356 AND FROM 38 TO 39 ON 12 AUGUST 2026, FOR THE PRIVATE
// HUB-ONLY AI LAB DASHBOARD. CI measured all JS at 354.9 KB gz and all CSS at
// 38.6 KB gz. The heavy page remains a lazy 8.1 KB chunk behind both the Hub
// deployment boundary and the competitions-admin capability; the Euro build
// emits no AiLabPage chunk at all. Most importantly, the largest/entry chunk
// remains inside the unchanged 77 KB cap at 76.5 KB, so no player first paint
// inherits the laboratory. The aggregate ceilings move only enough to admit
// the measured private surface and preserve the tighter per-chunk control.
//
// RAISED FROM 356 TO 366 AND FROM 39 TO 41 ON 13 AUGUST 2026, FOR CONTRACT
// 188'S BET BUILDER, AND THE PREVIOUS RAISES' OWN TEST IS WHAT JUSTIFIES IT.
// Those notes say: whenever the total is raised, check whether the ENTRY chunk
// also moved, because that is what would mean a panel had been imported
// statically into the shell. Measured against `main` at `2301b48`, built in a
// clean worktree from the same `node_modules`, ONE chunk moved at all:
//
//   • AiLabPage                  7.91 -> 14.48 KB gz  +6.58
//   • entry (`index`)                                  0.00 KB gz
//   • every other chunk                                below 0.05 KB gz
//
// SIX POINT SIX KILOBYTES IN A SINGLE LAZY CHUNK THAT NO PLAYER LOADS. The Bet
// Builder is administrator-only, behind the `competitions` capability and the
// Hub deployment boundary, and the Euro build emits no `AiLabPage` chunk at
// all — so the entire increase is unreachable from both a first paint and the
// tournament product. The largest-chunk ceiling, which is the number that
// decides what a first paint costs, is unchanged at 77 and measures 76.5.
//
// That distribution is why this is a budget change rather than a defect: the
// aggregate ceiling exists to bound how much JavaScript the product IS, and a
// private laboratory surface genuinely added some. Reducing was considered and
// rejected as the wrong lever here — splitting the Bet Builder out of a page
// that is ALREADY a lazy chunk would hoist its shared modules and grow the
// total, which is the effect measured three times in the notes above.
//
// 366 sits about four and a half kilobytes above the measured 361.5, the same
// deliberate tightness the last four raises chose. CSS went 38.6 -> 39.2 and is
// a single unsplit file, so 41 keeps roughly the kilobyte-and-a-half of headroom
// the 12 August note argued for: a ceiling with less headroom than one
// component costs is a stop rather than a ratchet.
//
// RAISED FROM 41 TO 44 ON 15 AUGUST 2026 FOR THE UI UX PRO MAX FINALISATION
// BATCH, AFTER MEASURING THE FAILURE RATHER THAN GUESSING. Batch one still fits
// under 41 KB; batch two deliberately improves the existing competition shell,
// discovery, Prediction DNA, private-league comparison, Championship and LMS
// surfaces and measures 42.1 KB gz in CI. CSS is intentionally one unsplit file,
// so every one of those responsive/accessibility rules moves the same total.
// The critical controls do not move: the largest JS chunk is still 76.5/77 KB
// and all JavaScript is 364.1/366 KB. A 44 KB CSS ceiling leaves about 1.9 KB
// over the measured value — enough for roughly one component, while still
// refusing an unreviewed second pass of comparable size.
// RAISED 19 AUGUST 2026 — 77 → 80, 366 → 436, 44 → 55 — BECAUSE THE vNEXT
// PRESENTATION LANE ARRIVED IN THE PRODUCTION BUNDLE. Two surfaces put it there
// on purpose: `/about`, which publishes the non-affiliation statement ADR 0017
// asks for, and the public landing page, whose product preview now MOUNTS the
// real Home, Matches, Leagues and Games rather than drawing a hand-built
// picture of them. The picture is what went stale — it was still advertising a
// "Hub / Predict / More" navigation the product had retired — so this is the
// cost of a marketing page that cannot lie about the product.
//
// EVERY NUMBER BELOW WAS MEASURED AGAINST `main` AT `895102c`, CHUNK BY CHUNK,
// IN A CLEAN WORKTREE. Bundle notes in this file have a habit of asserting a
// distribution; this one was checked.
//
//   • presentationZone (new, lazy)   +46.2 KB gz  the shell, the foundations and
//                                                 Framer Motion, shared by the
//                                                 two surfaces that use them
//   • ProductPreview (new, lazy)     +26.5 KB gz  the four vNext pages and the
//                                                 marketing world they render
//   • style.css                      +10.6 KB gz  vNext tokens and stylesheets;
//                                                 `cssCodeSplit: false` means
//                                                 one file, so this is eager
//   • hooks (new, lazy)               +7.5 KB gz
//   • index (entry)                   +6.6 KB gz  RE-CHUNKING, NOT NEW CODE —
//                                                 see below
//   • lib (new)                       +6.4 KB gz  ditto
//   • AboutPage                       +2.8 KB gz  the page itself; its shell and
//                                                 motion moved to the shared
//                                                 chunk above
//   • LandingPage                     −1.2 KB gz  SMALLER: the hand-built device,
//                                                 its rows and its CSS are gone
//   • design-system                   −7.2 KB gz  absorbed into the entry chunk
//   • jsx-runtime                    −12.4 KB gz  re-split
//
// THE ENTRY CHUNK DID NOT GROW, AND THAT IS THE CONTROL THIS FILE CARES MOST
// ABOUT. `index` rose from 73.3 to 79.8, but `design-system` (7.2) disappeared
// into it and `jsx-runtime` fell 12.4 while a new `lib` took 6.4. Summed, the
// four chunks a first paint actually fetches went 96.1 → 96.6 KB gz: half a
// kilobyte. The entry ceiling moves to 80 because the METRIC is "largest single
// chunk" and Vite reshaped which chunk that is — not because more code reaches
// a first paint. Verified directly: the entry chunk contains no Framer Motion,
// no vNext module and no marketing fixture. If it ever does, that is a real
// regression and this note is how the next reader will know.
//
// WHAT AN ANONYMOUS VISITOR ACTUALLY DOWNLOADS BEFORE THE PAGE PAINTS went
// 144.7 → 147.6 KB gz, +2.9, and 10.6 of the CSS increase is inside it. The
// preview's own 80.2 KB gz is behind `React.lazy` and arrives into a box the
// page already reserved from `previewDevice.ts`, so it costs no layout shift
// and is not on the critical path. That split is the whole design; if a future
// change raises the total again while the LANDING chunk also grows, the thing
// to check first is whether the preview has been imported statically.
//
// 436 sits about six kilobytes above the measured 429.8 and 55 about two above
// 53.1 — the same deliberate tightness the previous raises chose. The one
// reduction NOT taken is recorded so nobody re-derives it: Framer Motion's
// projection code is roughly half of `presentationZone`, and `LazyMotion` with
// `domAnimation` would remove it — but `VNextNav` animates its active indicator
// with a shared `layoutId`, which needs `domMax`. Deleting a product behaviour
// to shrink a lazy chunk is the wrong trade; deferring the feature bundle with
// an async `features` import is the right one, and it is a change to the vNext
// lane rather than to this page.
// RAISED 20 AUGUST 2026 — 80 → 92, 436 → 492, 55 → 60 — BECAUSE THE FOOTBALL
// HUB CUTOVER TURNED ON. `config/vnext-programme.json` carries
// `productionCutoverAuthorized: true` and `netlify.toml` sets all nine
// destination flags in `[build.environment]`, so every context now BUILDS the
// vNext surfaces rather than folding them out. This is the first measurement of
// the product as it will actually be served.
//
// MEASURED WITH THE FLAGS ON, chunk by chunk, rather than estimated:
//
//   • index (entry)             79.9 → 89.6 KB gz
//   • VNextShell (new, lazy)     0.0 → 46.1  the shell, foundations and Framer
//                                            Motion, shared by every destination
//   • VNextHubDestinations       0.0 → 29.1  the eight cutover adapters
//   • VNextLeagues (new, lazy)   0.0 → 13.0
//   • ProductPreview (lazy)     10.8 → 10.8  the landing page's, unchanged
//   • all JS                   430.4 → 479.7
//   • all CSS                   53.2 → 58.1
//
// THE ENTRY CHUNK CONTAINS NO vNEXT CODE, and that was verified rather than
// assumed: no Framer Motion, no `data-vnext`, no vNext token, no marketing
// fixture, no `configureVNextTimeZone`. Every destination is behind
// `React.lazy` gated on a folded `import.meta.env` literal. The 9.7 KB is
// Rollup rebalancing — more consumers for the shared modules hoists common code
// up — which is the same effect the Matches cutover recorded and measured at
// 6.75 KB. If a future raise is accompanied by Framer Motion appearing in that
// probe, that is a static import that must be made lazy rather than budgeted.
//
// WHAT A SIGNED-IN VISITOR DOWNLOADS BEFORE ANYTHING RENDERS is 151.0 KB gz:
// the entry chunk, the jsx runtime and the one stylesheet. The 88 KB of vNext
// surfaces arrives per destination, on demand.
//
// THE CSS IS THE ONE THAT IS EAGER AND CANNOT BE MADE LAZY. `cssCodeSplit:
// false` collapses every stylesheet into one file that every visitor fetches,
// for the per-file gzip reason recorded at length in `vite.config.ts`, so the
// vNext lane's 4.9 KB is on the critical path whatever the routing does. It is
// the price of the design language and it is worth stating rather than hiding
// inside the total.
//
// 92 sits about two kilobytes over the measured 89.6, 492 about twelve over
// 479.7 and 60 about two over 58.1 — the same headroom-to-measurement shape the
// previous raises chose. THE ROLLBACK MEASUREMENT STILL HOLDS: with every flag
// off the same build measures 79.9 / 430.4 / 53.2, so turning a destination
// back off recovers its bytes as well as its behaviour.
// RAISED AGAIN 20 AUGUST 2026 — 492 → 506 AND 60 → 64, ENTRY UNCHANGED AT 92 —
// BECAUSE THE MATCH PREDICTOR IS NOW SHIPPED AT ALL.
//
// Stage 14 built `VNextPredictorDestination` and mounted it on no route, so the
// flagship game's vNext surface existed in the repository and in NO build: its
// only reachable address was the `import.meta.env.DEV` harness. Routing it is
// the fix for a player being dropped into the legacy season page from inside
// the Competition Deck, and the bytes are that surface arriving rather than any
// existing surface growing.
//
// Isolated by measuring the same commit three ways:
//
//   every flag off ............... 80.1 / 431.2 / 53.2
//   every flag on, predictor off .. 89.9 / 481.2 / 58.2
//   every flag on ................. 89.9 / 491.9 / 61.1
//
// so the destination costs +10.7 KB gz of JavaScript and +2.9 KB gz of CSS, and
// THE ENTRY CHUNK DOES NOT MOVE — the route is lazy, so only a player who opens
// the Match Predictor fetches the JavaScript. The CSS half is unavoidable and
// already recorded: `cssCodeSplit: false` collapses every stylesheet into one
// file every visitor downloads, which is why 2.9 KB of it is worth naming.
//
// 506 sits about fourteen kilobytes over the measured 491.9 and 64 about three
// over 61.1 — the same headroom-to-measurement shape every previous raise chose.
// THE ROLLBACK MEASUREMENT STILL HOLDS, and now covers this destination too:
// with every flag off the build measures 80.1 / 431.2 / 53.2, so turning the
// Match Predictor back off recovers its bytes as well as its behaviour.
const BUDGETS = {
  entryChunkKb: 92,
  totalJsKb: 506,
  totalCssKb: 64,
}

/**
 * Every file under a directory, recursively.
 *
 * @param {string} directory
 * @returns {string[]}
 */
function walk(directory) {
  /** @type {string[]} */
  const out = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

/**
 * @param {string} path
 * @returns {number} gzipped size in KB
 */
function gzipKb(path) {
  return gzipSync(readFileSync(path)).length / 1024
}

/** @type {string[]} */
let files
try {
  files = walk(root)
} catch {
  console.error(`No build output at ${root}. Run \`npm run build\` first.`)
  process.exit(1)
}

const js = files.filter((file) => file.endsWith('.js'))
const css = files.filter((file) => file.endsWith('.css'))

if (js.length === 0) {
  console.error('No JavaScript assets found — refusing to report a vacuous pass.')
  process.exit(1)
}

// The entry chunk is the one the browser must have before anything renders.
const entry = js
  .map((file) => ({ file, kb: gzipKb(file) }))
  .sort((left, right) => right.kb - left.kb)[0]
if (entry === undefined) {
  // A build with no JavaScript is not a passing budget, it is a broken build.
  console.error('No JavaScript chunk was emitted, so the entry budget cannot be checked.')
  process.exit(1)
}

const totalJs = js.reduce((sum, file) => sum + gzipKb(file), 0)
const totalCss = css.reduce((sum, file) => sum + gzipKb(file), 0)

/** @type {[label: string, actual: number, budget: number, detail: string][]} */
const checks = [
  ['largest JS chunk', entry.kb, BUDGETS.entryChunkKb, entry.file],
  ['all JS', totalJs, BUDGETS.totalJsKb, `${js.length} files`],
  ['all CSS', totalCss, BUDGETS.totalCssKb, `${css.length} files`],
]

let failed = false
for (const [label, actual, budget, detail] of checks) {
  const status = actual > budget ? 'OVER' : 'ok'
  if (actual > budget) failed = true
  console.log(
    `${status.padEnd(4)} ${label.padEnd(17)} ${actual.toFixed(1).padStart(7)} KB gz / ${String(budget).padStart(3)} KB  (${detail})`,
  )
}

if (failed) {
  console.error(
    '\nCompressed bundle budget exceeded. Either reduce the bundle or raise the ' +
      'budget in scripts/check-bundle-budget.mjs with a reason.',
  )
  process.exit(1)
}
console.log('\nAll compressed bundle budgets met.')
