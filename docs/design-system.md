# Euro 2028 Predictor — Design System

Source of truth for all visual and interaction design. Components implement exactly this. If code and this doc disagree, the doc wins — fix the code or consciously update the doc first.

---

## 1. Principles

- **One system, two themes.** Dark ("Night broadcast") is the default; light ("Daylight clean") is the option. Identical layout, spacing, and structure — only token values change between themes. Theme choice is a user setting, persisted per user.
- **Every colour comes from a token.** No raw hex anywhere in component CSS. This is what makes two themes cost the same as one.
- **Colour carries meaning consistently app-wide:**
  - **Accent green** = the user's world: predictions, actions, saved state, qualification
  - **Amber** = third-place / best-third race / caution
  - **Cyan** = live, real tournament data (never used for user actions)
  - **Gold** = jokers, exclusively. Nothing else may use gold.
  - **Red** = errors and elimination only
- **No emojis anywhere in the UI.** Icons are SVG only (Tabler icons or equivalent outline set).
- **Real flags, never emoji flags.** Use the `flag-icons` library (MIT) for all national flags. Flags render at 3:2 ratio, 2-3px corner radius, 1px hairline outline in `--line` so white-heavy flags (England) don't dissolve into light backgrounds.
- Mobile-first. Every component is designed at 360px width first.

## 2. Tokens

Defined in `src/styles/tokens.css` as CSS custom properties on `:root` (dark default) and `[data-theme="light"]`. Summary:

| Token | Purpose | Dark | Light |
|---|---|---|---|
| `--bg` | Page background | `#0A1128` | `#F7F5F0` |
| `--card` | Card surface | `#101E3E` | `#FDFCFA` |
| `--line` | Borders, dividers | `#26355C` | `#E5E2DA` |
| `--tx` | Primary text | `#F2F5FB` | `#1C1B16` |
| `--tx2` | Secondary text | `#9AA6C2` | `#6B6759` |
| `--tx3` | Muted text, labels | `#7E8BA8` | `#8A8677` |
| `--acc` | Accent green (actions, qualify, saved) | `#22E06C` | `#0F6E56` |
| `--amb` | Amber (third place, caution) | `#F0B429` | `#BA7517` |
| `--cyn` | Cyan (live data) | `#38C8E8` | `#0E7C9C` |
| `--red` | Errors, elimination | `#F06A5E` | `#B3382C` |
| `--gold` | Jokers only | `#E8C34A` | `#C99A1F` |
| `--gold-contrast` | Text on solid gold | `#2B2410` | `#2B2410` |
| `--gold-tint` | Gold pill/tint background | `#2B2410` | `#F7EDD0` |
| `--mut` | Muted bars, disabled | `#2A3757` | `#D8D4C8` |
| `--chip` | Chip/static-input background | `#1A2B52` | `#EFEDE4` |
| `--input-bg` | Score input background | `#12203F` | `#FFFFFF` |

**Gold rule:** gold text never sits directly on card backgrounds for interactive elements. Gold ships as solid-fill-with-`--gold-contrast`-text (calls to action) or tint-with-border pill (status). This is a hard rule; it exists because outline-only gold failed visibility review.

## 3. Typography

Loaded via Google Fonts (self-host later if needed for performance).

- **Display — Space Grotesk (400, 500):** team names, all numbers (scores, points, positions), headings, section labels, buttons
- **Body — Inter (400, 500):** supporting text, descriptions, footnotes
- Section labels/eyebrows: 10-11px, uppercase, letter-spacing 0.08em, `--tx3`, Space Grotesk
- Weights: 400 and 500 only. Hierarchy comes from size and colour, not heavier weights.
- Minimum font size 11px. Body 14px. Score inputs 19px. Result hero score 24px.

## 4. Spacing & shape

- Card radius 14px; inputs/chips 9px; pills 20px (full round)
- Card padding 14-16px; card border 1px `--line` (1.5px `--gold` when joker active)
- Base spacing unit 4px; common gaps 8/10/12px
- Side bars in tables: 4px wide, 24px tall, 2px radius
- Tap targets minimum 44x44px (score inputs are exactly 44x44)

## 5. Components

### Score input
- 44x44px, centred, 19px Space Grotesk 500
- 1.5px `--acc` border in **both** themes (equal prominence — this is the primary action on prediction screens)
- `inputmode="numeric"` for mobile keyboards
- Locked variant becomes a static chip: `--chip` background, `--line` border, `--tx2` text, not focusable

### Match card
Anatomy: eyebrow row (group + matchday | date + venue-flag + venue), team row (flag, name, score inputs, name, flag), footer row (status left, joker right).

**Lifecycle states (all must be implemented):**
1. **Editable** — accent-bordered inputs; footer shows save status ("Saving…" / green tick "Saved" / red "Save failed — retry")
2. **Locked** (entry deadline passed) — inputs become static chips; lock icon replaces venue in eyebrow; footer shows kickoff countdown
3. **Scored** — real result becomes the hero (24px), user's prediction moves to quiet footer text ("You predicted 2 – 1"), points pill on the right explains the award: "Exact score +5" (accent), "Result +3" (accent), "+0" (muted). With joker: "Exact score · joker 2x · +10" in gold tint pill.
- **Clickable:** whole card navigates to the match centre (Tier 4); chevron affordance on right edge. Score inputs and joker button stopPropagation. In v0.1, chevron and navigation are simply not rendered — same component, feature-flagged.
- Venue flag: small (18x12) host-nation flag beside venue name.

### Joker (group-stage matches only)
- **Counter** (predict screens, always visible): five gold dots — filled = used, outline = remaining — plus "N left"
- **Play joker** (available): solid `--gold` fill, `--gold-contrast` text, pill, cards icon. Remains available/active on locked cards until that match's kickoff — gold signals "still actionable" inside otherwise-locked UI.
- **Joker on** (active): tint pill (`--gold-tint` bg, `--gold` border+text) — status, deliberately quieter than the CTA. Card border goes 1.5px gold.
- **Committed** (match kicked off): joker fuses into the points pill; card keeps gold border permanently.
- Gold is used for nothing else in the app.

### Group table
- Row grid: position | side bar | flag | team | Pl | GD | Pts
- Position colour + side bar: `--acc` for 1st-2nd, `--amb` for 3rd, `--tx3`/`--mut` for 4th (colour never the only signal — bar + number pair up)
- 4th-place row dimmed (reduced opacity on flag, muted text)
- Legend row beneath: green = qualify, amber = best-third race
- Numbers in Space Grotesk; Pts column 500 weight

### Best third-placed table
- Same row anatomy as group table plus a **group-letter chip** (22x22, `--chip` bg, Space Grotesk) — the group letter drives R16 allocation, so it's first-class information here
- Positions 1-4: accent number + bar. **Elimination line** between 4th and 5th: thin `--red` rule with small uppercase "Elimination line" label
- Positions 5-6: dimmed, muted bars
- Footer explainer (info icon + one line): ranking criteria and that fixture mapping follows UEFA's allocation table. This footer is also where the manual tie-resolution prompt surfaces when the ranking is unresolvable.

### Live table (Tier 4 — designed now, build later)
- Same anatomy as group table with: cyan pulsing live dot in header; segmented **Predicted / Live** switcher on the card; a **"You"** column showing per-team delta vs the user's prediction (green tick = position correct; amber arrow + "2nd" etc = where they'd predicted); footer status line ("France v Italy in play · table updates at full time")
- Live dot uses CSS animation — must respect `prefers-reduced-motion: reduce` (static dot, no pulse)
- Cyan = real data, only ever real data

## 6. States (every component, no exceptions)

Every screen/component ships with: empty, loading (skeleton, not spinner, for content areas), error (with retry), locked, and saved/save-failed states designed and implemented together with the happy path — never retrofitted.

## 7. Accessibility

- WCAG AA contrast in both themes (the per-theme accent/gold values exist precisely for this)
- Never colour-only signalling (bars + numbers, icons + text)
- Visible focus states on all interactive elements (2px `--acc` focus ring)
- Buttons are button elements, links are anchors — no clickable divs
- All flags get accessible labels; decorative icons aria-hidden
- prefers-reduced-motion respected for all animation
- Score inputs labelled per team ("Scotland score")

## 8. CSS architecture

- CSS Modules per component; tokens imported globally
- No Tailwind, no CSS-in-JS libraries
- Component files stay presentational: no business logic, no data fetching (per CLAUDE.md architecture rules)
