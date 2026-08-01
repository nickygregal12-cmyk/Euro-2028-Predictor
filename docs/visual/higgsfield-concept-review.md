# Higgsfield concept review — Football Prediction Hub visual direction

**Status:** Concepts for owner review. **Nothing is implemented, committed or pushed.**
**Date:** 1 August 2026
**Scope:** three visual directions plus supporting concept assets. No application code, token, route, schema or product rule was changed.
**Decision requested:** pick one direction (or reject all three) before any implementation work starts.

---

## 1. Tooling confirmation

The Higgsfield MCP server is present and authenticated. `models_explore` reports `provider_name: "Higgsfield"` on its own models, which confirms the connector identity.

Two constraints emerged that the brief did not anticipate, and both shaped what could be produced:

| Constraint | Detail |
| --- | --- |
| Plan tier | The account is on the **free** plan with 10 credits. `soul_location` — the model actually recommended for environment and background work — returned `Requires basic plan or higher` and could not be used. |
| Model actually available | `z_image` (Tongyi-MAI), a fast stylised text-to-image model. It has **no controllable parameters** — no seed, no negative-prompt field, no resolution control, no style strength. Everything had to be steered through prose alone. |
| Rate limiting | The endpoint returned HTTP 429 repeatedly; generations had to be serialised rather than batched. |
| Output | 2048px on the long edge, PNG, RGB. Adequate as source for AVIF/WebP conversion at 1× and 2× phone widths; **marginal for a 2560px+ desktop background**, which would need upscaling. |

**Cost:** 18 generations at 0.15 credits each = **2.70 credits**. Balance went 10.00 → 7.30. No other spend was incurred.

The absence of a negative-prompt field matters more than it sounds. Every exclusion in the brief — no purple, no neon, no text, no markings — had to be written as English prose inside the positive prompt, and `z_image` honoured those instructions inconsistently. Section 9 records where it ignored them.

---

## 2. Repository authorities read

- [`AGENTS.md`](../../AGENTS.md) — operating rules, authority order, architecture rules.
- [`docs/design-system.md`](../design-system.md) — 455 lines; the stated source of truth for all visual and interaction design.
- [`docs/adr/0017-brand-and-club-identity.md`](../adr/0017-brand-and-club-identity.md) — club identity, badge-free rule.
- [`docs/adr/0019-brand-decision-deferred.md`](../adr/0019-brand-decision-deferred.md) — brand deferred with a trigger.
- [`docs/adr/0020-football-prediction-hub-product-model.md`](../adr/0020-football-prediction-hub-product-model.md) — the hub product model.
- [`src/styles/tokens.css`](../../src/styles/tokens.css) — the token values themselves.
- [`src/features/hub/HubPage.tsx`](../../src/features/hub/HubPage.tsx), [`CompetitionDashboardPage.tsx`](../../src/features/hub/CompetitionDashboardPage.tsx), [`hub.module.css`](../../src/features/hub/hub.module.css).
- [`src/design-system/ClubIdentity.tsx`](../../src/design-system/ClubIdentity.tsx), [`EmptyState.tsx`](../../src/design-system/EmptyState.tsx).

There is no `PRODUCT.md` or `DESIGN.md`; `docs/design-system.md` is the equivalent.

---

## 3. Brand characteristics that must be preserved

Taken from `docs/design-system.md` §1–§4 and `tokens.css`:

- **Two themes, one system.** Dark "Night broadcast" is default (`--bg #0A1128`, `--card #101E3E`); light "Daylight clean" is opt-in (`--bg #F7F5F0`, `--card #FDFCFA`). Only token values change between them — never layout.
- **Colour carries fixed meaning app-wide.** Accent green `#22E06C` is *the user's world*; cyan `#38C8E8` is *live real data*; amber `#F0B429` is *third place*; red is *errors*; and **gold `#E8C34A` is jokers and nothing else** — the design system states this as a hard rule.
- **Every colour comes from a token.** No raw hex in component CSS.
- **Typography:** Space Grotesk for display, headings and all numbers; Inter for body. Eyebrows 11px uppercase, 0.08em tracking.
- **Shape:** card radius 14px, 1px `--line` border, 14–16px padding.
- **No emoji anywhere.** SVG icons only. Real flags via `flag-icons`, never emoji flags.
- **Phone-first at 360px.** 44×44px minimum tap targets.
- **Badge-free club identity.** `ClubIdentity` is the *only* path by which a club may be shown — colour, generic kit pattern, monogram. ADR 0017 adds a design instruction: *"The design must not leave a crest-shaped hole"* — build an editorial, typographic layout rather than one shaped around a missing badge.
- **Contrast is enforced by tests.** `tokenContrast.test.ts` pins the text-token/surface matrix for both themes and `cssTokenPairings.test.ts` fails any rule declaring a sub-AA pairing. Anything placed behind text has to clear AA or it breaks CI, not just taste.

---

## 4. Conflicting design authorities — reported, not resolved

Four conflicts were found. **None is resolved here**, per the instruction to report before proceeding.

**4.1 The design system is still named and scoped for one tournament.**
`docs/design-system.md` opens "Euro 2028 Predictor — Design System" and declares itself the source of truth where "If code and this doc disagree, the doc wins." ADR 0020 has since made the product the Football Prediction Hub, and the document contains **no hub, competition-dashboard, or multi-competition section at all**. The surfaces this brief is about are not covered by the document that claims authority over them. Whichever direction is chosen, that document needs a hub section or it will keep winning arguments about screens it has never described.

**4.2 The design system has no concept of imagery.**
The entire system is flat, token-driven surfaces. There is no token, rule or precedent for photographic or generated imagery, and therefore **no existing authority on text-over-image contrast, image theming, or asset budgets**. Introducing atmospheric imagery is a genuine extension of the system, not a restyle within it. It needs its own rules — minimum scrim, maximum luminance in text zones, per-theme variants — added to §2 and §4 before implementation.

**4.3 Gold is reserved, and "premium football broadcast" reaches for gold.**
`--gold` is jokers only, stated as a hard rule. The natural visual vocabulary for premium football broadcast — trophy gold, golden-hour warmth — collides with it directly. All three directions below deliberately avoid warm gold in consequence, which is a real constraint on how "premium" they are allowed to look. If gold is ever wanted for competition atmosphere, that is an ADR-level change to a stated rule, not a design tweak.

**4.4 ADR 0017 and the Phase 0 evidence disagree about the shareable artefact.**
ADR 0017 consequences state the weekly results card is *"the artefact most likely to be seen outside the product"* and must be built on `ClubIdentity`. [`multi-competition-hub-build-plan.md`](../architecture/multi-competition-hub-build-plan.md) §1a correction O3 contradicts it from observed evidence: the **league table** is already being shared unprompted. It matters here because it decides which artefact deserves the strongest visual treatment.

**Resolved 1 August 2026 by [ADR 0021](../adr/0021-sharing-surface-priority.md):** standings sharing is the primary organic surface, the weekly personal card is secondary, and the shipped champion/bracket renderer stays tournament-specific. The three are separate artefacts and must not be collapsed into one share component; shared visual primitives may be reused.

---

## 5. Layout finding — measured, and it changes the brief

The brief asks for a "Hub desktop background". **The approved layout has almost nowhere to put one.** Measured in the running application:

| Surface | Viewport | Measurement |
| --- | --- | --- |
| Hub | 1440×900 | `main` has `max-width: none`, spans the full 1440px, **0px side gutter**. Cards 697px wide in a 2-column grid. |
| Hub | 390×844 | Cards 358px wide, 16px gutters, `--card` fully opaque. Cards total **1770px of height against an 844px viewport**. |
| Competition dashboard | 1440×900 | Sections 1408px wide, 16px gutters. |

At every breakpoint the content is full-bleed with 16px gutters and opaque cards. A page-level background image would be visible only in those gutters and the gaps between cards — on phone, effectively not at all.

**Consequence for all three directions:** imagery must be a **band inside the card or page header**, not a page background. The alternative — introducing a constrained max-width content column so a background can show around it — would change an approved layout, which this brief forbids. Every direction below is therefore specified as a header band. The assets named `hub-desktop-*` should be read as *masthead band artwork*, not wallpaper.

---

## 6. The three directions

### Direction 01 — Floodlight

**Rationale.** Atmosphere from *light*, not from photographs of places. The product is used in the evening, around matches; a floodlit haze over deep navy extends `--bg` rather than competing with it, and reads as football without depicting anything ownable. Restraint comes from confining the light to one corner and letting the rest fall to near-black.

- **Hub concept.** A shallow masthead band behind the eyebrow and h1 only, roughly 180px tall on desktop and 120px on phone, fading to `--bg` at its lower edge. Cards sit on flat `--bg` below it, unchanged.
- **Competition dashboard concept.** The same band, re-lit per competition, sitting behind the competition name and season. The dashboard's card stack is untouched.
- **Premier League.** Crisp, clean, white-blue light; sharp air; minimal haze. The most "broadcast studio" of the three.
- **Scottish Premiership.** Colder and damper — blue-grey, visible drizzle in the beam, heavier cloud. Distinguished by *weather and temperature*, never by tartan, saltire or any national device.
- **Euro 2028.** Warm summer dusk, wide open sky, dry still air. Distinguished by *season and scale*. Deliberately not gold (see §4.3).
- **Empty-state style.** Low-contrast navy line drawing of pitch geometry — the strongest single asset produced (see §8).
- **Onboarding style.** The same line vocabulary, drawn progressively: one element added per step, so the illustration completes as the user does.
- **Mobile cropping and text-safe areas.** The light source must sit in the top-right; the bottom two thirds must stay below 0.10 relative luminance. The mobile crop is a separate asset, not a CSS crop of the desktop one — `object-fit: cover` on the 16:9 asset pulls the bright lamp into the centre of a 9:16 frame.
- **Accessibility and performance risks.** The generated hub asset has a **specular lamp head** reaching 3.24:1 against `--tx` at its brightest — unusable behind text without a scrim or a crop that removes the lamp. Light theme needs an entirely separate treatment, not an inversion; a dark atmospheric band on cream reads as a bruise. Two full-size assets per competition per theme is a real payload — budget AVIF at ~40–60KB each and lazy-load below the fold.

---

### Direction 02 — Broadcast Grid

**Rationale.** No photography at all. A flat graphic system — thin rules, dot matrices, sweep lines — derived from the same geometry the tables and score rows already use. It is the most *data-led* of the three and the most honest about what the product is: a numbers product, not a stadium product. It is also the only direction that could eventually be rendered in CSS/SVG from tokens rather than shipped as images, which removes the payload and the theming problem together.

- **Hub concept.** A masthead band of fine rules that thin out toward the left, leaving the heading area flat.
- **Competition dashboard concept.** The same grid with per-competition rhythm — spacing and direction change, the vocabulary does not.
- **Premier League.** Dense, even, engineered vertical rules. Regular and relentless, like a 38-week league.
- **Scottish Premiership.** Broken, irregular horizontal rules with a diagonal weather wash — the same system, disturbed.
- **Euro 2028.** A radiating fan opening outward, echoing a bracket. Tournament shape expressed as geometry.
- **Empty-state style.** An incomplete rule-and-dot rectangle — a table with nothing in it. Directly legible as "no data yet" rather than decorative.
- **Onboarding style.** The grid assembling itself line by line.
- **Mobile cropping and text-safe areas.** Because the artwork is geometric, the mobile version should be **regenerated at 9:16, never cropped** — cropping a rule field changes its rhythm and it stops reading as a system. Keep all rules above the heading baseline.
- **Accessibility and performance risks.** The generated Premier League and Euro treatments are the **worst-measured assets in the whole set** (1.50:1 and 1.09:1 at p95 — effectively white-on-white). The model rendered "thin rules" as near-white bars covering most of the frame. Fixable by specifying maximum stroke luminance explicitly, but as generated they are unusable. Conversely this direction has the **best-behaved hub and empty-state assets** in the set.

---

### Direction 03 — Matchday Texture

**Rationale.** Material rather than scene. Extreme macro on the physical stuff of the game — wet grass, net cord, line paint — cropped so close that nothing identifiable survives. It is the most tactile and the most obviously "premium", and it carries the least risk of imitating a specific broadcaster because there is no scene to imitate.

- **Hub concept.** A texture band, heavily darkened, behind the masthead.
- **Competition dashboard concept.** Per-competition material and temperature.
- **Premier League.** Dry, precise net cord under cool light — clean and hard-edged.
- **Scottish Premiership.** Cold wet line paint bleeding into damp winter turf.
- **Euro 2028.** Warm dry summer turf, dust in still air, expansive falloff.
- **Empty-state style.** A single empty seat surface in deep shadow — absence expressed materially.
- **Onboarding style.** A sequence of materials, one per step.
- **Mobile cropping and text-safe areas.** Highest cropping risk of the three: macro texture has detail everywhere, so there is no reliably quiet region. Mobile crops must be generated separately with the sharp band pinned to the top edge.
- **Accessibility and performance risks.** **Three of six assets fail AA** in their nominal text-safe zone. Worse, this direction is **green-dominant**, and `--acc` green is the token that means "the user's world". A green background dilutes the one colour the design system relies on most. Photographic texture also compresses far less well than flat graphics — expect 3–5× the payload of Direction 02.

---

## 7. Asset inventory

All assets: model `z_image` (Tongyi-MAI, via Higgsfield), PNG, RGB, no seed control available, `count: 1`, no other parameters exposed. Prompts in §11.

| File | Intended use | Aspect | Dimensions |
| --- | --- | --- | --- |
| `01-floodlight/hub-desktop-floodlight.png` | Hub masthead band, desktop | 16:9 | 2048×1152 |
| `01-floodlight/hub-mobile-floodlight.png` | Hub masthead band, phone | 9:16 | 1152×2048 |
| `01-floodlight/premier-league-floodlight.png` | PL competition header | 16:9 | 2048×1152 |
| `01-floodlight/scottish-premiership-floodlight.png` | SPFL competition header | 16:9 | 2048×1152 |
| `01-floodlight/euro-2028-floodlight.png` | Euro competition header | 16:9 | 2048×1152 |
| `01-floodlight/empty-state-floodlight.png` | Empty-state backdrop | 1:1 | 2048×2048 |
| `02-broadcast-grid/hub-desktop-grid.png` | Hub masthead band, desktop | 16:9 | 2048×1152 |
| `02-broadcast-grid/hub-mobile-grid.png` | Hub masthead band, phone | 9:16 | 1152×2048 |
| `02-broadcast-grid/premier-league-grid.png` | PL competition header | 16:9 | 2048×1152 |
| `02-broadcast-grid/scottish-premiership-grid.png` | SPFL competition header | 16:9 | 2048×1152 |
| `02-broadcast-grid/euro-2028-grid.png` | Euro competition header | 16:9 | 2048×1152 |
| `02-broadcast-grid/empty-state-grid.png` | Empty-state backdrop | 1:1 | 2048×2048 |
| `03-matchday-texture/hub-desktop-texture.png` | Hub masthead band, desktop | 16:9 | 2048×1152 |
| `03-matchday-texture/hub-mobile-texture.png` | Hub masthead band, phone | 9:16 | 1152×2048 |
| `03-matchday-texture/premier-league-texture.png` | PL competition header | 16:9 | 2048×1152 |
| `03-matchday-texture/scottish-premiership-texture.png` | SPFL competition header | 16:9 | 2048×1152 |
| `03-matchday-texture/euro-2028-texture.png` | Euro competition header | 16:9 | 2048×1152 |
| `03-matchday-texture/empty-state-texture.png` | Empty-state backdrop | 1:1 | 2048×2048 |

**Retention — decided 1 August 2026.** The eighteen source PNGs totalled **64 MB**, which is not a reasonable thing to carry in git forever for research output. Four representative files were converted to WebP and retained as evidence; the rest were removed from the working tree after this document was updated. The conclusions in §8 and §10 are measurements and observations, and they survive the deletion — nothing here depends on a file that no longer exists.

Retained, in [`evidence/concepts/`](evidence/concepts/) — **296 KB combined**, longest edge 1600px:

| File | Why it is kept |
| --- | --- |
| `direction-01-floodlight-hub.webp` | representative Floodlight concept |
| `direction-02-broadcast-grid-hub.webp` | representative Broadcast Grid concept (the approved direction) |
| `direction-03-matchday-texture-hub.webp` | representative Matchday Texture concept |
| `rejected-02-broadcast-grid-purple-magenta-failure.webp` | **evidence of model inconsistency** — the purple/magenta output produced despite the prompt excluding both. Kept deliberately as the record that `z_image` did not honour written exclusions. |

`creative-source/` is now covered by a `.gitignore` rule so a future raw generation run cannot be committed by accident. Nothing was written to `public/`, `src/`, or any existing asset directory, and no existing file was overwritten.

---

## 8. Measured contrast of the text-safe zones

Every asset was measured rather than eyeballed. Relative luminance was computed per WCAG 2.x and compared against `--tx` in the dark theme (`#F2F5FB`). The sampled region is the zone each prompt was told to keep quiet: the left 55% for landscape and square assets, the bottom 65% for mobile crops. `p95` is the 95th-percentile brightest sample in that zone — the realistic worst case for a glyph, rather than a single outlier pixel.

| Asset | Zone | mean | p95 | worst |
| --- | --- | ---: | ---: | ---: |
| 01 empty-state | left 55% | 16.38 | 15.75 | 14.61 |
| 01 hub-mobile | bottom 65% | 16.63 | 13.25 | 6.54 |
| 01 hub-desktop | left 55% | 14.74 | 8.27 | 3.24 |
| 01 premier-league | left 55% | 8.07 | 4.72 | 2.35 |
| 01 scottish-premiership | left 55% | 7.06 | **2.92** | 1.07 |
| 01 euro-2028 | left 55% | 4.86 | **1.74** | 1.41 |
| 02 hub-mobile | bottom 65% | 16.60 | 16.18 | 15.89 |
| 02 hub-desktop | left 55% | 17.17 | 15.60 | 8.89 |
| 02 empty-state | left 55% | 16.21 | 15.35 | 12.45 |
| 02 scottish-premiership | left 55% | 15.76 | 14.14 | 9.47 |
| 02 premier-league | left 55% | 5.46 | **1.50** | 1.04 |
| 02 euro-2028 | left 55% | 5.35 | **1.09** | 1.09 |
| 03 hub-mobile | bottom 65% | 13.03 | 9.09 | 6.42 |
| 03 hub-desktop | left 55% | 12.59 | 8.44 | 3.47 |
| 03 empty-state | left 55% | 7.36 | 4.64 | 3.16 |
| 03 scottish-premiership | left 55% | 7.59 | **2.05** | 1.25 |
| 03 premier-league | left 55% | 7.24 | **2.88** | 1.38 |
| 03 euro-2028 | left 55% | 3.88 | **2.49** | 2.11 |

**Six of eighteen assets fail AA (4.5:1) for body text in the region they were explicitly instructed to keep quiet**, three of them at effectively white-on-white.

The pattern is consistent and worth stating plainly: **the per-competition treatments are the failure point in all three directions.** Asking for "interest on the right, quiet on the left" produced bright material spread across the whole frame in five of nine cases. The hub and empty-state assets, where the instruction was "mostly empty", behaved far better. Any implementation must either commit to a scrim as a system rule or generate competition art under a stated maximum-luminance constraint.

---

## 9. Licensing and rights review

| Check | Finding |
| --- | --- |
| Official league logos | **None present.** No mark, wordmark or device appears in any asset. |
| Official club badges | **None present.** No crest or crest-like shape. Consistent with ADR 0017 and the `ClubIdentity`-only rule. |
| Protected kit designs | **None present.** No garment, fabric or kit appears in any asset. |
| Recognisable player likenesses | **None present.** No people appear in any asset. |
| Broadcaster branding | **None present.** No score bug, lower third, or identifiable on-air look was reproduced. Direction 02 uses the *generic grammar* of sports graphics (rules, dot matrices) rather than any specific broadcaster's package. |
| Text rendered inside images | **None found** on inspection of the reviewed assets. `z_image` has no negative-prompt field, so this was steered by prose and needs re-checking on any regeneration. |
| Emoji flags | None. No flags of any kind appear. |
| National devices | None. Scottish differentiation is by weather and temperature only — no saltire, no tartan. |
| Provenance | All assets are machine-generated from text prompts recorded in §11. No reference image, no uploaded media and no third-party photograph was used as input. |

**Two caveats the owner should weigh rather than take on trust.** First, training-data provenance for `z_image` is not disclosed by the provider, so "no third-party photograph was used as input" describes *my* inputs, not the model's training corpus; that is a general and unresolved question for all generative imagery and it is not specific to this repository. Second, only a representative sample was opened and inspected pixel-by-pixel; the remaining assets were verified by the contrast analysis and their prompts, not by eye. Before any asset ships, all of it needs a full visual pass.

---

## 10. Rejected issues and artefacts

Recorded honestly, including where the tool ignored an explicit instruction.

1. **`02-broadcast-grid/hub-desktop-grid.png` — REJECT AS GENERATED.** Contains prominent **purple and magenta neon streaks** despite the prompt stating "no purple, no magenta, no neon". This violates two named exclusions in the brief simultaneously (purple gradients, neon gaming aesthetics). It is included in the folder only as evidence of the failure mode; it must be regenerated before the direction can be judged on its merits.
2. **`02-broadcast-grid/premier-league-grid.png` — near-white optical-art bars.** Clean and free of purple, but the rules render at ~90% luminance across two thirds of the frame (p95 1.50:1). It reads as Op Art, not as a restrained background, and the navy is noticeably more saturated than `--bg #0A1128`.
3. **`03-matchday-texture/hub-desktop-texture.png` — contains a white pitch line marking**, which the prompt explicitly excluded. Visually it is the most attractive asset produced; it is also busy enough to require a heavy scrim, and its green dominance conflicts with the `--acc` semantic (§6, Direction 03).
4. **`01-floodlight/hub-desktop-floodlight.png` — specular lamp head.** A literal floodlight fixture with a blown highlight. The left 55% is genuinely quiet (mean 14.74:1) but the lamp itself hits 3.24:1. Usable only if cropped to exclude the fixture, at which point it becomes a haze band — which is what the direction actually wants.
5. **Colour drift from `--bg` across the set.** Several assets sit at a more saturated blue than `#0A1128`. Any adopted direction needs a colour-grading pass to the token, not just a crop.
6. **No seed control.** `z_image` exposes no seed, so **none of these assets is reproducible**. A chosen direction cannot be regenerated consistently at other sizes on this plan. This is a genuine blocker for production use and is the strongest single argument for the plan upgrade in §12.
7. **Light theme is entirely unaddressed.** All 18 assets are dark-theme only. The brief asks for polish in both themes; a second full set, or a direction that does not need images at all, is required.

---

## 11. Prompts

Every prompt is recorded verbatim. Model `z_image` for all; `count: 1`; no other parameters were available.

<details>
<summary>Direction 01 — Floodlight</summary>

- **hub-desktop** (16:9) — "Abstract stadium floodlight atmosphere at night seen across dark empty air. Deep midnight navy base, cool white-blue floodlight bloom entering from upper right, falling away into darkness across the left. Volumetric haze, fine atmospheric grain, soft depth of field. No people, no crowd, no signage, no text, no letters, no numbers, no logos, no badges, no advertising boards. Minimal and restrained, mostly empty dark negative space at left and bottom. Muted desaturated editorial cinematic sports broadcast mood. Not glossy, not neon, no purple, no magenta, no lens flare starbursts."
- **hub-mobile** (9:16) — "Vertical crop of night stadium floodlight atmosphere. Deep midnight navy, a soft cool blue-white glow confined to the very top fifth of the frame, fading rapidly into near-black empty darkness for the lower four fifths. Volumetric haze, fine grain. No people, no crowd, no pitch, no signage, no text, no letters, no numbers, no logos, no badges. Extremely minimal, almost entirely empty dark space in the lower two thirds for interface content to sit over. Muted desaturated editorial cinematic mood. No purple, no magenta, no neon, no lens flare starbursts, no bright hotspot in the lower half."
- **premier-league** (16:9) — "Wide horizontal band of cool crisp English spring evening floodlight haze over a dark stadium void. Clean white-blue light raking from the right, faint cool green undertone in the shadows, sharp clean air with little atmospheric murk. Deep navy base. No people, no crowd, no kits, no pitch markings, no signage, no text, no letters, no numbers, no logos, no badges, no advertising boards. Restrained and minimal with a large quiet dark area across the left half. Editorial broadcast mood, muted and desaturated. No purple, no magenta, no neon, no gold, no amber."
- **scottish-premiership** (16:9) — "Cold Scottish winter night air under stadium floodlights. Blue-grey haze, fine drizzle suspended and visible in the beam, low heavy cloud, colder and damper than an English evening, slightly more atmospheric murk and mist. Deep navy base fading to near black on the left. No people, no crowd, no kits, no signage, no text, no letters, no numbers, no logos, no badges, no advertising boards, no flags. Restrained and minimal with a large quiet dark region across the left half. Editorial broadcast mood, muted and desaturated. No purple, no magenta, no neon, no gold, no amber, no tartan."
- **euro-2028** (16:9) — "Warm European summer dusk over an open stadium bowl, seen as pure atmosphere. Wide clear evening sky, deep blue upper air grading to a soft warm horizon low on the right, dry still air, very little haze, expansive and calm. Deep navy base with a large quiet dark region across the left. No people, no crowd, no kits, no signage, no text, no letters, no numbers, no logos, no badges, no advertising boards, no flags, no bunting. Restrained, minimal, editorial broadcast mood, muted and desaturated. No purple, no magenta, no neon, no saturated gold, no orange hotspot."
- **empty-state** (1:1) — "Minimal editorial line illustration on a deep navy background. Thin, even-weight cool white-blue strokes describing abstract football pitch geometry: a centre circle, a penalty arc and a few straight boundary lines, drawn incomplete and floating in empty space, as if a diagram left unfinished. Large amount of empty dark negative space around the shapes. Flat, no shading, no gradient, no glow, no perspective photograph. No people, no ball detail, no text, no letters, no numbers, no logos, no badges. Calm, quiet, restrained, technical drawing feel. No purple, no magenta, no neon, no gold, no amber."

</details>

<details>
<summary>Direction 02 — Broadcast Grid</summary>

- **hub-desktop** (16:9) — "Flat abstract graphic composition on a deep midnight navy field, in the style of a modern television sports graphics package. A precise geometric system of thin parallel rules, a fine regular dot matrix fading out, and two or three long soft horizontal motion streaks suggesting speed. Strictly flat vector-like shapes, no photography, no perspective, no three dimensional rendering, no glass, no blur panels. Very low contrast, tonal, almost monochrome navy with restrained cool blue accents. Composition weighted to the right edge leaving the left two thirds almost empty. No text, no letters, no numbers, no logos, no badges, no icons, no people. No purple, no magenta, no neon, no gold, no rainbow gradient."
- **hub-mobile** (9:16) — "Vertical flat abstract graphic on a deep midnight navy field, modern television sports graphics package style. A narrow band of thin parallel rules and a fine dot matrix occupying only the top sixth of the frame, dissolving downward into completely empty flat navy for the lower five sixths. Strictly flat vector-like shapes, no photography, no perspective, no three dimensional rendering, no glass panels. Very low contrast, tonal, almost monochrome navy with restrained cool blue accents. No text, no letters, no numbers, no logos, no badges, no icons, no people. No purple, no magenta, no neon, no gold."
- **premier-league** (16:9) — "Flat abstract graphic band on deep midnight navy, modern sports broadcast graphics style. A dense field of crisp thin vertical rules at even spacing, tightening toward the right edge, overlaid with one long clean horizontal sweep line. Precise, engineered, confident. Restrained cool white-blue accent only. Strictly flat, no photography, no perspective, no three dimensional rendering, no glass, no blur. Left two thirds almost entirely empty flat navy. No text, no letters, no numbers, no logos, no badges, no icons, no people. No purple, no magenta, no neon, no gold, no amber."
- **scottish-premiership** (16:9) — "Flat abstract graphic band on deep midnight navy, modern sports broadcast graphics style. A field of thin horizontal rules with irregular broken spacing, interrupted by a soft diagonal wash suggesting weather moving across, and a scatter of fine dots like drizzle. Cooler and greyer than crisp, slightly softer edges. Strictly flat, no photography, no perspective, no three dimensional rendering, no glass, no blur panels. Left two thirds almost entirely empty flat navy. No text, no letters, no numbers, no logos, no badges, no icons, no people, no tartan, no check pattern. No purple, no magenta, no neon, no gold, no amber."
- **euro-2028** (16:9) — "Flat abstract graphic band on deep midnight navy, modern sports broadcast graphics style. A wide radiating fan of thin rules opening outward from the right edge, suggesting a bracket or tournament tree, generous even spacing, a sense of scale and occasion. Strictly flat, no photography, no perspective, no three dimensional rendering, no glass, no blur panels. Restrained cool white-blue accent only. Left two thirds almost entirely empty flat navy. No text, no letters, no numbers, no logos, no badges, no icons, no people, no flags, no stars. No purple, no magenta, no neon, no gold, no amber."
- **empty-state** (1:1) — "Flat minimal graphic illustration on deep midnight navy. A sparse arrangement of thin cool blue rules and a small regular dot grid forming an incomplete rectangular frame floating in empty space, suggesting a table or list with nothing in it. Strictly flat vector-like, no photography, no perspective, no shading, no gradient, no glow. Large amount of empty flat navy around the shapes. No text, no letters, no numbers, no logos, no badges, no icons, no people. Calm, quiet, restrained, diagrammatic. No purple, no magenta, no neon, no gold, no amber."

</details>

<details>
<summary>Direction 03 — Matchday Texture</summary>

- **hub-desktop** (16:9) — "Extreme macro photograph of wet floodlit grass blades at night, shot so close that no pitch, no markings and no context are recognisable. Shallow depth of field, most of the frame falling into soft dark out-of-focus green-black, with a narrow band of sharp detail and cool light along the right edge. Deep desaturated cool green over near-black. Tactile, material, premium, restrained. No people, no ball, no boots, no kit fabric, no text, no letters, no numbers, no logos, no badges, no white line markings. Left two thirds soft, dark and quiet. No purple, no magenta, no neon, no gold, no vivid saturated green."
- **hub-mobile** (9:16) — "Vertical extreme macro photograph of wet floodlit grass at night, so close that no pitch or context is recognisable. A narrow band of sharp lit detail across the very top of the frame, falling away rapidly into soft dark out-of-focus green-black for the lower four fifths. Deep desaturated cool green over near-black. Tactile, material, premium, restrained. No people, no ball, no boots, no kit fabric, no text, no letters, no numbers, no logos, no badges, no white line markings. Lower two thirds must be soft, dark, quiet and free of bright detail. No purple, no magenta, no neon, no gold, no vivid saturated green."
- **premier-league** (16:9) — "Extreme macro photograph of tightly woven goal net cord under cool floodlight at night, cropped so close that the net reads only as an abstract diagonal lattice with no goal, no pitch and no context visible. Crisp white-grey cord against deep near-black negative space. Shallow depth of field, sharp detail confined to the right edge, dissolving into darkness across the left. Clean, dry, precise, premium and restrained. No people, no ball, no kit, no text, no letters, no numbers, no logos, no badges. Left two thirds dark and quiet. No purple, no magenta, no neon, no gold."
- **scottish-premiership** (16:9) — "Extreme macro photograph of cold wet painted line paint drying on dark winter turf, cropped so close that no marking shape, no pitch and no context is readable. Chalky matte white pigment bleeding into damp dark green-grey blades, tiny water droplets, cold damp light. Sharp detail confined to the right edge, dissolving into soft near-black across the left. Muted, cold, tactile, restrained. No people, no ball, no boots, no kit, no text, no letters, no numbers, no logos, no badges. Left two thirds dark and quiet. No purple, no magenta, no neon, no gold, no tartan."
- **euro-2028** (16:9) — "Extreme macro photograph of sun-warmed dry summer turf under a wide clear evening sky, cropped so close that no pitch, no markings and no context are readable. Dry fine blades, warm low side light grazing from the right, dust motes suspended in still air, generous soft out-of-focus falloff into deep shadow across the left. Warm but muted and desaturated, never orange or golden. Expansive, calm, premium. No people, no ball, no boots, no kit, no text, no letters, no numbers, no logos, no badges, no flags. Left two thirds soft, dark and quiet. No purple, no magenta, no neon, no saturated gold."
- **empty-state** (1:1) — "Extreme macro photograph of a single empty stadium seat surface in deep shadow, cropped so close that only abstract moulded plastic texture and one soft curved edge are visible, with no seat shape, no row, no stand and no context readable. Deep desaturated navy-grey material, matte, fine surface grain, one quiet highlight. Most of the frame is soft empty near-black negative space. Still, quiet, restrained, a sense of absence. No people, no ball, no kit, no text, no letters, no numbers, no logos, no badges. No purple, no magenta, no neon, no gold."

</details>

---

## 12. Recommendation

**Recommended: Direction 02 — Broadcast Grid**, with the explicit intent of implementing it **in CSS and SVG from design tokens rather than as generated images**.

The reasoning is about fit with the system that already exists, not about which picture is prettiest — Direction 03 is the prettiest and I am not recommending it.

- **It is the only direction that survives §4.2.** The design system has no imagery concept and no image-contrast rules. A token-driven geometric treatment needs none of that: it inherits `--bg`, `--line` and `--tx3`, themes itself correctly in light and dark for free, and cannot drift from `--bg` because it *is* `--bg`.
- **It solves §5 rather than fighting it.** A masthead band of rules costs nothing at 390px where there is no room for a background, and scales up on desktop without needing a second asset.
- **It is the only direction with no rights exposure at all** — no photography, no training-corpus question, nothing to clear.
- **It respects the colour law.** No green dominance to dilute `--acc`, no warm gold to collide with the joker rule.
- **It is measurably the best-behaved where it matters.** Its hub and empty-state assets scored 15.60, 16.18 and 15.35 at p95 — the top of the set.
- **Payload approaches zero** if implemented as CSS/SVG, against 3–5× for Direction 03.

Direction 01 is the natural second choice and is the better pick if the owner wants genuine atmosphere; it needs a full second asset set for the light theme and a committed scrim rule.

Direction 03 is the one to be most careful about. It looks the most premium and it carries the most risk: three AA failures, a semantic collision with `--acc` green, the largest payload, and an asset that already contains a marking the prompt excluded.

**A caveat that applies to whichever is chosen.** The generated assets in this folder are *concept evidence*, not production candidates. `z_image` gives no seed, so none of them can be reproduced or regenerated consistently at other sizes on the current plan (§10.6). If the owner wants a photographic direction (01 or 03) to actually ship, the plan needs upgrading to reach a model with seed and parameter control — which is precisely the dependency Direction 02 removes by not needing generated images at all.

---

## 13. Outcome

**Direction 02 — Broadcast Grid was approved on 1 August 2026 and is implemented**, in CSS and inline SVG from design tokens, exactly as recommended in §12. No generated image is used in the application, and none is loaded at runtime.

What followed, and where it landed:

| Follow-up from this review | Outcome |
| --- | --- |
| Add imagery rules to the design system (§4.2) | `docs/design-system.md` **§11** — masthead, decorative SVG, text-safe zones, contrast, themes, responsive, reduced motion, competition identity, empty states, generated-image and runtime-asset policy |
| Resolve or park the four conflicts in §4 | §4.1 and §4.2 resolved by the §11 rewrite and the document's rescope; §4.3 (gold) upheld unchanged; §4.4 settled by **[ADR 0021](../adr/0021-sharing-surface-priority.md)** |
| Produce a light-theme treatment (§10.7) | Not needed — the approved direction is token-derived, so both themes work from one implementation. This is the concrete payoff of choosing 02 over 01 or 03 |
| Measure against `tokenContrast` and the axe sweep | Done. The first implementation **failed AA at 4.27:1** and was fixed structurally rather than by tuning; see design-system §11.4 for the shipped measurements |

The §8 contrast table remains the record of why the image-led directions were rejected: six of eighteen generated assets failed AA in their own nominal text-safe zones. The implemented direction has no such failure mode, because there is no image behind any text.
