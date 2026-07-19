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

### Knockout bracket (mobile: one round at a time)
- **Round switcher:** segmented control (R16 / QF / SF / Final) with per-round progress counts ("6 of 8"); active round's label in `--acc`. All rounds always tappable — later rounds show whatever is resolvable.
- **Tie card:** header eyebrow = slot provenance ("R16 · Winner A v Runner-up C") + date + **host-nation venue flag (18×12) + venue name** (same treatment as match cards); two team rows beneath, separated by a **"v" divider** — hairline rules either side of a small muted "v" (11px, Space Grotesk) — so every tie reads as a fixture, not a list. The divider replaces the plain row border between the two teams and appears in all tie states (unpicked, picked, placeholder).
- **Team row = the button** (whole row tappable, min 44px). Unpicked: neutral rows with empty selection circles. Picked: winner gets `--acc` tint background + 3px accent left bar + check + "Through"; loser dims to 55% opacity but stays tappable to change the pick.
- **Unresolved slots** (feeding tie not yet picked): dashed empty flag placeholder + muted slot reference ("Winner R16 · Cardiff tie"). Never guessable, never blank.
- **Slot filling is visible:** when a tie is picked, the winner appears in its next-round slot immediately.
- **Cascade rule:** changing a pick with downstream dependents shows a confirm dialog stating exactly what clears ("Changing this clears 2 later picks (QF, SF). Continue?"). Cleared slots revert to placeholders. **No dialog when nothing depends on the change** — just switch. Never silently cascade; never block.
- **Auto-advance:** after a pick, smooth-scroll to the next unpicked tie in the round; after the round's last pick, advance to the next round tab. Uses jump-cut (no scroll animation) under `prefers-reduced-motion`. Auto-advance never bypasses a pending confirm dialog.
- **Champion card (Final, picked):** accent-bordered card, larger flag (38×25), 18px team name, "Your champion" eyebrow in `--acc`, trophy icon in `--acc`. **Champion is accent green — never gold** (gold is jokers only; this is the rule's proof case).
- Desktop/tablet full-wallchart view is a later-tier addition; the mobile round view is the v0.1 implementation and remains available at all sizes.

## 6. Navigation & page structure (v0.1)

**Bottom nav — 4 tabs:** Home / Predict / League / More. Active tab in `--acc` (icon + label), inactive `--tx3`, 44px min targets, Space Grotesk labels, football icon for Predict, trophy for League. Tabs are config: Leagues functionality expands the League tab at v0.5; match centre integrates at Tier 4 — no nav rebuild.

**Page map:**
- **Home** — entry status, completion %, deadline countdown, continue button (tournament-phase-aware layouts come later per original spec)
- **Predict** — the hub (below)
- **League** — overall leaderboard at v0.1; private leagues join here at v0.5
- **More** — profile, settings, theme toggle, how scoring works, sign out

**Predict hub pattern:** the Predict tab opens a checklist hub, not a direct screen. Header: title, overall progress bar (accent fill) with %, lock deadline line. Stage rows (card rows, chevron right, whole row tappable):
1. Groups A–F — status count ("36 of 36 matches predicted"), green tick icon when complete
2. Best third-placed teams — amber warning icon + "N tie(s) need your call" when tie-resolution is pending; tick when settled
3. Knockout bracket — "N of 15 winners picked"
4. Jokers — "N of 5 placed" (dedicated overview screen; jokers also placeable directly on match cards)
5. Review and submit — dimmed with lock icon until stages 1–4 complete; "Complete the steps above first"

Row icon chips: 34×34, `--chip` bg; icon colour = state (accent tick done, amber attention, muted otherwise). Same semantic colour language as the rest of the app — no new rules.

**Group predictor screen:** one group per screen, prev/next navigation between A–F, the six match cards stacked with the live predicted group table directly beneath them. Third-place and bracket are their own screens per their component specs.

### League area (Phase 2 build; live strip Phase 3)

**League tab (hub):**
- Top slot: **live match strip** when a match is in play (see below); absent otherwise
- **Overall standings card** pinned first: globe icon, "All players, everywhere," user's global rank + movement, chevron into the full table (this card is the whole tab at v0.1)
- **My leagues list**: one card per league — name (truncating), member count, "you own this" where true, user's rank in that league (accent when 1st) + movement arrow, chevron into detail
- **Create league** (primary, accent) + **Join league** (secondary) buttons beneath

**League detail page:**
- Header card: league name (truncating), member count, owner, invite code as tap-to-copy chip; share button opens native share sheet with the invite link; overflow menu (⋯) holds Leave league (confirm Modal; owners must transfer ownership or delete instead — leagues are never orphaned)
- Table header row: # | (movement) | Player | latest-matchday points (labelled e.g. "MD3") | Pts — aligned to the same grid as body rows
- **Member row (collapsed):** rank | movement arrow (accent up / red down / muted dash) | avatar initials + name (truncating, min-width: 0) | champion-pick flag (18×12) | latest points | total points. Current user's row: chip background, accent avatar, YOU chip, auto-scrolled into view on long lists
- **Member row (expanded, tap-in-place):** stat triple — Exact / Correct / Max left (accent) — plus Profile and Head to head buttons
- **No-entry members**: dimmed, "No entry", dash for latest, 0 total; before the entry deadline this state shows entry progress instead ("12/36 predicted")
- **Ranking display rule:** standard competition ranking — tied totals share the rank (1, 1, 3), rows within a tie ordered alphabetically. League tie-breakers (scoring rules §5) are applied **only for final standings** at tournament end, where the tie-break explanation is shown explicitly. Movement arrows compare shared ranks.
- **Champion-pick flag rules:** hidden before entries lock (reveal policy); dims when the picked team is eliminated

**Join flow:** invite links are primary (deep link → join screen with league preview: name, member count, owner + Join/Decline); code entry is the fallback on the join sheet. Links wrap codes — one system. Deep links survive the logged-out case: sign-up completes and returns to the pending join.

**Create flow:** name (required, length-limited) → created → immediately lands on share sheet with invite link (the post-create moment is the invite moment).

**Live match strip (Phase 3, designed now):** cyan-tinted bar, pulsing dot (reduced-motion: static), flags + live score + minute, one league-context line ("14 of 20 predicted this right"), "League view" chevron. Appears only while a match is live; simultaneous matches stack strips. Tap carries league context into the match centre (league-scoped member predictions); from the hub, lands with a league filter defaulting to the most recently viewed league. Requirement inherited by the Match Centre spec: league-scoped views reachable by deep link.

**Hostile-data design rule (applies to every page, starting here):** pages are designed and reviewed against worst-case realistic data — 20+ members, longest plausible names, tied scores, the user mid-table, non-submitters — at 360px, in both themes. Dev database is seeded with a fake mid-tournament so built pages are always reviewed populated, never empty.

**Explicitly parked:** dedicated activity tab/feed (activity is delivered ambiently via movement arrows, latest-points column, and a possible one-line "since last matchday" summary later).

### Review & submit page
- Header: title + lock deadline with time remaining
- **Checklist card**: compact mirror of the hub stages (tick / amber warning per row); incomplete rows get a "Fix ›" action deep-linking to the problem screen
- **Your tournament card**: champion hero (larger flag, "Your champion" eyebrow, accent trophy) + predicted final as one flag-v-flag line + "Full bracket ›" link
- **Awards card**: Top scorer — search picker ("Search by player or team…"), selected player as removable chip (flag + name); points value (25 pts) labelled beside the award in gold. Selection stored as a player reference; search populates when squads are confirmed — UI unchanged before/after. Group-stage goals — **derived, not entered**: shows the live sum of the user's 36 predicted scores with the caption "Calculated from your 36 predicted scores" and the up-to-40pts label; no input.
- **Submit button**: when blocked, disabled state names the blocker ("Fix 1 item to submit", lock icon); when clean, full-width accent "Submit entry" → confirm Modal → submitted state
- **Submitted state**: accent-bordered banner — "Entry submitted · You're in. Editable until [deadline]" + Share button (stub until the shareable summary exists). **Submission does not freeze the entry**: edits remain allowed until the real lock, autosaving as normal, entry stays submitted. Caption under the submit button states this before submitting too.

### Home dashboard (phase-aware)
Principle: Home is a hub — it summarises and links, never replicates other screens (no tables, no bracket, no hub checklist duplicate). Everything is one tap from here. Layout is layered, top to bottom:

**During tournament:**
1. **Stat strip** — four segments in one card: total Points | Points Today (accent) | overall rank + movement arrow | best-league position. Each segment taps through to its source screen.
2. **Today card** — cyan border while any match is live (live matches appear *inside* this card; Home has no separate live strip). One row per fixture today: live rows get pulsing dot (reduced-motion: static) + score + minute; upcoming rows show kickoff time; every row shows the user's prediction ("You said 2–1") and chevrons into the match centre.
3. **Catch-up line** — shown only when the user hasn't visited since meaningful change (last-visit timestamp): "Since you were last here: +N pts, up N places" plus the single most notable fact (a live jokered match earns a gold sparkle icon and priority). Hidden for recent visitors.
4. **League snapshot** — best/favourite league: name (truncating), position of members, gap to top, tap into detail.

**Pre-tournament, entry incomplete:** completion % progress bar + deadline countdown + "Continue predicting" primary button (Phase 1 build).

**Pre-tournament, entry complete + submitted:** submitted banner with lock countdown; champion mini-summary (flag + name) with Share button (stub until shareable summary exists); primary CTA becomes "Invite friends to your league" (accent).

**Post-tournament:** final rank, total score, league finishing positions, accuracy summary — designed at Phase 3 alongside full profiles; slot reserved.

### Profile page (Phase 2)
- **Identity header card**: avatar initials (46px circle), display name (truncating), champion pick as flag + name — **tombstone treatment when eliminated**: flag dimmed to ~45% opacity, name struck through — leagues count, and an H2H button in the header (primary action on another player's profile). Own profile (via More tab): same layout, no H2H button, edit actions instead.
- **Stat grid**: four StatCards in a row — total Points, Overall rank, Exact scores, Accuracy %.
- **Points breakdown card** (see component below).
- **View full entry row**: post-lock only — opens the player's complete entry read-only, rendered with existing components (their match cards, bracket, jokers).
- **Pre-lock state (reveal rules made visible)**: other players' profiles show only name, leagues, and entry status before entries lock; stats, breakdown, and entry are replaced by a lock-icon card explaining "Predictions and stats are hidden until entries lock on [date]."

### Points breakdown component (Phase 2; reused by profile, match centre, own points views)
- Grouped by scoring category, matching the scoring doc exactly: Group matches / Group positions / Knockout / Awards — one collapsible row per category with its subtotal (Space Grotesk, 500).
- Expanding a category lists individual score events: team flag + plain-language explanation ("Sco 2–1 Eng · exact score") + points value in accent. **Joker-doubled events** show a gold tint pill ("2× · +10") per the gold rules.
- Unscored categories show "0 · pending" in muted — never hidden.
- Total row pinned beneath, separated by a rule; the total must always equal the sum of rendered events (both derive from score_events — one source of truth).

## 7. States (every component, no exceptions)

Every screen/component ships with: empty, loading (skeleton, not spinner, for content areas), error (with retry), locked, and saved/save-failed states designed and implemented together with the happy path — never retrofitted.

## 8. Accessibility

- WCAG AA contrast in both themes (the per-theme accent/gold values exist precisely for this)
- Never colour-only signalling (bars + numbers, icons + text)
- Visible focus states on all interactive elements (2px `--acc` focus ring)
- Buttons are button elements, links are anchors — no clickable divs
- All flags get accessible labels; decorative icons aria-hidden
- prefers-reduced-motion respected for all animation
- Score inputs labelled per team ("Scotland score")

## 9. CSS architecture

- CSS Modules per component; tokens imported globally
- No Tailwind, no CSS-in-JS libraries
- Component files stay presentational: no business logic, no data fetching (per CLAUDE.md architecture rules)
