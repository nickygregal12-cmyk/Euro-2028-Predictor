# ADR 0015 — Commercial and social model

- **Status:** Accepted direction — unimplemented
- **Date:** 29 July 2026

## Context

The platform requires a revenue path to justify continued investment and to be worth anything as an asset, while the owner's settled position is that competing must always be free.

Two questions had to be separated. The **legally significant** line under the Gambling Act 2005 is paying a stake for a chance at a prize. The **commercial** question — whether the product ever charges for anything at all — is independent of it, and conflating the two would have foreclosed revenue options at no legal benefit.

Separately, an earlier planning decision adopted a durable friend-group entity spawning competition-scoped leagues. On review the abstraction's only unique payload was a cross-competition honours board, and the project's engineering rules prohibit speculative structure with no current use.

The nearest competitor, Forescore, offers per-league configurable scoring. Matching it was considered and rejected.

## Decision

**Free to play, permanently. No entry fee, no stake, no prize.** This removes Gambling Act 2005 exposure entirely.

**Private arrangements between users are outside the service, and the platform must stay outside them.**

Users will run their own paid competitions using these tools — a stake collected in a group chat, a pot settled between friends. That is their arrangement, conducted as it would otherwise be with a spreadsheet, and the platform takes no money, holds no stake and awards no prize. The regulated activity attaches to whoever operates the arrangement, which is them.

What would change that position is the platform appearing to participate. The following are therefore **permanently refused**, not deferred:

- entry-fee fields, pot or prize-value displays, payment tracking, "who has paid" indicators, or links to a payment service;
- any marketing, copy, screenshot or search term referencing stakes, pots or winnings;
- any feature whose purpose is administering money between users, however framed as a convenience.

**These will be requested, and by the most valuable users.** The managed-entrant feature is aimed at organisers, so the platform's most engaged users will disproportionately be people running paid pools, arriving with a reasonable-sounding request for "just a simple pot tracker". The refusal is recorded here in advance precisely because it is far easier to decline before that pressure exists than during it.

**The terms of service must state plainly** that the platform is free to play, takes no stakes, holds no funds and awards no prizes, and that any private arrangement between users is theirs alone and outside the service.

**Paying never affects a competitive outcome.** This principle sits alongside the separation law in `docs/competition-structure.md` and is not negotiable: no purchasable jokers, lives or Saves, no premium scoring, no paid advantage of any kind. Revenue attaches to convenience, presentation and reach — never to the result.

**Revenue is intended, from sources other than the act of competing.** In order of fit: a premium tier (ad-free, deeper statistics, custom league branding), sponsorship, and white-label licensing. General advertising is not viable below substantial scale. Betting affiliate revenue is deliberately **not** a default — it would engage gambling advertising rules, force age gating, raise the app store rating and change the product's character. Any move toward it is a separate decision requiring its own record.

**Social model: no durable group entity.** Every competition carries its own private league option, as the Original Predictor already implements, plus a "run this again" action that carries the member list into a new competition without re-inviting anyone.

**Scoring rules are identical across every competition.** No per-league customisation. Only the Last Man Standing format presets vary, and those change format rather than points — see ADR 0013.

## Consequences

- The Gambling Commission question, specialist counsel, the stricter app store review path and country-by-country restrictions all leave the critical path. This is the single largest compliance simplification available to the project.
- **A user entitlement concept should be accommodated in the competition-season schema and not built.** Retrofitting entitlements later is materially harder than leaving room for them now; building them before a premium tier exists is speculative structure.
- No durable group entity and therefore **no cross-competition honours board**. If that history later proves to be what makes a mates' competition sticky across seasons, the group may be introduced then, on evidence from the closed-cohort season. It must not be reintroduced on speculation.
- One scoring authority remains, with a single SQL-versus-TypeScript parity harness rather than one per configuration. Every leaderboard stays comparable and the rules are one page.
- Custom scoring **will** be requested by users. The answer is no, and the reasoning — comparability, one rules page, one testable authority — is stated publicly rather than hidden.
- Store privacy disclosures, terms of service and the privacy notice must reflect a free product with no prize mechanic, and the terms must carry the private-arrangements statement above.
- **The free-to-play position is also a competitive one.** Every comparable Last Man Standing operator charges an entry fee, so groups running a free office or pub competition currently use a spreadsheet or a group chat. That is a genuinely underserved audience and it fits the organiser positioning better than competing with paid operators would.
- **Its cost is the loss of a natural abuse barrier.** An entry fee is every competitor's anti-abuse mechanism as much as its business model. Free entry inherits the multiple-account exposure recorded in ADR 0013 and the risk register. Both the differentiator and the exposure follow from the same decision.
- Managed entrants remain scoped to Last Man Standing only; see ADR 0013.

## Rejected alternatives

- **Entry fees and prizes.** Rejected: engages the Gambling Act 2005, requires licensing and specialist advice, lengthens app store review considerably, and sits badly against a mates-and-family product.
- **Money-handling features for private competitions** — pot trackers, payment status, entry-fee fields. Rejected permanently, not deferred. Each individually looks like a small convenience; together they convert a prediction tool into an administrator of the arrangement, which is the distinction the platform's position depends on.
- **Policing what users do privately.** Rejected as neither possible nor desirable. The platform does not know about, endorse or facilitate private stakes; it states its position in the terms and builds nothing that assumes otherwise.
- **Never charging for anything.** Rejected as an over-correction. It confuses the legal constraint (no stake, no prize) with a commercial choice, and a product with no revenue mechanism is valued as an asset rather than on a multiple — a material difference to the project's stated objective.
- **Any paid competitive advantage.** Rejected permanently. A prediction game that sells advantage has no integrity, and the reputational damage would not be recoverable.
- **Betting affiliate revenue as a default model.** Rejected as a default, not forever. It carries the highest revenue per user and the heaviest constraints; adopting it would be a change of product identity and requires its own decision record.
- **A durable friend-group entity.** Rejected: a new abstraction whose only unique payload was an honours board that may never be exercised. Per-competition leagues plus a copy action deliver the same practical outcome at a fraction of the schema and test cost.
- **Per-league configurable scoring.** Rejected: fragments comparability across leaderboards, multiplies the rules surface and the parity test matrix, and fights the simplicity that distinguishes this product from the incumbent.
