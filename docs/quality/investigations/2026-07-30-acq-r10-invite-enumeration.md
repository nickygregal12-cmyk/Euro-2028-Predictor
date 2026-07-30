# ACQ-R10 — league invite generation and probing, measured

**Date:** 30 July 2026
**Risk:** `ACQ-R10` — league invite generation/probing can support enumeration.
**Named mitigation:** cryptographic longer codes, preview throttling, reduced disclosure and code rotation.
**Outcome:** the risk is **real, currently unmitigated in all four respects, and gets worse in direct proportion to the platform's success.** No change is proposed here; the before-state is pinned by `tests/database-parity/inviteCodeEnumeration.test.ts`.

## What the schema does today

Read from the committed migrations, not assumed.

| Property | Current value | Where |
| --- | --- | --- |
| Generator | `random()` | `20260719180000_add_leagues.sql` |
| Alphabet | `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 chars) | same |
| Length | 6 | same |
| Keyspace | 31⁶ = **887,503,681** | derived |
| Collision handling | retry, up to 10 attempts | `20260727191942_operating_cap_enforcement.sql` |
| Preview RPC | `get_league_preview(text)`, `security definer`, `stable` | `20260719180000_add_leagues.sql` |
| Preview grant | `authenticated`, `service_role` | `20260724001500_harden_function_privileges.sql` |
| Preview throttle | **none** | — |
| Preview discloses | `id`, `name`, `member_count`, `owner_name`, `is_member` | `20260719180000_add_leagues.sql` |

## Finding 1 — the generator is not cryptographic

`gen_invite_code()` draws from `random()`. PostgreSQL documents that function as a deterministic pseudo-random generator and states it is not suitable for cryptographic purposes.

This is the least urgent of the four gaps, because exploiting PRNG predictability requires observing generator output the attacker cannot directly see. It is nonetheless the cheapest to fix: **`pgcrypto` is already installed** — `20260719120000_init_v0_1.sql` creates it for `gen_random_uuid()` — so `gen_random_bytes()` is available with no new dependency.

## Finding 2 — the keyspace is adequate now and inadequate later

887 million looks comfortable. It is not the relevant number. What matters is the probability that a *random guess hits an existing league*, and that scales with how many leagues exist:

| Leagues | Expected guesses to first hit | At 10 probes/s | At 100 probes/s |
| ---: | ---: | ---: | ---: |
| 100 | 8,875,036 | 247 hours | 24.7 hours |
| 1,000 | 887,503 | 24.7 hours | 2.5 hours |
| 10,000 | 88,750 | 2.5 hours | 15 minutes |
| 50,000 | 17,750 | 30 minutes | 3 minutes |

**The control weakens exactly as the platform succeeds.** At today's scale this is a non-issue. At the scale the multi-competition platform is being built for, a first hit is minutes of unattended probing.

Two extra characters in the same alphabet multiply the keyspace by 961, moving the 50,000-league case from three minutes to about 47 hours (roughly two days) at 100/s. Length is the cheap lever.

## Finding 3 — probing is completely unthrottled, and this is the real gap

Rate limiting exists but is implemented entirely as **triggers on table writes**. The complete surface:

| Action | Ceiling |
| --- | ---: |
| `prediction_save` | 60 |
| `league_membership` | 5 |

`get_league_preview` is a `language sql ... stable` read. No trigger fires, so no limit applies.

The asymmetry is the point: **joining a league is limited to five per window; guessing at codes is unlimited.** The throttle guards the action an honest user performs and leaves the one an attacker performs untouched.

This is the finding that should drive the mitigation order. Codes could be lengthened and still be probed freely; throttling changes the economics regardless of keyspace.

## Finding 4 — a hit discloses identity, not just existence

A correct guess returns the league name, its member count and the owner's display name. That is enough to identify a private group and its organiser, not merely to confirm a code is valid.

`is_member` is caller-scoped and correct. Member identities are not exposed — the original migration comment notes this deliberately, and it holds.

## What this does not establish

- **No live probing was performed.** Every figure above is derived from the committed schema and arithmetic; nothing was run against a hosted environment.
- **No timing analysis.** Whether a wrong code is distinguishable from a right one by response time was not measured; the `stable` SQL function makes a difference plausible but unquantified.
- **No assessment of Supabase platform-level limits.** PostgREST or gateway throttling may impose a ceiling this document cannot see. That would reduce the practical rate but is not a schema control and is not visible to these tests.
- **Code rotation** — the fourth part of the named mitigation — has no current implementation to characterise. There is no way to change a league's code, so a leaked code is permanent.

## Disposition

`ACQ-R10` stays **Open**. Nothing here mitigates it; the before-state is now pinned so the mitigation must arrive as a visible edit.

Suggested order when it is taken up, cheapest-first by risk reduction:

1. **Throttle `get_league_preview`.** Changes the economics at any keyspace, and is the only gap that is currently unbounded rather than merely weak.
2. **Lengthen the code** to 8 characters in the same alphabet, keeping the read-aloud property and the collision retry.
3. **Swap `random()` for `gen_random_bytes()`** — pgcrypto is already present.
4. **Reduce preview disclosure** or gate `owner_name` behind a successful join.
5. **Add code rotation**, so a leaked invite is recoverable.

Items 1–4 are one migration. Item 5 needs a product decision about what happens to pending invites when a code rotates.

**Sequencing note:** production is currently a contract behind (repository 64, production 63), so this should not become a second unapplied migration until that gap is closed.
