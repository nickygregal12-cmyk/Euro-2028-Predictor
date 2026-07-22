# Euro 2028 Predictor — Design System

Source of truth for all visual and interaction design. Components implement exactly this. If code and this doc disagree, the doc wins — fix the code or consciously update the doc first.

**2026-07-22 full walkthrough pass:** every surface reviewed with Nicky; stale statements synced to the built reality and eight decisions recorded inline (each marked "decided 2026-07-22"): sign-out confirm kept with updated copy · bracket un-pick = tap winner again · small-numbers honesty rule (50-player threshold) · live-score API display-only + admin-confirmed results · match-window-aware refresh + refetch-on-focus · league owner tools (regenerate + remove + transfer; no pause-invites) · display-name editing with moderation · landing-page interactive demo with keep-or-discard at /welcome · PWA basics at Phase 3 · **Predict hub re-cut** (hero + journey stepper, A–F quick-jump chips, continuous prev/next journey across all five stages) · **post-lock reveal made public** (any signed-in player can view any profile/breakdown/entry post-lock — fairness rule; co-membership no longer gates it) · **Matches tab expanded** into the during-tournament command centre (Fixtures / Tables / Bracket-as-it-stands / Stats sub-views, joker nudge) · **Predict tab morphs to "My entry" post-lock** (locked-identity hero, view-links, Jokers stays live) · **top nav + Account page** (slim app bar with theme toggle + avatar→Profile; More→Account holds highlights card, name/password/email, reminder-email toggle, danger zone incl. pre-lock-only Clear predictions) · **"How everyone called it"** (post-lock consensus page under My entry — champion race, people's final, boot consensus, most agreed/divided/trusted matches, goals spread, only-you card; exempt from small-N suppression; surfaced on Home via a 48-hour post-lock teaser card) · **Predictor Cup UI direction approved** (five screens: group, groups browser + wildcard table, live matchup, knockout/penalties, draw; gold scoped to the penalty moment within Cup surfaces) · **KO Predictor rules decided + UI direction approved** (5/3/+2-through scoring, rolling entry, global-only at launch; three screens: round-shaped home, draw-only through-toggle predict cards, honest rolling-entry standings) · **predict-flow fixes** (within-group ties resolve IN PLACE on group screens — thirds screen carries thirds ties only, amber chip + hub counts; bracket round-completion auto-jump replaced by an explicit round-complete continue card) · **spectator state** (no-entry post-lock: main predictor view-only, bonus games fully open — the latecomer's pitch) · **matchday recap card** on Home (time-boxed, self-removing) · **public invite preview** on logged-out /join/:code (anon-safe name+count endpoint) · **leaderboard neighbourhood rule** at 50+ rows.

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
- **Local timezone.** All times display in the user's local timezone (stored UTC); venue-local secondary where relevant.
- **Reveal rules (updated 2026-07-22 — post-lock is public).** Pre-lock, an entry is visible only to its owner — absolute, server-enforced (the anti-copying protection). **Post-lock, every entry is public to any signed-in player**: profile stats, points breakdown, and the full entry are viewable from any leaderboard, shared league or not — a leaderboard whose totals can't be inspected isn't fair, and frozen predictions can't be gamed by being seen. League co-membership no longer gates profile/H2H access; it only scopes league-context views (named picks grouped per league in the Match Centre).
- **Small-numbers honesty rule (decided 2026-07-22).** Anywhere the app shows an anonymous prediction distribution or a percentile, the pool being shown must contain **at least 50 players**; below that, distributions collapse to participation counts only ("18 of 20 predicted this match") and percentiles are dropped in favour of the plain rank ("16th of 34"). Rationale: under ~50 players, "anonymous" bars are trivially de-anonymisable by league mates, and "top 48%" reads as mockery. Applies to: Match Centre overall bars, post-tournament percentile hero, and any future percentile copy. Named league-scoped views are untouched (post-lock reveal to co-members is deliberate).

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

Self-hosted via `@fontsource` (Inter + Space Grotesk, latin + latin-ext, `font-display: swap`, `src/styles/fonts.css`) — moved off Google Fonts 2026-07 for CSP + render-blocking reasons; no external font requests.

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
- **Clickable:** whole card navigates to the match centre; chevron affordance on right edge. Score inputs and joker button stopPropagation. Feature-flagged via `FEATURES.matchCardNavigation` — **enabled since 2026-07-21** (the Match Centre + Matches tab shipped).
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
- Footer explainer (info icon + one line): ranking criteria and that fixture mapping follows UEFA's allocation table. This footer is where the manual tie-resolution prompt surfaces when the THIRDS ranking is unresolvable — **thirds-scope ties only (2026-07-22)**: within-group ties resolve in place on their group's predictor screen.

### Live table (Phase 3 — designed now, build later; home = Matches tab → Tables sub-view; live values come from entered results / the live-data feed — see §6 → Live data & refresh)
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
- **Un-pick rule (decided 2026-07-22):** tapping the currently-selected winner **again clears the pick** — the tie returns to the unpicked state (empty selection circles) and its next-round slot reverts to a placeholder. Same cascade-confirm applies when downstream picks depend on it; no dialog otherwise. No new UI element — the row is already the button. *(Build note: pairs with the server-side delete version-guard — audit follow-up item 6 — since un-pick is a `predicted_progression` delete.)*
- **Auto-advance (amended 2026-07-22 — round jumps were imperceptible):** after a pick, smooth-scroll to the next unpicked tie in the round (jump-cut under `prefers-reduced-motion`) — WITHIN-round behaviour unchanged. **Completing a round's last pick no longer auto-jumps**: an accent **round-complete card** appears in place — "✓ Round of 16 complete — Continue to Quarter-finals →" — and the user taps to advance, owning the transition and learning the structure. Auto-scroll never bypasses a pending confirm dialog.
- **Champion card (Final, picked):** accent-bordered card, larger flag (38×25), 18px team name, "Your champion" eyebrow in `--acc`, trophy icon in `--acc`. **Champion is accent green — never gold** (gold is jokers only; this is the rule's proof case).
- Desktop/tablet full-wallchart view is a later-tier addition; the mobile round view is the v0.1 implementation and remains available at all sizes.

## 6. Navigation & page structure

**Bottom nav — 5 tabs:** Home / Predict / **Matches** / League / More. Active tab in `--acc` (icon + label), inactive `--tx3`, 44px min targets, Space Grotesk labels, football icon for Predict, calendar for Matches, trophy for League. The 5-tab bar fits at 360px. Tabs proved to be config as designed: Matches was added (2026-07-21) and the match centre (`/match/:ref`) maps to the Matches tab with no nav rebuild.

**Top nav — app bar (decided 2026-07-22):** a slim bar on every signed-in screen. Left: the page's title/eyebrow (context, not a logo — the wordmark belongs to auth screens and the landing page). Right, 44px targets: **theme toggle** (sun/moon icon — flips dark/light in place, persisted per user; relocated from More) and the **avatar chip** (32px initials circle) — tapping it opens the user's **own Profile**. `--bg` surface, optional hairline `--line` bottom rule; never taller than it needs to be — the bottom nav remains the primary navigation, this bar is identity + theme only.

**Page map:**
- **Home** — phase-aware dashboard (see below)
- **Predict** — the hub (below)
- **Matches** — the time-shaped fixture browser (see Matches tab below); the match centre lives under this tab
- **League** — overall standings + private leagues hub
- **More** — **Games hub** (decided 2026-07-22: the bonus-games directory lives HERE — More → Games; games are surfaced contextually everywhere they matter via Home action cards, spectator pitch, and deadline nudges, so the hub is the directory, not the front door), Account (below), **How to play** (the /welcome content permanently findable + a mini-FAQ), how scoring works, and the **legal pages** when Phase 3 lands them. Theme moved to the top nav; sign-out moved into Account (decided 2026-07-22).

**Predict hub — hero + journey map (re-cut decided 2026-07-22; supersedes the flat checklist).** Pre-tournament this is the app's main page and must read like its centrepiece, not a settings list. Top to bottom:

- **Hero**: overall completion as a large accent element (ring or full-width bar with big %), the lock countdown given real visual weight ("Locks in 12 days" — Space Grotesk, not a footnote line), and — once a champion is picked — the champion's flag + name sitting in the hero as the entry's emotional anchor. Primary CTA: one big accent **Continue** button that deep-links to the **first incomplete required thing** (first unpredicted match → first unresolved tie → first unpicked winner; when everything required is done it reads "Review & submit" and goes there). Never just row chevrons.
- **Journey map**: the five stages as a **numbered vertical stepper** — steps connected by a line, each step's number chip coloured by state (accent tick = done, accent = current/next, amber = needs your call, muted = not started, Review dimmed with lock icon until steps 1–4 complete). Whole step rows tappable. Status copy per step unchanged: Groups "N of 36 predicted" · Best thirds "N tie(s) need your call" / tick · Bracket "N of 15 winners picked" · Jokers "N of 5 placed" (optional — never blocks submit) · Review "Complete the steps above first" until unlocked.
- **A–F quick-jump chips (decided 2026-07-22)**: the Groups step carries a strip of six letter chips (`--chip` bg, 34×34), each showing its own state (accent tick when its 6 matches are done, count colour otherwise; **amber when that group has an unresolved tie** — in-place resolution, see Group predictor screen), each tapping **straight into that group**. The Groups step row copy counts ties too ("36 of 36 · 1 tie needs your call"); the Best-thirds step counts only thirds-scope ties; the Continue CTA treats an unresolved tie, wherever it lives, as the first incomplete thing.

**Continuous journey (decided 2026-07-22):** every prediction screen carries persistent **prev/next across stage boundaries** — the entry is one linear flow: Groups A → F → Best third-placed → Knockout bracket (R16 → Final via the existing round switcher) → Jokers → Review. "Next" from Group F lands on Best thirds; "Back" from the bracket returns to Best thirds; and so on end-to-end. Every prediction screen shows a consistent **"Step N of 5" eyebrow** with the stage name so the user always knows where they are in the journey. The hub is the map you can drop in and out of — never a screen you're forced back through to keep moving.

**Post-lock: the Predict tab morphs into "My entry" (decided 2026-07-22).** At the lock instant the tab relabels (same nav slot, same icon — tabs are config) and the hub re-purposes from journey to identity: the hero flips from completion-and-countdown to the locked entry — champion flag + name, total points, overall rank. The stepper becomes **view-links into the user's picks**: Groups (read-only, scored match cards as results land), Bracket (your picks; the against-reality view lives in Matches → Bracket), Review summary + Share, and **"How everyone called it →"** (the post-lock consensus page — own section below). **Jokers stays fully live** — the one still-actionable stage (place/move until each match's kickoff), carrying the same unplayed-jokers nudge as the Matches tab. Nothing is removed; the tab never goes dead. Division of labour with the Matches tab per its spec: My entry = what you said; Matches = what's happening.

**Spectator state — no-entry after lock (decided 2026-07-22).** A user who signs up (or never completed an entry) after `lock_at` is a first-class citizen, not a dead end. Rules: **the Original Predictor is locked and view-only for them; bonus games are fully open to them** — every bonus game (KO Predictor, Last Man Standing, Predictor Cup; sweepstake later) has its own entry window and deadlines, so a latecomer is a spectator in the main game and a full player in the bonus games; the bonus games are precisely the latecomer's pitch. Surfaces:
- **Home (no-entry, post-lock):** honest header ("Entries locked on 9 June — but stick around"), then what they CAN do: join leagues (they appear as the already-designed "No entry" member rows), browse everything (Matches, tables, consensus page, profiles — post-lock reveal is public), and a bonus-games pitch card when any game is open or announced ("The knockout game opens 26 June — free to enter", accent CTA into the Games hub). No fake completion bars, no dead Continue button.
- **Predict tab (no-entry, post-lock):** a spectate state, not "My entry" (there's no entry to show) — the lock explainer + the same bonus-games pitch + "Browse the tournament →" into Matches.
- Everything else behaves per its own spec (leaderboards show them only in leagues they join, as no-entry rows; they never appear on the Original Predictor overall standings, which is submitted-entries only).

**Group predictor screen:** one group per screen, prev/next navigation (now part of the continuous journey above), the six match cards stacked with the live predicted group table directly beneath them. **In-place tie resolution (decided 2026-07-22):** when the group's predicted scores create a tie the automatic criteria can't separate (scoring-rules §6 step 7 — ANY positions, not just 3rd), the `TieResolver` renders directly beneath that group's table with an amber prompt ("Spain and Italy are level on everything — set the order") — the tie is resolved at the exact moment and place the user created it. The Best third-placed screen now carries ONLY thirds-ranking ties (its label finally true); previously every tie surfaced there, where a Group-B 1st/2nd tie would never be found. Third-place and bracket are their own screens per their component specs.

### League area (Phase 2 build; live strip Phase 3)

**League tab (hub):**
- Top slot: **live match strip** when a match is in play (see below); absent otherwise
- **Overall standings card** pinned first: globe icon, "All players, everywhere," user's global rank + movement, chevron into the full table. **At-scale display rule (decided 2026-07-22):** once the table exceeds ~50 rows, the full-table page renders **top 3 pinned + the user's neighbourhood** (a window of rows around them) with a "Show full table" expander — never an unwindowed wall. League tables are unaffected (leagues are human-sized by nature).
- **My leagues list**: one card per league — name (truncating), member count, "you own this" where true, user's rank in that league (accent when 1st) + movement arrow, chevron into detail
- **Create league** (primary, accent) + **Join league** (secondary) buttons beneath

**League detail page:**
- Header card: league name (truncating), member count, owner, invite code as tap-to-copy chip; share button opens native share sheet with the invite link; overflow menu (⋯) holds Leave league (confirm Modal; owners must transfer ownership or delete instead — leagues are never orphaned)
- **League owner tools (Phase 3 — decided 2026-07-22, scope: regenerate + remove + transfer; no pause-invites):** owner-only additions, all server-enforced (owner-only RPCs; the client only reflects), all confirm-gated per §7 tier 1, all using existing UI patterns:
  - **Regenerate invite code** — in the header overflow (owner only). Confirm dialog states the concrete consequence: "The current link and code stop working immediately. Anyone you've already sent them to will need the new one." New code follows the same short unambiguous alphabet; the header chip + share sheet update in place.
  - **Remove a member** — on the expanded member row, owner only: a quiet red "Remove from league" action behind a confirm that names the person ("Remove Jenna from The Boys League? They can rejoin with a valid invite."). Removal never touches their entry or overall standing — league membership only.
  - **Transfer ownership / Delete league** — already exist in the overflow; unchanged.
- Table header row: # | (movement) | Player | latest-matchday points (labelled e.g. "MD3") | Pts — aligned to the same grid as body rows
- **Member row (collapsed):** rank | movement arrow (accent up / red down / muted dash) | avatar initials + name (truncating, min-width: 0) | champion-pick flag (18×12) | latest points | total points. Current user's row: chip background, accent avatar, YOU chip, auto-scrolled into view on long lists
- **Member row (expanded, tap-in-place):** stat triple — Exact / Correct / Max left (accent) — plus Profile and Head to head buttons
- **No-entry members**: dimmed, "No entry", dash for latest, 0 total; before the entry deadline this state shows entry progress instead ("12/36 predicted")
- **Ranking display rule:** standard competition ranking — tied totals share the rank (1, 1, 3), rows within a tie ordered alphabetically. League tie-breakers (scoring rules §5) are applied **only for final standings** at tournament end, where the tie-break explanation is shown explicitly. Movement arrows compare shared ranks.
- **Champion-pick flag rules:** hidden before entries lock (reveal policy); dims when the picked team is eliminated

**Join flow:** invite links are primary (deep link → join screen with league preview: name, member count, owner + Join/Decline); code entry is the fallback on the join sheet. Links wrap codes — one system. Deep links survive the logged-out case: sign-up completes and returns to the pending join. **Public invite preview (decided 2026-07-22):** the LOGGED-OUT `/join/:code` page shows what the visitor was invited to BEFORE the sign-up ask — "You've been invited to **The Boys League** — 8 members" + Sign up to join. *(Build note: needs one anon-safe, rate-limited preview endpoint returning name + member count ONLY — never members, owner identity, or codes-by-enumeration; invalid codes get a neutral "this invite isn't valid" with no existence oracle beyond it. Migration required.)* Joining a specific thing converts better than joining an abstract app.

**Create flow:** name (required, length-limited) → created → immediately lands on share sheet with invite link (the post-create moment is the invite moment).

**Live match strip (Phase 3, designed now; score + minute from the live-data feed — see Live data & refresh below):** cyan-tinted bar, pulsing dot (reduced-motion: static), flags + live score + minute, one league-context line ("14 of 20 predicted this right"), "League view" chevron. Appears only while a match is live; simultaneous matches stack strips. Tap carries league context into the match centre (league-scoped member predictions); from the hub, lands with a league filter defaulting to the most recently viewed league. Requirement inherited by the Match Centre spec: league-scoped views reachable by deep link.

**Hostile-data design rule (applies to every page, starting here):** pages are designed and reviewed against worst-case realistic data — 20+ members, longest plausible names, tied scores, the user mid-table, non-submitters — at 360px, in both themes. Dev database is seeded with a fake mid-tournament so built pages are always reviewed populated, never empty.

**Explicitly parked:** dedicated activity tab/feed (activity is delivered ambiently via movement arrows, latest-points column, and a possible one-line "since last matchday" summary later).

### Review & submit page
- Header: title + lock deadline with time remaining
- **Checklist card**: compact mirror of the hub stages (tick / amber warning per row); incomplete rows get a "Fix ›" action deep-linking to the problem screen
- **Your tournament card**: champion hero (larger flag, "Your champion" eyebrow, accent trophy) + predicted final as one flag-v-flag line + "Full bracket ›" link
- **Awards card**: Top scorer — search picker ("Search by player or team…"), selected player as removable chip (flag + name); points value (25 pts) labelled beside the award in gold. Selection stored as a player reference; search populates when squads are confirmed — UI unchanged before/after. Group-stage goals — **derived, not entered**: shows the live sum of the user's 36 predicted scores with the caption "Calculated from your 36 predicted scores" and the up-to-40pts label; no input.
- **Submit button**: when blocked, disabled state names the blocker ("Fix 1 item to submit", lock icon); when clean, full-width accent "Submit entry" → confirm Modal → submitted state
- **Submitted state**: accent-bordered banner — "Entry submitted · You're in. Editable until [deadline]" + Share button (wired to the Shareable cards ShareSheet since 2026-07-21). **Submission does not freeze the entry**: edits remain allowed until the real lock, autosaving as normal, entry stays submitted. Caption under the submit button states this before submitting too.

### Home dashboard (phase-aware)
Principle: Home is a hub — it summarises and links, never replicates other screens (no tables, no bracket, no hub checklist duplicate). Everything is one tap from here. Layout is layered, top to bottom:

**During tournament:**
1. **Stat strip** — four segments in one card: total Points | Points Today (accent) | overall rank + movement arrow | best-league position. Each segment taps through to its source screen.
2. **Today card** — cyan border while any match is live (live matches appear *inside* this card; Home has no separate live strip). One row per fixture today: live rows get pulsing dot (reduced-motion: static) + score + minute (from the live-data feed — see §6 → Live data & refresh); upcoming rows show kickoff time; every row shows the user's prediction ("You said 2–1") and chevrons into the match centre.
3. **Catch-up line** — shown only when the user hasn't visited since meaningful change (last-visit timestamp): "Since you were last here: +N pts, up N places" plus the single most notable fact (a live jokered match earns a gold sparkle icon and priority). Hidden for recent visitors.
4. **League snapshot** — best/favourite league: name (truncating), position of members, gap to top, tap into detail.
5. **Matchday recap card (decided 2026-07-22 — time-boxed):** once a matchday is FULLY scored, a recap card sits high on Home until the next matchday's first kickoff, then self-removes: "Matchday 2 done · 12 pts · up 3 places" with a best-call line ("Best call: Sco 2–1 Eng — exact") and the joker outcome where one played (gold "Joker paid +10" / muted "Joker burned +0"). Data = `rank_history` + score events; matchday completeness reuses the rank-history rule. The natural nightly screenshot; taps into Matches → Fixtures at that matchday.
6. **"The picks are in" teaser (decided 2026-07-22 — time-boxed):** for **48 hours from the lock instant**, one extra card — eyebrow "The picks are in", a single headline stat (the most-picked champion: flag + "Spain — 8 of 20 backed them"), CTA **"How everyone called it →"** into the consensus page. Self-removing after 48h (no dismissal UI); the page stays permanently reachable via My entry and Matches → Stats. Fits the Home principle: one stat, one link, never the content itself.

**Pre-tournament, entry incomplete:** completion % progress bar + deadline countdown + "Continue predicting" primary button (Phase 1 build).

**Pre-tournament, entry complete + submitted:** submitted banner with lock countdown; champion mini-summary (flag + name) with Share button (wired — opens the tease card); primary CTA becomes "Invite friends to your league" (accent).

**Post-tournament:** final rank, total score, league finishing positions, accuracy summary — designed at Phase 3 alongside full profiles; slot reserved.

### Profile page (Phase 2)
- **Identity header card**: avatar initials (46px circle), display name (truncating), champion pick as flag + name — **tombstone treatment when eliminated**: flag dimmed to ~45% opacity, name struck through — leagues count, and an H2H button in the header (primary action on another player's profile). Own profile (via More tab): same layout, no H2H button, edit actions instead.
- **Edit display name (decided 2026-07-22; placement updated same day):** the own-profile edit action **routes to Account → Change display name** (the edit itself lives on the Account page — settings never sit on the public-shaped Profile). Validation as sign-up (1–40); **the server-side moderation trigger is the real gate** — it already fires on every name write, edits included; the client mirrors it for a friendly inline error, never enforces alone. *(Build note: ships with a review-and-expand pass on the banned-words lists — written for sign-up impersonation cases; slurs/racism terms need explicit coverage in both client policy and server trigger, kept mirrored.)*
- **Stat grid**: four StatCards in a row — total Points, Overall rank, Exact scores, Accuracy %.
- **Points breakdown card** (see component below).
- **View full entry row**: post-lock only — opens the player's complete entry read-only, rendered with existing components (their match cards, bracket, jokers).
- **Pre-lock state (reveal rules made visible)**: other players' profiles show only name, leagues, and entry status before entries lock; stats, breakdown, and entry are replaced by a lock-icon card explaining "Predictions and stats are hidden until entries lock on [date]."
- **Who can view (decided 2026-07-22 — fairness rule):** post-lock, **any signed-in player** can open any player's profile — stats, points breakdown, and full entry — regardless of shared leagues (§1 Reveal rules). **Entry points:** every leaderboard row is tappable into that player's profile — the Overall standings table and league member rows alike (the league row's expanded Profile button becomes redundant-but-harmless; the collapsed row tap can go straight there). *(Build note: requires an append-only migration redefining `get_rival_entry()` — drop the co-membership check, KEEP the post-lock check; the server remains the gate, UI hiding stays cosmetic.)*

### Account page (decided 2026-07-22 — More → Account; the private half of the profile/account split)
Profile is public (who you are, how you're doing — what others see post-lock); **Account is private** (settings and management — only ever yours). No settings appear on the public-shaped Profile page. Top to bottom:

- **Highlights card**: avatar, display name, champion mini-flag (tombstone rules apply), one-liner "112 pts · 14th overall", and "View full profile →" into `/profile` — the page opens with identity, not chores.
- **Details**: **Change display name** (single field, 1–40; the server moderation trigger is the gate, client mirrors for friendly errors — the Profile page's edit action routes HERE; supersedes the earlier on-profile placement), **Change password** (in-app for signed-in users — current password not required by Supabase but the form asks the new one twice; distinct from the logged-out reset flow), **Change email** (Supabase `updateUser` — sends a confirmation email to the new address; the row shows "pending confirmation" until clicked).
- **Preferences**: **Deadline reminder emails on/off** (default on) — this toggle must exist before the deadline-reminder emails ship (they're a Phase 2 build item; opt-out from day one is non-negotiable email etiquette).
- **Danger zone** (visually separated at the bottom, all §7 tier-1 confirms):
  - **Clear my predictions** — **pre-lock only**; wipes the entry back to empty ("This clears all 36 scores, your bracket, jokers and awards picks. Your account and leagues are untouched."). Hidden entirely post-lock. **Server-enforcement build note:** clearing is a DELETE path, and the existing lock triggers reject *writes* post-lock — the same migration must extend lock coverage to DELETEs on the prediction tables (pairs with the delete version-guard, audit follow-up item 6 — one migration covers both).
  - **Sign out** — with the decided confirm copy ("Sign out? You'll need your password to get back in — or a reset email.").
  - **Delete account + export my data** — the Phase 3 roadmap item's designed home; consequence copy spells out league memberships and leaderboard rows per the deletion policy when that lands.

### Points breakdown component (Phase 2; reused by profile, match centre, own points views)
- Grouped by scoring category, matching the scoring doc exactly: Group matches / Group positions / Knockout / Awards — one collapsible row per category with its subtotal (Space Grotesk, 500).
- Expanding a category lists individual score events: team flag + plain-language explanation ("Sco 2–1 Eng · exact score") + points value in accent. **Joker-doubled events** show a gold tint pill ("2× · +10") per the gold rules.
- Unscored categories show "0 · pending" in muted — never hidden.
- Total row pinned beneath, separated by a rule; the total must always equal the sum of rendered events (both derive from score_events — one source of truth).

### /welcome page (Phase 2 — shown once, after first sign-in, before Home)
- Single screen, no carousel. Eyebrow app title, "Welcome, [display name]" (21px display), one-line tagline ("One entry. A whole summer of bragging rights.").
- Three-step card using the app's own hub iconography (football / tournament / cards — the joker step's icon in gold per the colour law): Predict every group match ("your group tables build themselves") → Build your bracket ("all the way to your champion at Wembley") → Play your jokers, beat your mates ("Five jokers double a match's points. Join a league and settle it properly.").
- Primary CTA (accent, full width): **"Start with Group A →"** — drops straight into the group predictor, not Home.
- Quiet bottom link: **"How the scoring works →"** — opens the existing scoring page; its back action lands on Home, not back on welcome.
- Seen-tracking: `welcomed_at` on profiles (survives devices). **Marked seen on ENTRY (mount), not exit** — the mount is the one reliable event (exit paths — back button, tab close, direct nav-away — can't all be guaranteed), so entry-marking is the exactly-once guarantee; the write is idempotent and keeps first-seen. Never shown twice; content remains findable under More → How to play. Never shown to the dev user in normal flows (dev + seed users pre-stamped — no code special-casing).
- **Demo-picks card (conditional — decided 2026-07-22, with the landing-page interactive demo):** when the sign-up carries stashed demo picks (see Landing page → Interactive demo), /welcome shows one extra card at the top: "Your Group A picks from the demo are ready" with **Keep them** (accent — imports the six predictions into the new entry) / **Start fresh** (quiet — clears the stash). One-time; absent when no stash exists.

### H2H page (Phase 2 header/stats/split; graph + bracket health activate Phase 3)
- **Face-off header**: both players — avatar, name (truncating), champion flag (tombstone-dimmed if eliminated) — with the headline totals large between them ("96 – 112 · Total points").
- **Stat-vs-stat rows**: label centred, each player's value either side; the better value per row in accent on its side. Rows: Exact scores, KO picks alive, **Max still possible** (the hope metric). Extendable.
- **Rank over time graph**: both players as lines (viewer accent, rival cyan), rank axis inverted (up = better), current rank in the legend. **Scope switcher** (top-right chip): Overall by default; dropdown lists only leagues BOTH players share. Requires `rank_history` snapshots (per user per matchday) — **schema + capture landed** (`20260720180000`; capture is hooked into the recompute so it's live from the first scored result). The graph itself remains the Phase 3 build.
- **Bracket health vs real** (renders only once knockouts begin): per-player chip — champion alive (accent tick) / out (red cross), "N/8 QF picks alive" style counts — plus "Compare full brackets ›" opening both predicted brackets side by side against real results (the Phase 3 bracket-comparison surface's entry point).
- **Where you split**: plain-language agreement/disagreement strip ("You both had Scotland winning Group A" / "He had England beating France in the semi — you went the other way"). Agreements use a users icon, splits an arrows-split icon. The screenshot-to-group-chat card.
- Reveal rules apply: H2H against another player is post-lock only (pre-lock, the H2H button on profiles is hidden along with everything else). **Scope (updated 2026-07-22): global, not league-gated** — reachable from any player's profile post-lock (§1 Reveal rules); the rank-graph scope switcher still lists only leagues both players share, defaulting to Overall.

### Shareable cards (feeds the Share stubs on Review, Home, and league contexts)
Client-generated images (canvas/SVG → PNG, fixed 1080×1080) pushed through the native share sheet. Always rendered in the dark-navy poster treatment regardless of the sharer's theme. Designed to survive chat-app compression: big shapes, flags over names, high contrast, minimal fine text. No emojis; proper flags.

One renderer, three content states:
1. **Quick tease** — champion hero (large flag, name, "My champion"), predicted final line (flags-v-flags, venue + date), one derived-stat line ("89 goals predicted · 5 jokers armed"), challenge chip ("Think you know better?" + app URL). Available once a champion is picked.
2. **Full bracket** — wall-chart of the entry's knockout SURVIVORS converging from both sides (R16 winners small → QF → SF → champion huge with trophy and accent ring; flag size = predicted progression depth; flags only, champion is the only named team), plus an awards strip (Golden boot in gold treatment, Group goals derived number, URL chip). Available whenever the entry is COMPLETE — pre- or post-lock (sharing is voluntary self-disclosure; the reveal rules only protect non-consensual visibility, and copying a bracket can only tie, never beat, the copied). Header adapts: "«Name»'s entry" pre-lock; lock icon + "locked in" post-lock.
3. **During-tournament brag** — champion (tombstone treatment if eliminated), points + overall rank ("112 pts · 89th of 2,140") replacing the final line; no challenge copy.
- **League context**: shared from within a league, the header carries the league name and the URL chip becomes the league invite link — the card doubles as a recruitment poster.
- **Share moment** offers the applicable variants ("Share your champion / Share your full bracket").
- **Build**: **done (2026-07-21)** — self-contained client-side canvas renderer (`src/features/share/`), all three content states + league variant, native share / download fallback; all three entry points (Review / Home / league detail) wired via the shared `useShareModel` hook.

### Match Centre (Phase 3 — the per-fixture page)
One shared skeleton, three temporal states, two match-type variants. Skeleton top to bottom: header → score hero → your stake → what [scope] said → what it changed → points detail (PointsBreakdown for this match).

**Header**: stage + state eyebrow ("Group A · Full time" / "Round of 16 · After pens"), venue with host-nation flag. **Scope switcher chip** (top-right) when the user belongs to leagues: "This league ▾" / other leagues / Overall. Arriving via a league deep link (live strip, league detail) pre-selects that league.

**Match-type variants:**
- *Group*: exact-score stake ("You predicted 2–1" + points pill incl. joker states); consequences in table language (group position changes, best-third race entry/exit).
- *Knockout*: winner-only stake ("You had Scotland through" + progression points pill); score hero gains the AET/penalties line ("Scotland win 4–3 on penalties" — display only; the winner-call is what's scored); consequences in bracket language (your picks surviving/dying downstream; league casualties).

**"What [scope] said" — the scope rule: league scope = names, overall scope = bars.**
- *Overall*: anonymous aggregate — group matches show a scoreline distribution (bar per predicted score, counts, your row marked "N · you"); KO matches show a two-team split bar with flags. **Small-numbers honesty rule applies (§1): under 50 players in the pool, the distribution is suppressed and this block shows the participation count only.**
- *League*: named member picks — one row per member (avatar, name truncating, their pick, their points), grouped by outcome best-first (Exact accent / Right result / Wrong dimmed for groups; "Had X ✓" / "Had Y ✗" for KO). Joker pills per row: gold when paid, muted grey "+0" when burned. Current user's row highlighted. Collapsed to notable rows + "Show all N members".
- Reveal-gating: named picks and distributions are post-lock only; pre-lock, this block shows entry-status counts only ("18 of 20 have predicted this match").

**Temporal states:**
- *Before*: header + countdown; your stake editable (pre-lock) or locked chips; said-block reveal-gated per above; no consequences section.
- *During*: cyan live treatment (pulsing dot, minute — reduced-motion static); score + minute come from the **live-data feed** (§6 → Live data & refresh — display-only, never the scored result); provisional points on stakes and league rows, marked as provisional; consequences as "as it stands" projections. Until the feed exists, During renders the feed-less fallback defined in Live data & refresh.
- *After*: as mocked — confirmed points, full consequences ("What it changed"), the league schadenfreude line computed from progressions ("4 league rivals lose picks — incl. Jenna's finalist Netherlands").

**Data requirements:** per-match prediction aggregates and the league-scoped per-match member-picks query — **built** (`get_match_prediction_distribution` + `get_league_match_picks`, migration `20260721130000`, both mirroring the reveal gate; the tournament-scope gate on the league RPC was added pre-apply).

### Matches tab (5th nav slot — expanded 2026-07-22 into the during-tournament command centre)
The answer to "what's happening, and how am I doing against it". A **segmented control at the top** switches four sub-views (the fixtures list shipped 2026-07-21 becomes the first of them):

- **Fixtures** — the built list, unchanged: every fixture grouped by matchday ("Matchday 3 · Tue 14 Jun"), today auto-scrolled into view. Compact rows: flags, kickoff time (upcoming) or result (played) or cyan live treatment (dot, score, minute — from the live-data feed, §6), the user's prediction ("You said 2–1" / "You had Sco through"), points pill once scored (joker variants), joker marker, chevron → match centre. Filter chips (All · By group · My jokers) live within this sub-view.
  - **Joker nudge (decided 2026-07-22):** when the user has unplayed jokers AND playable group matches remain, a gentle dismissible line sits at the top of Fixtures — gold tint pill, quiet: "2 jokers still to play — Matchday 3 starts Friday" — tapping into the Jokers screen. Never a modal, never repeated after dismissal within the same matchday.
- **Tables** — all six groups rendered with the Live table component (Predicted / Live switcher + the "You" comparison column — that component's designed home is HERE). Live values from entered results; predicted from the user's entry; footer status line per the component spec.
- **Bracket ("as it stands")** — the projection view. Once group games are underway, the R16 auto-populates from **live standings** (the same pure domain — `resolveGroupTies` → `rankThirdPlacedTeams` → `resolveRoundOf16` — fed real results instead of predictions), displayed against the user's predicted R16 with **per-slot agree/differ marks** (accent tick = your predicted team currently holds that slot; muted diff = someone else does). Clearly labelled provisional ("As it stands after MD2") in cyan-family language until each group completes; projections harden into real fixtures as groups finish; once the KO starts, it shows real results vs the user's picks through to the final (adjacent to the H2H bracket-health concept — one visual language between them).
- **Stats** — the awards race: (1) **Group-stage goals** — running real total (sum of entered results) vs the user's derived predicted total, with the tiered-points bands visible ("You said 89 · currently 41 after 18 games"); works from day one. (2) **Top scorers** — live top-5 vs the user's golden boot pick highlighted in its position (or "outside the top 5 · 1 goal"). **Feed-dependent:** scorer data doesn't exist in manual result entry, so this card renders only once the live-data feed (§6) supplies it — hidden entirely before that, never a broken placeholder. Stats also carries a quiet link to **"How everyone called it"** (the consensus page under My entry).

Division of labour: Home = today + catch-up (glanceable); **Matches = what's happening** (browse, tables, projection, races); match centre = one fixture deep; **My entry (post-lock Predict tab) = what you said**. No duplication of group screens — they remain the group-shaped predicting view; this is the time-shaped tournament view.

### How everyone called it (post-lock consensus page — decided 2026-07-22; lives under My entry, pointed to from Matches → Stats)
The wisdom-of-the-crowd page: every entry's picks aggregated, unlocked the moment entries lock. **Entry points:** the My entry stepper link, the Matches → Stats pointer, and Home's 48-hour "The picks are in" teaser card (Home dashboard spec). **Post-lock only, server-gated** (a pre-lock version would be a copying machine — same gate pattern as `get_rival_entry`); all stats derive from existing tables via one post-lock-gated aggregate endpoint (no new schema). **Explicitly EXEMPT from the §1 small-numbers suppression** — counts are this page's entire content, nothing here pretends anonymity, and post-lock-public reveal (§1) makes that safe; the suppression rule stays scoped to percentiles and the Match Centre's anonymous bars. Cards, top to bottom:

- **The champion race** — most-picked champions, top 5 with flags + counts, the user's highlighted ("Spain ×8 · France ×5 · **Scotland ×3 — you**").
- **The people's final** — the most commonly predicted final pairing (flags-v-flags + count), vs yours.
- **Golden boot consensus** — most-picked top scorer, yours highlighted; "no pick yet" entries counted honestly.
- **Most agreed match** — the fixture where the most entries share one scoreline ("14 of 20 said England 2–0 Albania") — and **the most divided match** (the flattest distribution) beside it.
- **Most trusted match** — where the most jokers landed ("9 jokers on England v Scotland", gold treatment per the colour law).
- **Group goals spread** — highest / lowest / average guess, the user's marked on the range.
- **Only you** — the user's unique calls: teams in their bracket no other entry has at that depth, an unshared champion ("Only you have Georgia in the quarters"). The screenshot card.

Hostile-data rule applies as everywhere (ties in every count, 1-entry and 2-entry pools, longest names, 360px, both themes).

### Post-tournament Home (Phase 3 — Home's final state, from the morning after the final)
- **Final standing hero**: centred — "Euro 2028 · Final standings" eyebrow, overall finish huge ("214th"), percentile line in accent ("of 2,140 · top 10%") — most players don't win; the percentile gives every finish a story. **Small-numbers honesty rule applies (§1): under 50 players the percentile is dropped — the hero shows the plain "16th of 34".**
- **League finishes card**: one row per league — final position (accent + trophy for 1st), league name truncating, and a story line per league: where a tie-break decided anything, it's explained right here ("Level on 96 with Davie — he had more exact scores" — this is the tie-break-display requirement's home); wins get celebratory copy.
- **Champion reckoning card**: one card, two moods. Missed: dimmed flag, struck-through name, rueful copy ("You backed ~~Scotland~~. Spain won it. There's always 2032."). Called it: full-brightness flag, accent celebration.
- **Final stat strip**: Exact / Accuracy % / Best matchday / joker return in gold ("+42 · 3/5 jokers").
- **Share your tournament**: primary CTA → the brag card, final edition (peak share-propensity moment).
- **Archive close**: "Your entry, every match, and all the standings stay right here to argue over" (the app becomes an archive, never a corpse — all browsing keeps working) + "Thanks for playing. See you at the next one." (platform door ajar for future tournaments).

### Landing page (Phase 3 — the logged-out root; signed-in users route straight to Home)
Voice: "a mate built this," premium polish — personal, confident, honest. Single scroll, mobile-first, dark poster treatment.
- **Hero**: eyebrow ("UK & Ireland · Summer 2028"), headline "Call the whole Euros. Before a ball is kicked.", two-sentence pitch (scale of the boast: every match, whole bracket, one locked entry, a summer of finding out), primary CTA **"Start predicting"** (solid accent — the only solid CTA on the page), under-line "Free. No ads. Built by a fan."
- **Three beats** (persuasive, not instructional — /welcome handles instruction): 1. Score all 36 group games — tables build themselves. 2. Pick every knockout winner — champion at Wembley; five jokers double your surest matches. 3. Drag your mates into a league — every point explained, rivals' picks revealed at kickoff, all summer to argue.
- **Proof glimpses**: two real UI fragments rendered from actual components (a scored match card with gold joker pill; a leaderboard row) — demonstrating a finished product, never mockups that can drift.
- **Interactive demo — "Try it: predict Group A" (decided 2026-07-22):** sits after the three beats, before the closer. The REAL group predictor, scoped tiny: the six Group A match cards with working score inputs and the live group table building itself beneath as they type (the app's magic moment, felt rather than screenshotted). Sample fixture data; **no jokers** (one concept per demo — jokers are pitched in beat 3); no account; nothing saved server-side (picks live in browser storage only). On completing all six: the table completes and an accent CTA appears — "That's one group down. Sign up free to predict the rest." Built from the existing `MatchCard` + `GroupTable` components so it can never drift from the product. **At sign-up, the stashed picks trigger the keep-or-discard card on /welcome** (see /welcome → Demo-picks card): Keep imports them into the real entry; Start fresh clears the stash. Reuses the pending-join stash pattern.
- **Closer**: "Entries lock [date]. Get yours in." — the date is **derived from `tournaments.lock_at`**, never hardcoded copy (a tightened lock time must never make the landing page lie). + secondary CTA **"Sign up free"** (outline style — different label from the hero: the pitch sells the action, the closer makes the honest ask). During the tournament, the closer reframes live ("Matchday 3 is live — see the standings").
- **Footer**: "An independent fan project. Not affiliated with UEFA or any team." + Privacy · Terms · How scoring works (the scoring page is publicly readable — sceptics can audit the rules before signing up. **Build note: the scoring page currently lives behind auth — it needs a public route when the landing page ships.**)

### Admin panel (Phase 3 — protected ops console; fully designed, build deferred)
The operator's cockpit for running a live tournament. Not a public surface — a protected route behind the server-side admin grant (`docs/ops-admin-bootstrap.md`; RLS / SECURITY DEFINER checks are the real gate, the hidden nav is cosmetic). One shell, a left rail of sections, each a focused tool. Mobile-usable (result entry must work from a phone at a match) but density-first, not marketing-polished. Every mutating action is audit-logged (below) and, where it recomputes scores, shows the impact before commit.

**Overview** — the at-a-glance operational state: next fixtures needing a result (with "kicks off in / kicked off Nh ago" urgency), count of unresolved anomalies, entries/leagues/users totals, last recompute time + status, and any feature-flag currently off-default. Deep-links into the section that needs attention. This is the tournament-time landing tab — it answers "what needs me right now".

**Result entry** — the core tournament-time tool. Pick a fixture → enter the result (**pre-filled from the live-data feed when it exists — §6 → Live data & refresh; the admin's confirm is what commits**) → see the scoring impact *before* confirming (how many entries move, biggest rank swings, jokers paid/burned) → commit. Commit writes the result and triggers the existing delete-and-rederive recompute (`recompute_tournament_scores`) synchronously, so scores and `rank_history` update in the same transaction. **Knockout handling is explicit:** for KO fixtures the form captures 90-minute score, then optional extra-time score, then optional penalty shootout — and the *winner* is the scored quantity (scoring-rules §3), while AET/penalty detail is display-only (feeds the Match Centre "win 4–3 on penalties" line). The form refuses an ambiguous KO result (a draw with no shootout winner) so a knockout can never be committed without a resolved progression. Correction and clear reuse the same screen; because recompute is delete-and-rederive, a corrected or cleared result never double-counts (rule 5). Until this page ships, Phase 2 uses `docs/ops-result-entry.md` (SQL entry) as the interim mechanism — same trigger, same safety.

**Scoring / anomaly review** — the trust surface. Lists anything that warrants a human look before it reaches players: entries whose stored total would disagree with a fresh recompute (should be empty by construction — a non-empty list is the alarm), fixtures resulted but not yet recomputed, jokers in unexpected states, and any manual tie-resolution still pending at lock. A "recompute this tournament" action (wraps `recompute_all_scores`) with a dry-run diff first. This section exists so scoring stays *provably* recalculable and correctable, not just asserted.

**Prose specs for the remaining sections** (designed, deferred):
- **Users** — search/browse profiles; see role, entry status, league memberships, join date; grant/revoke admin (mirrors the bootstrap SQL, audit-logged); moderation actions on display names that slipped past the filter. Never exposes passwords or auth internals — reads the same `profiles` the app does.
- **Leagues** — browse every league (name, owner, member count, invite code, created); inspect membership; intervene only for support/abuse (transfer ownership of an orphaned-risk league, remove an abusive member, regenerate a leaked invite code) — each a deliberate, logged action, never routine. Respects the never-orphaned invariant already enforced at the DB.
- **Fixtures** — the tournament skeleton as data: schedule, venues, kickoff times, lock instant (`tournaments.lock_at`), matchday/round mapping. Edit is rare and pre-tournament (a venue or kickoff correction); during the tournament this is mostly read, with result entry living in its own section. Changing a kickoff or lock time is high-blast-radius (deadlines, joker commitment) and therefore confirm-gated and logged.
- **Connections** — external integrations and their health: SMTP/Resend send status, the live-score feed (planned — see §6 → Live data & refresh: display-only + admin-confirmed results), Supabase project pointer (dev vs production — the prod project `vkfnsqdyhvtwyqkisxhk` is live as of 2026-07-22). Read-only health first; any credential lives in the dashboard/env, never surfaced here.
- **Feature flags** — the runtime on/off switches the app already reads (e.g. `FEATURES.matchCardNavigation`), listed with current state and default, toggled per environment with a logged reason. The mechanism is deliberately simple (config the app reads), not a third-party flag service.
- **Audit log** — the append-only record of every admin mutation: who, what, when, before→after, and the affected entity. Read-only, filterable by actor/section/entity, and itself never editable. This is what makes every other section safe to hand to a second trusted admin: nothing an operator does is invisible. (Roadmap already lists audit logs under the Phase 3 dress-rehearsal gate.)

### KO Predictor (launch-scope bonus game — UI direction APPROVED 2026-07-22; full hostile-data 360px design pass still owed before build; FIRST bonus game in the build order)
Deliberately the lightest game: pick, lock, score, climb. Rules decided 2026-07-22 (recorded in competition-structure §4): scoring **Exact regulation score 5 · correct result 3 · "Through" bonus +2** for the right advancing team (stacks — exact + through = 7 — and pays alone when the scoreline is wrong but the team is right, e.g. predicted 2–1, finished 1–1 with your team through on pens); **rolling entry** (join before any round, earlier rounds simply unbanked); **global leaderboard only at launch** (invite-only KO competitions deferred — separate tables from day one, the code layer bolts on later); **no jokers ever** (the shared prediction store with the Predictor Cup forbids anything that distorts a raw pick). Per-match kickoff locks + per-match reveal via the shared store. Three screens:

- **KO home (round-shaped)** — game eyebrow + player count; current round as the hero: "3 of 4 predicted" card with per-match lock framing ("picks lock per match") and an accent Finish-picks CTA; fixture rows (teams, "You said 2–1 · Fra through", kickoff; missing pick = one amber nudge row, never a modal); previous rounds collapse to a one-line history card ("Your round: +23 pts · 2 exact · 6 through" ›); footer rank strip ("7th of 61 · Standings ›").
- **Predict cards** — the standard match-card anatomy (eyebrow: tie ref + kickoff + venue; score inputs) with the KO mechanic: **the "Who goes through?" two-team toggle appears ONLY when the predicted scoreline is a draw** ("Level after 90 — who goes through?"); a decisive scoreline implies the through-team with a quiet footer line ("France through · from your score") — zero extra friction on non-draws. Footer always shows the scoring reminder ("Exact 5 · Result 3 · Through +2") + save status. The through-pick renders in accent (it's the user's call, per the colour law); scored cards stack a "Through +2" pill beside the score pill so every point is explained.
- **Global standings** — the standard leaderboard components: # / player / latest-round column (e.g. "QF +12") / total; YOU row highlighted; **rolling entry shown honestly** — late joiners carry a quiet outline "from QF" tag and simply have fewer rounds banked (a latecomer can top the round while sitting low overall — the hook that makes joining late worthwhile); footer legend explains both.

### Predictor Cup (launch-scope bonus game — UI direction APPROVED 2026-07-22; full hostile-data 360px design pass still owed before build)
Rules: `docs/predictor-cup-rules.md`. Five screens prototyped in chat and approved; the direction is binding, the pixel-perfect pass happens at build. Everything reuses the existing visual language — no new components beyond composition:

- **Group screen** — the user's Cup group as a football-shaped table (side bars + position colouring exactly as real group tables: accent = qualifying, amber = wildcard race, 4th dimmed), columns # / W-D-L / PD / Pts (PF/PA behind tap where space demands), YOU row chip-highlighted, legend row, and a **next-fixture strip** (avatars, "Matchday 3 · v Jamie", real-match count + date, chevron) as the screen's action.
- **Groups browser** — the user's group PINNED first (accent border, one-line status), every other group a collapsed card (leader + pts one-liner; 3-player groups flagged amber) expanding in place to its full table; footer link to the **wildcard table** (same table language, all 3rd-placers + 3-group runners-up ranked per rules §6.3). Scales to 22 groups by browsing, never a wall.
- **Live matchup (the heart)** — face-off header with the big head-to-head prediction-points score as the hero ("14 – 11", cyan live line "2 of 4 played"), then one row per real match: result + both players' picks with points pills (Exact accent / Result outline / +0 muted), cyan "as it stands" provisional pills on live matches, and the opponent's pick for unlocked matches shown as lock-icon "Hidden until kickoff" (the reveal rule made visible). Footer states 3–1–0.
- **Knockout tie + Penalty Number moment** — escalating drama: neutral full-time card (score level, seeds as quiet "(4)" annotations — names first, always) → extra-time line (scoreline error, "9 – 9 · still level") → the **gold penalty panel**: both lanes labelled (odd/even), both numbers, the actual total large in gold, one-line verdict ("Jamie wins on penalties · off by 1 v your 2") → result chip in the rules-doc notation ("Nicky 17–17 Jamie (Jamie P)"). Below: **Your Cup run** — a simple round-by-round history list (Bye / W / L with P-marker).
- **Knockout draw** — reuses the main bracket's RoundSwitcher pattern (Playoff / R32 / R16 / QF / SF / F segmented control), a collective bye card ("Seeds 1–7 · straight to the round of 32"), seeded tie cards with the v-divider, the user's tie accent-bordered, footer noting same-group avoidance.
- **GOLD RULING (approved 2026-07-22):** the Penalty Number panel uses gold — a scoped exception to "gold = jokers only": the Cup has no jokers, so within Cup surfaces gold means the decisive penalty moment and nothing else. The app-wide law stands everywhere outside the Cup.

### Sweepstake builder (Phase 4+ bonus game — concept approved; full hostile-data 360px design pass required before build)
The classic office sweepstake as a bonus game: entrants are assigned national teams, and the entrant whose team advances furthest wins. Designed and approved in concept (two screens mocked); it still owes a full design pass before build.

- **Concept** — a sweepstake bonus game sitting under the Games hub: each entrant is allocated one or more teams; the furthest-advancing team wins the pot.
- **Team assignment** — a **seeded snake draft** (draft order reverses each round). Snake ordering keeps it fair when team quality varies, so no single entrant hoards the strongest seeds.
- **Entrants — MIXED** — registered app users **and** unregistered guest names (no account required). The organiser types guest names in; a guest exists only inside that one sweepstake.
- **Winner** — the furthest-advancing team. Tie-break = the **seed rank of the deeper-going team** (better seed wins the tie).
- **Two screens** (mocked, concept-approved):
  1. **Builder / draft setup** — the organiser creates the sweepstake, adds entrants (a registered-user picker + free-text guest names), then runs and reveals the snake draft.
  2. **Results / leaderboard** — entrant → assigned team → current status (alive / eliminated / champion), ordered by furthest progression.
- **Competition separation law applies in full** (competition-structure): entry is voluntary, never auto-enrolled; results never touch Original Predictor points; every screen states which competition it is. **Known design tension to resolve in the full pass (not now):** guest entrants stretch the law further than any other bonus game — participants who aren't users at all. How that reconciles with "which competition is this / whose entry is this" is a design-pass question.
- **Explicitly NOT specced yet** (all design-pass questions): the data model, joins/invites, edit-after-draft rules, and what happens if a guest later registers.

### Live data & refresh (app-wide — decided 2026-07-22)
How "live" works, in one place. Every live surface (Home Today card, Matches tab live rows, live match strip, live tables, Match Centre During state) reads from this model. **All phase/day/state decisions come from the tournament-context engine (`docs/architecture-and-tournament-states.md`) — no surface computes its own; the states named there (T/D/S/F) are the ones this doc's layouts bind to.**

- **Live-score API = display only. Scoring stays admin-confirmed.** A live-score feed (vendor chosen at build; free-tier cost check first — see roadmap) supplies in-play score + minute into a **separate live-data store**. It NEVER writes `matches.home_score`/`away_score` — the official result is entered/confirmed by the admin (API pre-fills the admin form; admin always confirms), and only that confirmed write triggers scoring. A flaky feed can therefore never touch the leaderboard, and the feed never interacts with the recompute pipeline. *(Prerequisite chain from the 2026-07-22 audit: the recompute advisory lock must be applied before any feed or admin panel ships.)*
- **Feed-less fallback (until the API exists):** between kickoff and the confirmed result, live surfaces show the cyan "In play" treatment with kickoff-derived copy ("In play · started 7:45pm") — no score, no minute, no provisional points. **Amended 2026-07-22 (architecture doc §4, state D4):** from kickoff + ~2h (or feed FT when a feed exists), the treatment switches to **"Full time — awaiting confirmation"** — visually distinct from live AND confirmed, provisional score where a feed supplies one, no points/movement/progression until the admin confirms. A finished match must never read as "in play" for hours. The richer during-states (score/minute/provisional) activate automatically when the feed lands.
- **Match-window-aware refresh:** the app knows every kickoff. During a live window (kickoff → result confirmed), live surfaces poll roughly every 60s; outside match windows, zero polling. **Refetch-on-focus everywhere, always** — returning to the app from another app refreshes the current screen. No websockets/realtime (deliberate; keeps the free tier honest).
- Provisional values are always visually marked as provisional (cyan family, "as it stands" language) and never persist anywhere.

### Auth screens (built Phase 1–2; documented for drift-protection)
Presentational shell + forms (previewable in `/dev/components`): `AuthScreen` — app title over a centred card on `--bg`. **Log in** (email, password, "Forgot password?" link) / **Sign up** (display name 1–40, email, password) / **Reset request** (`/auth/reset` — neutral "if an account exists" confirmation, enumeration-safe) / **Update password** (`/auth/update-password` — grace window while the recovery session resolves, success → Home, expired-link fallback). Errors surface via `Alert` in friendly copy only (`friendlyAuthError` — a raw Supabase message never reaches the user); validation mirrors the server (`validateSignUp`). Turnstile widget renders above the submit button on both forms when enabled; submit gates on a token; widget remounts after a server error (single-use tokens). Session restore shows a neutral splash — a refresh never flashes the logged-out screens.

### Deadline reminder emails (Phase 2 build item — spec)
App-voice, plain, one job: sent at **48h and 24h before lock** to accounts whose entry is incomplete or unsubmitted. Subject states the fact ("Your Euro entry locks in 24 hours — you're 62% done"). Body: one short paragraph, the completion state, a single CTA deep-linking to the **first incomplete stage** (not Home). No marketing tone, no imagery beyond the wordmark, dark-poster treatment optional but never at the cost of plain-text readability. Complete-and-submitted accounts receive nothing.

### App install — PWA basics (Phase 3 — decided 2026-07-22)
A web-app manifest + icon set so "Add to Home Screen" yields a standalone full-screen app with the "28" monogram icon and navy theme colour — restoring the original "feels like an app" goal at minimal cost. **Scope is strictly manifest + icons + standalone display.** Offline support, service workers, and push notifications stay parked (Parking Lot).

## 7. Destructive actions (app-wide principle)

Three tiers — the goal is that confirm dialogs stay rare enough to be respected:

1. **Irreversible or costly → confirm Modal.** Leave league, Submit entry, bracket cascade-clear (when dependents exist), account deletion (Phase 3), and **sign out** — kept (decided 2026-07-22) even though password reset now exists: an accidental sign-out on a phone is still a real cost. Copy updated to be honest about the recovery path: **"Sign out? You'll need your password to get back in — or a reset email."** Dialogs state the concrete consequence, never a generic "Are you sure?".
2. **Reversible → no dialog; undo-toast where re-doing isn't trivial.** Removing a joker, changing a score, changing a bracket pick with no dependents. Joker removal shows a toast "Joker removed · Undo" (few seconds); when the affected match kicks off soon, the toast states it explicitly ("Joker removed · kicks off in 12m · Undo") since commitment rules make that removal effectively final.
3. **Routine actions are never confirmed.** Over-confirming trains users to click through dialogs, which defeats tier 1.

## 8. States (every component, no exceptions)

Every screen/component ships with: empty, loading (skeleton, not spinner, for content areas), error (with retry), locked, and saved/save-failed states designed and implemented together with the happy path — never retrofitted.

## 9. Accessibility

- WCAG AA contrast in both themes (the per-theme accent/gold values exist precisely for this)
- Never colour-only signalling (bars + numbers, icons + text)
- Visible focus states on all interactive elements (2px `--acc` focus ring)
- Buttons are button elements, links are anchors — no clickable divs
- All flags get accessible labels; decorative icons aria-hidden
- prefers-reduced-motion respected for all animation
- Score inputs labelled per team ("Scotland score")

## 10. CSS architecture

- CSS Modules per component; tokens imported globally
- No Tailwind, no CSS-in-JS libraries
- Component files stay presentational: no business logic, no data fetching (per CLAUDE.md architecture rules)
