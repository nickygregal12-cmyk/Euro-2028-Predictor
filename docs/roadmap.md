# Euro 2028 Predictor — Full Remaining Roadmap

Everything still to come, consolidated from every decision and flag across the project. Phase 1 is closed (spine built, deployed at euro28predictor.netlify.app behind real auth). This picks up from there.

This is the **full-horizon map**; `build-todo.md` is the tiered, tick-as-you-go checklist for the current tier. The two are kept in sync — this doc holds the detail and the far horizon, build-todo holds the near-term order of work.

---

## IN FLIGHT RIGHT NOW

- [x] **Component pack + seed script** — DONE. PlayerChip, StatCard, PointsBreakdown (with the `score_events` shape defined in `src/domain/tournament/scoreEvents.ts`), LeaderboardRow extended (shared `initialsOf` + champion-pick flag). Dev seed in `scripts/seed-dev/`: ~20 hostile-data test users, submitted entries, jokers, ~12 results scored through the real `calculateScore` pipeline; fail-closed + idempotent + dry-run by default.
  - *The wrinkle resolved cleanly:* scoring already existed as a pure domain pipeline, so the seed runs it directly (`scoreEntries.ts`); no results/scoring plumbing needed pulling forward.
- [ ] **Phase 1 completion note** in CLAUDE.md status (ask for it at the end of the current session)

---

## PHASE 2 — Original Predictor leagues + social layer

**Design already done:** league hub, league detail (expandable rows, shared ranks 1-1-3, alphabetical within ties, tie-breaks only at final standings), join/create/leave flows, profile page (tombstone champion treatment), points breakdown component, reveal rules.
**Design still needed:** H2H page (quick — profile pieces side by side + common-picks strip).

### Build items
- [ ] **Home dashboard build** — pre-tournament states exist; build the full layered layout (stat strip, Today card, catch-up line, league snapshot) per spec; during-tournament layers activate as data exists
- [ ] **Private leagues**: create (name → immediate share sheet), invite link primary + code fallback, join flow with league preview + decline, leave (overflow menu, confirm modal; owners must transfer or delete — no orphaned leagues)
- [ ] **Invite deep links survive logged-out**: tap link → sign up → land back in pending join
- [ ] **League detail page** per spec: header (tap-to-copy code, share sheet), member rows (collapsed/expanded), max-remaining-points calc in domain layer, entry-progress display pre-deadline, no-entry state
- [ ] **Reveal-after-lock RLS policy** — designed once, reused by all later competitions; champion flags hidden pre-lock; "view full entry" post-lock only
- [ ] **Profile pages** per spec (identity header, stat grid, points breakdown, view-full-entry, pre-lock hidden state; own profile via More tab)
- [ ] **H2H build, pass 1** (designed): face-off header, stat-vs-stat, where-you-split strip; post-lock only
- [ ] **rank_history schema** — per-user per-matchday rank snapshots; capture MUST start from the first scored result (Phase 2/3 boundary item, not retrofittable) — feeds the H2H graph and profile rank history
- [ ] **Points breakdown live** — driven by real score_events
- [ ] **Minimal admin result-entry page** — protected route, result entry with scoring-impact preview before confirm; result correction flow (tested: no double-counting on re-entry)
- [ ] **/welcome page** — post-first-signin orientation (distinct from the Phase 3 landing page): how the game works in 3 steps, first action ("Start with Group A"), don't-show-again; quick design session then build. Must exist before the single-tester test.
- [ ] **Deadline reminder emails** — "entries lock in 48h / 24h, you're N% done" to incomplete entries; requires custom SMTP, which is therefore PULLED FORWARD into this phase rather than waiting for full auth hardening. Basic implementation: scheduled function checking incomplete entries against lock time.
- [ ] **Auto-submit at lock** (decided): at the lock instant the server auto-submits any VALID never-submitted entry (scoring-rules §7); incomplete entries stay out of standings; auto-submitted entries marked internally. Implement in the lock migration/function; UI still encourages manual submit.
- [ ] **Destructive-action polish** (design-system §7): sign-out confirm modal ("You'll need your password to get back in") and joker-removal undo-toast (kickoff-aware copy when the match starts soon)
- [x] **Admin bootstrapping documented** — `docs/ops-admin-bootstrap.md`: the one-time SQL that grants the first admin role, written into an ops note in the repo — never be locked out of your own tournament. (Self-flags that the role column/value must be verified against the live schema before first use.)
- [ ] **Auth hardening** (one combined build):
  - Confirmation-aware sign-up + server-side profile creation via auth.users trigger (remove client createMyProfile) — *confirmed live incident 2026-07-20*
  - friendlyAuthError: distinguish the no-session case (currently misreports as "email in use")
  - Password reset flow (Supabase resetPasswordForEmail + two screens; "if an account exists" copy — never confirm which emails are registered)
  - Custom SMTP for auth emails (Resend/Brevo free tier) before friends test
  - Cloudflare Turnstile on sign up / log in
  - Rate limiting (auth endpoints, prediction save, league join)
  - Display-name moderation rules
  - Decide: require email verification or not
- [ ] **CI**: GitHub Actions running the test suite on every push
- [ ] **Bracket UX gap**: no way to un-pick a winner, only change — add a clear/unpick action (parked from review build)
- [ ] **Tie-breaks at final standings**: display the tie-break explanation prominently when final league standings are computed

### Phase 2 exit gates
- [ ] **Separate production Supabase project** — fresh migrations, real data; dev project keeps the test mess; Netlify env vars switch to prod project
- [ ] Auth hardening complete (esp. password reset + SMTP)
- [ ] **Single-tester entry-flow test**: ONE trusted person, run against a test script Nicky defines (sign up → full entry → join league → specific friction checkpoints), findings reported back and triaged before Phase 3. This is a friction check, not a launch — the real all-hands test is the Phase 3 dress rehearsal. **Script written: `docs/test-script.md`** (silent-observation tasks + follow-up questions + note-taking shorthand); the run + triage remain the gate.

**Testing model (three tiers):**
1. Phase 2 exit — single-tester scripted friction test (above)
2. Phase 3 exit — **full dress rehearsal**: simulated tournament with friends playing along over days — results entered, leagues moving, match centre live. This is the proper "get people to try it" moment and the effective final step before launch.
3. Spring 2028 — real launch once teams/squads are seeded.

---

## PHASE 3 — Core tournament experience

**Design needed first:** Match Centre (dedicated session, hostile-tested against seeded data) — the biggest undesigned surface.

- [ ] **Match Centre**: per-fixture pages, pre/during/post states, points explanation via PointsBreakdown, effect on table/bracket
- [ ] **League-scoped match centre views** reachable by deep link (the live-strip requirement)
- [ ] **Live match strip** on League tab + league detail (designed; cyan, pulsing dot, league-context line)
- [ ] **Matches joins nav as 5th tab** (tabs are config — no rebuild)
- [ ] **Live tables**: Predicted/Live switcher + "You" comparison column (designed)
- [ ] **H2H pass 2**: rank-over-time graph (shared-league scope switcher) + bracket-health-vs-real card + compare-full-brackets side-by-side view (all designed)
- [ ] **Full profiles extensions**: rank history (from rank_history), bracket comparisons
- [ ] **During-tournament + post-tournament Home states** live (post-tournament layout designed at this phase)
- [ ] **Results UX** — whatever the admin flow needs beyond minimal (postponements, corrections at scale)
- [ ] **Shareable cards build** (Phase 3-adjacent) — the self-contained image-generation capability now fully specced in **design-system §6 (Shareable cards)**: one 1080×1080 dark-navy renderer with three content states (quick tease / full bracket / during-tournament brag) plus a league-context recruitment-poster variant; designed to survive chat-app compression (big shapes, flags over names). The Share stubs on Review, Home, and league contexts route here. (Was "Shareable entry summary" — design is done, this is the build.)
- [ ] **Landing page** — the public front door (explain in 3 steps, Start Predicting, demo before account); needed before any public sharing
- [ ] **Independent-app disclaimer + privacy notice/terms** in footer
- [ ] **Error monitoring** (Sentry free tier or similar) — know the app broke before the group chat does; wired before the dress rehearsal
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
- [ ] **Custom domain** (optional annual cost — the one budgeted expense)
- [ ] **Backup/export process** before the tournament
- [ ] **Timezone display rule** (design principle, apply from next build onward): all times shown in the USER'S local timezone (stored UTC); venue-local time secondary where relevant; lock countdowns always local. Goes into design-system.md at next sync.

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
**Done:** all components + tables, live table, bracket, jokers, nav + Predict hub, league hub/detail/join/create, live strip, review & submit, Home (all phases sketched, pre/during specced), profile, points breakdown.
**To do:** Match Centre (Phase 3, big), shareable summary (small, anytime), post-tournament Home (Phase 3), landing page (Phase 3). — /welcome and H2H now designed; Phase 2 design shelf is COMPLETE.

## PROCESS RULES (hard-won, keep them)
1. One Claude Code session per repo at a time; prompts queue, never parallelise
2. Docs updated in chat land in the repo as the immediate next Claude Code message — never batched
3. Migrations are append-only; every new migration = manual SQL-editor apply, immediately
4. Every page designed against hostile data at 360px before build
5. Server enforces every rule; the client only reflects
6. Doc filenames: repo names, not download names (rename on drop)
7. End sessions with CLAUDE.md status + build-todo updates
