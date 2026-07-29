# Competition Structure — Original Predictor & Bonus Games

Source of truth for how competitions relate. The core law: **the Original Predictor and Bonus Games are fully separate competitions.** Shared user accounts and shared tournament data are the only common ground.

Platform-wide competition-season and opt-in authority: [ADR 0011](adr/0011-multi-competition-platform.md). Season Last Man Standing and Cup formats are governed by [ADR 0013](adr/0013-last-man-standing-season-rules.md) and [ADR 0014](adr/0014-predictor-cup-season-formats.md); commercial and social constraints are governed by [ADR 0015](adr/0015-commercial-and-social-model.md).

---

## 1. Separation law

- The **Original Predictor** is the main game and the only competition connected to the standard overall/private-league system.
- Bonus Games (**KO Predictor**, **Last Man Standing** and **Predictor Cup**) each require **separate, voluntary entry**. Joining an Original Predictor league never enrols anyone in a Bonus Game; entering one Bonus Game never enrols anyone in another.
- Bonus-game points never alter Original Predictor points, and Bonus Game standings never appear as tabs inside Original Predictor league pages.
- Every competition view must clearly identify the competition being shown.
- Bonus Games use dedicated platform tables: `bonus_competitions`, `bonus_competition_windows`, `bonus_window_fixtures`, `bonus_competition_entrants`, `bonus_score_events` and `bonus_competition_audit`. The earlier `entries.entry_type` plan is abandoned; `entries` belongs to the Original Predictor alone.
- Raw knockout scoreline predictions are collected once in `bonus_knockout_predictions` and read by the KO Predictor and Predictor Cup. Group-stage Cup scoring reads the user's submitted Original Predictor scorelines. Raw predictions can be shared; entries, scoring and standings remain separate.

## 2. Navigation and catalogue

- The shipped primary navigation is Home / Predict / Matches / League / More.
- **League** is permanently Original Predictor only.
- **Bonus Games lives at More → Bonus Games (`/games`)**.
- Per-game surfaces are:
  - `/games/knockout` — shared knockout prediction form;
  - `/games/ko-predictor` — KO Predictor standings;
  - `/games/lms` — Last Man Standing selection/history;
  - `/games/cup` — Predictor Cup group, ties, bracket and honours.
- The canonical three game cards remain visible even when hosted catalogue rows are missing. Hosted publication controls registration, windows and fixtures; absence of configuration must not silently erase a delivered feature.
- The repeatable production catalogue source is `scripts/bonus-games/publish-catalogue.sql`. It creates three published competition records, 14 LMS/Cup windows and 102 fixture links, without creating entrants, predictions, draws, scores or results.
- Registration opening instants are an operational decision. Newly configured production rows remain visible with `registration_opens_at = null` until the owner deliberately opens them.

## 3. Original Predictor private leagues

League pages include the league name, invite link/code, owner, members, rankings, movement, latest/total points, accuracy indicators, predicted champion, secure profile links and H2H actions. Original Predictor leagues never auto-enrol members into Bonus Games.

## 4. Bonus Games

### KO Predictor

Implemented through contracts 49–52. Optional rolling-entry game for real knockout fixtures. One regulation-time scoreline per match plus a “who goes through?” pick when a draw is predicted. Scoring: **Exact 5 · Result 3 · Through +2**. Through points stack and can pay alone. No jokers. Global standings only at launch.

### Last Man Standing

Implemented at contract 53. One pick per platform round, changeable until the round deadline. Group picks must win; knockout picks must advance. Each team can be used once. No pick means elimination at settle. Official corrections re-derive outcomes. A whole-round wipeout voids the round so a winner remains possible.

### Predictor Cup

Implemented through contracts 54–60. Transparent draw into groups, three head-to-head group matchdays, qualification with the §5.2 mini head-to-head and wildcards, banded seeding, playoff/byes, fixed knockout bracket, Extra-Time Accuracy, parity-laned Penalty Numbers, walkovers, champion and Golden Predictor. Full rules remain in `docs/predictor-cup-rules.md`.

## 5. Delivery sequence

`docs/roadmap.md` is the only live execution sequence.

- **Original Predictor foundation:** delivered.
- **Original Predictor leagues/social comparison:** delivered first production cut.
- **Core tournament experience:** delivered first production cut; remaining post-lock and secondary states are current work.
- **Bonus Games platform:** delivered.
- **KO Predictor:** delivered.
- **Last Man Standing:** delivered.
- **Predictor Cup:** delivered.
- **Fan Duels direct challenge, Shield/Plate and Sweepstake concepts:** parked/non-launch-blocking unless explicitly reopened.

## 6. Guardrails

1. Original Predictor leagues and Bonus Games are never modelled as the same competition.
2. Scoring, entries and score events always remain competition-specific.
3. Predicted and real brackets never blend.
4. Other-player reveal/privacy rules remain server-enforced.
5. Hosted catalogue absence must produce an honest unavailable/not-open state, not silent feature disappearance.
6. No Bonus Game registration opens in production without a deliberate owner decision and recorded opening instant.
