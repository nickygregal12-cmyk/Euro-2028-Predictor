# Euro 2028 Predictor — Full Remaining Roadmap

Everything still to come, consolidated from every decision and flag across the project. Phase 1 is closed (spine built, deployed behind real auth). Live at **euro28predictor.com** (primary, DNS propagating as of 2026-07-20) with **euro28predictor.netlify.app** as the working fallback — both valid. This picks up from there.

This is the **full-horizon map**; `build-todo.md` is the tiered, tick-as-you-go checklist for the current tier. The two are kept in sync — this doc holds the detail and the far horizon, build-todo holds the near-term order of work.

---

## IN FLIGHT RIGHT NOW

- [x] **Component pack + seed script** — DONE. PlayerChip, StatCard, PointsBreakdown (with the `score_events` shape defined in `src/domain/tournament/scoreEvents.ts`), LeaderboardRow extended (shared `initialsOf` + champion-pick flag). Dev seed in `scripts/seed-dev/`: ~20 hostile-data test users, submitted entries, jokers, ~12 results scored through the real `calculateScore` pipeline; fail-closed + idempotent + dry-run by default.
  - *The wrinkle resolved cleanly:* scoring already existed as a pure domain pipeline, so the seed runs it directly (`scoreEntries.ts`); no results/scoring plumbing needed pulling forward.
- [x] **Phase 1 completion note** in CLAUDE.md status — "Phase 1 is closed" recorded (v0.1 spine deployed behind real auth; the production-project split is the Phase 2 exit gate).

---

## PHASE 2 — Original Predictor leagues + social layer

**Design complete for Phase 2:** league hub, league detail (expandable rows, shared ranks 1-1-3, alphabetical within ties, tie-breaks only at final standings), join/create/leave flows, profile page (tombstone champion treatment), points breakdown component, reveal rules, H2H page (face-off header, stat-vs-stat, where-you-split). Nothing left on the design shelf — see the Design Ledger.

### Build items
- [x] **Home dashboard build** — phase-aware layout shipped (stat strip, Today card, catch-up line, league snapshot); during layers activate once results exist (`src/features/home/`; detail in build-todo)
- [x] **Private leagues**: create (name → immediate share sheet), invite link primary + code fallback, join flow with league preview + decline, leave (overflow menu, confirm modal; owners must transfer or delete — no orphaned leagues) — shipped (`src/features/leagues/`; migration `20260719180000_add_leagues.sql`)
- [x] **Invite deep links survive logged-out**: tap link → sign up → land back in pending join — shipped (`/join/:code`, pending-join stash)
- [x] **League detail page** per spec: header (tap-to-copy code, share sheet), member rows (collapsed/expanded), max-remaining-points calc in domain layer, entry-progress display pre-deadline, no-entry state — shipped (`LeagueDetailPage` + `LeagueMemberRow`; `maxRemainingPoints` in domain)
- [x] **Reveal-after-lock RLS policy** — built with H2H (`20260720170000_reveal_after_lock.sql`). `get_rival_entry()` security-definer function returns another user's entry ONLY when `now() >= lock_at` AND caller/rival share a league (the get_league_members co-membership scope). Server-enforced — refuses pre-lock even if called directly; the UI hiding is cosmetic (defense in depth). The reusable reveal path for all later competitions. Powers H2H now; wiring the other-player Profile page on it is the remaining step. (Was tracked only here, not in the auth-hardening bundle — no de-dup needed.)
- [~] **Profile pages** per spec (identity header, stat grid, points breakdown, view-full-entry, pre-lock hidden state; own profile via More tab) — **own profile shipped** (`src/features/profile/`, `/profile` via More); reuses `PointsBreakdown` unchanged. Viewing OTHER players' profiles now has a secure data path (the reveal-after-lock `get_rival_entry`, built with H2H) — wiring the other-player Profile page onto it is the remaining step; the other-player + pre-lock-hidden states are already built presentationally (`/dev/components`).
- [x] **H2H build, pass 1**: face-off header, stat-vs-stat (Exact / KO picks alive / Max still possible), where-you-split (champion + finalists); post-lock only, reached from league member rows. Domain reuses calculateScore + maxRemainingPoints (no drift); consumes the reveal endpoint above. Rank-over-time graph + bracket-health-vs-real remain **Phase 3** (H2H pass 2). (`src/features/h2h/`)
- [x] **rank_history schema** — per-user per-matchday rank snapshots (`20260720180000_add_rank_history.sql`). Capture (`capture_rank_history`) is hooked into `recompute_tournament_scores()`, so it's live from the first scored result (not retrofittable); it snapshots each fully-scored matchday insert-once (historical log). Schema-first — the H2H rank graph + profile rank history are the Phase 3 consumers. The rival's history reads via the reveal path (post-lock + co-membership), added with the graph.
- [x] **Points breakdown live** — driven by real score_events. The standalone "My points" view was **superseded by the Profile page** (which embeds the same `PointsBreakdown`): `/more/points` now redirects to `/profile`, the More nav entry was removed, and `MyPointsPage` was deleted. Scored match cards in the group predictor also show real points.
- [x] **Scoring engine completion** (§2 group positions / §3 knockout progression / §4 awards → `score_events`) — **done** (`20260721120000_scoring_positions_knockout_awards.sql`). Extends the same `recompute_tournament_scores()` delete-and-rederive pipeline as §1, in SQL (kept in-DB and atomic with the result write; no edge-function infra). §2 ports the §6 tie-breaks faithfully (`resolveGroupTies`/`calculateGroupTable`) to derive each complete group's actual order, then scores 2/correct + 5 full-order bonus. §3 derives each team's actual furthest stage from KO match participation (champion = final winner) and stacks R16 10/QF 15/SF 20/FINAL 25/CHAMPION 40 up to min(predicted, actual); jokers never apply. §4 adds `tournaments.golden_boot_player_id` (the actual top scorer, admin-set) for the 25-pt golden boot, and the tiered group-goals total (exact 40/≤5 30/≤10 20/else 0) with the predicted number DERIVED from the 36 stored scores (never stored). Each section is finality-gated (complete group / KO participation / complete group stage / actual GB set), so on partial data everything but §1 scores 0 and the recompute stays byte-identical to the reference — the seed-equality acceptance test (`tests/scripts/scoreEntries.test.ts`) still holds, with reference scenarios in `tests/domain/scoringCompletion.test.ts`. Preserves the §1 block + the `capture_rank_history()` call, so rank history now captures real snapshots. **CONFIRMED APPLIED (2026-07-21):** `20260721120000` applied to the dev DB, `recompute_tournament_scores()` + `tournaments.golden_boot_player_id` present, dev seed re-run (`--commit`) left the leaderboard unchanged (Cristiano 30, xX_Predictor_Xx 27 — matches the acceptance test, so §2/§3/§4 correctly score 0 on the incomplete seed with no §1 regression), and `rank_history` still captured (22 MD1 rows). This resolves the top-priority Phase 2 correctness item. (§2/§3/§4 non-zero output awaits a complete group / KO participants / an actual golden boot; see `docs/ops-pending-migrations.md`.)
- [x] **Result entry documented for Phase 2** — `docs/ops-result-entry.md`: how to enter / correct / clear a result via SQL, the automatic recompute (the `recompute_scores_on_result` trigger → `recompute_tournament_scores`), the manual backfill (`recompute_all_scores`), and verification queries — written from the live schema. The interim mechanism until the admin page; correction is already safe (delete-and-rederive recompute, no double-count). *(The admin result-entry **page** is deferred to Phase 3 — see there.)*
- [x] **/welcome page** — post-first-signin orientation, shown once before Home: 3-step card, "Start with Group A →", quiet scoring link. Seen-tracked on `profiles.welcomed_at` (survives devices), marked on ENTRY for an exactly-once guarantee. Dev + seed users pre-stamped so the gate never fires in dev flows (no code special-casing). `src/features/welcome/`; migration `20260720160000_add_profile_welcomed_at.sql`.
- [ ] **Deadline reminder emails** — "entries lock in 48h / 24h, you're N% done" to incomplete entries; requires custom SMTP, which is therefore PULLED FORWARD into this phase rather than waiting for full auth hardening. Basic implementation: scheduled function checking incomplete entries against lock time.
- [ ] **Auto-submit at lock** (decided): at the lock instant the server auto-submits any VALID never-submitted entry (scoring-rules §7); incomplete entries stay out of standings; auto-submitted entries marked internally. Implement in the lock migration/function; UI still encourages manual submit.
- [ ] **Destructive-action polish** (design-system §7): sign-out confirm modal ("You'll need your password to get back in") and joker-removal undo-toast (kickoff-aware copy when the match starts soon)
- [x] **Admin bootstrapping documented** — `docs/ops-admin-bootstrap.md`: the one-time SQL that grants the first admin role, written into an ops note in the repo — never be locked out of your own tournament. (Self-flags that the role column/value must be verified against the live schema before first use.)
- [x] **Auth hardening** (one combined build) — **complete**: pure-code items + SMTP + Turnstile + password reset all shipped, and the email-verification decision is now made:
  - [x] Confirmation-aware sign-up + server-side profile creation via auth.users trigger (`20260720190000`), client createMyProfile removed — *the 2026-07-20 incident fix* (no client insert to fail under no-session RLS)
  - [x] friendlyAuthError: distinguishes the no-session/RLS case from email-in-use (accurate copy, not a guess)
  - [x] Display-name moderation rules — data-driven client policy + server trigger (`20260720200000`)
  - [x] Rate limiting — app-level for prediction save (60/min) + league join (5/min) (`20260720210000`); Supabase already covers its auth endpoints
  - [x] Custom SMTP for auth emails — **done**: Resend account, domain `euro28predictor.com` purchased + verified via Cloudflare DNS, SMTP configured in Supabase Auth settings, verified live by a real password-recovery email send from the dashboard
  - [x] Password reset flow — **done**: two screens (`/auth/reset` request → neutral "if an account exists" confirmation, email-enumeration-safe; `/auth/update-password` set-new-password via the recovery session). `sendPasswordReset`/`updatePassword` in `services/supabase/auth.ts`; the reset request carries a Turnstile token (the recover endpoint is CAPTCHA-protected too). Update-password sits outside the auth gates (the recovery link is a session) with a grace window + expired-link fallback. Verified: all states in `/dev/components`, real routing, and the outgoing request threads the captcha token — full happy-path round-trip is a production check (dev CAPTCHA uses the real secret, and the real site key is domain-locked to euro28predictor.com). **Nicky, dashboard:** confirm Supabase Auth → URL Configuration allows the `/auth/update-password` redirect on **both** domains (a `https://euro28predictor.com/**` + `https://euro28predictor.netlify.app/**` wildcard covers it) — the email link uses the current origin
  - [x] Cloudflare Turnstile on sign up / log in — **fully shipped and verified live in production** (Option A: Supabase built-in CAPTCHA). Frontend widget on both forms (`data-action="turnstile-spin-v2"`, token threaded to auth calls, gated on `VITE_TURNSTILE_SITE_KEY`) **and** the Supabase-side config (site key in Netlify env, Supabase Auth → CAPTCHA enabled with the secret — the two moved together) are both confirmed working. Dev auto-login uses `VITE_TURNSTILE_DEV_TOKEN` (CF test token). **Double-render bug fixed this session:** the container's `cf-turnstile` class triggered Cloudflare's implicit auto-render on top of our explicit `render()` (looping "skipped implicit render"; Error 400020 + postMessage origin mismatch under the real domain-locked key) — fix was to drop the class (explicit render only) + a render-once ref guard. **Watch for this pattern** if Turnstile (or any script that auto-scans for a class) is embedded elsewhere: don't give the container the library's auto-render class when you also render explicitly.
  - [x] Decide: require email verification or not — **DECIDED: staying OFF for now.** At current scale (friends/casual, not public-facing growth) the sign-up-friction cost outweighs the fake-account-prevention benefit. The auth.users trigger fix (shipped) makes turning it on **safe whenever needed** — no blocker, purely a product-timing choice. **Revisit before Phase 3 / closer to launch, or sooner if junk/bot sign-ups become a real problem.**
- [ ] **CI**: GitHub Actions running the test suite on every push
- [ ] **Bracket UX gap**: no way to un-pick a winner, only change — add a clear/unpick action (parked from review build)
- [ ] **Tie-breaks at final standings**: display the tie-break explanation prominently when final league standings are computed

### Phase 2 exit gates
- [ ] **Separate production Supabase project** — fresh migrations, real data; dev project keeps the test mess; Netlify env vars switch to prod project. **Applying the full ordered migration set is part of this — see `docs/ops-pending-migrations.md` (the migration inventory + ordered prod-setup checklist + verification query). Dev is fully applied; a fresh prod project needs the whole set from scratch.**
- [x] Auth hardening complete (pure-code items, SMTP, Turnstile, password reset; email-verification decided OFF for now)
- [ ] **Single-tester entry-flow test**: ONE trusted person, run against a test script Nicky defines (sign up → full entry → join league → specific friction checkpoints), findings reported back and triaged before Phase 3. This is a friction check, not a launch — the real all-hands test is the Phase 3 dress rehearsal. **Script written: `docs/test-script.md`** (silent-observation tasks + follow-up questions + note-taking shorthand); the run + triage remain the gate. **The dev-migration prerequisite is now cleared** — as of 2026-07-21 all migrations are confirmed applied to dev (`docs/ops-pending-migrations.md`), so leagues + scoring are live and the friction test is meaningful; just re-run the dev seed `--commit` first if the DB needs repopulating.

**Testing model (three tiers):**
1. Phase 2 exit — single-tester scripted friction test (above)
2. Phase 3 exit — **full dress rehearsal**: simulated tournament with friends playing along over days — results entered, leagues moving, match centre live. This is the proper "get people to try it" moment and the effective final step before launch.
3. Spring 2028 — real launch once teams/squads are seeded.

---

## PHASE 3 — Core tournament experience

**Design needed first:** Match Centre (dedicated session, hostile-tested against seeded data) — the biggest undesigned surface.

- [~] **Match Centre**: per-fixture pages, pre/during/post states, points explanation via PointsBreakdown, effect on table/bracket — **built (pulled forward from Phase 3, 2026-07-21)**. `/match/:matchRef` (`src/features/matches/`): all 3 temporal states × group/KO variants × overall/league scope; the "what [scope] said" block is the data-sensitive part — two new SECURITY DEFINER RPCs (`get_league_match_picks` = league names, post-lock + co-membership; `get_match_prediction_distribution` = overall anonymous bars, post-lock), both mirroring the `get_rival_entry` reveal gate (migration `20260721130000`, **pending apply**). Pure domain `matchCentre.ts` (tested); presentational states in `/dev/components` (verified 360px, both themes). **During is wired-but-unfed** (no live-score source yet). **Overall-bars small-N de-anonymisation: ACCEPTED for now** (all seed/dev accounts pre-traffic) — **revisit before Phase 3 close / launch** (add a min-count suppression threshold if real users are few); dated TODO, same treatment as the email-verification decision. Live end-to-end awaits applying `20260721130000` + a working auth session.
  - [x] MatchCard chevron/navigation feature flag (`FEATURES.matchCardNavigation`) **enabled** (2026-07-21) — the group predictor's cards pass `onOpen → /match/:matchRef` now that the Match Centre + Matches tab ship
- [ ] **League-scoped match centre views** reachable by deep link (the live-strip requirement)
- [ ] **Live match strip** on League tab + league detail (designed; cyan, pulsing dot, league-context line)
- [x] **Matches tab — 5th nav slot** (2026-07-21): the time-shaped fixture browser (`src/features/matches/`) — fixtures grouped by matchday, rows with your prediction/points/joker/live + chevron → match centre, filter chips (All · By group · My jokers), auto-scroll to the current matchday. Pure tested `matchesTab.ts`; `'matches'` added to BottomNav/AppShell (5-tab bar fits 360px). Tabs were indeed config — no rebuild.
- [ ] **Live tables**: Predicted/Live switcher + "You" comparison column (designed)
- [ ] **H2H pass 2**: rank-over-time graph (shared-league scope switcher) + bracket-health-vs-real card + compare-full-brackets side-by-side view (all designed)
- [ ] **Full profiles extensions**: rank history (from rank_history), bracket comparisons
- [ ] **During-tournament + post-tournament Home states** live (post-tournament layout designed at this phase)
- [ ] **Admin panel** (moved from Phase 2; **must exist before the dress rehearsal**) — **fully designed, build deferred to Phase 3** (spec in **design-system §6 (Admin panel)**): protected ops console — Overview, Result entry (scoring-impact preview before confirm; explicit knockout ET/penalties handling — winner is scored, AET/pens display-only; correction/clear reuse the same delete-and-rederive recompute), Scoring/anomaly review, plus Users / Leagues / Fixtures / Connections / Feature flags / Audit log. Deferred from Phase 2 deliberately: build it once against the final feature set (including what the bonus games need from results) rather than accreting features onto an early version. Result correction is already safe via the delete-and-rederive recompute, and Phase 2 uses `docs/ops-result-entry.md` (SQL entry) in the meantime.
- [ ] **Results UX** — whatever the admin flow needs beyond minimal (postponements, corrections at scale)
- [~] **Shareable cards build** (Phase 3-adjacent) — **built (2026-07-21)**. Self-contained client-side image generation (`src/features/share/`): one 1080×1080 dark-navy **canvas** renderer (`renderShareCard.ts`, theme-independent, big shapes, real flags over names, no emojis) with all three content states (quick tease / full bracket funnel / during-tournament brag incl. tombstone) + the league-recruitment header/chip. Flags are bundled same-origin SVGs so the canvas isn't tainted (`toBlob` → valid PNG verified). `ShareSheet` = the share moment (variant switcher + live preview + native-share-with-file / download fallback). Pure `shareModel.ts` (variant availability, stat/brag/chip formatting, flag-size-by-depth; 10 tests). **Wired: the Review "Share your entry" stub** (was "coming soon"). All states in `/dev/components` (both themes, 360px). **Still to wire:** the Home submitted-banner + league-context Share entry points (the model already supports the league variant).
- [ ] **Landing page** — the public front door (explain in 3 steps, Start Predicting, demo before account); needed before any public sharing
- [ ] **Independent-app disclaimer + privacy notice/terms** in footer
- [ ] **Error monitoring** (Sentry free tier or similar) — know the app broke before the group chat does; wired before the dress rehearsal
- [ ] **Analytics** — Plausible (free tier) at Phase 3; privacy-friendly, no cookie banner required
- [ ] **Account deletion + data export** — legal right to erasure; policy for what deletion means for league memberships, leaderboard rows, and (later) duel history; button in More, alongside the privacy notice
- [ ] **E2E tests (Playwright)** for critical journeys; staging environment; audit logs; accessibility pass
- [ ] **Full dress rehearsal (testing tier 2)** — simulate the entire competition start to finish with friends playing along: entries in, results entered over days, ties, a result correction, leagues and match centre live. The real "people try it" moment; launch-blocking.

---

## PHASE 4 — Bonus Games platform

- [ ] Shared Bonus Games hub at More → Games (/games): per-game entry status, deadlines, current round, score/survival
- [ ] Optional-entry framework: registration, deadlines, independent participant pools, game status/history, admin management
- [ ] Separation law enforced throughout: entering anything is always voluntary; nothing auto-enrols; bonus results never touch Original Predictor points; every screen states which competition it is

## PHASE 5 — KO Predictor
- [ ] Separate optional game once real knockout fixtures known; own registration, predictions, points, standings, per-match kickoff locks; global + invite-only KO competitions; never merged with Original scores

## PHASE 6 — Last Man Standing
- [ ] Separate entry + player pool, round deadlines, survival/elimination states, previous-selection history, dedicated competitions via the Games hub

## PHASE 7 — Fan Duels (staged)
1. Competition entry (4/8/16/32/64 brackets, byes defined pre-draw)
2. Random draw (transparent, published, locked after; audit trail; admin redraw only pre-predictions)
3. Knockout bracket (mobile round-by-round)
4. Round-based prediction sets (rounds aligned to EURO match periods, configurable; both players answer the same set; hidden until lock)
5. Duel scoring (live provisional + confirmed)
6. Advancement / elimination
7. Tie-breaks (defined before competition starts; never invented after)
8. Final + champion state
9. Fan Duels profile stats (duel record, championships, rivalry record)
10. Optional direct-challenge mode (secondary; never affects organised brackets)
- Dedicated data structures throughout — never an extension of league_members

---

## STANDING DATA/OPS ITEMS (no phase — do when triggered)

- [ ] **Real teams into seed data** once Euro 2028 qualifying completes (Dec 2026 draw onward); host slots: Wales A1, England B1, NI D1, ROI E1, Scotland F1 if qualified
- [ ] **Verify tournament-structure doc against final UEFA 2028 regulations** when published — esp. the 15-combination third-place allocation table (banner in the doc until done)
- [ ] **Players table population** once squads confirmed (golden-boot search goes live; UI already final)
- [ ] **Per-matchday kickoff times** after the 2027 schedule announcement
- [ ] **Free-tier ceilings check** before real users: know the Supabase/Netlify limits and the user count where £0 stops
- [x] **Custom domain** (the one budgeted expense) — **`euro28predictor.com` purchased** (Cloudflare registrar) and set as the **primary** custom domain in Netlify, DNS auto-provisioned via the Netlify/Cloudflare integration. Supabase Auth Site URL + Redirect URLs updated to include both `euro28predictor.com` and `euro28predictor.netlify.app` (the latter kept as a working fallback). `.com` is canonical going forward; both domains resolve to the same deploy. **DNS propagation pending as of 2026-07-20** (was returning `DNS_PROBE_FINISHED_NXDOMAIN` — expected during propagation, not a bug; can take up to ~24h). *If `euro28predictor.com` still isn't resolving after ~2026-07-24, investigate — otherwise it's just pending propagation.*
- [ ] **Backup/export process** before the tournament
- [x] **Timezone display rule** — now a design-system §1 principle: all times in the user's local timezone (stored UTC); venue-local secondary where relevant; lock countdowns always local.

---

## PARKING LOT (explicitly deferred, revisit only if demanded)
- Activity tab/feed (activity stays ambient: movement arrows, latest column, possible "since last matchday" line)
- Native apps, push notifications, chat/social feeds, avatar uploads
- Automated live-score API (manual admin entry is the design; API may prefill later but admin always confirms)
- Additional scoring modes; public user-created competitions
- Magic links, social logins, MFA
- Full PWA treatment (worth revisiting at Phase 3 — "feels like an app" was an original goal)

---

## DESIGN LEDGER (what's designed vs not)
**ALL surfaces designed — ledger zero.** Every screen in the app now has a spec in `design-system.md`. The final additions that cleared the shelf: **Match Centre** (§6), **Matches tab** (§6), **Shareable cards** (§6), **Landing page** (§6), **Post-tournament Home** (§6) — with /welcome and H2H designed earlier. Design is no longer a blocker on any build: every remaining item in this roadmap is implementation, not design.

## PROCESS RULES (hard-won, keep them)
1. One Claude Code session per repo at a time; prompts queue, never parallelise
2. Docs updated in chat land in the repo as the immediate next Claude Code message — never batched
3. Migrations are append-only; every new migration = manual SQL-editor apply, immediately
4. Every page designed against hostile data at 360px before build
5. Server enforces every rule; the client only reflects
6. Doc filenames: repo names, not download names (rename on drop)
7. End sessions with CLAUDE.md status + build-todo updates
